from flask import Flask, request, jsonify
from flask_cors import CORS
import spacy
import os
import re
import uuid
import json
import pickle
import numpy as np
from pdfminer.high_level import extract_text
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from openai import OpenAI
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app)
nlp = spacy.load("en_core_web_sm")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

MODEL_PATH = "ats_model.pkl"


# ─── Expanded Skill List (200+ skills) ───────────────────────
SKILL_LIST = [
    # Languages
    "python", "java", "c++", "c#", "javascript", "typescript", "kotlin",
    "swift", "go", "rust", "ruby", "php", "scala", "r", "matlab", "perl",
    "bash", "shell", "c", "dart", "elixir", "haskell", "lua",
    # Frontend
    "react", "vue", "angular", "nextjs", "nuxtjs", "svelte", "html", "css",
    "tailwind", "bootstrap", "sass", "less", "redux", "zustand", "mobx",
    "webpack", "vite", "babel", "jest", "cypress", "storybook",
    "react query", "framer motion", "three.js", "d3.js",
    # Backend
    "node", "express", "fastapi", "django", "flask", "spring boot",
    "asp.net", "laravel", "rails", "graphql", "rest api", "grpc",
    "fastify", "hapi", "nestjs", "gin", "fiber", "echo",
    # Databases
    "mongodb", "mysql", "postgresql", "sqlite", "redis", "firebase",
    "cassandra", "dynamodb", "elasticsearch", "neo4j", "supabase",
    "planetscale", "cockroachdb", "influxdb", "snowflake", "bigquery",
    # DevOps / Cloud
    "docker", "kubernetes", "aws", "azure", "gcp", "terraform",
    "ansible", "jenkins", "github actions", "gitlab ci", "circleci",
    "linux", "git", "nginx", "apache", "prometheus", "grafana",
    "datadog", "splunk", "helm", "istio", "vault",
    # Data / ML / AI
    "machine learning", "deep learning", "pandas", "numpy", "tensorflow",
    "pytorch", "scikit-learn", "keras", "xgboost", "lightgbm",
    "matplotlib", "seaborn", "plotly", "data science", "nlp",
    "computer vision", "reinforcement learning", "hugging face",
    "langchain", "openai", "llm", "rag", "vector database",
    "apache spark", "hadoop", "airflow", "dbt", "kafka",
    # Mobile
    "react native", "flutter", "android", "ios", "swift", "kotlin",
    "xamarin", "ionic", "expo",
    # Design / UX
    "figma", "adobe xd", "sketch", "wireframing", "prototyping",
    "user research", "ui design", "ux design", "canva", "illustrator",
    # Security
    "networking", "ethical hacking", "firewalls", "siem", "cryptography",
    "penetration testing", "owasp", "soc", "vulnerability assessment",
    "cybersecurity", "cloud security",
    # Soft / Methodologies
    "agile", "scrum", "kanban", "jira", "confluence", "git flow",
    "tdd", "bdd", "ci/cd", "microservices", "system design",
    "object oriented programming", "functional programming", "design patterns",
]

ALIASES = {
    "html5":               "html",
    "css3":                "css",
    "node.js":             "node",
    "nodejs":              "node",
    "react.js":            "react",
    "reactjs":             "react",
    "next.js":             "nextjs",
    "nuxt.js":             "nuxtjs",
    "express.js":          "express",
    "mongodb atlas":       "mongodb",
    "rest apis":           "rest api",
    "restful api":         "rest api",
    "restful apis":        "rest api",
    "restful":             "rest api",
    "scikit learn":        "scikit-learn",
    "sklearn":             "scikit-learn",
    "github":              "git",
    "gitlab":              "git",
    "bitbucket":           "git",
    "java script":         "javascript",
    "type script":         "typescript",
    "vue.js":              "vue",
    "angular.js":          "angular",
    "spring":              "spring boot",
    "postgres":            "postgresql",
    "psql":                "postgresql",
    "gpt":                 "openai",
    "chatgpt":             "openai",
    "oop":                 "object oriented programming",
    "object-oriented":     "object oriented programming",
    "ci cd":               "ci/cd",
    "github actions":      "github actions",
    "aws lambda":          "aws",
    "amazon web services": "aws",
    "google cloud":        "gcp",
    "microsoft azure":     "azure",
}

