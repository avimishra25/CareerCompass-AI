"""Roadmap ordering, schema validation and the real /roadmap route with a fake LLM.

Run: python -m unittest discover -s ml-service -p "test_*.py"
"""
import ast
import hmac
import json
import os
from pathlib import Path
import unittest
from unittest.mock import Mock, patch

from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException

import roadmap
from llm import LLMError
from roadmap import (RoadmapOutputError, extract_projects, generate_roadmap, merge_gaps,
                     order_gaps, parse_roadmap_request, validate_milestones)


def milestones_json(gaps, weeks=None, **overrides):
    weeks = weeks or len(gaps)
    items = [{"week": i + 1, "skill": gaps[i % len(gaps)], "objective": f"Learn {gaps[i % len(gaps)]}",
              "resources": ["Official docs", "Free tutorial"], "mini_project": "Extend Expense Tracker"}
             for i in range(weeks)]
    for key, value in overrides.items():
        items[0][key] = value
    return json.dumps({"milestones": items})


def payload(**overrides):
    data = {"target_role": "fullstack developer", "missing_skills": ["React", "javascript"],
            "jd_gaps": ["docker", "kubernetes", "react"], "known_skills": ["html", "Docker"],
            "hours_per_week": 8}
    data.update(overrides)
    return data


class OrderingTests(unittest.TestCase):
    def test_merge_dedupes_normalises_and_drops_known(self):
        self.assertEqual(merge_gaps(["React", " node ", "python"], ["react", "Docker", "Python"], ["PYTHON"]),
                         ["react", "node", "docker"])
        self.assertEqual(merge_gaps(["git"], ["git"], ["git"]), [])

    def test_prerequisites_come_first(self):
        ordered = order_gaps(["kubernetes", "typescript", "react", "docker compose", "javascript", "docker",
                              "express", "node", "ci/cd", "git", "postgresql", "sql", "html", "css"])
        for before, after in [("javascript", "typescript"), ("docker", "kubernetes"), ("docker", "docker compose"),
                              ("html", "react"), ("css", "react"), ("node", "express"), ("sql", "postgresql"),
                              ("git", "ci/cd"), ("javascript", "node")]:
            self.assertLess(ordered.index(before), ordered.index(after), f"{before} before {after}")
        self.assertEqual(sorted(ordered), sorted(set(ordered)))

    def test_transitive_chain_without_middle_skill_and_stable_ties(self):
        self.assertEqual(order_gaps(["scikit-learn", "figma", "python"]), ["figma", "python", "scikit-learn"])
        self.assertEqual(order_gaps(["scikit-learn", "pandas", "python"]), ["python", "pandas", "scikit-learn"])
        self.assertEqual(order_gaps(["figma", "rust", "go"]), ["figma", "rust", "go"])

    def test_cycle_does_not_hang_or_drop_skills(self):
        self.assertEqual(sorted(order_gaps(["a", "b"], {"a": ["b"], "b": ["a"]})), ["a", "b"])

    def test_projects_excerpt(self):
        text = "Summary\nStudent\nProjects\nExpense Tracker - React app\nEducation\nB.Tech"
        self.assertEqual(extract_projects(text), "Expense Tracker - React app")
        self.assertEqual(extract_projects("No such section"), "")
        self.assertEqual(len(extract_projects("Projects\n" + "x" * 5000)), 1500)


class ValidationTests(unittest.TestCase):
    gaps = ["javascript", "react", "docker"]

    def test_valid_response_is_reordered_by_gap_order(self):
        items = json.loads(milestones_json(self.gaps, 4))["milestones"]
        items[0]["skill"], items[2]["skill"] = "Docker", "javascript"
        result = validate_milestones(json.dumps(items), self.gaps, 4)
        self.assertEqual([m["week"] for m in result], [1, 2, 3, 4])
        self.assertEqual([m["skill"] for m in result], ["javascript", "javascript", "react", "docker"])
        self.assertEqual(set(result[0]), {"week", "skill", "objective", "resources", "mini_project"})

    def test_invalid_responses_rejected(self):
        good = json.loads(milestones_json(self.gaps))
        duplicate = json.loads(milestones_json(self.gaps))
        duplicate["milestones"][1]["week"] = 1
        missing = json.loads(milestones_json(self.gaps))
        del missing["milestones"][0]["mini_project"]
        cases = ["not json", "[]", json.dumps({"other": []}), json.dumps(good["milestones"][:2]),
                 json.dumps(duplicate), json.dumps(missing), milestones_json(self.gaps, week=0),
                 milestones_json(self.gaps, week=4), milestones_json(self.gaps, week=True),
                 milestones_json(self.gaps, week="1"), milestones_json(self.gaps, skill="kubernetes"),
                 milestones_json(self.gaps, skill=3), milestones_json(self.gaps, objective=" "),
                 milestones_json(self.gaps, objective="x" * 501), milestones_json(self.gaps, mini_project=None),
                 milestones_json(self.gaps, resources=["one"]), milestones_json(self.gaps, resources=["a", "b", "c", "d"]),
                 milestones_json(self.gaps, resources=["a", 2]), milestones_json(self.gaps, resources="docs")]
        for raw in cases:
            with self.subTest(raw=raw[:80]):
                with self.assertRaises(RoadmapOutputError):
                    validate_milestones(raw, self.gaps, 3)

    def test_request_validation(self):
        invalid = [None, [], {}, payload(extra=1), payload(target_role=" "), payload(target_role=5),
                   payload(missing_skills="react"), payload(jd_gaps=[1]), payload(known_skills=[" "]),
                   payload(hours_per_week=1), payload(hours_per_week=41), payload(hours_per_week=8.0),
                   payload(hours_per_week=True), payload(weeks=3), payload(weeks=13), payload(resume_text=5)]
        for data in invalid:
            with self.subTest(data=str(data)[:80]):
                with self.assertRaises(roadmap.RoadmapInputError) as caught:
                    parse_roadmap_request(data)
                self.assertEqual(caught.exception.status, 400)
        for data in [payload(target_role="x" * 101), payload(jd_gaps=["x" * 61]), payload(known_skills=["x"] * 301),
                     payload(resume_text="x" * 50001)]:
            with self.assertRaises(roadmap.RoadmapInputError) as caught:
                parse_roadmap_request(data)
            self.assertEqual(caught.exception.status, 413)
        self.assertEqual(parse_roadmap_request(payload())["weeks"], 6)
        self.assertEqual(parse_roadmap_request(payload(weeks=12, hours_per_week=40))["weeks"], 12)


