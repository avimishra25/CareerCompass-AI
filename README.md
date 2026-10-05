# 🧭 CareerCompass AI

> Resume analysis, deterministic job-description matching and skill gaps, ML-based ATS scoring, and Gemini career guidance.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.19+-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.10%20%2F%203.11-yellow.svg)](https://python.org)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.4-orange.svg)](https://scikit-learn.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green.svg)](https://mongodb.com/atlas)
![Deployed](https://img.shields.io/badge/Deployed-Vercel%20%2B%20Render%20%2B%20HuggingFace-blueviolet)

---

## 📌 Overview

CareerCompass AI is a full-stack career intelligence platform that analyzes resumes and provides actionable feedback for job seekers.

It uses spaCy and TF-IDF to extract skills, a **GradientBoostingRegressor** to estimate ATS readiness, and Google Gemini for career chat. JD matching compares saved resume text with a pasted job description using TF-IDF similarity and skill coverage, without an LLM.

The ATS model trains on 600 synthetic feature samples across three quality tiers. Its score is a heuristic, not a validated prediction of employer ATS decisions. Matching against 12 predefined career profiles and matching against a custom JD are separate features. Chat resends the current conversation and resume context; it does not persist conversations to MongoDB.

---

## ▶️ Live Demo

[Open CareerCompass AI](https://career-compass-ai-omega-smoky.vercel.app/)

---

## ✨ Features

### 🔐 Authentication
- **Google OAuth 2.0** via Passport.js — one-click sign in, no password required
- JWT-based session management with 7-day token expiry
- Token handoff via redirect after OAuth callback; the client stores the JWT in localStorage

### 📄 Resume Analysis
- Drag & drop PDF upload
- NLP skill extraction using spaCy (lemmatization + two-pass smart matching)
- 200+ skill dictionary with alias normalisation (Node.js → node, sklearn → scikit-learn)
- TF-IDF cosine similarity skill ranking
- Career role matching across **12 job profiles** with match % and missing skills
- Target role selection — benchmarks analysis specifically against your goal role

### 📊 ML-Powered ATS Scoring
- **GradientBoostingRegressor** trained on 600 synthetic resume samples
- Scores resumes across **10 features**: skill count, skill density, action verb count, verb density, quantified achievements, section count, word count, sentence length, contact info, summary presence
- Feature importance extraction — surfaces **top_drivers** (what scored well) and **improve_here** (what to fix)
- Actionable ML-powered improvement tips per feature
- Score out of 100 with circular gauge UI

### 🎯 JD Matching & Skill Gaps
- Choose a saved resume analysis and paste a job description of up to 8000 characters
- Deterministic score: 40% TF-IDF cosine similarity + 60% detected JD skill coverage
- Matched, missing, and extra skill chips; top keyword gaps; Weak / Fair / Strong verdict
- Saved match history with owner-only access and deletion
- Older analyses without saved resume text require a fresh upload

### 💬 AI Career Chatbot
- Google Gemini powered career advisor
- Full validated conversation history and resume ML insights retained per request
- Server-owned system prompt; clients send only message and history
- Discuss resume details and target roles through conversation text

### 📄 PDF Report Export
- Download full ATS analysis report as PDF (jsPDF + html2canvas)
- Frontend-based rendering — no backend load

### 🔀 Resume Comparison
- Select any 2 past analyses and compare side-by-side
- Compare ATS scores, role matches, and gained/lost/common skills

### 📊 Progress Tracker & Dashboard
- Skills progress tracker across multiple analyses over time
- Dashboard stats: total analyses, top matched role, average ATS score, last analysis date, JD-match count, and best JD-match score
- Visual progress bars and glassmorphism UI

### 🕓 Analysis History
- Every analysis saved to MongoDB with full mlInsights
- View, manage, and delete past reports

---

## 🏗️ Architecture

CareerCompass AI is a distributed 3-service architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                             │
│                    React 19 + Tailwind CSS                      │
│                      (Vercel — CDN)                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / JWT
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Node.js / Express                            │
│         Auth · Upload · History · JD Match Routes               │
│                    (Render — Web Service)                       │
│                           │                                     │
│              ┌────────────┴────────────┐                        │
│              ▼                         ▼                        │
│     MongoDB Atlas                 Flask ML Service              │
│ (Users · Analyses · JDMatches)     spaCy · TF-IDF · GBR          │
│                               Google Gemini                     │
│                           (Hugging Face Spaces)                 │
└─────────────────────────────────────────────────────────────────┘
```

| Service | Technology | Host |
|---|---|---|
| Frontend | React 19 + Tailwind CSS | Vercel |
| Core Backend | Node.js + Express.js | Render |
| ML / NLP Engine | Python + Flask + scikit-learn | Hugging Face Spaces |
| Database | MongoDB Atlas | MongoDB Cloud |

---

## 🔁 Request Flow

```
User uploads Resume PDF
        ↓
React → POST /upload (JWT protected, multipart/form-data)
        ↓
Node.js validates JWT → saves PDF via Multer → forwards to Flask
        ↓
Flask: pdfminer extracts raw text
        ↓
normalize() → alias replacement (Node.js → node, etc.)
        ↓
extract_skills() → regex pass + spaCy lemmatization (2-pass)
        ↓
rank_skills_tfidf() → cosine similarity ranking
        ↓
extract_features() → 10 numeric features from resume text
        ↓
GradientBoostingRegressor.predict() → ATS score (0-100)
        ↓
get_feature_importances() → top_drivers + improve_here
        ↓
match_roles() → 12 role scores + missing skills
        ↓
Flask returns JSON → Node.js saves analysis, mlInsights, and bounded resume text
        ↓
React renders: ATS Report + ML Insights + Career Match + Chatbot
```

JD matching: React sends `analysisId`, `jd_text`, and optional `jdTitle` to Node.
Node validates the JWT, rate limit, payload, and analysis ownership, then sends the saved resume text
and JD to Flask with `X-Internal-Key`. Flask returns deterministic results; Node saves a `JDMatch`
record and returns it to the page. Resume text is excluded from normal analysis-history responses.

---

## 🔐 Authentication Flow

```
User clicks "Continue with Google"
        ↓
Frontend → GET /api/auth/google
        ↓
Passport.js redirects to Google consent screen
        ↓
Google → GET /api/auth/google/callback
        ↓
Passport verifies profile → upserts User in MongoDB
        ↓
Server generates JWT → redirects to CLIENT_URL?token=...
        ↓
React reads token from URL (synchronous useState initializer)
        ↓
OAuthSuccess: saves token to localStorage → fetches /api/auth/me
        ↓
AuthContext sets user state → navigate to Dashboard
```

---

## 🧠 ML Model Details

The ATS scoring engine uses a **scikit-learn Pipeline**:

```
StandardScaler → GradientBoostingRegressor
  n_estimators=200 | learning_rate=0.05 | max_depth=4
```

**Training data:** 600 synthetic resume samples across 3 quality tiers (poor / average / good) with Gaussian noise (σ=3) for smooth score distribution. Seed fixed at 42 for reproducibility.

**Feature importances** come from `regressor.feature_importances_`. These are global model importances,
not per-resume causal explanations. `top_drivers` pairs them with resume measurements; `improve_here`
uses additional rules to suggest improvements.

**Model persistence:** Saved as `ats_model.pkl` on first startup. Reloaded on subsequent restarts. Retrainable only through Flask `POST /retrain` with the internal API key.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS, Axios, jsPDF, html2canvas |
| State Management | React Context API (AuthContext) |
| Backend | Node.js ≥20.19.0 (Mongoose 9 requirement), Express 5 |
| File Handling | Multer (PDF uploads) |
| Authentication | Google OAuth 2.0, Passport.js, JWT, bcryptjs |
| Database | MongoDB Atlas, Mongoose |
| NLP | Python, spaCy (en_core_web_sm), TF-IDF, pdfminer.six |
| ML Model | scikit-learn (GradientBoostingRegressor, StandardScaler, Pipeline) |
| AI Chatbot | Google Gemini |
| Deployment | Vercel (frontend), Render (backend), Hugging Face Spaces (ML) |

---

## 📂 Project Structure

```
CareerCompass-AI/
├── client/                         # React frontend
│   ├── src/
│   │   ├── components/             # Navbar, ATSReport, CareerAgent, ProgressTracker
│   │   ├── context/                # AuthContext (JWT session management)
│   │   ├── pages/                  # AuthPage, OAuthSuccess, UploadResume,
│   │   │                           # History, Dashboard, JDMatch, About, Compare, Profile
│   │   └── App.js
├── server/                         # Node.js backend
│   ├── config/                     # passport.js (Google OAuth strategy)
│   ├── middleware/                 # JWT auth middleware
│   ├── models/                     # User, Analysis (+ resumeText), JDMatch
│   ├── routes/                     # auth.js (Google OAuth, /me)
│   ├── server.js
│   └── .env
└── ml-service/                     # Python ML + NLP service
    ├── app.py                      # Flask, spaCy, TF-IDF, GBR, Gemini
    ├── llm.py                      # Swappable text-generation provider
    ├── requirements.txt
    └── .env
```

---

## 🎯 JD Matching: Scoring and Limits

Open **JD Match**, choose a saved analysis, and paste up to 8000 Unicode characters of job description.
New uploads retain up to 50,000 characters of extracted resume text, excluded from history responses.
Older analyses without saved text require re-upload; skills alone cannot reconstruct a resume.

The deterministic score is `100 × (0.40 × TF-IDF cosine similarity + 0.60 × skill coverage)`.
TF-IDF is fitted to the normalized resume/JD pair using unigrams, English stop-word removal, and
scikit-learn's default tokenization and IDF smoothing. Coverage is matched distinct JD skills divided
by all detected distinct JD skills. The existing normalizer and skill extractor handle aliases in both texts.
If no JD skills are detected, coverage is zero; weights are not redistributed. Empty vocabularies have
zero text similarity. Scores are rounded to one decimal: **Weak <50**, **Fair 50–<75**, **Strong ≥75**.
The 60% skill weight favors explicit requirements over similar wording (40%).

Matched/missing skills sort by normalized JD mention count descending, then alphabetically; extra
resume skills sort alphabetically. Keyword gaps are the top ten JD TF-IDF terms absent from the resume,
with alphabetical ties. No LLM or ATS regression model participates in this score.

Limits: vocabulary coverage, alias rules, PDF extraction, and truncation affect results. The existing
extractor can produce false positives; mentions and frequency do not establish proficiency, required
versus optional skills, negation, experience level, or hiring likelihood. Tokenization can lose punctuation
in terms such as C++. Keyword gaps are wording suggestions, not instructions to invent experience.

`POST /api/jd-match` accepts `{ analysisId, jd_text, jdTitle? }` (title at most 120 characters).
JWT authentication and analysis ownership are required; POST is limited to 20 requests/user/15 minutes.
`GET /api/jd-match/history` and `DELETE /api/jd-match/:id` are owner scoped. Missing/foreign IDs return
the same 404; malformed inputs return 400, overlength JDs 413, throttling 429, and unavailable ML 503.
Records retain the JD (bounded to 8000 characters), result, title, analysis reference, and creation time.
Deleting an analysis leaves its saved JD matches available until separately deleted.

The internal Flask endpoint `POST /jd-match` accepts `{ resume_text, jd_text }` with nonblank strings,
at most 50,000 resume characters and 8000 JD characters. Its result contains `overall_match`,
`matched_skills`, `missing_skills`, `extra_skills`, `keyword_gaps`, and `verdict`.
Node returns HTTP 201 with the saved record, including that result under `result`. Missing/invalid
JWTs return 401; database failures return sanitized 500 errors. Call Flask through Node in the browser.

### Tests and manual checks

From the repository root, after completing local setup:

```powershell
.\ml-service\venv\Scripts\python.exe -m unittest discover -s ml-service -p "test_*.py"
npm --prefix server test
npm --prefix client test -- --watchAll=false --runInBand --runTestsByPath src/pages/JDMatch.test.jsx src/components/CareerAgent.test.jsx
npm --prefix client run build
```

On macOS/Linux, replace the Python executable above with `./ml-service/venv/bin/python`.
Scoring tests use real scikit-learn and stub spaCy's lemma
pass; Node tests use real JWT, middleware, and schema validation with mocked MongoDB and Flask calls.
For an integration check, start all three services and upload a PDF containing
`Python Flask PostgreSQL Docker`. Match the same text (Strong), then
`Figma wireframing prototyping Adobe XD user research` (Weak). Check chips, history, and Dashboard
count/best score. Empty/whitespace JD must return 400; an 8001-character JD must return 413 via API
(both are blocked in the UI). With another account's JWT, submit the first account's analysis ID:
expect 404 and no saved match. Confirm foreign matches cannot be listed or deleted, and deleting an
owned match updates its history and Dashboard stats.

## ⚙️ Environment Variables

JD matching reuses `REACT_APP_API_URL`, `ML_SERVICE_URL`, `MONGO_URI`, `JWT_SECRET`, and the shared
`INTERNAL_API_KEY`. It needs no new environment variables or Gemini key. The Node authentication
configuration is also required to sign in. Local values and startup commands appear below.

**Vercel (Frontend)**
```env
REACT_APP_API_URL=https://your-backend-on-render.com
```

**Render (Backend)**
```env
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://your-backend.onrender.com/api/auth/google/callback
CLIENT_URL=https://your-frontend.vercel.app
ML_SERVICE_URL=https://your-space.hf.space
PORT=5000
INTERNAL_API_KEY=replace_with_shared_random_secret
TRUST_PROXY_HOPS=1
```

**Hugging Face Spaces (ML Service)**
```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash-lite
INTERNAL_API_KEY=replace_with_shared_random_secret
```

Chat uses Google's official [`google-genai` Python SDK](https://googleapis.github.io/python-genai/).
Create a key in [Google AI Studio](https://aistudio.google.com/apikey) and store `GEMINI_API_KEY`
only in the ML service's environment/Space Secrets. The code defaults `GEMINI_MODEL` to
`gemini-3.5-flash-lite`; configure a model available to your Google project. Provider availability,
quotas, and pricing are external to this repository. No Gemini secret belongs in the browser or Node environment.

All LLM requests pass through `ml-service/llm.py:generate(system_prompt, messages, json_mode=False, max_output_tokens=1024)`.
It maps assistant messages to Gemini's `model` role and uses `system_instruction` for the server prompt.
Resume analysis and ML insights are injected as user context on each turn, including after clearing chat.
Requests time out after 10 seconds per SDK request; transient network/408/429/500/502/503/504 failures retry once
after a one-second backoff. SDK automatic retries are disabled. Exhausted quota returns JSON HTTP 503
with `AI quota exhausted or rate limit reached. Try again later.` Invalid keys/configuration also return a safe 503.
The Node proxy preserves only known safe error messages. JSON mode requests `application/json`, parses the response,
retries malformed JSON once, then raises `LLMError`; successful calls always return a string, including JSON mode.
There is one transient retry and one JSON repair retry per invocation (at most three SDK requests).

Deploy the ML service, then Node, then the client so history handling and safe error messages agree.
The chat request/response shape is `{message, history}` / `{reply}`. Existing analyses remain readable;
JD matching requires re-upload for analyses without `resumeText`. JD matching adds a separate collection.

---

Set the **same strong random `INTERNAL_API_KEY`** in Render environment variables and Hugging Face Space **Secrets**.
Use the same value in both local `.env` files. Never place it in Vercel/client configuration or commit it.
Node sends the key on every Flask request. Copy `server/.env.example` and `ml-service/.env.example` for local setup.
`TRUST_PROXY_HOPS` defaults to `0` locally; use `1` only when Render is the single trusted reverse proxy.
Verify the proxy topology before changing it, since it controls the IP used for rate limiting.

Security limits: `/api` permits 300 requests per 15 minutes per IP; chat and JD-match POST each permit 20 per user per 15 minutes.
These counters are in memory per Node process and reset on restart; multiple replicas require a shared store.
Uploads require one PDF, PDF MIME type, `.pdf` extension, and `%PDF-` signature; Node limits file size to 5 MiB.
Flask limits the entire request (including multipart overhead) to 5 MiB and uses at most 50,000 extracted characters.
Chat accepts exactly `{message, history}`: message is nonblank and 1–2000 characters; history is an array
of `{role: "user"|"assistant", content: string}` with nonblank content, up to 2000 characters for user messages
and 16000 for assistant replies. Both services validate and retain every supplied item; the existing JSON body-size limits still apply. Client-provided system prompts, extra fields,
and system roles return 400. The client resends replies without truncation.

## ⚙️ Local Setup

### Prerequisites

- Node.js **20.19.0 or newer**, as required by the installed Mongoose 9 dependency
- Python **3.11** for the commands below; the Docker image uses Python 3.10
- A running local MongoDB server or a reachable MongoDB Atlas database
- Google OAuth credentials for the existing sign-in flow
- A Gemini API key only if you want career chat; resume analysis and JD matching do not call Gemini

The pinned spaCy 3.7.5, scikit-learn 1.4.2, and NumPy 1.26.4 stack predates Python 3.14.
Use Python 3.11 for local setup instead of creating the environment with whichever `python` is on PATH.

### 1. Clone and install Node dependencies

Run in PowerShell:

```powershell
git clone https://github.com/avimishra25/CareerCompass-AI.git
cd CareerCompass-AI
npm --prefix server install
npm --prefix client install
```

For an existing checkout, open PowerShell in the repository root and run only the two install commands.
The Windows commands below all start from that root unless stated otherwise.

### 2. Create the ML virtual environment

Check the Python launcher first:

```powershell
py -3.11 --version
```

If Python 3.11 is missing, install it, then reopen PowerShell:

```powershell
winget install --exact --id Python.Python.3.11
```

Create the environment and install the pinned packages and language model:

```powershell
py -3.11 -m venv ml-service/venv
.\ml-service\venv\Scripts\python.exe -m pip install -r ml-service/requirements.txt
.\ml-service\venv\Scripts\python.exe -m spacy download en_core_web_sm
```

These commands use the environment's executable directly, so PowerShell activation is unnecessary.
Virtual environments are machine-specific. If an old environment reports **Unable to create process**,
its base Python installation may have been removed or moved. Preserve anything needed from it, then
recreate it using the installed Python 3.11 interpreter and reinstall the requirements.

On macOS/Linux, with Python 3.11 installed, use:

```bash
python3.11 -m venv ml-service/venv
./ml-service/venv/bin/python -m pip install -r ml-service/requirements.txt
./ml-service/venv/bin/python -m spacy download en_core_web_sm
```

### 3. Configure local environment files

Create the files below if absent; update existing values without overwriting unrelated settings.
`server/.env.example` and `ml-service/.env.example` provide starting values. Add the OAuth settings
shown here to the server configuration for the existing sign-in flow.

Generate two separate random values, one for `JWT_SECRET` and one for `INTERNAL_API_KEY`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**`server/.env`**

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/careercompass
JWT_SECRET=<first-generated-value>
PORT=5000
ML_SERVICE_URL=http://localhost:8000
INTERNAL_API_KEY=<second-generated-value>
TRUST_PROXY_HOPS=0
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
CLIENT_URL=http://localhost:3000
```

Replace `MONGO_URI` with your Atlas URI if using Atlas. Starting Node does not start MongoDB.
Replace all angle-bracket placeholders with your own values.

**`ml-service/.env`**

```dotenv
INTERNAL_API_KEY=<same-second-generated-value>
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
```

Set `GEMINI_API_KEY` to enable chat. Leave it blank when testing only resume analysis or JD matching.
The `INTERNAL_API_KEY` values must match exactly between Node and Flask.

**`client/.env`**

```dotenv
REACT_APP_API_URL=http://localhost:5000
```

Restart the relevant service after changing environment variables. Never put service secrets in the client.

### 4. Run all three services

Open three PowerShell terminals at the repository root and keep each running.

**Terminal 1 — Flask**

```powershell
cd ml-service
.\venv\Scripts\python.exe app.py
```

**Terminal 2 — Node**

```powershell
cd server
node server.js
```

**Terminal 3 — React**

```powershell
cd client
npm start
```

On macOS/Linux, start Flask with `./venv/bin/python app.py` from `ml-service`; Node and React commands
are unchanged. Flask loads or trains the ATS model during startup.

Open [http://localhost:3000](http://localhost:3000). Node runs on port 5000; Flask runs on port 8000.
Check Flask with `Invoke-RestMethod http://localhost:8000/health` in PowerShell. Sign in, upload a fresh
PDF resume, then choose **JD Match**. Analyses created before resume-text storage require re-upload.

### Existing Google OAuth setup (local)

Configure a web OAuth client in [Google Cloud Console](https://console.cloud.google.com) with
`http://localhost:5000/api/auth/google/callback` as an authorized redirect URI. Supply its credentials
in `server/.env` and ensure your account is allowed to use the OAuth app while it is in testing.

---

## 🔁 Retraining the ML Model

The ATS model can be retrained on demand after code changes. The Node `/api/retrain` route is removed.
All Flask endpoints except `/health` require `X-Internal-Key`: missing or incorrect keys return JSON 401.
If `INTERNAL_API_KEY` is unset or empty, protected endpoints return JSON 403, including `/retrain`.

```bash
# Call Flask directly using the shared secret from your environment.
curl -X POST https://your-space-name.hf.space/retrain \
  -H "X-Internal-Key: $INTERNAL_API_KEY"
```

Retrain when you change `extract_features()`, update training data tiers, or add new scoring features.

---

## 📈 Future Scope

- Career roadmap with learning path recommendations
- Real job listing integration (LinkedIn, Indeed API)
- Per-role ML models (separate model per job category)
- Resume builder with inline AI suggestions

---

## 📸 Screenshots

<img width="1545" height="905" alt="image" src="https://github.com/user-attachments/assets/d20a83a6-2a31-4dbb-ac77-5c42676fba61" />
<img width="1528" height="887" alt="image" src="https://github.com/user-attachments/assets/a4fd784d-7201-4b9a-82f8-08f63f905a17" />
<img width="1492" height="872" alt="image" src="https://github.com/user-attachments/assets/f4d07baa-d6b5-4808-a129-adaf52e8a0e0" />
<img width="1525" height="915" alt="image" src="https://github.com/user-attachments/assets/d1f1a3ae-111a-4147-883d-54baebb9162a" />
<img width="1692" height="917" alt="image" src="https://github.com/user-attachments/assets/869b23d4-c628-41c2-bf54-89d53ea6ffe2" />
<img width="1681" height="911" alt="image" src="https://github.com/user-attachments/assets/27e25876-517e-49fa-b7b0-2eadecdd4594" />
<img width="1691" height="905" alt="image" src="https://github.com/user-attachments/assets/2262a5f2-a50c-4d21-bb03-26b3d9dae253" />
<img width="1516" height="925" alt="image" src="https://github.com/user-attachments/assets/9a3f749c-ef26-477a-b9cc-255e75eb207f" />

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m "feat: add your feature"`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## 📬 Contact

Built by **Avi Mishra** — feel free to connect or raise an issue for feedback and suggestions.

---

⭐ If you found this project useful, consider giving it a star!