# ─── Role definitions ─────────────────────────────────────────
ROLE_DEFINITIONS = {
    "fullstack developer":    {"emoji": "💻", "skills": ["react","node","express","mongodb","javascript","html","css","rest api","git"]},
    "frontend developer":     {"emoji": "🎨", "skills": ["react","html","css","javascript","typescript","tailwind","redux","figma","vue","angular"]},
    "backend developer":      {"emoji": "⚙️",  "skills": ["node","express","python","django","flask","postgresql","mongodb","redis","docker","rest api"]},
    "data scientist":         {"emoji": "📊", "skills": ["python","pandas","numpy","scikit-learn","tensorflow","pytorch","matplotlib","sql","machine learning","r"]},
    "devops engineer":        {"emoji": "🛠️",  "skills": ["docker","kubernetes","aws","linux","git","terraform","ansible","jenkins","github actions","nginx"]},
    "ml engineer":            {"emoji": "🤖", "skills": ["python","tensorflow","pytorch","scikit-learn","pandas","numpy","mlflow","docker","aws","deep learning"]},
    "mobile developer":       {"emoji": "📱", "skills": ["react native","flutter","android","ios","kotlin","swift","firebase","redux","expo"]},
    "cloud architect":        {"emoji": "☁️",  "skills": ["aws","azure","gcp","terraform","kubernetes","docker","microservices","linux","networking","ci/cd"]},
    "cybersecurity analyst":  {"emoji": "🔐", "skills": ["networking","ethical hacking","firewalls","siem","cryptography","penetration testing","owasp","linux","cybersecurity"]},
    "ui/ux designer":         {"emoji": "✏️",  "skills": ["figma","adobe xd","sketch","wireframing","prototyping","user research","ui design","ux design","css","html"]},
    "database administrator": {"emoji": "🗄️",  "skills": ["postgresql","mysql","mongodb","redis","elasticsearch","sql","performance tuning","backup","replication"]},
    "blockchain developer":   {"emoji": "🔗", "skills": ["solidity","ethereum","web3","smart contracts","rust","go","cryptography","node","react"]},
}

# ─── ATS constants ────────────────────────────────────────────
ATS_SECTIONS   = ["education", "experience", "skills", "projects", "summary",
                  "contact", "certifications", "achievements", "work experience",
                  "professional experience", "technical skills", "objective"]
ACTION_VERBS   = ["developed","built","led","designed","implemented","improved",
                  "created","managed","deployed","optimized","architected","launched",
                  "reduced","increased","delivered","collaborated","mentored",
                  "automated","integrated","migrated","scaled","refactored",
                  "engineered","established","pioneered","streamlined"]
QUANT_PATTERNS = [r'\d+%', r'\d+x', r'\$\d+', r'\d+\s*years?',
                  r'\d+\s*months?', r'\d+\s*users?', r'\d+\s*team',
                  r'\d+\s*million', r'\d+\s*thousand', r'\d+k\b']


# ═══════════════════════════════════════════════════════════════
#  SECTION 1 — FEATURE EXTRACTION
#  These are the raw measurements we take from any resume.
#  Each one becomes an input column for the ML model.
# ═══════════════════════════════════════════════════════════════

