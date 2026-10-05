"""Run real scoring/Flask routes without loading the unrelated ATS model at startup."""
import ast
import hmac
import os
from pathlib import Path
import re
import unittest
from unittest.mock import patch

from flask import Flask, jsonify, request
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from werkzeug.exceptions import HTTPException


def load_match_app():
    source = Path(__file__).with_name("app.py")
    tree = ast.parse(source.read_text(encoding="utf-8"))
    functions = {"normalize", "extract_skills", "compute_jd_match", "jd_match",
                 "require_internal_key", "request_too_large", "http_error", "internal_error"}
    constants = {"app", "app.config['MAX_CONTENT_LENGTH']", "SKILL_LIST", "ALIASES",
                 "JD_TEXT_WEIGHT", "JD_SKILL_WEIGHT", "JD_MAX_CHARS"}
    selected = [node for node in tree.body
                if (isinstance(node, ast.FunctionDef) and node.name in functions)
                or (isinstance(node, ast.Assign) and ast.unparse(node.targets[0]) in constants)]

    # Isolate spaCy's optional lemma pass; keep real alias/skill matching and sklearn scoring.
    class Doc(list):
        noun_chunks = []

    namespace = dict(__name__="jd_match_test_app", Flask=Flask, jsonify=jsonify, request=request, re=re, os=os, hmac=hmac,
                     HTTPException=HTTPException, TfidfVectorizer=TfidfVectorizer,
                     cosine_similarity=cosine_similarity, nlp=lambda text: Doc([
                         type("Token", (), {"lemma_": "|" + text + "|", "text": text, "is_punct": False})()
                     ]))
    exec(compile(ast.Module(body=selected, type_ignores=[]), str(source), "exec"), namespace)
    return namespace


class JDMatchTests(unittest.TestCase):
    def setUp(self):
        self.ns = load_match_app()
        self.http = self.ns["app"].test_client()
        env = patch.dict(os.environ, {"INTERNAL_API_KEY": "test-only-key"})
        env.start()
        self.addCleanup(env.stop)

    def match(self, resume="Python Flask PostgreSQL Docker", jd="Python Flask PostgreSQL Docker"):
        return self.http.post("/jd-match", json={"resume_text": resume, "jd_text": jd},
                              headers={"X-Internal-Key": "test-only-key"})

    def test_fit_mismatch_and_determinism(self):
        fit = self.match().json
        miss = self.match(jd="Figma wireframing prototyping adobe xd user research").json
        self.assertEqual(fit["overall_match"], 100)
        self.assertEqual(fit["verdict"], "Strong")
        self.assertEqual(miss["overall_match"], 0)
        self.assertEqual(miss["verdict"], "Weak")
        self.assertEqual(fit, self.match().json)
        self.assertTrue(miss["keyword_gaps"])

    def test_aliases_frequency_and_extra_skills(self):
        result = self.match("React.js Node.js Docker", "React React.js Node.js Python Python Python Flask").json
        self.assertEqual(result["matched_skills"], ["react", "node"])
        self.assertEqual(result["missing_skills"], ["python", "flask"])
        self.assertEqual(result["extra_skills"], ["docker"])
        self.assertNotIn("react", result["keyword_gaps"])

    def test_formula_and_no_skills(self):
        result = self.match("Python", "Python Flask").json
        vec = TfidfVectorizer(stop_words="english").fit_transform(["python", "python flask"])
        expected = round(100 * (0.4 * cosine_similarity(vec[0:1], vec[1:2])[0, 0] + 0.6 * 0.5), 1)
        self.assertEqual(result["overall_match"], expected)
        self.assertEqual(result["verdict"], "Fair")
        self.assertEqual(self.match("gardening", "gardening").json["overall_match"], 40)
        self.assertEqual(self.match("!!!", "the and").json["overall_match"], 0)

    def test_validation_and_auth(self):
        for jd in ["", "  ", 42, [], None]:
            self.assertEqual(self.match(jd=jd).status_code, 400)
        self.assertEqual(self.match(resume=" ").status_code, 400)
        self.assertEqual(self.match(jd="x" * 8001).status_code, 413)
        self.assertEqual(self.match(jd="x" * 8000).status_code, 200)
        self.assertEqual(self.match(resume="x" * 50001).status_code, 413)
        self.assertEqual(self.http.post("/jd-match").status_code, 401)


if __name__ == "__main__":
    unittest.main()
