"""Face detection (YuNet) + embedding (SFace) via OpenCV, CPU only. No fabricated scores."""
import cv2, numpy as np, pathlib, threading
_lock = threading.RLock()  # cv2.dnn nets are not thread-safe
M = pathlib.Path(__file__).parent / "models"
_det = _rec = None
AVAILABLE = (M / "yunet.onnx").exists() and (M / "sface.onnx").exists()


def _load(w, h):
    global _det, _rec
    if _det is None:
        _det = cv2.FaceDetectorYN.create(str(M / "yunet.onnx"), "", (w, h), 0.6, 0.3, 5000)
        _rec = cv2.FaceRecognizerSF.create(str(M / "sface.onnx"), "")
    _det.setInputSize((w, h))
    return _det, _rec


def detect(img):
    """returns best face row (x,y,w,h, 5 landmarks..., score) or None"""
    h, w = img.shape[:2]
    with _lock:
        det, _ = _load(w, h)
        _, faces = det.detect(img)
    if faces is None or len(faces) == 0: return None
    return faces[np.argmax(faces[:, -1])]


def embed(img):
    f = detect(img)
    if f is None: return None
    with _lock:
        _, rec = _load(*img.shape[1::-1])
        al = rec.alignCrop(img, f)
        e = rec.feature(al).flatten().astype(np.float32)
    return e / (np.linalg.norm(e) + 1e-9)


def cosine(a, b): return float(np.dot(a, b))