def extract_features(raw_text, detected_skills):
    """
    Converts a raw resume string into a fixed-length numeric
    feature vector that the sklearn model can learn from.

    Returns a dict (human-readable) and a list (model input).
    """
    text_lower  = raw_text.lower()
    words       = raw_text.split()
    sentences   = [s.strip() for s in re.split(r'[.!?]', raw_text) if s.strip()]
    word_count  = len(words)

    # ── Feature 1: skill_count ──────────────────────────────
    # How many distinct skills appear in the resume.
    # More skills → generally better ATS pass rate.
    skill_count = len(detected_skills)

    # ── Feature 2: skill_density ────────────────────────────
    # Skills per 100 words. A resume with 20 skills in 200 words
    # is denser (more focused) than one with 20 in 1000 words.
    skill_density = (skill_count / word_count * 100) if word_count > 0 else 0

    # ── Feature 3: unique_verb_count ────────────────────────
    # Number of distinct action verbs found. ATS systems reward
    # resumes that describe accomplishments, not just duties.
    found_verbs       = [v for v in ACTION_VERBS if v in text_lower]
    unique_verb_count = len(set(found_verbs))

    # ── Feature 4: verb_density ─────────────────────────────
    # Action verbs per 100 words — avoids rewarding longer
    # resumes just for having more words.
    verb_density = (unique_verb_count / word_count * 100) if word_count > 0 else 0

    # ── Feature 5: quant_count ──────────────────────────────
    # Count of quantified achievements (50%, 3x, $200K, etc.)
    # These are the #1 signal ATS + recruiters look for.
    quant_count = sum(1 for p in QUANT_PATTERNS if re.search(p, text_lower))

    # ── Feature 6: section_count ────────────────────────────
    # How many standard resume sections are present.
    # Missing "Education" or "Experience" is a hard ATS fail.
    section_count = sum(
        1 for s in ATS_SECTIONS
        if re.search(r'\b' + re.escape(s) + r'\b', text_lower)
    )

    # ── Feature 7: word_count ───────────────────────────────
    # Raw word count. Too short = thin resume. Too long = noise.
    # Optimal range is roughly 300–800 for most roles.
    # (stored directly, model learns the curve)

    # ── Feature 8: avg_sentence_length ──────────────────────
    # Average words per sentence. Very long sentences are hard
    # for ATS parsers to process correctly.
    avg_sentence_len = (
        np.mean([len(s.split()) for s in sentences]) if sentences else 0
    )

    # ── Feature 9: has_contact_info ─────────────────────────
    # Binary flag — does the resume contain an email or phone?
    # Missing contact info auto-fails most ATS systems.
    email_present = 1 if re.search(r'[\w.+-]+@[\w-]+\.[a-z]{2,}', raw_text) else 0
    phone_present = 1 if re.search(r'(\+?\d[\d\s\-().]{7,}\d)', raw_text) else 0
    has_contact   = min(1, email_present + phone_present)

    # ── Feature 10: has_summary ─────────────────────────────
    # Binary — does the resume open with a summary/objective?
    # Summaries help ATS rank-order candidates immediately.
    has_summary = 1 if re.search(
        r'\b(summary|objective|profile|about me)\b', text_lower
    ) else 0

    feature_dict = {
        "skill_count":       skill_count,
        "skill_density":     round(skill_density, 3),
        "unique_verb_count": unique_verb_count,
        "verb_density":      round(verb_density, 3),
        "quant_count":       quant_count,
        "section_count":     section_count,
        "word_count":        word_count,
        "avg_sentence_len":  round(avg_sentence_len, 2),
        "has_contact":       has_contact,
        "has_summary":       has_summary,
    }

    # Exact same order every time — critical for model input
    feature_vector = [
        skill_count, skill_density, unique_verb_count, verb_density,
        quant_count, section_count, word_count, avg_sentence_len,
        has_contact, has_summary,
    ]

    return feature_dict, feature_vector


# ═══════════════════════════════════════════════════════════════
#  SECTION 2 — SYNTHETIC TRAINING DATA GENERATOR
#
#  We have no labelled dataset, so we generate one.
#  The logic: we define what a "bad", "average", and "good"
#  resume looks like, then add random noise so the model
#  learns a smooth curve rather than memorising fixed points.
#
#  This is a standard technique called programmatic labelling
#  (similar to weak supervision / Snorkel framework).
# ═══════════════════════════════════════════════════════════════

