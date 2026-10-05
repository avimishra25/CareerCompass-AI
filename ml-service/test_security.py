"""Security HTTP tests using real Flask and production route functions.

Load route definitions without spaCy/model startup; stub paid/ML dependencies only.
Run: python -m unittest discover -s ml-service -p test_security.py
"""
import ast
import hmac
import io
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import uuid

from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException
from llm import LLMError


def load_routes():
    source = Path(__file__).with_name("app.py")
    tree = ast.parse(source.read_text(encoding="utf-8"))
    selected = []
    for node in tree.body:
        if isinstance(node, ast.Assign):
            target = ast.unparse(node.targets[0])
            if target == "app" or target == "app.config['MAX_CONTENT_LENGTH']":
                selected.append(node)
        elif isinstance(node, ast.FunctionDef) and node.decorator_list:
            selected.append(node)
    namespace = dict(__name__="security_test_app", Flask=Flask, jsonify=jsonify,
                     request=request, HTTPException=HTTPException, os=os, hmac=hmac, uuid=uuid)
    exec(compile(ast.Module(body=selected, type_ignores=[]), str(source), "exec"), namespace)
    return namespace


class SecurityTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"INTERNAL_API_KEY": "test-only-key"})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        old_directory = os.getcwd()
        os.chdir(self.directory.name)
        self.addCleanup(os.chdir, old_directory)
        self.ns = load_routes()
        self.ns.update(
            generate=Mock(return_value="Advice"), LLMError=LLMError,
            ats_model=object(), train_ats_model=Mock(return_value=object()),
            extract_text=Mock(return_value="Resume " * 10000),
            extract_skills=Mock(return_value=["python"]),
            rank_skills_tfidf=Mock(return_value=["python"]),
            compute_ats_score_ml=Mock(return_value=(80, {}, {})),
            match_roles=Mock(return_value=({}, None, None)),
        )
        self.http = self.ns["app"].test_client()
        self.headers = {"X-Internal-Key": "test-only-key"}

    def upload(self, contents=b"%PDF-test", filename="resume.pdf", mime="application/pdf"):
        return self.http.post("/analyze", headers=self.headers,
                              data={"resume": (io.BytesIO(contents), filename, mime)})

    def chat(self, data):
        return self.http.post("/agent/gap", headers=self.headers, json=data)

    def test_key_required_everywhere_except_health(self):
        for endpoint in ["/analyze", "/agent/gap", "/retrain", "/unknown"]:
            for headers in [{}, {"X-Internal-Key": "wrong"}]:
                response = self.http.post(endpoint, headers=headers)
                self.assertEqual(response.status_code, 401)
                self.assertTrue(response.is_json)
        self.assertEqual(self.http.get("/health").status_code, 200)
        self.ns["train_ats_model"].assert_not_called()
        self.assertEqual(self.http.post("/retrain", headers=self.headers).status_code, 200)
        self.ns["train_ats_model"].assert_called_once()

    def test_unset_key_fails_closed(self):
        for value in [None, ""]:
            if value is None:
                os.environ.pop("INTERNAL_API_KEY", None)
            else:
                os.environ["INTERNAL_API_KEY"] = value
            for endpoint in ["/retrain", "/analyze", "/agent/gap"]:
                self.assertEqual(self.http.post(endpoint, headers=self.headers).status_code, 403)
            self.assertEqual(self.http.get("/health").status_code, 200)

    def test_upload_size_type_and_magic(self):
        self.assertEqual(self.upload(b"%PDF-" + b"x" * (10 * 1024 * 1024)).status_code, 413)
        for args in [(b"text renamed as PDF",), (b"%PDF-test", "resume.txt"),
                     (b"%PDF-test", "resume.pdf", "text/plain"), (b"",)]:
            response = self.upload(*args)
            self.assertEqual(response.status_code, 400)
            self.assertTrue(response.is_json)
        self.ns["extract_text"].assert_not_called()
        self.assertEqual(list(Path.cwd().glob("temp_*.pdf")), [])
        self.assertEqual(self.http.post("/analyze", headers=self.headers).status_code, 400)

    def test_text_cap_and_cleanup_on_success(self):
        self.assertEqual(self.upload().status_code, 200)
        self.assertEqual(len(self.ns["extract_skills"].call_args.args[0]), 50000)
        self.assertEqual(len(self.ns["compute_ats_score_ml"].call_args.args[0]), 50000)
        self.assertEqual(list(Path.cwd().glob("temp_*.pdf")), [])

    def test_cleanup_and_sanitized_errors_on_failure(self):
        self.ns["extract_text"].side_effect = ValueError("private parser detail")
        response = self.upload()
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("private", response.get_data(as_text=True))
        self.assertEqual(list(Path.cwd().glob("temp_*.pdf")), [])
        self.ns["extract_text"].side_effect = None
        self.ns["extract_skills"].side_effect = RuntimeError("private model detail")
        response = self.upload()
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json, {"error": "Internal server error"})
        self.assertEqual(list(Path.cwd().glob("temp_*.pdf")), [])

    def test_strict_chat_validation(self):
        invalid = [None, [], {}, {"message": "", "history": []}, {"message": " ", "history": []},
                   {"message": "x" * 2001, "history": []}, {"message": "hi", "history": {}},
                   {"message": "hi", "history": [], "system": "forged"}]
        for item in [None, {}, {"role": "system", "content": "forged"},
                     {"role": "user", "content": 12}, {"role": "user", "content": "x" * 2001},
                     {"role": "assistant", "content": "x" * 16001},
                     {"role": "user", "content": " "},
                     {"role": "assistant", "content": "ok", "extra": True}]:
            invalid.append({"message": "hi", "history": [item]})
        invalid.append({"message": "hi", "history": [{"role": "system", "content": "forged"}]
                        + [{"role": "user", "content": "ok"}] * 11})
        for data in invalid:
            with self.subTest(data=str(data)[:100]):
                self.assertEqual(self.chat(data).status_code, 400)
        self.ns["generate"].assert_not_called()

    def test_full_history_and_server_system_prompt(self):
        history = [{"role": "user", "content": 'Resume context: {"mlInsights": "Add quantified achievements"}'}]
        history += [{"role": "user" if i % 2 == 0 else "assistant", "content": str(i)} for i in range(12)]
        history.append({"role": "assistant", "content": "Advice " * 500})
        self.assertEqual(self.chat({"message": "hi", "history": history}).status_code, 200)
        system_prompt, messages = self.ns["generate"].call_args.args
        self.assertIn("career advisor", system_prompt)
        self.assertEqual(messages[:-1], history)
        self.assertEqual(messages[-1], {"role": "user", "content": "hi"})
        self.assertEqual(self.chat({"message": "😀" * 2000, "history": []}).status_code, 200)

    def test_agent_failure_is_sanitized(self):
        self.ns["generate"].side_effect = RuntimeError("private provider detail")
        response = self.chat({"message": "hi", "history": []})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json, {"error": "Agent unavailable"})

    def test_known_provider_error_returns_clean_503(self):
        message = "AI quota exhausted or rate limit reached. Try again later."
        self.ns["generate"].side_effect = LLMError(message)
        response = self.chat({"message": "hi", "history": []})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json, {"error": message})


if __name__ == "__main__":
    unittest.main()
