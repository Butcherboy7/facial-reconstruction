"""FastAPI backend. Run: uvicorn app:app --port 8000"""
import json, time, uuid, pathlib, datetime, base64
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import db, engine, matching, photoreal
from concurrent.futures import ThreadPoolExecutor
from schema import STEPS, REQUIRED
from prompt import build_prompt, short_prompt

ROOT = pathlib.Path(__file__).parent
DATA = ROOT / "data"
OUT = DATA / "out"
OUT.mkdir(exist_ok=True)
db.init()

app = FastAPI(title="Witness-Guided Facial Reconstruction (academic prototype)")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/files", StaticFiles(directory=DATA), name="files")

SAME_ID_REF = 0.363  # OpenCV-documented cosine threshold for SFace; reference only, NOT an identification claim


def url(rel): return "/files/" + rel.replace("\\", "/")


def save(case_id, img, name, ext="jpg"):
    d = OUT / case_id; d.mkdir(exist_ok=True, parents=True)
    f = f"{name}_{uuid.uuid4().hex[:6]}.{ext}"
    cv2.imwrite(str(d / f), img, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return f"out/{case_id}/{f}"


def load(rel): return cv2.imread(str(DATA / rel.replace("/files/", "")))


def get_case(cid):
    c = db.q("SELECT * FROM cases WHERE id=?", (cid,), one=True)
    if not c: raise HTTPException(404, "case not found")
    return c


# ---------- startup: embed reference database ----------
def index_refs():
    if not matching.AVAILABLE: return
    have = {r["id"] for r in db.q("SELECT id FROM refs")}
    for f in sorted((DATA / "refs").glob("*.jpg")):
        if f.stem in have: continue
        e = matching.embed(cv2.imread(str(f)))
        if e is not None:
            db.ins("INSERT INTO refs(id,path,embedding,note) VALUES(?,?,?,?)", (f.stem, f"refs/{f.name}", e.tobytes(), "synthetic demo reference"))
index_refs()


# ---------- meta ----------
@app.get("/api/schema")
def schema(): return {"steps": STEPS, "required": REQUIRED}


@app.get("/api/status")
def status():
    return {"generation": "studio", "matching": "real" if matching.AVAILABLE else "demo",
            "matching_model": "SFace (OpenCV) + YuNet detector", "references": db.q("SELECT COUNT(*) n FROM refs", one=True)["n"],
            "three_d": "studio", "photoreal": photoreal.enabled()}


# ---------- cases ----------
class CaseIn(BaseModel):
    name: str; date: str = ""; location: str = ""; investigator: str = ""
    incident_type: str = ""; description: str = ""; notes: str = ""


@app.post("/api/cases")
def create_case(c: CaseIn):
    n = db.q("SELECT COUNT(*) n FROM cases", one=True)["n"] + 1
    cid = f"CASE-{datetime.date.today():%Y%m%d}-{n:03d}"
    db.ins("INSERT INTO cases(id,name,date,location,investigator,incident_type,description,notes,created) VALUES(?,?,?,?,?,?,?,?,?)",
           (cid, c.name, c.date, c.location, c.investigator, c.incident_type, c.description, c.notes, time.time()))
    return get_case(cid)


@app.get("/api/cases")
def list_cases(): return db.q("SELECT id,name,date,location,investigator,incident_type,status,final_image,created FROM cases ORDER BY created DESC")


@app.get("/api/cases/{cid}")
def case_detail(cid: str):
    c = get_case(cid)
    c["profile"] = json.loads(c["profile"] or "{}")
    c["final_image"] = url(c["final_image"]) if c["final_image"] else None
    vs = db.q("SELECT * FROM versions WHERE case_id=? ORDER BY n", (cid,))
    for v in vs:
        v["profile"] = json.loads(v["profile"]); v["candidates"] = json.loads(v["candidates"])
        for k in v["candidates"]: k["url"] = url(k["path"])
    assets = db.q("SELECT * FROM assets WHERE case_id=? ORDER BY id", (cid,))
    for a in assets: a["meta"] = json.loads(a["meta"] or "{}"); a["url"] = url(a["path"])
    ss = db.q("SELECT * FROM searches WHERE case_id=? ORDER BY id DESC LIMIT 1", (cid,))
    s = None
    if ss:
        s = ss[0]; s["results"] = json.loads(s["results"]); s["stages"] = json.loads(s["stages"]); s["query_url"] = url(s["query_path"])
        for r in s["results"]: r["url"] = url(r["path"])
    return {"case": c, "versions": vs, "assets": assets, "search": s}


class ProfileIn(BaseModel):
    profile: dict


@app.put("/api/cases/{cid}/profile")
def save_profile(cid: str, b: ProfileIn):
    get_case(cid)
    db.q("UPDATE cases SET profile=? WHERE id=?", (json.dumps(b.profile), cid))
    return {"ok": True, "prompt": build_prompt(b.profile)}


# ---------- client-rendered 3D Face Studio output ----------
def decode_img(data_url):
    raw = base64.b64decode(data_url.split(",", 1)[1])
    im = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if im is None: raise HTTPException(400, "bad image")
    return im


class RenderIn(BaseModel):
    case_id: str; profile: dict; images: list[str]; seeds: list[int]; parent: int | None = None; changes: dict | None = None


def finish(im, desc):
    """optional photo-real pass; falls back to the 3D render if disabled, failed, or the result has no valid face"""
    meta = {"photoreal": False}
    if photoreal.enabled():
        out, err = photoreal.enhance(im, desc)
        v = engine.validate(out) if out is not None else None
        if out is not None and v and v.get("face_detected"):
            meta.update({"photoreal": True, "source": "3D render + AI image model"}); im = out
        else:
            meta["photoreal_error"] = err or "no face in result"
    meta["validation"] = engine.validate(im)
    return im, meta


@app.post("/api/upload-version")
def upload_version(b: RenderIn):
    """Store candidate renders produced by the in-browser 3D Face Studio as a new immutable version."""
    get_case(b.case_id)
    prompt = build_prompt(b.profile)
    n = (db.q("SELECT MAX(n) m FROM versions WHERE case_id=?", (b.case_id,), one=True)["m"] or 0) + 1
    cands = []
    ims = [decode_img(d) for d in b.images]
    outs = list(ThreadPoolExecutor(4).map(lambda im: finish(im, short_prompt(b.profile)), ims))
    for i, (sd, (im, meta)) in enumerate(zip(b.seeds, outs)):
        meta.update({"seed": sd, "jitter": 0 if i == 0 else 1})
        cands.append({"index": i, "path": save(b.case_id, im, f"v{n}_c{i}"), "meta": meta})
    vid = db.ins("INSERT INTO versions(case_id,n,profile,prompt,mode,candidates,selected,created) VALUES(?,?,?,?,?,?,?,?)",
                 (b.case_id, n, json.dumps(b.profile), prompt, "studio", json.dumps(cands), None, time.time()))
    db.q("UPDATE cases SET profile=? WHERE id=?", (json.dumps(b.profile), b.case_id))
    return {"id": vid, "n": n, "prompt": prompt, "mode": "studio", "parent": b.parent, "changes": b.changes}


class AssetIn(BaseModel):
    case_id: str; kind: str; label: str; image: str; meta: dict = {}; profile: dict = {}


class PreviewIn(BaseModel):
    profile: dict; image: str


@app.post("/api/preview-photo")
def preview_photo(b: PreviewIn):
    """photo-real preview of the current 3D face (not stored)"""
    if not photoreal.enabled(): raise HTTPException(503, "Photo-real is off: add a free Cloudflare token to backend/.env")
    im, meta = finish(decode_img(b.image), short_prompt(b.profile))
    if not meta["photoreal"]: raise HTTPException(502, "Photo-real failed: " + str(meta.get("photoreal_error", "unknown")))
    ok, buf = cv2.imencode(".jpg", im, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return {"image": "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()}


@app.post("/api/upload-asset")
def upload_asset(b: AssetIn):
    get_case(b.case_id)
    im, m = finish(decode_img(b.image), short_prompt(b.profile) if b.profile else b.label)
    return add_asset(b.case_id, b.kind, b.label, save(b.case_id, im, b.kind), {**b.meta, "photoreal": m["photoreal"]})


# ---------- generation ----------
def make_version(cid, profile, seed):
    prompt = build_prompt(profile)
    n = (db.q("SELECT MAX(n) m FROM versions WHERE case_id=?", (cid,), one=True)["m"] or 0) + 1
    t0 = time.perf_counter()
    gens = engine.generate(profile, prompt, n=4, seed=seed)
    cands = []
    for i, g in enumerate(gens):
        meta = g["meta"]; meta["validation"] = engine.validate(g["image"])
        cands.append({"index": i, "path": save(cid, g["image"], f"v{n}_c{i}"), "meta": meta})
    mode = engine.mode()
    vid = db.ins("INSERT INTO versions(case_id,n,profile,prompt,mode,candidates,selected,created) VALUES(?,?,?,?,?,?,?,?)",
                 (cid, n, json.dumps(profile), prompt, mode, json.dumps(cands), None, time.time()))
    db.q("UPDATE cases SET profile=? WHERE id=?", (json.dumps(profile), cid))
    return {"id": vid, "n": n, "prompt": prompt, "mode": mode, "seconds": round(time.perf_counter() - t0, 2)}


class GenIn(BaseModel):
    case_id: str; profile: dict


@app.post("/api/generate-face")
def generate_face(b: GenIn):
    get_case(b.case_id)
    return make_version(b.case_id, b.profile, seed=int(time.time()) % 10000)


class RefineIn(BaseModel):
    case_id: str; base_version: int; changes: dict


@app.post("/api/refine-face")
def refine_face(b: RefineIn):
    v = db.q("SELECT * FROM versions WHERE id=? AND case_id=?", (b.base_version, b.case_id), one=True)
    if not v: raise HTTPException(404, "version not found")
    prof = {**json.loads(v["profile"]), **b.changes}
    out = make_version(b.case_id, prof, seed=int(time.time()) % 10000)
    out["parent"] = v["n"]; out["changes"] = b.changes
    return out


class SelIn(BaseModel):
    case_id: str; version_id: int; index: int


@app.post("/api/select-reconstruction")
def select_recon(b: SelIn):
    v = db.q("SELECT * FROM versions WHERE id=? AND case_id=?", (b.version_id, b.case_id), one=True)
    if not v: raise HTTPException(404)
    c = json.loads(v["candidates"])[b.index]
    db.q("UPDATE versions SET selected=? WHERE id=?", (b.index, b.version_id))
    db.q("UPDATE cases SET final_image=?, profile=? WHERE id=?", (c["path"], v["profile"], b.case_id))
    return {"final_image": url(c["path"])}


class CaseOnly(BaseModel):
    case_id: str


def final_img(cid):
    c = get_case(cid)
    if not c["final_image"]: raise HTTPException(400, "Select a reconstruction first")
    return c, cv2.imread(str(DATA / c["final_image"]))


def add_asset(cid, kind, label, path, meta=None):
    aid = db.ins("INSERT INTO assets(case_id,kind,label,path,meta,created) VALUES(?,?,?,?,?,?)", (cid, kind, label, path, json.dumps(meta or {}), time.time()))
    return {"id": aid, "kind": kind, "label": label, "url": url(path), "meta": meta or {}}


@app.post("/api/generate-sketch")
def generate_sketch(b: CaseOnly):
    _, im = final_img(b.case_id)
    return add_asset(b.case_id, "sketch", "Forensic pencil sketch", save(b.case_id, engine.pencil_sketch(im), "sketch"), {"method": "OpenCV dodge-blend + edge pass"})


@app.post("/api/generate-3d")
def generate_3d(b: CaseOnly):
    c, im = final_img(b.case_id)
    f = matching.detect(im) if matching.AVAILABLE else None
    if f is None: raise HTTPException(422, "No face detected in reconstruction")
    h, w = im.shape[:2]
    lm = {"box": [float(f[0] / w), float(f[1] / h), float(f[2] / w), float(f[3] / h)],
          "eye_r": [float(f[4] / w), float(f[5] / h)], "eye_l": [float(f[6] / w), float(f[7] / h)],
          "nose": [float(f[8] / w), float(f[9] / h)], "mouth_r": [float(f[10] / w), float(f[11] / h)], "mouth_l": [float(f[12] / w), float(f[13] / h)],
          "aspect": w / h}
    return add_asset(b.case_id, "model3d", "3D head (demo parametric)", c["final_image"],
                     {"mode": "DEMO", "method": "parametric head mesh aligned to detected landmarks, photo projected as texture", "landmarks": lm,
                      "note": "REAL mode would use a pretrained monocular reconstruction model (e.g. DECA). Monocular 3D cannot recover geometry never visible in the input image."})


class AgeIn(BaseModel):
    case_id: str; ages: list[int]


@app.post("/api/age-simulate")
def age_simulate(b: AgeIn):
    c, im = final_img(b.case_id)
    base = int(json.loads(c["profile"]).get("age") or 35)
    out = []
    for a in b.ages:
        out.append(add_asset(b.case_id, "age", f"Age {a}", save(b.case_id, engine.age_to(im, a, base), f"age{a}"), {"age": a, "witness_estimate": base}))
    return out


class VarIn(BaseModel):
    case_id: str; variations: list[str]


LABELS = {"stubble": "Light stubble", "beard": "Fuller beard", "glasses": "Rectangular glasses", "round_glasses": "Round glasses",
          "darker_hair": "Darker hair", "lighter_hair": "Lighter hair"}


@app.post("/api/appearance-variation")
def appearance_variation(b: VarIn):
    _, im = final_img(b.case_id)
    return [add_asset(b.case_id, "variation", LABELS.get(k, k), save(b.case_id, engine.variation(im, k), f"var_{k}"), {"variation": k}) for k in b.variations]


class FinalIn(BaseModel):
    case_id: str; path: str


@app.post("/api/set-final")
def set_final(b: FinalIn):
    p = b.path.replace("/files/", "")
    db.q("UPDATE cases SET final_image=? WHERE id=?", (p, b.case_id))
    return {"final_image": url(p)}


# ---------- embedding / search ----------
@app.post("/api/generate-embedding")
def gen_embedding(b: CaseOnly):
    _, im = final_img(b.case_id)
    e = matching.embed(im)
    if e is None: raise HTTPException(422, "No face detected")
    return {"dim": int(e.shape[0]), "norm": float(np.linalg.norm(e)), "model": "SFace"}


@app.get("/api/references")
def references():
    return [{"id": r["id"], "url": url(r["path"]), "note": r["note"]} for r in db.q("SELECT id,path,note FROM refs ORDER BY id")]


@app.post("/api/search-database")
def search(b: CaseOnly):
    if not matching.AVAILABLE: raise HTTPException(503, "Matching models unavailable")
    c, _ = final_img(b.case_id)
    stages = []

    def stage(name, fn):
        t = time.perf_counter(); r = fn(); stages.append({"name": name, "ms": round((time.perf_counter() - t) * 1000, 1)}); return r
    im = stage("Preparing reconstruction", lambda: cv2.imread(str(DATA / c["final_image"])))
    face = stage("Detecting face", lambda: matching.detect(im))
    if face is None: raise HTTPException(422, "No face detected in selected reconstruction")
    emb = stage("Generating embedding", lambda: matching.embed(im))
    refs = stage("Searching reference database", lambda: db.q("SELECT id,path,embedding FROM refs"))
    sc = stage("Comparing candidates", lambda: [(r, matching.cosine(emb, np.frombuffer(r["embedding"], np.float32))) for r in refs])
    ranked = stage("Ranking results", lambda: sorted(sc, key=lambda x: -x[1]))
    results = [{"rank": i + 1, "id": r["id"], "path": r["path"], "similarity": round(s, 4)} for i, (r, s) in enumerate(ranked)]
    db.ins("INSERT INTO searches(case_id,query_path,mode,results,stages,created) VALUES(?,?,?,?,?,?)",
           (b.case_id, c["final_image"], "real", json.dumps(results), json.dumps(stages), time.time()))
    return {"stages": stages, "results": [{**r, "url": url(r["path"])} for r in results], "threshold_ref": SAME_ID_REF,
            "disclaimer": "Similarity score represents model output and does not establish identity."}
