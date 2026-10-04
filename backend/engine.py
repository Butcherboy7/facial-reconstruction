"""Image engine.

REAL mode: calls a Stable-Diffusion-WebUI-compatible API if SD_API_URL is set and reachable.
DEMO mode: selects from a pool of synthetic faces by agreement with the structured profile.
Sketch / age / variations are real OpenCV image processing (approximations, not biological prediction).
"""
import os, json, base64, random, pathlib, urllib.request
import cv2
import numpy as np
import matching

DATA = pathlib.Path(__file__).parent / "data"
POOL = json.loads((DATA / "pool_tags.json").read_text())
SD_URL = os.environ.get("SD_API_URL", "").rstrip("/")
HAIR = {"black": "black", "dark_brown": "black", "brown": "brown", "blond": "blond", "red": "brown", "grey": "grey"}


def mode():
    if SD_URL:
        try:
            urllib.request.urlopen(SD_URL + "/sdapi/v1/options", timeout=2)
            return "real"
        except Exception:
            pass
    return "demo"


def _score(t, p):
    """agreement between profile and pool-face tags -> (score 0..1, per-attribute booleans)"""
    m = {}
    sex = {"male": "m", "female": "f"}.get(p.get("sex"))
    m["sex"] = (sex == t["sex"]) if sex else None
    m["age"] = abs((p.get("age") or 35) - t["age"]) <= 8
    hs = p.get("hair_style")
    hl = "long" if hs in ("long", "bun") else "short"
    m["hair length"] = (hl == t["hair_length"]) if hs and hs != "bald" else None
    hc = HAIR.get(p.get("hair_color"))
    m["hair colour"] = (hc == t["hair_color"]) if hc and hs != "bald" else None
    b = p.get("beard")
    if b:
        m["facial hair"] = (b == "none" and t["beard"] == "none") or (b in ("stubble", "short", "full", "goatee") and t["beard"] in ("stubble", "short"))
    else:
        m["facial hair"] = None
    g = p.get("glasses")
    m["glasses"] = ((g == "glasses") == bool(t["glasses"])) if g else None
    w = {"sex": 5, "age": 2, "hair length": 2, "hair colour": 1.5, "facial hair": 1.5, "glasses": 1}
    num = sum(w[k] for k, v in m.items() if v)
    den = sum(w[k] for k, v in m.items() if v is not None)
    return (num / den if den else 0.5), m


def generate(profile, prompt, n=4, seed=0, exclude=()):
    """returns list of {image: BGR ndarray, meta: {...}}"""
    if mode() == "real":
        out = []
        for i in range(n):
            body = json.dumps({"prompt": prompt, "negative_prompt": "cartoon, anime, plastic skin, smiling, sunglasses",
                               "width": 512, "height": 512, "steps": 25, "seed": seed + i}).encode()
            r = urllib.request.Request(SD_URL + "/sdapi/v1/txt2img", body, {"Content-Type": "application/json"})
            img = json.loads(urllib.request.urlopen(r, timeout=300).read())["images"][0]
            im = cv2.imdecode(np.frombuffer(base64.b64decode(img), np.uint8), cv2.IMREAD_COLOR)
            out.append({"image": im, "meta": {"source": "sd-api", "seed": seed + i}})
        return out
    rng = random.Random(seed)
    scored = []
    for t in POOL:
        if t["file"] in exclude:
            continue
        s, m = _score(t, profile)
        scored.append((s + rng.random() * 0.25, s, m, t))
    scored.sort(key=lambda x: -x[0])
    out = []
    for _, s, m, t in scored[:n]:
        im = cv2.imread(str(DATA / "pool" / t["file"]))
        out.append({"image": im, "meta": {"source": "demo-pool", "file": t["file"], "agreement": round(s, 2),
                                          "checks": {k: v for k, v in m.items() if v is not None}}})
    return out


def validate(img):
    """face validation: face detected + frontal-ness (eye-line tilt)"""
    f = matching.detect(img) if matching.AVAILABLE else None
    if f is None:
        return {"face_detected": False}
    tilt = abs(float(np.degrees(np.arctan2(f[7] - f[5], f[6] - f[4]))))
    return {"face_detected": True, "det_score": round(float(f[-1]), 3), "eye_tilt_deg": round(tilt, 1), "frontal": tilt < 8}


