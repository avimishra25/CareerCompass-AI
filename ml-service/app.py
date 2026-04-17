from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import re
import uuid
import nltk
from nltk.stem import WordNetLemmatizer
from pdfminer.high_level import extract_text
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv
load_dotenv()

# Download required nltk data on startup
nltk.download('wordnet',               quiet=True)
nltk.download('omw-1.4',              quiet=True)
nltk.download('averaged_perceptron_tagger', quiet=True)
nltk.download('punkt',                quiet=True)
nltk.download('punkt_tab',            quiet=True)

lemmatizer = WordNetLemmatizer()

app = Flask(__name__)
CORS(app)

# OpenAI is optional — stubbed out when key is missing
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
client = None
if OPENAI_API_KEY:
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)


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

# ─── Role definitions (skills required per role) ─────────────
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

# ─── ATS scoring weights ──────────────────────────────────────
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


def normalize(text):
    t = text.lower()
    for alias, canonical in sorted(ALIASES.items(), key=lambda x: -len(x[0])):
        t = re.sub(r'\b' + re.escape(alias) + r'\b', canonical, t)
    return t


def lemmatize_text(text):
    """Lemmatize text using nltk WordNetLemmatizer (replaces spacy lemmatization)."""
    tokens = nltk.word_tokenize(text[:50000])
    lemmas = [lemmatizer.lemmatize(token.lower()) for token in tokens
              if token.isalpha() and len(token) > 1]
    return " ".join(lemmas)


def extract_skills(raw_text):
    normalized = normalize(raw_text)
    detected = set()

    # Pass 1: regex word-boundary match (same as before)
    for skill in SKILL_LIST:
        pattern = r'(?<![a-z0-9\-])' + re.escape(skill) + r'(?![a-z0-9\-])'
        if re.search(pattern, normalized):
            detected.add(skill)

    # Pass 2: nltk lemmatization fallback (replaces spacy)
    lemmatized = lemmatize_text(normalized)

    for skill in SKILL_LIST:
        if skill not in detected:
            # Lemmatize the skill name itself for comparison
            skill_lemma = " ".join([lemmatizer.lemmatize(w) for w in skill.split()])
            if skill_lemma in lemmatized:
                detected.add(skill)

    return list(detected)


def rank_skills_tfidf(raw_text, detected_skills):
    if not detected_skills:
        return []
    try:
        corpus = [raw_text.lower()] + [
            f"{s} {s} experience proficient {s} skilled" for s in detected_skills
        ]
        vec = TfidfVectorizer(ngram_range=(1, 2), max_features=5000)
        mat = vec.fit_transform(corpus)
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

        results[role] = {
            "score":   score,
            "missing": missing,
            "emoji":   info["emoji"],
        }

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


def compute_ats_score(raw_text, detected_skills):
    text_lower = raw_text.lower()
    words      = raw_text.split()
    word_count = len(words)

    skill_score   = min(30, len(detected_skills) * 1.5)
    found_verbs   = [v for v in ACTION_VERBS if v in text_lower]
    verb_score    = min(20, len(set(found_verbs)) * 2)
    quant_hits    = sum(1 for p in QUANT_PATTERNS if re.search(p, text_lower))
    quant_score   = min(20, quant_hits * 4)
    section_hits  = sum(1 for s in ATS_SECTIONS if re.search(r'\b' + re.escape(s) + r'\b', text_lower))
    section_score = min(20, section_hits * 2)

    if   300 <= word_count <= 700:   length_score = 10
    elif 700 < word_count  <= 1200:  length_score = 7
    elif 150 <= word_count < 300:    length_score = 5
    else:                            length_score = 2

    total = min(100, max(0, int(skill_score + verb_score + quant_score + section_score + length_score)))

    breakdown = {
        "skills":     {"score": int(skill_score),  "max": 30, "label": "Skill coverage"},
        "verbs":      {"score": int(verb_score),    "max": 20, "label": "Action verbs",
                       "found": list(set(found_verbs))[:8]},
        "quantified": {"score": int(quant_score),   "max": 20, "label": "Quantified results"},
        "sections":   {"score": int(section_score), "max": 20, "label": "Resume sections"},
        "length":     {"score": int(length_score),  "max": 10, "label": "Length & density",
                       "words": word_count},
    }

    return total, breakdown


# ─── Routes ───────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "openai": bool(client)})


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

        detected  = extract_skills(raw_text)
        ranked    = rank_skills_tfidf(raw_text, detected)
        ats_total, ats_breakdown = compute_ats_score(raw_text, ranked)
        match_results, best_role_obj, target_role_data = match_roles(ranked, target_role)

        response_data = {
            "skills":        ranked,
            "total_found":   len(ranked),
            "match":         match_results,
            "bestRole":      best_role_obj,
            "ats_score":     ats_total,
            "ats_breakdown": ats_breakdown,
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
            # Graceful stub when OpenAI key is not configured
            return jsonify({
                "reply": "AI career guidance is coming soon. Your resume has been analyzed successfully — check the ATS score and skill breakdown above for detailed feedback."
            })

        data          = request.json or {}
        user_skills   = data.get("skills", [])
        best_role     = data.get("bestRole", {})
        ats_score     = data.get("atsScore", 0)
        user_message  = data.get("message", "Analyze my resume")
        target_role   = data.get("targetRole", None)

        if isinstance(best_role, str):
            best_role = {"role": best_role, "score": 0}

        role_context  = target_role if target_role else best_role.get('role', 'unknown')

        system_prompt = f"""
You are a career advisor AI.

Candidate skills: {', '.join(user_skills)}
Predicted best role: {best_role.get('role', 'unknown')}
{f"User's target role: {target_role}" if target_role else ""}
ATS Score: {ats_score}/100

STRICT RULES:
- If a target role is specified, prioritize advice for that role
- Give specific, actionable advice
- DO NOT assume software developer unless explicitly mentioned

Give:
1. Short summary
2. Strengths
3. Weaknesses
4. Skills to improve specifically for {role_context}
"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message}
            ]
        )

        return jsonify({"reply": response.choices[0].message.content.strip()})

    except Exception as e:
        print("ERROR:", str(e))
        return jsonify({"error": str(e), "reply": "Something went wrong"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=False)