class GenerateTests(unittest.TestCase):
    def test_no_gaps_skips_llm(self):
        fake = Mock()
        result = generate_roadmap(parse_roadmap_request(payload(missing_skills=["git"], jd_gaps=[], known_skills=["Git"])), fake)
        self.assertTrue(result["covered"])
        self.assertIn("already cover", result["message"])
        self.assertEqual(result["milestones"], [])
        fake.assert_not_called()

    def test_json_mode_server_prompt_and_ordered_gaps(self):
        gaps = ["javascript", "react", "kubernetes"]
        fake = Mock(return_value=milestones_json(gaps, 6))
        result = generate_roadmap(parse_roadmap_request(payload(resume_text="Projects\nExpense Tracker\nSkills\nhtml")), fake)
        self.assertEqual(result["skill_gaps"], gaps)
        self.assertEqual(len(result["milestones"]), 6)
        system_prompt, messages = fake.call_args.args
        self.assertTrue(fake.call_args.kwargs["json_mode"])
        self.assertIn("exactly 6 items", system_prompt)
        context = json.loads(messages[0]["content"])
        self.assertEqual(context["ordered_skill_gaps"], gaps)
        self.assertEqual(context["existing_projects"], "Expense Tracker")

    def test_one_retry_on_invalid_schema_then_error(self):
        gaps = ["javascript", "react", "kubernetes"]
        fake = Mock(side_effect=['{"milestones": []}', milestones_json(gaps, 6)])
        self.assertFalse(generate_roadmap(parse_roadmap_request(payload()), fake)["covered"])
        self.assertEqual(fake.call_count, 2)
        fake = Mock(return_value='{"milestones": []}')
        with self.assertRaises(RoadmapOutputError):
            generate_roadmap(parse_roadmap_request(payload()), fake)
        self.assertEqual(fake.call_count, 2)


def load_roadmap_app(fake_generate):
    source = Path(__file__).with_name("app.py")
    tree = ast.parse(source.read_text(encoding="utf-8"))
    functions = {"career_roadmap", "require_internal_key", "request_too_large", "http_error", "internal_error"}
    selected = [node for node in tree.body
                if (isinstance(node, ast.FunctionDef) and node.name in functions)
                or (isinstance(node, ast.Assign) and ast.unparse(node.targets[0]) in {"app", "app.config['MAX_CONTENT_LENGTH']"})]
    namespace = dict(__name__="roadmap_test_app", Flask=Flask, jsonify=jsonify, request=request, os=os, hmac=hmac,
                     HTTPException=HTTPException, generate=fake_generate, LLMError=LLMError,
                     **{name: getattr(roadmap, name) for name in ("RoadmapInputError", "RoadmapOutputError",
                        "ROADMAP_INVALID_MESSAGE", "parse_roadmap_request", "generate_roadmap")})
    exec(compile(ast.Module(body=selected, type_ignores=[]), str(source), "exec"), namespace)
    return namespace["app"].test_client()


class RouteTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {"INTERNAL_API_KEY": "test-only-key"})
        env.start()
        self.addCleanup(env.stop)
        self.fake = Mock(return_value=milestones_json(["javascript", "react", "kubernetes"], 6))
        self.http = load_roadmap_app(self.fake)

    def post(self, data, key="test-only-key"):
        return self.http.post("/roadmap", json=data, headers={"X-Internal-Key": key} if key else {})

    def test_auth_validation_and_success(self):
        self.assertEqual(self.post(payload(), key=None).status_code, 401)
        self.assertEqual(self.post(payload(), key="wrong").status_code, 401)
        self.assertEqual(self.post(payload(hours_per_week=50)).status_code, 400)
        self.assertEqual(self.post(payload(target_role="x" * 101)).status_code, 413)
        self.fake.assert_not_called()
        response = self.post(payload())
        self.assertEqual(response.status_code, 200)
        self.assertEqual([m["week"] for m in response.json["milestones"]], [1, 2, 3, 4, 5, 6])

    def test_invalid_model_output_returns_safe_502(self):
        self.fake.return_value = '{"milestones": "nope"}'
        response = self.post(payload())
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json, {"error": "AI returned an invalid roadmap. Try again."})
        self.fake.side_effect = LLMError("AI returned invalid JSON after one retry.")
        self.assertEqual(self.post(payload()).status_code, 502)

    def test_provider_errors_are_sanitised(self):
        self.fake.side_effect = LLMError("AI quota exhausted or rate limit reached. Try again later.")
        response = self.post(payload())
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json["error"], "AI quota exhausted or rate limit reached. Try again later.")
        self.fake.side_effect = RuntimeError("private provider detail")
        response = self.post(payload())
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private", response.get_data(as_text=True))


if __name__ == "__main__":
    unittest.main()
