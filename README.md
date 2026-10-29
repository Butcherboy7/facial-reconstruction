# Witness-Guided Facial Reconstruction: academic prototype

A forensic workstation demo. An investigator opens a case, and a witness builds the suspect's face by choosing each
feature separately: face shape, hair, eyebrows and eyes, nose, mouth and jaw, facial hair, marks and glasses. A live
3D face updates with every choice, like a game character creator. The finished face can then be:

- explored as a pencil sketch, a 360° 3D head, older or younger versions, and appearance variations
- **matched against the Convicted Felons database**, with a scanning animation and a match accuracy score
- filed with **suspect details, leads and witness statements**
- **exported as a WANTED poster** (PNG or PDF) that ends with "Contact Rajajinagar Police Station"
- printed as a case report

> **All people, records, fingerprints and crimes in this app are fictional demo data.** Similarity scores do not
> establish identity.

---

## 1. What you need to install first (one time)

| Software | Version | Download | Note |
|---|---|---|---|
| **Python** | 3.10 or newer | https://www.python.org/downloads/ | On Windows, **tick "Add python.exe to PATH"** on the first installer screen |
| **Node.js** | 18 or newer (LTS) | https://nodejs.org/ | Take the "LTS" version and keep the default options |
| A modern browser | Chrome or Edge | already on most PCs | |

You also need an **internet connection the first time** you start the app, because it downloads its libraries
(about 300 MB).

To check that they're installed, open **Command Prompt** (Windows) or **Terminal** (Mac/Linux) and type:

```
python --version
node --version
```

Both should print a version number. If `python` isn't found on Windows, try `py --version`. If that works, use `py`
wherever this guide says `python`.

---

## 2. Start the app

First **unzip** the folder somewhere simple, for example `C:\forensic`. Don't run it from inside the zip.

### Windows (easiest): double-click `start.bat`

1. Open the unzipped folder and double-click **`start.bat`**.
2. Two black windows open, called **backend** and **frontend**. The first start takes a few minutes while
   libraries install. **Leave both windows open** the whole time you use the app.
3. Your browser opens **http://localhost:5173**. If it opens before the app is ready, wait 10 seconds and refresh.

To stop the app, close the two black windows.

### Manual start (Windows, Mac or Linux)

Open **two** terminals in the unzipped folder.

**Terminal 1, backend** (port 8000):
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app:app --port 8000
```

**Terminal 2, frontend** (port 5173):
```bash
cd frontend
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser. Keep both terminals open.

After the first time, you can skip `pip install` and `npm install`.

---

## 3. How to use it (5-minute demo)

**A. Look at the database**
1. Click **Convicted Felons** in the top menu. This shows 25 fictional records with mugshots.
2. Click any person to see their name, age, date of birth, blood group, crime and legal section, sentence,
   fingerprints, and a description of the motive (why), the method (how) and a psychological assessment.

**B. Build a face from a witness description**
1. Click **+ New case**, fill in the case name, place and type of crime, then click create.
2. **Step 1 Describe:** answer each group of questions (Basics, Face Shape, Hair, Eyebrows & Eyes, Nose,
   Mouth & Jaw, Facial Hair, Marks & Glasses). Each option shows a small picture of that feature; the 3D face in the
   middle updates live, and you can drag it to turn it. Then press **Save face & continue**.
3. **Step 2 Explore:** pencil sketch, 3D view, age simulation, appearance variations.
4. **Step 3 Compare:** face-recognition comparison against a small synthetic reference set.
5. **Step 4 Match Database:** press **Match database** to watch the scan and see the best matches from the
   Convicted Felons register, with their accuracy %.
6. **Step 5 Suspect & Witnesses:** enter what's known about the suspect (the name stays "Unknown" until
   identified), the leads, and the detective's witness statements.
7. **Step 6 Export:** the WANTED poster. Click **Download image (PNG)** or **Save as PDF**.
8. **Step 7 Report:** printable case summary.

**C. Quick demo of a strong match**
Open any record in **Convicted Felons** and click **"Demo: create a witness case resembling this person"**. The app
builds a face from a slightly imperfect witness description of that person and opens **Match Database**. Press
**Match database** and the scan should rank that person first as a strong match.

