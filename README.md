# 🧭 CareerCompass AI

> 🚀 AI-powered resume analyzer with ML-based ATS scoring, OpenAI career guidance, and email-verified authentication.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.10+-yellow.svg)](https://python.org)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.4-orange.svg)](https://scikit-learn.org)
![AI Powered](https://img.shields.io/badge/AI-Powered-blueviolet)
![ATS Optimized](https://img.shields.io/badge/ATS-Optimized-green)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green.svg)](https://mongodb.com/atlas)

---

## 📌 Overview

CareerCompass AI is an AI-powered career intelligence platform that analyzes resumes and guides users toward their ideal career path.

It combines NLP (spaCy + TF-IDF) with a trained **GradientBoostingRegressor ML model** and OpenAI to extract skills, predict ATS readiness scores, surface ML-identified improvement insights, and provide personalized career guidance through an interactive chatbot with full conversation memory.

The platform goes beyond analysis — it tells users **exactly what to fix and why**, backed by a real ML model trained on 600 synthetic resume samples.

---

## ▶️ Live Demo
**https://career-compass-ai-omega-smoky.vercel.app/**

---

## ✨ Features

### 🔐 Authentication
- JWT-based register / login / logout with bcrypt password hashing
- **Email OTP verification on registration** — account activated only after verifying email
- Profile page with account info and **change password** functionality

### 📄 Resume Analysis
- Drag & drop PDF upload
- NLP skill extraction using spaCy (lemmatization + two-pass smart matching)
- 200+ skill dictionary with alias normalisation (Node.js → node, sklearn → scikit-learn)
- TF-IDF cosine similarity skill ranking
- Career role matching across **12 job profiles** with match % and missing skills
- Target role selection — benchmarks analysis specifically against your goal role
- Best role auto-detection

### 📊 ML-Powered ATS Scoring
- **GradientBoostingRegressor** trained on 600 synthetic resume samples
- Scores resume across **10 features**: skill count, skill density, action verb count, verb density, quantified achievements, section count, word count, sentence length, contact info, summary presence
- Feature importance extraction — surfaces **top_drivers** (what scored well) and **improve_here** (what to fix)
- Actionable ML-powered improvement tips per feature
- Backward-compatible 5-dimension breakdown (skills, verbs, quantified, sections, length)
- Score out of 100 with circular gauge UI

### 💬 AI Chatbot
- OpenAI GPT-4o-mini powered career advisor
- **Full conversation history** injected into every API call (multi-turn memory)
- ML improvement insights injected into system prompt for consistent advice
- Target role and best role context passed per session

### 📄 PDF Report Export
- Download full analysis as PDF (jsPDF + html2canvas)
- Frontend-based, no backend load

### 🔀 Resume Comparison
- Select any 2 past analyses and compare side-by-side
- Built on saved history data

### 📊 Progress Tracker & Dashboard
- Skills progress tracker across analyses
- Dashboard stats: total analyses, top matched role, average ATS score, last analysis date
- Visual progress bars and glassmorphism UI

### 🕓 Analysis History
- Every analysis saved to MongoDB with full mlInsights
- View, manage, and delete past reports
- ATS score and target role shown per entry

---

## 🧠 ML Model Details

The ATS scoring engine uses a **scikit-learn Pipeline**:

```
StandardScaler → GradientBoostingRegressor
  n_estimators=200 | learning_rate=0.05 | max_depth=4
```

**Training data:** 600 synthetic resume samples across 3 quality tiers (poor / average / good) with Gaussian noise (σ=3) for smooth curve learning. Seed fixed at 42 for reproducibility.

**Feature importances** are extracted from `regressor.feature_importances_` and returned to the frontend as `top_drivers` and `improve_here` for every analysis.

**Model persistence:** Saved as `ats_model.pkl` on first startup. Reloaded on subsequent restarts. Retrainable via `POST /api/retrain`.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js 19, Tailwind CSS, Axios, jsPDF, html2canvas |
| State Management | React AuthContext (global session + email verification state) |
| Backend | Node.js 18+, Express.js |
| File Handling | Multer (PDF uploads, disk storage) |
| Authentication | JWT, bcryptjs, Nodemailer (OTP email) |
| Database | MongoDB Atlas, Mongoose |
| NLP | Python, spaCy (en_core_web_sm), TF-IDF, pdfminer.six |
| ML Model | scikit-learn (GradientBoostingRegressor, StandardScaler, Pipeline) |
| AI Chatbot | OpenAI GPT-4o-mini |
| Deployment | Vercel (frontend), Render (backend), Hugging Face Spaces (ML) |

---

## 🏗️ Architecture & Deployment

CareerCompass AI is a distributed 3-service architecture:

| Service | Technology | Host |
|---|---|---|
| Frontend | React.js + Tailwind CSS | Vercel |
| Core Backend | Node.js + Express.js | Render |
| ML / NLP Engine | Python + Flask + scikit-learn | Hugging Face Spaces |
| Database | MongoDB Atlas | MongoDB Cloud |

---

## 🧠 How It Works

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

## 📂 Project Structure

```
CareerCompass-AI/
├── client/                         # React frontend
│   ├── src/
│   │   ├── components/             # Navbar, ATSReport, CareerAgent, ProgressTracker
│   │   ├── context/                # AuthContext (session + isVerified state)
│   │   ├── pages/                  # AuthPage, UploadResume, History, Dashboard
│   │   │                           # About, Compare, Profile
│   │   └── App.js
├── server/                         # Node.js backend
│   ├── middleware/                 # JWT auth middleware
│   ├── models/                     # User (+ otp/isVerified fields), Analysis (+ mlInsights)
│   ├── routes/                     # auth.js (register, verify-otp, login, /me, change-password)
│   ├── utils/                      # OTP generation, email sending (Nodemailer)
│   ├── server.js
│   └── .env
└── ml-service/                     # Python ML + NLP service
    ├── app.py                      # Flask, spaCy, TF-IDF, GBR, OpenAI
    ├── requirements.txt
    └── .env
```

---

## ⚙️ Production Environment Variables

**Vercel (Frontend)**
```env
REACT_APP_API_URL=https://your-backend-on-render.com
```

**Render (Backend)**
```env
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_secret_key
ML_SERVICE_URL=https://your-space-name.hf.space
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
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
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
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
# ✅ Model trained — MAE: X.XX pts, RMSE: X.XX pts
# 💾 Model saved to ats_model.pkl
# Server running on http://localhost:8000
```

### Running All Three Services

| Terminal | Command | Port |
|---|---|---|
| 1 — ML Service | `python app.py` (ml-service, venv active) | 8000 |
| 2 — Backend | `node server.js` (server/) | 5000 |
| 3 — Frontend | `npm start` (client/) | 3000 |

---

## 🔐 Authentication Flow

1. User registers with name, email, and password
2. Password hashed with bcrypt before storing
3. **OTP sent to registered email via Nodemailer**
4. User enters OTP — account marked `isVerified: true` in MongoDB
5. JWT token issued on successful login
6. All protected routes require valid `Bearer` token
7. Token verified server-side on every request
8. AuthContext manages global session and verification state
9. Profile page allows changing password (current password verified before update)

---

## 🔁 Retraining the ML Model

The ATS model can be retrained on demand after code changes:

```bash
# Via API (requires JWT)
curl -X POST https://your-backend.com/api/retrain \
  -H "Authorization: Bearer YOUR_TOKEN"

# Or locally (no auth needed on Flask directly)
curl -X POST http://localhost:8000/retrain
```

Retrain when you: change `extract_features()`, update synthetic data tiers, or add new features to the model.

---

## 🚀 Current Status

### ✅ Completed
- JWT Authentication (Register / Login / Logout)
- **Email OTP verification on registration**
- **Profile page with change password**
- Resume PDF upload (drag & drop)
- NLP skill extraction (spaCy, two-pass matching)
- TF-IDF skill ranking
- Career role matching (12 roles)
- Skill gap analysis
- Target role selection and benchmarking
- **ML-powered ATS scoring (GradientBoostingRegressor)**
- **ML feature importance insights (top_drivers, improve_here)**
- OpenAI GPT-4o-mini chatbot with **full conversation history**
- Analysis history (save / view / delete)
- Resume comparison (side-by-side)
- Progress tracker
- PDF report export (jsPDF + html2canvas)
- Dashboard with stats and visual insights
- Modern glassmorphism UI
- Protected routes with JWT middleware
- /retrain and /health endpoints

---

## 📈 Future Scope

- Job description keyword matching for role-specific ATS scoring
- Career roadmap with learning path recommendations
- Real job listing integration (LinkedIn, Indeed API)
- Per-role ML models (separate model for each job category)
- Resume builder with AI suggestions

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

## 🏷️ Tags

AI • ML • GradientBoosting • OpenAI • Resume Analyzer • ATS Scoring • NLP • spaCy • scikit-learn • Full Stack • MERN • Career Tech • React • Node.js • Python • Flask

---

⭐ If you found this project useful, consider giving it a star!