def generate_training_data(n_samples=500):
    """
    Generates n_samples synthetic (feature_vector, ats_score) pairs.
    Returns X (feature matrix) and y (score vector).
    """
    np.random.seed(42)  # reproducible results every run
    X, y = [], []

    for _ in range(n_samples):
        # ── Pick a resume "quality tier" at random ──────────
        # poor=30%, average=40%, good=30%
        tier = np.random.choice(["poor", "average", "good"],
                                p=[0.30, 0.40, 0.30])

        if tier == "poor":
            # Poor resume: few skills, no verbs, no numbers,
            # missing sections, too short or way too long
            skill_count       = np.random.randint(0, 5)
            skill_density     = np.random.uniform(0, 1.5)
            unique_verb_count = np.random.randint(0, 3)
            verb_density      = np.random.uniform(0, 0.5)
            quant_count       = np.random.randint(0, 2)
            section_count     = np.random.randint(0, 3)
            word_count        = np.random.choice(
                [np.random.randint(50, 150),      # too short
                 np.random.randint(1500, 3000)]   # way too long
            )
            avg_sentence_len  = np.random.uniform(25, 50)  # walls of text
            has_contact       = np.random.choice([0, 1], p=[0.4, 0.6])
            has_summary       = 0
            base_score        = np.random.uniform(10, 35)

        elif tier == "average":
            # Average resume: decent skills, some verbs,
            # 1–2 quantified results, most sections present
            skill_count       = np.random.randint(5, 12)
            skill_density     = np.random.uniform(1.5, 3.5)
            unique_verb_count = np.random.randint(3, 8)
            verb_density      = np.random.uniform(0.5, 1.5)
            quant_count       = np.random.randint(1, 4)
            section_count     = np.random.randint(3, 6)
            word_count        = np.random.randint(250, 700)
            avg_sentence_len  = np.random.uniform(12, 25)
            has_contact       = 1
            has_summary       = np.random.choice([0, 1], p=[0.5, 0.5])
            base_score        = np.random.uniform(40, 65)

        else:  # good
            # Strong resume: 12+ skills, many action verbs,
            # multiple quantified wins, all sections, right length
            skill_count       = np.random.randint(12, 25)
            skill_density     = np.random.uniform(3.0, 6.0)
            unique_verb_count = np.random.randint(8, 20)
            verb_density      = np.random.uniform(1.5, 3.5)
            quant_count       = np.random.randint(4, 10)
            section_count     = np.random.randint(5, 9)
            word_count        = np.random.randint(350, 800)
            avg_sentence_len  = np.random.uniform(8, 18)
            has_contact       = 1
            has_summary       = 1
            base_score        = np.random.uniform(68, 95)

        # Add small random noise so the model learns a
        # smooth relationship, not a step function
        noise = np.random.normal(0, 3)
        score = float(np.clip(base_score + noise, 0, 100))

        feature_vector = [
            skill_count, skill_density, unique_verb_count, verb_density,
            quant_count, section_count, word_count, avg_sentence_len,
            has_contact, has_summary,
        ]

        X.append(feature_vector)
        y.append(score)

    return np.array(X), np.array(y)


# ═══════════════════════════════════════════════════════════════
#  SECTION 3 — MODEL TRAINING
#
#  We use a Pipeline:
#    Step 1 — StandardScaler: normalises all features to
#             mean=0, std=1. This is important because
#             word_count (0–3000) and has_contact (0 or 1)
#             are on completely different scales.
#
#    Step 2 — GradientBoostingRegressor: an ensemble of
#             decision trees that learns the non-linear
#             relationship between features and ATS score.
#             Much better than Ridge for this task because
#             the relationship is not linear (e.g. word_count
#             peaks at ~500 then gets penalised — a line can't
#             capture that curve).
# ═══════════════════════════════════════════════════════════════

def train_ats_model():
    """
    Trains the ATS scoring model on synthetic data.
    Saves the model to disk so it only trains once on startup.
    Returns the fitted Pipeline.
    """
    print("🤖 Training ATS model on synthetic data...")

    X, y = generate_training_data(n_samples=600)

    # Split: 80% train, 20% test — standard ML practice
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = Pipeline([
        ("scaler",    StandardScaler()),
        ("regressor", GradientBoostingRegressor(
            n_estimators=200,    # 200 trees in the ensemble
            learning_rate=0.05,  # small steps → less overfitting
            max_depth=4,         # shallow trees → generalises better
            random_state=42,
        )),
    ])

    model.fit(X_train, y_train)

    # Evaluate on held-out test set
    test_preds = model.predict(X_test)
    mae  = float(np.mean(np.abs(test_preds - y_test)))
    rmse = float(np.sqrt(np.mean((test_preds - y_test) ** 2)))
    print(f"✅ Model trained — MAE: {mae:.2f} pts, RMSE: {rmse:.2f} pts")

    # Persist to disk so we don't retrain on every cold start
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    print(f"💾 Model saved to {MODEL_PATH}")

    return model


