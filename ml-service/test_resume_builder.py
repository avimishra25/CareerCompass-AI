"""Resume builder: number-hallucination guard, enhance route with a fake LLM, and /resume/score.

Run: python -m unittest discover -s ml-service -p "test_*.py"
"""
import ast
import hmac
import json
import os
from pathlib import Path
import re
import unittest
from unittest.mock import Mock, patch

import numpy as np
from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException

import resume_builder
from llm import LLMError
from resume_builder import ResumeOutputError, enhance_bullets, numbers_in, validate_bullets

NOTES = "made a portfolio website with html and css, contact form, around 300 people visited, 2,000 page views"


def bullets(*items):
    return json.dumps({"bullets": list(items)})


def load_app(fake_generate):
    """Load the real routes and ATS scoring code; stub spaCy's lemma pass and the trained model."""
    source = Path(__file__).with_name("app.py")
    tree = ast.parse(source.read_text(encoding="utf-8"))
    functions = {"resume_enhance", "resume_score", "require_internal_key", "request_too_large", "http_error",
                 "internal_error", "normalize", "extract_skills", "extract_features", "compute_ats_score_ml",
                 "get_feature_importances", "_improvement_tip", "_length_score"}
    constants = {"app", "app.config['MAX_CONTENT_LENGTH']", "SKILL_LIST", "ALIASES", "ATS_SECTIONS",
                 "ACTION_VERBS", "QUANT_PATTERNS", "FEATURE_NAMES", "FEATURE_LABELS"}
    selected = [node for node in tree.body
                if (isinstance(node, ast.FunctionDef) and node.name in functions)
                or (isinstance(node, ast.Assign) and ast.unparse(node.targets[0]) in constants)]

    class Doc(list):
        noun_chunks = []

    class Regressor:
        feature_importances_ = np.array([0.2, 0.05, 0.2, 0.05, 0.15, 0.1, 0.1, 0.05, 0.05, 0.05])

    model = Mock(named_steps={"regressor": Regressor()})
    model.predict.return_value = [72.4]
    namespace = dict(
        __name__="resume_test_app", Flask=Flask, jsonify=jsonify, request=request, os=os, hmac=hmac, re=re, np=np,
        HTTPException=HTTPException, generate=fake_generate, LLMError=LLMError, ats_model=model,
        nlp=lambda text: Doc([type("Token", (), {"lemma_": "|", "text": text, "is_punct": False})()]),
        **{name: getattr(resume_builder, name) for name in (
            "ResumeInputError", "ResumeOutputError", "ENHANCE_INVALID_MESSAGE", "parse_enhance_request", "enhance_bullets")})
    exec(compile(ast.Module(body=selected, type_ignores=[]), str(source), "exec"), namespace)
    return namespace


class NumberGuardTests(unittest.TestCase):
    def test_numbers_normalise_thousands_separators(self):
        self.assertEqual(numbers_in("2,000 users, 35% faster, v1.5"), {"2000", "35", "1.5"})
        self.assertEqual(numbers_in("no digits"), set())

    def test_numbers_from_notes_allowed(self):
        result = validate_bullets(bullets("• Built a portfolio site visited by 300 people", "Reached 2000 page views"), NOTES)
        self.assertEqual(result, ["Built a portfolio site visited by 300 people", "Reached 2000 page views"])

    def test_invented_numbers_rejected(self):
        for invented in ["Attracted 300+ visitors in 1 month", "Improved load time by 35%",
                         "Built with HTML5 and CSS3", "Served 2,500 users", "Launched in 2024"]:
            with self.subTest(invented=invented):
                with self.assertRaises(ResumeOutputError):
                    validate_bullets(bullets("Built a portfolio website", invented), NOTES)

    def test_schema_and_length(self):
        for raw in ["not json", "[]", json.dumps({"bullets": "x"}), bullets("only one"),
                    bullets("a", "b", "c", "d", "e"), bullets("ok", 5), bullets("ok", " • "), bullets("ok", "x" * 221)]:
            with self.subTest(raw=raw[:60]):
                with self.assertRaises(ResumeOutputError):
                    validate_bullets(raw, NOTES)
        self.assertEqual(len(validate_bullets(bullets("ok", "x" * 220), NOTES)[1]), 220)

    def test_retry_once_then_error(self):
        payload = {"section": "project", "title": "Portfolio", "notes": NOTES, "tone": "concise"}
        fake = Mock(side_effect=[bullets("Grew traffic by 50%", "Built a site"), bullets("Built a site", "Added a form")])
        self.assertEqual(enhance_bullets(payload, fake, ["built"]), ["Built a site", "Added a form"])
        self.assertEqual(fake.call_count, 2)
        system_prompt, messages = fake.call_args.args
        self.assertTrue(fake.call_args.kwargs["json_mode"])
        self.assertIn("built", system_prompt)
        self.assertEqual(json.loads(messages[0]["content"])["notes"], NOTES)
        fake = Mock(return_value=bullets("Served 9 clients", "Built a site"))
        with self.assertRaises(ResumeOutputError):
            enhance_bullets(payload, fake, ["built"])
        self.assertEqual(fake.call_count, 2)

    def test_title_numbers_are_user_text(self):
        self.assertEqual(validate_bullets(bullets("Completed Python 3 coursework", "Built scripts"), "Python 3 Course\nnotes"),
                         ["Completed Python 3 coursework", "Built scripts"])


class RouteTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {"INTERNAL_API_KEY": "test-only-key"})
        env.start()
        self.addCleanup(env.stop)
        self.fake = Mock(return_value=bullets("Built a portfolio website", "Added a contact form"))
        self.ns = load_app(self.fake)
        self.http = self.ns["app"].test_client()
        self.headers = {"X-Internal-Key": "test-only-key"}

    def enhance(self, **overrides):
        data = {"section": "project", "title": "Portfolio", "notes": NOTES, "tone": "professional", **overrides}
        return self.http.post("/resume/enhance", json=data, headers=self.headers)

    def test_enhance_validation_and_errors(self):
        self.assertEqual(self.http.post("/resume/enhance", json={}).status_code, 401)
        for overrides in [{"section": "skills"}, {"tone": "funny"}, {"notes": " "}, {"title": 5}, {"extra": 1}]:
            self.assertEqual(self.enhance(**overrides).status_code, 400)
        self.assertEqual(self.enhance(notes="x" * 1501).status_code, 413)
        self.assertEqual(self.enhance(title="x" * 121).status_code, 413)
        self.fake.assert_not_called()
        self.assertEqual(self.enhance().json, {"bullets": ["Built a portfolio website", "Added a contact form"]})
        self.fake.return_value = bullets("Grew revenue 40%", "Built a site")
        response = self.enhance()
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json, {"error": "AI returned an invalid suggestion. Try again."})
        self.fake.side_effect = LLMError("AI quota exhausted or rate limit reached. Try again later.")
        self.assertEqual(self.enhance().status_code, 503)
        self.fake.side_effect = RuntimeError("private provider detail")
        response = self.enhance()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private", response.get_data(as_text=True))

    def test_score_matches_analyze_shape(self):
        text = ("Jane Doe\njane@example.com\nSUMMARY\nStudent developer.\nSKILLS\nPython, React, Docker\n"
                "EXPERIENCE\nIntern\n- Developed 6 REST APIs serving 2000 users\n- Reduced load time by 35%\n"
                "PROJECTS\nPortfolio\n- Built a site\nEDUCATION\nB.Tech")
        response = self.http.post("/resume/score", json={"text": text}, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json
        self.assertEqual(data["ats_score"], 72)
        self.assertEqual(set(data["ats_breakdown"]), {"skills", "verbs", "quantified", "sections", "length"})
        for item in data["ats_breakdown"].values():
            self.assertTrue({"score", "max", "label"} <= set(item))
        self.assertIn("developed", data["ats_breakdown"]["verbs"]["found"])
        self.assertEqual(data["ml_insights"]["features"]["has_contact"], 1)
        self.assertGreaterEqual(data["ml_insights"]["features"]["skill_count"], 3)
        self.assertEqual(len(data["ml_insights"]["top_drivers"]), 3)

    def test_score_validation(self):
        for body in [None, {}, {"text": " "}, {"text": 5}, {"text": "x", "extra": 1}]:
            self.assertEqual(self.http.post("/resume/score", json=body, headers=self.headers).status_code, 400)
        self.assertEqual(self.http.post("/resume/score", json={"text": "x" * 50001}, headers=self.headers).status_code, 413)
        self.assertEqual(self.http.post("/resume/score", json={"text": "x"}).status_code, 401)


if __name__ == "__main__":
    unittest.main()
