"""Optional photo-real pass: sends the 3D render to an image model (Cloudflare Workers AI, else Google Gemini) and gets back a photographic
portrait that keeps the same facial attributes. Needs GEMINI_API_KEY (free key from aistudio.google.com/apikey).
Without a key everything still works and the 3D render is used as-is."""
import os, json, base64, pathlib, urllib.request, urllib.error
import cv2
import numpy as np

ROOT = pathlib.Path(__file__).parent


def _load_env():
    f = ROOT / ".env"
    if f.exists():
        for line in f.read_text(encoding="utf8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env()
MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")


CF_MODEL = os.environ.get("CF_IMG2IMG_MODEL", "@cf/lykon/dreamshaper-8-lcm")
NEG = "cartoon, 3d render, cgi, painting, illustration, plastic skin, deformed, extra fingers, text, watermark, smiling, sunglasses, hat"


def enabled() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY") or (os.environ.get("CLOUDFLARE_API_TOKEN") and os.environ.get("CLOUDFLARE_ACCOUNT_ID")))


def _cloudflare(img_bgr, desc, strength=0.62):
    """Free Cloudflare Workers AI image-to-image: the 3D render fixes the structure, the model supplies photographic detail."""
    img = cv2.resize(img_bgr, (512, 640))
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 92])
    body = {"prompt": desc, "negative_prompt": NEG, "image_b64": base64.b64encode(buf.tobytes()).decode(), "strength": strength,
            "guidance": 2, "num_steps": 8, "width": 512, "height": 640}
    req = urllib.request.Request(f"https://api.cloudflare.com/client/v4/accounts/{os.environ['CLOUDFLARE_ACCOUNT_ID']}/ai/run/{CF_MODEL}",
                                 data=json.dumps(body).encode(), headers={"Authorization": "Bearer " + os.environ["CLOUDFLARE_API_TOKEN"], "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
        out = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        return (out, None) if out is not None else (None, "bad response: " + raw[:150].decode("utf8", "ignore"))
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}: {e.read()[:200].decode('utf8', 'ignore')}"
    except Exception as e:
        return None, str(e)[:200]


PROMPT = ("This is a 3D character render of a person. Redraw it as a photorealistic studio portrait photograph of a real person "
          "(head and shoulders, front-facing, neutral expression, plain light-grey background, soft even lighting, natural skin texture). "
          "Keep every facial attribute of the render exactly as it is: face shape, skin tone, hair style and colour, eyebrows, eye shape and "
          "colour, nose, lips, jaw, ears, facial hair, scars or marks, glasses, apparent age. Keep the same framing and head pose. "
          "Do not add accessories, text or a different background. Description for reference: {desc}")


def enhance(img_bgr, desc: str):
    """returns (image, error). image is None on any failure so callers fall back to the 3D render."""
    if os.environ.get("CLOUDFLARE_API_TOKEN") and os.environ.get("CLOUDFLARE_ACCOUNT_ID"):
        return _cloudflare(img_bgr, desc)
    key = os.environ.get("GEMINI_API_KEY")
    if not key: return None, "no key"
    ok, buf = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
    body = {"contents": [{"parts": [{"text": PROMPT.format(desc=desc)},
                                    {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(buf.tobytes()).decode()}}]}],
            "generationConfig": {"responseModalities": ["IMAGE"]}}
    req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
                                 data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            j = json.loads(r.read())
        for c in j.get("candidates", []):
            for p in c.get("content", {}).get("parts", []):
                d = p.get("inlineData") or p.get("inline_data")
                if d:
                    out = cv2.imdecode(np.frombuffer(base64.b64decode(d["data"]), np.uint8), cv2.IMREAD_COLOR)
                    if out is not None: return out, None
        return None, "model returned no image"
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}: {e.read()[:200].decode('utf8', 'ignore')}"
    except Exception as e:  # network, timeout
        return None, str(e)[:200]