def load_or_train_model():
    """
    Loads model from disk if it exists, otherwise trains fresh.
    This is called once at startup — not per request.
    """
    if os.path.exists(MODEL_PATH):
        try:
            with open(MODEL_PATH, "rb") as f:
                model = pickle.load(f)
            print("✅ ATS model loaded from disk")
            return model
        except Exception:
            print("⚠️  Saved model corrupted — retraining...")

    return train_ats_model()


# ── Load model at startup (happens once, not per request) ─────
ats_model = load_or_train_model()

# ── Feature importance labels (for the breakdown response) ────
FEATURE_NAMES = [
    "skill_count", "skill_density", "unique_verb_count", "verb_density",
    "quant_count", "section_count", "word_count", "avg_sentence_len",
    "has_contact", "has_summary",
]

FEATURE_LABELS = {
    "skill_count":       "Number of skills detected",
    "skill_density":     "Skill density (skills per 100 words)",
    "unique_verb_count": "Unique action verbs used",
    "verb_density":      "Action verb density",
    "quant_count":       "Quantified achievements",
    "section_count":     "Resume sections present",
    "word_count":        "Total word count",
    "avg_sentence_len":  "Average sentence length",
    "has_contact":       "Contact information present",
    "has_summary":       "Summary / objective section present",
}


def get_feature_importances(model, feature_vector):
    """
    Extracts which features drove the score up or down.
    Returns top 3 positive drivers and top 2 things to improve.
    The GradientBoostingRegressor exposes .feature_importances_
    — these are Gini importance scores showing which feature
    the trees split on most often.
    """
    importances = model.named_steps["regressor"].feature_importances_
    paired = sorted(
        zip(FEATURE_NAMES, importances, feature_vector),
        key=lambda x: -x[1]
    )

    drivers = []
    for name, importance, value in paired[:3]:
        drivers.append({
            "feature":    name,
            "label":      FEATURE_LABELS[name],
            "importance": round(float(importance) * 100, 1),
            "your_value": round(float(value), 2),
        })

    improvements = []
    # Features with low values AND high importance → biggest gains available
    low_value_important = sorted(
        [(n, imp, v) for n, imp, v in paired if v < 3 and imp > 0.03],
        key=lambda x: -x[1]
    )
    for name, importance, value in low_value_important[:2]:
        improvements.append({
            "feature": name,
            "label":   FEATURE_LABELS[name],
            "tip":     _improvement_tip(name),
        })

    return drivers, improvements


def _improvement_tip(feature_name):
    tips = {
        "skill_count":       "Add more relevant technical skills to your skills section.",
        "skill_density":     "Integrate skill mentions naturally throughout your experience bullets.",
        "unique_verb_count": "Start each bullet point with a strong action verb (built, led, deployed...).",
        "verb_density":      "Replace passive phrases like 'was responsible for' with active verbs.",
        "quant_count":       "Add numbers to your achievements: percentages, team sizes, revenue impact.",
        "section_count":     "Ensure your resume has: Summary, Experience, Skills, Projects, Education.",
        "word_count":        "Aim for 400–700 words — enough detail without overwhelming the parser.",
        "avg_sentence_len":  "Break long sentences into shorter, punchy bullet points.",
        "has_contact":       "Add your email and phone number clearly at the top.",
        "has_summary":       "Add a 2–3 sentence professional summary at the top of your resume.",
    }
    return tips.get(feature_name, "Review and improve this section.")


# ═══════════════════════════════════════════════════════════════
#  SECTION 4 — ML-POWERED ATS SCORING
#  Replaces the old hardcoded formula with model prediction.
#  We still return a breakdown so the UI doesn't need changes.
# ═══════════════════════════════════════════════════════════════

