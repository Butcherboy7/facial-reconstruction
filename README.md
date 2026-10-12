# Witness-Guided Facial Reconstruction: academic prototype

An investigator opens a case, a witness describes a face by picking features (the 3D face changes live, like a game
character creator), and the workstation produces a pencil sketch, a 360° 3D head, age simulations and appearance
variations. The face is then compared against a reference set with a face-recognition model, and a printable case
report is produced.

Four steps per case: **Describe → Explore → Compare → Report.**

**Runs on any laptop (CPU + integrated graphics, no dedicated GPU).**

## Run it locally

Requirements: **Python 3.10+**, **Node.js 18+**, Git.

```bash
git clone https://github.com/Butcherboy7/facial-reconstruction.git
cd facial-reconstruction
```

**Windows, one click:** double-click `start.bat`. It installs everything, starts both servers and opens the browser.

**Manual (Windows, macOS, Linux)**, in two terminals:

```bash
# terminal 1: backend (http://localhost:8000)
cd backend
pip install -r requirements.txt
python -m uvicorn app:app --port 8000

# terminal 2: frontend
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Click *Start a new case*, answer the questions, press *Save face & continue*, then work
through Explore, Compare and Report. Keep both terminals open while you use the app.

Troubleshooting: if the page says "Could not load case", the backend is not running on port 8000. If `python` is not
found, try `py` (Windows) or `python3`.

## How it works
| Stage | How |
|---|---|
| Structured profile | `backend/schema.py` (every answer is a structured attribute) |
| Face model | One 3D head mesh in the browser (Three.js). Each answer morphs the mesh and paints eyes, brows, lips, beard, skin tone, marks and ageing in a shader; hair is a masked shell; glasses are 3D geometry |
| Pencil sketch | OpenCV dodge-blend + edge pass over the render |
| Age / variations | Re-rendered from the same 3D model with age or a changed trait |
| Face validation + embedding | OpenCV YuNet detector + SFace embeddings (CPU), cosine similarity |
| Reference DB | 18 synthetic faces. No real people or records |

The faces are stylised approximations, never photographs and never an identification.

## Optional: photo-real faces (free)
Without a key, faces are 3D renders. With a free Cloudflare Workers AI token, each render is redrawn by an image-to-image model
(DreamShaper) as a photographic portrait; the 3D render fixes face structure, so your selections are kept. Copy
`backend/.env.example` to `backend/.env`, fill `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, restart the backend.
Only the synthetic render and a text description are sent. If a call fails the app falls back to the 3D render.

## Evaluation
`cd backend && python eval.py` → Top-1 / Top-3 on the 18 references using degraded queries. Prototype measurement on a
tiny synthetic set, not a claim about real-world identification.

## Limitations
Witness descriptions are uncertain; generated faces are approximations. Similarity scores are raw model output and do
not establish identity.

## Credits
Head mesh: "Lee Perry-Smith head scan" (Infinite-Realities), licensed CC BY 3.0, via the three.js examples.
