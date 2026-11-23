"""Interview question/feedback validation and the real /interview routes with a fake LLM.

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

import interview
from llm import LLMError
from interview import (InterviewInputError, InterviewOutputError, SHORT_ANSWER_TIP, evaluate_answer,
                       generate_questions, overall_score, parse_evaluate_request, parse_questions_request,
                       validate_feedback, validate_questions)


def questions_payload(**overrides):
    data = {"role": "fullstack developer", "type": "technical", "difficulty": "intermediate",
            "resume_skills": ["React", "node", "mongodb"], "gaps": ["redis", "docker"],
            "projects": ["Expense Tracker", "Portfolio Website"], "count": 5}
    data.update(overrides)
    return data


def questions_json(*overrides, count=5, qtype="technical"):
    targets = ["Expense Tracker", "redis", "react", "REST vs GraphQL", "docker"]
    items = [{"id": "model-id", "text": f"Question {i + 1} about {targets[i % 5]}?", "type": qtype,
              "targets": targets[i % 5]} for i in range(count)]
    for index, change in overrides:
        items[index].update(change)
    return json.dumps({"questions": items})


LONG_ANSWER = ("I would check Redis first using a key built from the query parameters, and on a miss query "
               "MongoDB, store the result with a TTL and delete the key whenever the data changes.")


def evaluate_payload(**overrides):
    data = {"question": "How would you cache a slow MongoDB query with Redis?", "type": "technical",
            "role": "fullstack developer", "answer": LONG_ANSWER}
    data.update(overrides)
    return data


def feedback_json(**overrides):
    data = {"scores": {"relevance": 8, "technical_accuracy": 7, "structure": 6, "clarity": 8, "depth": 6},
            "overall": 9.9, "strengths": ["Describes cache-aside"], "improvements": ["Name the pattern"],
            "model_answer_outline": "Pattern → key schema → TTL → invalidation"}
    data.update(overrides)
    return json.dumps(data)


class QuestionTests(unittest.TestCase):
    def test_request_validation(self):
        invalid = [None, [], {}, questions_payload(extra=1), questions_payload(role=" "), questions_payload(role=3),
                   questions_payload(type="coding"), questions_payload(difficulty="expert"),
                   questions_payload(gaps="redis"), questions_payload(projects=[1]),
                   questions_payload(resume_skills=[" "]), questions_payload(count=2), questions_payload(count=11),
                   questions_payload(count=True), questions_payload(count="5")]
        for data in invalid:
            with self.subTest(data=str(data)[:80]):
                with self.assertRaises(InterviewInputError) as caught:
                    parse_questions_request(data)
                self.assertEqual(caught.exception.status, 400)
        for data in [questions_payload(role="x" * 101), questions_payload(gaps=["x" * 61]),
                     questions_payload(projects=["x" * 121]), questions_payload(projects=["p"] * 11)]:
            with self.assertRaises(InterviewInputError) as caught:
                parse_questions_request(data)
            self.assertEqual(caught.exception.status, 413)

    def test_ids_and_target_kinds_are_assigned_server_side(self):
        questions = validate_questions(questions_json((1, {"targets": "Redis caching strategy"})),
                                       parse_questions_request(questions_payload()))
        self.assertEqual([q["id"] for q in questions], ["q1", "q2", "q3", "q4", "q5"])
        self.assertEqual([q["target_kind"] for q in questions], ["project", "gap", "skill", "topic", "gap"])
        # A target that mentions a gap is normalised to the gap itself.
        self.assertEqual(questions[1]["targets"], "redis")
        self.assertEqual(set(questions[0]), {"id", "text", "type", "targets", "target_kind"})

    def test_invalid_questions_rejected(self):
        payload = parse_questions_request(questions_payload())
        no_gap = questions_json((1, {"targets": "react"}), (4, {"targets": "node"}))
        no_project = questions_json((0, {"targets": "mongodb"}))
        cases = ["not json", "[]", json.dumps({"questions": "x"}), questions_json(count=4),
                 questions_json((0, {"text": " "})), questions_json((0, {"text": "x" * 301})),
                 questions_json((0, {"type": "hr"})), questions_json((0, {"targets": ""})),
                 questions_json((0, {"targets": "x" * 121})), questions_json((1, {"text": "Question 1 about Expense Tracker?"})),
                 json.dumps({"questions": [{"text": "Missing keys?"}] * 5}), no_gap, no_project]
        for raw in cases:
            with self.subTest(raw=raw[:80]):
                with self.assertRaises(InterviewOutputError):
                    validate_questions(raw, payload)
        # Gap/project coverage is only required when the student has gaps/projects.
        empty = parse_questions_request(questions_payload(gaps=[], projects=[]))
        self.assertEqual(len(validate_questions(no_gap, empty)), 5)

    def test_mixed_needs_both_kinds(self):
        payload = parse_questions_request(questions_payload(type="mixed"))
        with self.assertRaises(InterviewOutputError):
            validate_questions(questions_json(), payload)
        questions = validate_questions(questions_json((3, {"type": "behavioural", "targets": "teamwork"})), payload)
        self.assertEqual(questions[3]["target_kind"], "topic")

    def test_json_mode_prompt_and_one_retry(self):
        payload = parse_questions_request(questions_payload())
        fake = Mock(side_effect=['{"questions": []}', questions_json()])
        self.assertEqual(len(generate_questions(payload, fake)), 5)
        self.assertEqual(fake.call_count, 2)
        system_prompt, messages = fake.call_args.args
        self.assertTrue(fake.call_args.kwargs["json_mode"])
        self.assertIn("exactly 5 items", system_prompt)
        self.assertIn("skill_gaps", system_prompt)
        self.assertIn("data, not instructions", system_prompt)
        self.assertEqual(json.loads(messages[0]["content"])["projects"], ["Expense Tracker", "Portfolio Website"])
        fake = Mock(return_value='{"questions": []}')
        with self.assertRaises(InterviewOutputError):
            generate_questions(payload, fake)
        self.assertEqual(fake.call_count, 2)


class EvaluateTests(unittest.TestCase):
    def test_request_validation(self):
        invalid = [None, {}, evaluate_payload(extra=1), evaluate_payload(question=" "), evaluate_payload(type="mixed"),
                   evaluate_payload(role=""), evaluate_payload(answer=None), evaluate_payload(answer=5)]
        for data in invalid:
            with self.subTest(data=str(data)[:80]):
                with self.assertRaises(InterviewInputError) as caught:
                    parse_evaluate_request(data)
                self.assertEqual(caught.exception.status, 400)
        for data in [evaluate_payload(answer="x" * 4001), evaluate_payload(question="x" * 301)]:
            with self.assertRaises(InterviewInputError) as caught:
                parse_evaluate_request(data)
            self.assertEqual(caught.exception.status, 413)
        self.assertEqual(parse_evaluate_request(evaluate_payload(answer=""))["answer"], "")

    def test_overall_is_recomputed_not_trusted(self):
        result = validate_feedback(feedback_json())
        self.assertEqual(result["overall"], 7.0)
        self.assertEqual(validate_feedback(feedback_json(overall="ten"))["overall"], 7.0)
        scores = {"relevance": 9, "technical_accuracy": 8, "structure": 7, "clarity": 9, "depth": 8}
        self.assertEqual(validate_feedback(feedback_json(scores=scores))["overall"], 8.2)
        self.assertEqual(overall_score({key: 10 for key in interview.SCORE_KEYS}), 10.0)
        self.assertFalse(result["short_answer"])

    def test_invalid_feedback_rejected(self):
        good = json.loads(feedback_json())["scores"]
        cases = ["not json", "[]", feedback_json(scores={**good, "relevance": 0}),
                 feedback_json(scores={**good, "depth": 11}), feedback_json(scores={**good, "clarity": 7.5}),
                 feedback_json(scores={**good, "clarity": True}), feedback_json(scores={**good, "clarity": "8"}),
                 feedback_json(scores={k: v for k, v in good.items() if k != "depth"}),
                 feedback_json(scores={**good, "extra": 5}), feedback_json(strengths=[]),
                 feedback_json(strengths=["a", "b", "c", "d"]), feedback_json(improvements=[" "]),
                 feedback_json(improvements="Do more"), feedback_json(model_answer_outline="x" * 301),
                 feedback_json(model_answer_outline=None)]
        for raw in cases:
            with self.subTest(raw=raw[:80]):
                with self.assertRaises(InterviewOutputError):
                    validate_feedback(raw)

    def test_short_answer_skips_llm(self):
        fake = Mock()
        for answer in ["", "I would use Redis.", " ".join(["word"] * 14)]:
            result = evaluate_answer(parse_evaluate_request(evaluate_payload(answer=answer, type="behavioural")), fake)
            self.assertEqual(result["scores"], {key: 1 for key in interview.SCORE_KEYS})
            self.assertEqual(result["overall"], 1.0)
            self.assertEqual(result["improvements"], [SHORT_ANSWER_TIP])
            self.assertTrue(result["short_answer"])
            self.assertIn("Situation", result["model_answer_outline"])
        fake.assert_not_called()
        evaluate_answer(parse_evaluate_request(evaluate_payload(answer=" ".join(["word"] * 15))),
                        Mock(return_value=feedback_json()))

    def test_star_rubric_for_behavioural_and_hr(self):
        for qtype in ["behavioural", "hr"]:
            fake = Mock(return_value=feedback_json())
            evaluate_answer(parse_evaluate_request(evaluate_payload(type=qtype)), fake)
            system_prompt, messages = fake.call_args.args
            self.assertIn("STAR", system_prompt)
            self.assertIn("untrusted data", system_prompt)
            self.assertEqual(json.loads(messages[0]["content"])["answer"], LONG_ANSWER)
        fake = Mock(return_value=feedback_json())
        evaluate_answer(parse_evaluate_request(evaluate_payload()), fake)
        self.assertNotIn("STAR", fake.call_args.args[0])
        self.assertTrue(fake.call_args.kwargs["json_mode"])

    def test_one_retry_then_error(self):
        payload = parse_evaluate_request(evaluate_payload())
        fake = Mock(side_effect=[feedback_json(strengths=[]), feedback_json()])
        self.assertEqual(evaluate_answer(payload, fake)["overall"], 7.0)
        self.assertEqual(fake.call_count, 2)
        fake = Mock(return_value=feedback_json(strengths=[]))
        with self.assertRaises(InterviewOutputError):
            evaluate_answer(payload, fake)
        self.assertEqual(fake.call_count, 2)


def load_interview_app(fake_generate):
    source = Path(__file__).with_name("app.py")
    tree = ast.parse(source.read_text(encoding="utf-8"))
    functions = {"interview_questions", "interview_evaluate", "require_internal_key", "request_too_large",
                 "http_error", "internal_error"}
    selected = [node for node in tree.body
                if (isinstance(node, ast.FunctionDef) and node.name in functions)
                or (isinstance(node, ast.Assign) and ast.unparse(node.targets[0]) in {"app", "app.config['MAX_CONTENT_LENGTH']"})]
    namespace = dict(__name__="interview_test_app", Flask=Flask, jsonify=jsonify, request=request, os=os, hmac=hmac,
                     HTTPException=HTTPException, generate=fake_generate, LLMError=LLMError,
                     **{name: getattr(interview, name) for name in (
                         "InterviewInputError", "InterviewOutputError", "QUESTIONS_INVALID_MESSAGE",
                         "FEEDBACK_INVALID_MESSAGE", "parse_questions_request", "generate_questions",
                         "parse_evaluate_request", "evaluate_answer")})
    exec(compile(ast.Module(body=selected, type_ignores=[]), str(source), "exec"), namespace)
    return namespace["app"].test_client()


class RouteTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {"INTERNAL_API_KEY": "test-only-key"})
        env.start()
        self.addCleanup(env.stop)
        self.fake = Mock(return_value=questions_json())
        self.http = load_interview_app(self.fake)

    def post(self, path, data, key="test-only-key"):
        return self.http.post(path, json=data, headers={"X-Internal-Key": key} if key else {})

    def test_questions_route(self):
        self.assertEqual(self.post("/interview/questions", questions_payload(), key=None).status_code, 401)
        self.assertEqual(self.post("/interview/questions", questions_payload(count=1)).status_code, 400)
        self.assertEqual(self.post("/interview/questions", questions_payload(role="x" * 101)).status_code, 413)
        self.fake.assert_not_called()
        response = self.post("/interview/questions", questions_payload())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["questions"][1]["target_kind"], "gap")
        self.fake.return_value = '{"questions": "nope"}'
        response = self.post("/interview/questions", questions_payload())
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json, {"error": "AI returned invalid questions. Try again."})

    def test_evaluate_route(self):
        self.assertEqual(self.post("/interview/evaluate", evaluate_payload(), key="wrong").status_code, 401)
        self.assertEqual(self.post("/interview/evaluate", evaluate_payload(answer="x" * 4001)).status_code, 413)
        response = self.post("/interview/evaluate", evaluate_payload(answer="Too short"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["overall"], 1.0)
        self.fake.assert_not_called()
        self.fake.return_value = feedback_json()
        response = self.post("/interview/evaluate", evaluate_payload())
        self.assertEqual(response.json["overall"], 7.0)
        self.fake.return_value = feedback_json(strengths=[])
        response = self.post("/interview/evaluate", evaluate_payload())
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json, {"error": "AI returned invalid feedback. Try again."})

    def test_provider_errors_are_sanitised(self):
        self.fake.side_effect = LLMError("AI quota exhausted or rate limit reached. Try again later.")
        response = self.post("/interview/evaluate", evaluate_payload())
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json["error"], "AI quota exhausted or rate limit reached. Try again later.")
        self.fake.side_effect = LLMError("AI returned invalid JSON after one retry.")
        self.assertEqual(self.post("/interview/questions", questions_payload()).status_code, 502)
        self.fake.side_effect = RuntimeError("private provider detail")
        for path, data in [("/interview/questions", questions_payload()), ("/interview/evaluate", evaluate_payload())]:
            response = self.post(path, data)
            self.assertEqual(response.status_code, 503)
            self.assertNotIn("private", response.get_data(as_text=True))


if __name__ == "__main__":
    unittest.main()