> Suspect details and witness statements are saved in the browser you use, so they stay on that computer only.

---

## 4. Realistic photo faces (optional)

- **The 25 database mugshots are already included** in `frontend/public/felons/` and work offline.
- **Faces you build:** when you save a face and the computer is online, the app also asks a free online image
  service (Pollinations.ai, no account needed) for a realistic photo **from the text description**. The photo shares
  the chosen features, but it's a separate image, not a copy of the 3D face. It takes 15–60 seconds. If the computer
  is offline or the service is busy, the app simply keeps the 3D face.
- **To make the photo follow the 3D face exactly**, add a free Cloudflare Workers AI key:
  1. Make a free account at https://dash.cloudflare.com, then open **AI → Workers AI**.
  2. Note your **Account ID** and create an **API token** using the "Workers AI" template.
  3. Copy `backend/.env.example` to `backend/.env` and fill in `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
  4. Restart the backend.

  Never share the `.env` file or put it on GitHub; it holds your key.

To turn the online photo step off completely, add the line `POLLINATIONS=0` to `backend/.env`.

---

## 5. Troubleshooting

| Problem | Fix |
|---|---|
| Page says **"Could not load case"** or **"BACKEND OFFLINE"** | The backend isn't running. Check that the backend window or terminal is still open and shows no errors, and that you're in the `backend` folder when you start it |
| `'python' is not recognized` | Reinstall Python and tick **"Add python.exe to PATH"**, or use `py` instead of `python` |
| `'npm' is not recognized` | Install Node.js, then **close and reopen** the terminal |
| `pip install` fails on `opencv` | Update pip first: `python -m pip install --upgrade pip`, then retry |
| **Port already in use** (8000 or 5173) | The app is already running in another window. Close the old windows, or restart the PC |
| The 3D face is blank or black | Use Chrome or Edge, and check that hardware acceleration is on (Settings → System) |
| Browser opened too early and shows an error | Wait 10–20 seconds and refresh |
| Saved face stays a 3D render (not a photo) | That's normal when offline or when the online service is busy |

---

## 6. Project layout

```
backend/            Python FastAPI server (cases, images, face recognition, photo step)
  app.py            API endpoints
  schema.py         every witness question and answer option
  photoreal.py      optional realistic-photo step
  models/           face detection + recognition models (CPU, included)
  data/             database, saved images and reference faces
frontend/           React + Three.js web app
  src/studio/       3D face model, shaders, rendering
  src/felons/       Convicted Felons data, mugshots, fingerprints, matching
  src/components/   case steps (Describe, Explore, Compare, Match Database, Suspect & Witnesses, Export, Report)
  public/felons/    the 25 mugshot photos
start.bat           one-click start for Windows
```

## How it works

| Stage | How |
|---|---|
| Structured profile | `backend/schema.py`: every answer is a structured attribute |
| 3D face | One 3D head mesh in the browser (Three.js). Each answer reshapes the mesh and paints eyes, brows, lips, beard, skin tone, marks and ageing in a shader; hair is a shell, glasses are 3D geometry |
| Pencil sketch | Dodge-blend + edge pass over the face image |
| Compare | OpenCV YuNet face detector + SFace embeddings (CPU), cosine similarity on a synthetic reference set |
| Match Database | The face's structured features are compared, weighted, with each record's features, plus age and marks, giving a match accuracy % |
| Fingerprints | Generated ridge patterns (loop, whorl, arch); not real prints |
| Wanted poster | Drawn on an HTML canvas in the browser, exported as PNG or printed to PDF |

## Limitations
Witness descriptions are uncertain, and generated faces are approximations. The female 3D face is reshaped from a
male head scan, so it is less convincing than the male one. Match scores are a demo of the workflow, not biometric
identification.

## Credits
Head mesh: "Lee Perry-Smith head scan" (Infinite-Realities), licensed CC BY 3.0, via the three.js examples.
Mugshot photos: generated with Pollinations.ai; they don't show real people.