def compute_ats_score_ml(raw_text, detected_skills):
    """
    Uses the trained GradientBoostingRegressor to predict
    the ATS score instead of a hand-crafted formula.

    Returns:
        total        — int score 0–100
        breakdown    — dict compatible with the old format
        ml_insights  — new dict with feature importances
    """
    feature_dict, feature_vector = extract_features(raw_text, detected_skills)

    # Model prediction
    raw_prediction = ats_model.predict([feature_vector])[0]
    total = int(np.clip(round(raw_prediction), 0, 100))

    # Get feature importances for insight
    drivers, improvements = get_feature_importances(ats_model, feature_vector)

    # ── Keep backward-compatible breakdown format ─────────
    # The frontend expects these exact keys — we reconstruct
    # them from the feature values so nothing breaks.
    text_lower  = raw_text.lower()
    found_verbs = [v for v in ACTION_VERBS if v in text_lower]

    breakdown = {
        "skills":     {
            "score": min(30, int(feature_dict["skill_count"] * 1.5)),
            "max":   30,
            "label": "Skill coverage",
        },
        "verbs":      {
            "score": min(20, feature_dict["unique_verb_count"] * 2),
            "max":   20,
            "label": "Action verbs",
            "found": list(set(found_verbs))[:8],
        },
        "quantified": {
            "score": min(20, feature_dict["quant_count"] * 4),
            "max":   20,
            "label": "Quantified results",
        },
        "sections":   {
            "score": min(20, feature_dict["section_count"] * 2),
            "max":   20,
            "label": "Resume sections",
        },
        "length":     {
            "score": _length_score(feature_dict["word_count"]),
            "max":   10,
            "label": "Length & density",
            "words": feature_dict["word_count"],
        },
    }

    ml_insights = {
        "model":        "GradientBoostingRegressor",
        "features":     feature_dict,
        "top_drivers":  drivers,
        "improve_here": improvements,
    }

    return total, breakdown, ml_insights


def _length_score(word_count):
    if 350 <= word_count <= 750:
        return 10
    elif 750 < word_count <= 1200:
        return 7
    elif 200 <= word_count < 350:
        return 5
    return 2


# ═══════════════════════════════════════════════════════════════
#  SECTION 5 — UNCHANGED HELPERS (normalize, extract, rank, match)
# ═══════════════════════════════════════════════════════════════

def normalize(text):
    t = text.lower()
    for alias, canonical in sorted(ALIASES.items(), key=lambda x: -len(x[0])):
        t = re.sub(r'\b' + re.escape(alias) + r'\b', canonical, t)
    return t


def extract_skills(raw_text):
    normalized = normalize(raw_text)
    detected   = set()

    for skill in SKILL_LIST:
        pattern = r'(?<![a-z0-9\-])' + re.escape(skill) + r'(?![a-z0-9\-])'
        if re.search(pattern, normalized):
            detected.add(skill)

    doc         = nlp(normalized[:50000])
    lemmas      = " ".join([t.lemma_ for t in doc if not t.is_punct and len(t.text) > 1])
    noun_chunks = " ".join([c.text for c in doc.noun_chunks])
    combined    = lemmas + " " + noun_chunks

    for skill in SKILL_LIST:
        if skill not in detected:
            skill_lemma = " ".join([t.lemma_ for t in nlp(skill)])
            if skill_lemma in combined:
                detected.add(skill)

    return list(detected)


def rank_skills_tfidf(raw_text, detected_skills):
    if not detected_skills:
        return []
    try:
        corpus = [raw_text.lower()] + [
            f"{s} {s} experience proficient {s} skilled" for s in detected_skills
        ]
        vec  = TfidfVectorizer(ngram_range=(1, 2), max_features=5000)
        mat  = vec.fit_transform(corpus)
        sims = cosine_similarity(mat[0:1], mat[1:]).flatten()
        scored = sorted(zip(detected_skills, sims), key=lambda x: -x[1])
        return [s for s, _ in scored]
    except Exception:
        return detected_skills


def match_roles(detected_skills, target_role=None):
    skill_set = set(detected_skills)
    results   = {}

    for role, info in ROLE_DEFINITIONS.items():
        required = info["skills"]
        matched  = [s for s in required if s in skill_set]
        missing  = [s for s in required if s not in skill_set]
        score    = round((len(matched) / len(required)) * 100) if required else 0
        results[role] = {"score": score, "missing": missing, "emoji": info["emoji"]}

    sorted_roles  = sorted(results.items(), key=lambda x: -x[1]["score"])
    best_role     = sorted_roles[0] if sorted_roles else None
    best_role_obj = {"role": best_role[0], "score": best_role[1]["score"]} if best_role else None

    target_role_data = None
    if target_role and target_role.lower() in results:
        target_role_data = {
            "role":  target_role.lower(),
            "score": results[target_role.lower()]["score"],
        }

    return results, best_role_obj, target_role_data


