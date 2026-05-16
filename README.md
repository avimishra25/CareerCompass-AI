# 🧭 CareerCompass AI

> AI-powered resume analyzer with ML-based ATS scoring, OpenAI career guidance, and Google OAuth authentication.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.10+-yellow.svg)](https://python.org)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.4-orange.svg)](https://scikit-learn.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green.svg)](https://mongodb.com/atlas)
![Deployed](https://img.shields.io/badge/Deployed-Vercel%20%2B%20Render%20%2B%20HuggingFace-blueviolet)

---

## 📌 Overview

CareerCompass AI is a full-stack career intelligence platform that analyzes resumes and provides actionable feedback for job seekers.

It combines NLP (spaCy + TF-IDF) with a trained **GradientBoostingRegressor ML model** and OpenAI GPT-4o-mini to extract skills, predict ATS readiness scores, surface ML-identified improvement insights, and provide personalized career guidance through an interactive chatbot with full conversation memory.

The platform goes beyond analysis — it tells users **exactly what to fix and why**, backed by a real ML model trained on 600 synthetic resume samples across 12 job profiles.

---

## ▶️ Live Demo

**https://career-compass-ai-omega-smoky.vercel.app/**

---

## ✨ Features

### 🔐 Authentication
- **Google OAuth 2.0** via Passport.js — one-click sign in, no password required
- JWT-based session management with 7-day token expiry
- Secure token handoff via server-side redirect after OAuth callback

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

### 💬 AI Career Chatbot
- OpenAI GPT-4o-mini powered career advisor
- Full conversation history injected into every API call (multi-turn memory)
- ML improvement insights injected into system prompt for consistent, resume-aware advice
- Target role and best role context passed per session

### 📄 PDF Report Export
- Download full ATS analysis report as PDF (jsPDF + html2canvas)
- Frontend-based rendering — no backend load

### 🔀 Resume Comparison
- Select any 2 past analyses and compare side-by-side
- Diff view for ATS score, skill matches, and ML insights

### 📊 Progress Tracker & Dashboard
- Skills progress tracker across multiple analyses over time
- Dashboard stats: total analyses, top matched role, average ATS score, last analysis date
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
│         Auth · Upload · History · Analysis Routes               │
│                    (Render — Web Service)                       │
│                           │                                     │
│              ┌────────────┴────────────┐                        │
│              ▼                         ▼                        │
│     MongoDB Atlas                 Flask ML Service              │
│   (Users · Analyses)          spaCy · TF-IDF · GBR             │
│                               OpenAI GPT-4o-mini                │
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
Flask returns JSON → Node.js saves to MongoDB (with mlInsights)
        ↓
React renders: ATS Report + ML Insights + Career Match + Chatbot
```

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

**Feature importances** are extracted from `regressor.feature_importances_` and returned as `top_drivers` and `improve_here` for every analysis.

**Model persistence:** Saved as `ats_model.pkl` on first startup. Reloaded on subsequent restarts. Retrainable via `POST /retrain`.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS, Axios, jsPDF, html2canvas |
| State Management | React Context API (AuthContext) |
| Backend | Node.js 18+, Express.js |
| File Handling | Multer (PDF uploads) |
| Authentication | Google OAuth 2.0, Passport.js, JWT, bcryptjs |
| Database | MongoDB Atlas, Mongoose |
| NLP | Python, spaCy (en_core_web_sm), TF-IDF, pdfminer.six |
| ML Model | scikit-learn (GradientBoostingRegressor, StandardScaler, Pipeline) |
| AI Chatbot | OpenAI GPT-4o-mini |
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
│   │   │                           # History, Dashboard, About, Compare, Profile
│   │   └── App.js
├── server/                         # Node.js backend
│   ├── config/                     # passport.js (Google OAuth strategy)
│   ├── middleware/                 # JWT auth middleware
│   ├── models/                     # User, Analysis (+ mlInsights)
│   ├── routes/                     # auth.js (Google OAuth, /me)
│   ├── server.js
│   └── .env
└── ml-service/                     # Python ML + NLP service
    ├── app.py                      # Flask, spaCy, TF-IDF, GBR, OpenAI
    ├── requirements.txt
    └── .env
```

---

## ⚙️ Environment Variables

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
```

**Hugging Face Spaces (ML Service)**
```env
OPENAI_API_KEY=your_openai_key
```

---

## ⚙️ Local Setup

### Prerequisites
- Node.js v18+
- Python 3.10+
- MongoDB Atlas account (free tier works)
- Google Cloud Console project with OAuth 2.0 credentials

### 1. Clone Repository

```bash
git clone https://github.com/avimishra25/CareerCompass-AI.git
cd CareerCompass-AI
```

### 2. Backend Setup

```bash
cd server
npm install
```

Create `.env` inside `/server`:

```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/careercompass
JWT_SECRET=your_secret_key_here
PORT=5000
ML_SERVICE_URL=http://localhost:8000
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
CLIENT_URL=http://localhost:3000
```

```bash
node server.js
# ✅ MongoDB connected
# Server running on http://localhost:5000
```

### 3. Frontend Setup

```bash
cd client
npm install
```

Create `.env` inside `/client`:

```env
REACT_APP_API_URL=http://localhost:5000
```

```bash
npm start
# App runs at http://localhost:3000
```

### 4. ML Service Setup

```bash
cd ml-service
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

Create `.env` inside `/ml-service`:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

```bash
python app.py
# 🤖 Training ATS model on synthetic data...
# ✅ Model trained
# Server running on http://localhost:8000
```

### Running All Three Services

| Terminal | Command | Port |
|---|---|---|
| 1 — ML Service | `python app.py` (ml-service, venv active) | 8000 |
| 2 — Backend | `node server.js` (server/) | 5000 |
| 3 — Frontend | `npm start` (client/) | 3000 |

### Google OAuth Setup (Local)

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:5000/api/auth/google/callback` to Authorized redirect URIs
4. Add your email as a test user under APIs & Services → OAuth consent screen → Audience

---

## 🔁 Retraining the ML Model

```bash
# Via API (requires JWT)
curl -X POST https://your-backend.onrender.com/api/retrain \
  -H "Authorization: Bearer YOUR_TOKEN"

# Locally (direct Flask call)
curl -X POST http://localhost:8000/retrain
```

Retrain when you change `extract_features()`, update training data tiers, or add new scoring features.

---

## 📈 Future Scope

- Job description keyword matching for role-specific ATS scoring
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
