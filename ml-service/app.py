from flask import Flask, request, jsonify
import spacy
from pdfminer.high_level import extract_text

app = Flask(__name__)
nlp = spacy.load("en_core_web_sm")

# Predefined skill list
SKILL_LIST = [
    "python", "java", "c++", "javascript", "react", "node", "express",
    "mongodb", "mysql", "sql", "html", "css", "aws", "docker",
    "machine learning", "data science", "pandas", "numpy", "tensorflow"
]

@app.route("/analyze", methods=["POST"])
def analyze():
    file = request.files["resume"]

    file_path = "temp.pdf"
    file.save(file_path)

    text = extract_text(file_path).lower()

    detected_skills = []

    for skill in SKILL_LIST:
        if skill in text:
            detected_skills.append(skill)

    return jsonify({
        "skills": detected_skills
    })

if __name__ == "__main__":
    app.run(port=8000)