# ═══════════════════════════════════════════════════════════════
#  SECTION 6 — ROUTES
# ═══════════════════════════════════════════════════════════════

@app.route("/analyze", methods=["POST"])
def analyze():
    file        = request.files["resume"]
    target_role = request.form.get("targetRole", None)
    file_path   = f"temp_{uuid.uuid4().hex}.pdf"
    file.save(file_path)

    try:
        raw_text = extract_text(file_path)
        if not raw_text or not raw_text.strip():
            return jsonify({"skills": [], "error": "Could not extract text from PDF"}), 400

        detected = extract_skills(raw_text)
        ranked   = rank_skills_tfidf(raw_text, detected)

        # ── ML-powered ATS scoring (replaces old formula) ──
        ats_total, ats_breakdown, ml_insights = compute_ats_score_ml(raw_text, ranked)

        match_results, best_role_obj, target_role_data = match_roles(ranked, target_role)

        response_data = {
            "skills":        ranked,
            "total_found":   len(ranked),
            "match":         match_results,
            "bestRole":      best_role_obj,
            "ats_score":     ats_total,
            "ats_breakdown": ats_breakdown,
            "ml_insights":   ml_insights,    # ← new field
            "raw_text":      raw_text[:8000],
        }

        if target_role_data:
            response_data["targetRoleAnalysis"] = {
                "role":    target_role_data["role"],
                "score":   target_role_data["score"],
                "missing": match_results.get(target_role_data["role"], {}).get("missing", []),
                "emoji":   match_results.get(target_role_data["role"], {}).get("emoji", "🎯"),
            }

        return jsonify(response_data)

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@app.route("/agent/gap", methods=["POST"])
def agent_gap():
    try:
        if not client:
            return jsonify({"error": "OpenAI API key not configured"}), 500

        data = request.json or {}

        user_skills   = data.get("skills", [])
        best_role     = data.get("bestRole", {})
        ats_score     = data.get("atsScore", 0)
        user_message  = data.get("message", "Analyze my resume")
        history       = data.get("history", [])          # ← was ignored before
        target_role   = data.get("targetRole", None)
        ml_insights   = data.get("mlInsights", {})       # ← pass from frontend

        if isinstance(best_role, str):
            best_role = {"role": best_role, "score": 0}

        role_context = target_role if target_role else best_role.get("role", "unknown")

        # Include ML improvement areas in the system prompt
        improve_tips = ""
        if ml_insights.get("improve_here"):
            tips = [f"- {t['label']}: {t['tip']}"
                    for t in ml_insights["improve_here"]]
            improve_tips = "\nML-identified improvement areas:\n" + "\n".join(tips)

        system_prompt = f"""You are a career advisor AI.

Candidate skills: {', '.join(user_skills)}
Predicted best role: {best_role.get('role', 'unknown')}
{f"User's target role: {target_role}" if target_role else ""}
ATS Score: {ats_score}/100{improve_tips}

STRICT RULES:
- If a target role is specified, prioritize advice for that role
- Give specific, actionable advice
- DO NOT assume software developer unless explicitly mentioned

Give:
1. Short summary
2. Strengths
3. Weaknesses
4. Skills to improve specifically for {role_context}"""

        # ── FIX: conversation history ──────────
        # meaning every chatbot reply had no memory of the
        # previous messages in the session.
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
        )

        reply = response.choices[0].message.content.strip()
        return jsonify({"reply": reply})

    except Exception as e:
        print("❌ ERROR:", str(e))
        return jsonify({"error": str(e), "reply": "Something went wrong"}), 500


@app.route("/retrain", methods=["POST"])
def retrain():
    """
    Admin endpoint to retrain the model on fresh synthetic data.
    Useful when you update the training logic or add new features.
    Call: POST /retrain  (no body needed)
    """
    try:
        global ats_model
        ats_model = train_ats_model()
        return jsonify({"status": "ok", "message": "Model retrained successfully"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":      "ok",
        "openai":      bool(client),
        "model":       "GradientBoostingRegressor",
        "model_ready": ats_model is not None,
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
