"""Prototype evaluation on the 18 synthetic reference faces (NOT a real-world forensic claim).

Protocol: for each reference image, build a degraded 'query' (pencil sketch / age +20 / glasses / stubble),
embed it, rank all 18 references, record the rank of the source reference. Reports Top-1 / Top-3 and
similarity distributions, plus per-stage latency. Run:  python eval.py
"""
import json, time, pathlib, statistics as st
import cv2, numpy as np
import engine, matching

refs = sorted((pathlib.Path(__file__).parent / "data" / "refs").glob("*.jpg"))
E = {r.stem: matching.embed(cv2.imread(str(r))) for r in refs}
ids = list(E)
M = np.stack([E[i] for i in ids])
tests = {
    "identity (same image)": lambda im: im,
    "pencil sketch": engine.pencil_sketch,
    "age +20 sim": lambda im: engine.age_to(im, 55, 35),
    "glasses": lambda im: engine.variation(im, "glasses"),
    "stubble": lambda im: engine.variation(im, "stubble"),
}
out = {}
for name, fn in tests.items():
    ranks, same, other, ms = [], [], [], []
    for rid in ids:
        im = cv2.imread(str(next(r for r in refs if r.stem == rid)))
        t = time.perf_counter(); q = matching.embed(fn(im)); ms.append((time.perf_counter() - t) * 1000)
        if q is None: ranks.append(None); continue
        sims = M @ q
        order = np.argsort(-sims)
        ranks.append(int(np.where(order == ids.index(rid))[0][0]) + 1)
        same.append(float(sims[ids.index(rid)])); other += [float(s) for j, s in enumerate(sims) if j != ids.index(rid)]
    ok = [r for r in ranks if r]
    out[name] = {"n": len(ids), "face_found": len(ok), "top1": sum(r == 1 for r in ok) / len(ids), "top3": sum(r <= 3 for r in ok) / len(ids),
                 "sim_same_mean": round(st.mean(same), 3) if same else None, "sim_other_mean": round(st.mean(other), 3) if other else None,
                 "embed_ms_mean": round(st.mean(ms), 1)}
    print(f"{name:24s} found {len(ok)}/{len(ids)}  top1 {out[name]['top1']:.2f}  top3 {out[name]['top3']:.2f}  same {out[name]['sim_same_mean']}  other {out[name]['sim_other_mean']}  {out[name]['embed_ms_mean']} ms")
json.dump(out, open("eval_results.json", "w"), indent=1)
