# Witness-Guided Facial Reconstruction — academic prototype

Investigator creates a case → witness describes a face by picking features (the 3D face changes live, like a game
character creator) → 4 candidate faces (+refine / version history) → pencil sketch, 360° 3D head, age simulation,
appearance variations → reference-database similarity search → printable case report.

**Runs on any laptop (CPU + integrated graphics, no dedicated GPU).** Needs Python 3.10+ and Node 18+.

## Run
Double-click `start.bat` (Windows), or manually:
```
cd backend  && pip install -r requirements.txt && python -m uvicorn app:app --port 8000
cd frontend && npm install && npm run dev        # open http://localhost:5173
```

## How it works
| Stage | How |
|---|---|
| Structured profile | `backend/schema.py` (every answer is a structured attribute) |
| Face model | One 3D head mesh in the browser (Three.js). Each answer morphs the mesh and paints eyes, brows, lips, beard, skin tone, marks and ageing in a shader; hair is a masked shell; glasses are 3D geometry |
| Candidates | Candidate A follows the profile exactly; B–D add seeded small proportion changes |
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
