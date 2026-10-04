from schema import phrase

NEG = ("cartoon, anime, illustration, plastic skin, smiling, dramatic lighting, extreme pose, "
       "deformed ears, uncanny eyes, oversized eyes, sunglasses, hat, busy background")


def _tidy(p: dict) -> dict:
    """facial hair does not apply to a woman: keep the written description consistent with the face"""
    if p.get('sex') == 'female': p = {**p, 'beard': 'none', 'mustache': 'none', 'sideburns': 'none'}
    return p


def short_prompt(p: dict) -> str:
    """compact prompt for image models with short context (Stable-Diffusion style)"""
    p = _tidy(p)
    age = int(p.get("age") or 35)
    sex = {"male": "man", "female": "woman"}.get(p.get("sex"), "person")
    parts = []
    for k in ["skin", "face_shape", "forehead", "cheeks", "eyebrows", "eyes", "eye_color", "nose", "mouth", "jaw", "chin", "ears"]:
        if p.get(k): parts.append(phrase(k, p[k]))
    hs, hc = p.get("hair_style"), p.get("hair_color")
    parts.append("shaved bald head" if hs == "bald" else (f"{phrase('hair_style', hs)} in {phrase('hair_color', hc)}" if hs and hc else phrase("hair_style", hs) if hs else ""))
    if p.get("sex") != "female": parts.append("clean-shaven" if p.get("beard") in (None, "none") else phrase("beard", p["beard"]))
    if p.get("mustache") not in (None, "none"): parts.append(phrase("mustache", p["mustache"]))
    if p.get("glasses") == "glasses": parts.append("wearing glasses")
    for m in p.get("marks") or []: parts.append(phrase("marks", m))
    return f"photorealistic studio portrait photograph of a {age} year old {sex}, " + ", ".join(x for x in parts if x) + ", neutral expression, mouth closed, plain light grey background, natural skin texture, sharp focus, 85mm lens"


def build_prompt(p: dict) -> str:
    """Convert a structured facial profile into a controlled natural-language prompt."""
    age = int(p.get("age") or 35)
    sex = phrase("sex", p.get("sex")) or "person"
    parts = []
    for k in ["face_shape", "forehead", "cheeks"]:
        if p.get(k): parts.append(phrase(k, p[k]))
    hs, hc = p.get("hair_style"), p.get("hair_color")
    if hs == "bald": parts.append("a shaved bald head")
    elif hs: parts.append(f"{phrase('hair_style', hs)}" + (f" in {phrase('hair_color', hc)}" if hc else ""))
    for k in ["eyebrows", "eyes", "eye_color", "eye_spacing", "nose", "nose_size", "mouth", "jaw", "chin", "ears"]:
        if p.get(k): parts.append(phrase(k, p[k]))
    if p.get("sex") == "female": pass
    elif p.get("beard") and p["beard"] != "none": parts.append(phrase("beard", p["beard"]))
    elif p.get("beard") == "none": parts.append("clean-shaven")
    if p.get("mustache") and p["mustache"] != "none": parts.append(phrase("mustache", p["mustache"]))
    if p.get("sideburns") and p["sideburns"] != "none": parts.append(phrase("sideburns", p["sideburns"]))
    if p.get("skin"): parts.append(phrase("skin", p["skin"]))
    if p.get("glasses") == "glasses": parts.append("wearing glasses")
    for m in p.get("marks") or []: parts.append(phrase("marks", m))
    body = ", ".join(x for x in parts if x)
    return (f"Generate a realistic neutral front-facing head-and-shoulders portrait of an approximately {age}-year-old {sex} "
            f"with {body}. Neutral expression, mouth closed. Plain light-grey background, even soft lighting. "
            f"Photorealistic facial proportions, natural skin texture, natural facial asymmetry, correct ear and nose anatomy.")