def _streaks(h, w, angle, length, seed):
    """directional pencil-stroke texture (0..1): noise smeared along one direction"""
    rng = np.random.default_rng(seed)
    n = (rng.random((h, w)) > 0.82).astype(np.float32)
    k = np.zeros((length, length), np.float32)
    c, r = length // 2, length // 2 - 1
    dx, dy = np.cos(np.radians(angle)) * r, -np.sin(np.radians(angle)) * r
    cv2.line(k, (int(c - dx), int(c - dy)), (int(c + dx), int(c + dy)), 1.0, 1, cv2.LINE_AA)
    t = cv2.filter2D(n, -1, k / k.sum())
    return np.clip(t / (t.mean() * 2.2 + 1e-6), 0, 1)


def pencil_sketch(img):
    """hand-drawn style graphite sketch: XDoG contour lines + directional hatching for tone + paper grain"""
    h0, w0 = img.shape[:2]
    S = 2                                                    # work at 2x for finer strokes
    im = cv2.resize(img, (w0 * S, h0 * S), interpolation=cv2.INTER_CUBIC)
    h, w = im.shape[:2]
    # subject mask: anything that differs from the plain backdrop; fade the bust out like a drawn vignette
    corners = np.concatenate([im[:30, :30].reshape(-1, 3), im[:30, -30:].reshape(-1, 3)]).astype(np.float32)
    dist = np.linalg.norm(im.astype(np.float32) - np.median(corners, axis=0), axis=2)
    mask = cv2.GaussianBlur(np.clip((dist - 14) / 22, 0, 1), (0, 0), 3 * S)
    yy = np.linspace(0, 1, h)[:, None]
    mask *= np.clip((0.97 - yy) / 0.2, 0, 1) ** 1.3
    # smooth skin / stubble noise but keep features
    det = im
    for _ in range(3):
        det = cv2.bilateralFilter(det, 9, 40, 7)
    sm = cv2.medianBlur(cv2.medianBlur(det, 4 * S + 3), 2 * S + 1)   # stubble / pores gone (tone only)
    m = (mask > 0.5) & (np.arange(h)[:, None] < int(h * 0.7))   # tonal range from head, not shoulders

    def norm(x):
        x = cv2.cvtColor(x, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
        if m.sum() > 100:
            lo, med = np.percentile(x[m], 4), np.percentile(x[m], 55)
            x = np.clip(0.74 + (x - med) * (0.6 / max(med - lo, 0.04)), 0.06, 1)
        return cv2.createCLAHE(1.6, (6, 6)).apply((x * 255).astype(np.uint8)).astype(np.float32) / 255
    g, gd = norm(sm), norm(det)
    # contours: extended difference of gaussians
    g1 = cv2.GaussianBlur(gd, (0, 0), 0.9 * S); g2 = cv2.GaussianBlur(gd, (0, 0), 1.6 * 0.9 * S)
    d = g1 - 0.985 * g2
    line = np.where(d >= -0.004, 1.0, 1 + np.tanh(180 * (d + 0.004)))
    # drop specks (stubble dots, pores): keep only stroke-sized line pieces
    ink = (line < 0.6).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    small = np.zeros(n, bool); small[1:] = stats[1:, cv2.CC_STAT_AREA] < 30 * S * S
    line = np.where(small[lab] & (ink > 0), 1.0, line)
    # texture areas (stubble, pores) fire edges everywhere: fade lines where edge density is high and tone is mid
    dens = cv2.GaussianBlur(ink.astype(np.float32), (0, 0), 5 * S)
    line = 1 - (1 - line) * (1 - np.clip((dens - 0.16) / 0.12, 0, 1) * 0.85)
    line = cv2.GaussianBlur(line.astype(np.float32), (0, 0), 0.6)
    # tone: darker areas get more (and crossed) strokes
    tone = cv2.GaussianBlur(g, (0, 0), 2.0 * S)
    dark = np.clip((0.95 - tone) / 0.8, 0, 1)
    st1 = _streaks(h, w, 58, 13 * S, 3)
    st2 = _streaks(h, w, -35, 11 * S, 7)
    st3 = _streaks(h, w, 80, 9 * S, 11)
    shade = 1 - 0.55 * dark ** 1.1 * (0.35 + 0.65 * st1)
    shade *= 1 - 0.45 * np.clip((dark - 0.35) / 0.65, 0, 1) * (0.3 + 0.7 * st2)
    shade *= 1 - 0.35 * np.clip((dark - 0.65) / 0.35, 0, 1) * (0.3 + 0.7 * st3)
    soft = 1 - 0.22 * dark                                  # smudged graphite under the strokes
    pencil = np.clip(line * shade * soft, 0, 1)
    pencil = 1 - (1 - pencil) * mask                        # paper outside the subject
    # paper grain (graphite catches on the tooth of the paper)
    rng = np.random.default_rng(1)
    grain = cv2.GaussianBlur(rng.random((h, w)).astype(np.float32), (0, 0), 0.8)
    pencil = 1 - (1 - pencil) * (0.78 + 0.44 * grain)
    fib = cv2.GaussianBlur(rng.random((h // 4 + 1, w // 4 + 1)).astype(np.float32), (0, 0), 2)
    fib = cv2.resize(fib, (w, h))
    pencil = np.clip(pencil * (0.985 + 0.03 * fib), 0, 1)
    out = cv2.resize(pencil, (w0, h0), interpolation=cv2.INTER_AREA)
    paper = np.array([238, 242, 246], np.float32) / 255      # BGR warm paper
    lead = np.array([58, 54, 52], np.float32) / 255          # graphite
    col = paper[None, None] * out[..., None] + lead[None, None] * (1 - out[..., None])
    return (col * 255).clip(0, 255).astype(np.uint8)


def _hair_weight(img, f, thresh=135, span=70):
    """soft mask of hair pixels: inside the crown ellipse, dark, and unlike the background colour"""
    h, w = img.shape[:2]
    lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    corners = np.concatenate([img[:24, :24].reshape(-1, 3), img[:24, -24:].reshape(-1, 3)]).astype(np.float32)
    dist = np.linalg.norm(img.astype(np.float32) - np.median(corners, axis=0), axis=2)
    return _hair_mask(f, h, w) * np.clip((thresh - lum) / span, 0, 1) * np.clip((dist - 28) / 30, 0, 1)


def _hair_mask(f, h, w):
    x, y, fw, fh = f[:4]
    m = np.zeros((h, w), np.float32)
    cv2.ellipse(m, (int(x + fw / 2), int(y + fh * 0.12)), (int(fw * 0.66), int(fh * 0.6)), 0, 180, 360, 1, -1)
    return m


def age_to(img, target, base):
    """Approximate age visualisation (image processing; not biological age prediction)."""
    d = (target - base) / 20.0
    if abs(d) < 0.02:
        return img.copy()
    out = img.copy()
    h, w = img.shape[:2]
    f = matching.detect(img)
    if d > 0:
        lab = cv2.cvtColor(out, cv2.COLOR_BGR2LAB).astype(np.float32)
        L = lab[..., 0]
        detail = L - cv2.GaussianBlur(L, (0, 0), 3)
        d = min(d, 1.6)
        # wrinkles / texture, dulled skin tone, slight loss of contrast
        lab[..., 0] = np.clip(L + detail * (1.3 + 2.4 * d) - 9 * d, 0, 255)
        lab[..., 1:] = 128 + (lab[..., 1:] - 128) * (1 - 0.2 * min(d, 1))
        # lower-face / under-eye softening shadows
        if f is not None:
            x, y, fw, fh = f[:4]
            sh = np.zeros(L.shape, np.float32)
            for e in (f[4:6], f[6:8]):
                cv2.ellipse(sh, (int(e[0]), int(e[1] + fh * 0.07)), (int(fw * 0.13), int(fh * 0.035)), 0, 0, 360, 1, -1)
            sh = cv2.GaussianBlur(sh, (0, 0), fw * 0.02)
            lab[..., 0] = np.clip(lab[..., 0] - sh * 20 * min(d, 1.2), 0, 255)
        out = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR)
        if f is not None:
            hair = cv2.GaussianBlur(_hair_weight(img, f), (0, 0), 4)[..., None] * min(1.0, d * 1.5)
            g = np.clip(cv2.cvtColor(out, cv2.COLOR_BGR2GRAY).astype(np.int16) + 100, 0, 235).astype(np.uint8)
            out = (out * (1 - hair) + cv2.cvtColor(g, cv2.COLOR_GRAY2BGR) * hair).astype(np.uint8)
    else:
        k = min(1.0, -d * 1.2)
        sm = out
        for _ in range(1 + int(2 * k)):
            sm = cv2.bilateralFilter(sm, 9, 38, 9)
        out = cv2.addWeighted(out, 1 - 0.72 * k, sm, 0.72 * k, 8 * k)
    return out


def variation(img, kind):
    f = matching.detect(img)
    if f is None:
        return img
    h, w = img.shape[:2]
    out = img.copy().astype(np.float32)
    x, y, fw, fh = f[:4]
    re, le, mr, ml = f[4:6], f[6:8], f[10:12], f[12:14]
    mc = (mr + ml) / 2
    if kind in ("stubble", "beard"):
        k = 0.42 if kind == "stubble" else 0.8
        m = np.zeros((h, w), np.float32)
        cx, cy = int(mc[0]), int(mc[1] + fh * 0.04)
        cv2.ellipse(m, (cx, int(mc[1] - fh * 0.04)), (int(fw * 0.5), int(fh * 0.62)), 0, 0, 180, 1, -1)
        cv2.ellipse(m, (cx, int(mc[1] - fh * 0.075)), (int(fw * 0.20), int(fh * 0.04)), 0, 0, 360, 1, -1)
        cv2.ellipse(m, (cx, int(mc[1])), (int(np.linalg.norm(mr - ml) * 0.55), int(fh * 0.03)), 0, 0, 360, 0, -1)
        m[: int(mc[1] - fh * 0.12)] = 0
        m = cv2.GaussianBlur(m, (0, 0), fw * 0.03)
        n = cv2.GaussianBlur(np.random.default_rng(3).random((h, w)).astype(np.float32), (0, 0), 0.7)
        n = np.clip((n - 0.35) * 3, 0, 1)
        a = (m * (0.5 + 0.5 * n) * k)[..., None]
        out = out * (1 - a) + np.array([28, 30, 34], np.float32) * a
    elif kind in ("glasses", "round_glasses"):
        ov = np.zeros((h, w, 4), np.uint8)
        ed = float(np.linalg.norm(re - le))
        r = int(ed * 0.27)
        t = max(2, int(ed * 0.035))
        col = (25, 25, 28, 255)
        for c in (re, le):
            cx, cy = int(c[0]), int(c[1])
            if kind == "round_glasses":
                cv2.circle(ov, (cx, cy), r, col, t, cv2.LINE_AA)
            else:
                cv2.rectangle(ov, (int(cx - r * 1.25), int(cy - r * .8)), (int(cx + r * 1.25), int(cy + r * .8)), col, t, cv2.LINE_AA)
        cv2.line(ov, (int(re[0] + r), int(re[1] - 2)), (int(le[0] - r), int(le[1] - 2)), col, t, cv2.LINE_AA)
        cv2.line(ov, (int(re[0] - r * 1.1), int(re[1])), (int(re[0] - r * 1.9), int(re[1] - 4)), col, 2, cv2.LINE_AA)
        cv2.line(ov, (int(le[0] + r * 1.1), int(le[1])), (int(le[0] + r * 1.9), int(le[1] - 4)), col, 2, cv2.LINE_AA)
        a = (ov[..., 3:] / 255.0) * 0.92
        out = out * (1 - a) + ov[..., :3].astype(np.float32) * a
    elif kind in ("darker_hair", "lighter_hair"):
        hair = cv2.GaussianBlur(_hair_weight(img, f, 125), (0, 0), 3)[..., None]
        if kind == "darker_hair":
            out = out * (1 - hair * 0.6)
        else:
            out = out * (1 - hair * 0.7) + np.array([135, 170, 205], np.float32) * hair * 0.7
    return np.clip(out, 0, 255).astype(np.uint8)
