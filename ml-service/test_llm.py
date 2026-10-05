"""Exercise the real Gemini SDK against a fake HTTP transport; no key or network needed."""
import json
import os
import unittest
from unittest.mock import patch

import httpx
from google import genai

import llm
from test_security import load_routes


class LLMTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"GEMINI_API_KEY": "test-key", "GEMINI_MODEL": ""})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.requests = []
        self.outcomes = ["Advice"]
        self.options = []
        real_client = genai.Client

        def respond(request):
            self.requests.append(request)
            outcome = self.outcomes.pop(0)
            if isinstance(outcome, Exception):
                raise outcome
            if isinstance(outcome, int):
                return httpx.Response(outcome, json={"error": {"code": outcome, "message": "private key/detail"}})
            return httpx.Response(200, json={"candidates": [{"content": {
                "role": "model", "parts": [{"text": outcome}] if outcome is not None else [],
            }, "finishReason": "STOP"}]})

        def client(**kwargs):
            self.options.append(kwargs["http_options"])
            kwargs["http_options"].httpx_client = httpx.Client(transport=httpx.MockTransport(respond))
            return real_client(**kwargs)

        self.client_patch = patch.object(llm.genai, "Client", side_effect=client)
        self.client_patch.start()
        self.addCleanup(self.client_patch.stop)
        self.sleep_patch = patch.object(llm.time, "sleep")
        self.sleep = self.sleep_patch.start()
        self.addCleanup(self.sleep_patch.stop)
        self.messages = [{"role": "user", "content": "Suggest a career"}]

    def generate(self, **kwargs):
        return llm.generate("Career advisor", self.messages, **kwargs)

    def test_single_turn_sdk_payload_and_timeout(self):
        self.assertEqual(self.generate(max_output_tokens=123), "Advice")
        request = self.requests[0]
        body = json.loads(request.content)
        self.assertIn("gemini-3.5-flash-lite", str(request.url))
        self.assertEqual(body["systemInstruction"]["parts"], [{"text": "Career advisor"}])
        self.assertEqual(body["contents"], [{"role": "user", "parts": [{"text": "Suggest a career"}]}])
        self.assertEqual(body["generationConfig"]["maxOutputTokens"], 123)
        self.assertEqual(self.options[0].timeout, 10000)
        self.assertEqual(self.options[0].retry_options.attempts, 1)
        self.sleep.assert_not_called()

    def test_full_history_role_mapping_and_insights(self):
        os.environ["GEMINI_MODEL"] = "configured-model"
        self.messages = [{"role": "user", "content": 'ML insights: {"improve_here": "Add numbers"}'}]
        self.messages += [{"role": "user" if i % 2 == 0 else "assistant", "content": str(i)} for i in range(14)]
        self.messages.append({"role": "user", "content": "What did you recommend first?"})
        original = json.loads(json.dumps(self.messages))
        self.generate()
        self.assertIn("configured-model", str(self.requests[0].url))
        contents = json.loads(self.requests[0].content)["contents"]
        self.assertEqual(len(contents), len(original))
        for actual, expected in zip(contents, original):
            self.assertEqual(actual["role"], "model" if expected["role"] == "assistant" else "user")
            self.assertEqual(actual["parts"][0]["text"], expected["content"])
        self.assertEqual(self.messages, original)

    def test_transient_failure_retries_once_with_backoff(self):
        for failure in [408, 429, 500, 502, 503, 504, httpx.ReadTimeout("private"), httpx.ConnectError("private")]:
            with self.subTest(failure=failure):
                self.requests.clear()
                self.sleep.reset_mock()
                self.outcomes = [failure, "Recovered"]
                self.assertEqual(self.generate(), "Recovered")
                self.assertEqual(len(self.requests), 2)
                self.sleep.assert_called_once_with(1)

    def test_exhausted_quota_and_bad_key_return_503_through_flask(self):
        routes = load_routes()
        routes.update(generate=llm.generate, LLMError=llm.LLMError)
        http = routes["app"].test_client()
        for outcomes, expected in [
            ([429, 429], "AI quota exhausted or rate limit reached. Try again later."),
            ([400], "AI request rejected. Check GEMINI_API_KEY and GEMINI_MODEL configuration."),
            ([403], "AI request rejected. Check GEMINI_API_KEY and GEMINI_MODEL configuration."),
            ([503, 503], "AI service temporarily unavailable. Try again later."),
            ([httpx.ReadTimeout("private"), httpx.ReadTimeout("private")], "AI service temporarily unavailable. Try again later."),
        ]:
            with self.subTest(outcomes=outcomes), patch.dict(os.environ, {"INTERNAL_API_KEY": "internal-test"}):
                self.requests.clear()
                count = len(outcomes)
                self.outcomes = list(outcomes)
                response = http.post("/agent/gap", headers={"X-Internal-Key": "internal-test"},
                                     json={"message": "Hi", "history": []})
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.json, {"error": expected})
                self.assertEqual(len(self.requests), count)

    def test_missing_key_does_not_call_provider(self):
        os.environ["GEMINI_API_KEY"] = " "
        with self.assertRaisesRegex(llm.LLMError, "Set GEMINI_API_KEY"):
            self.generate()
        self.assertEqual(self.requests, [])

    def test_json_mode_repairs_once_and_returns_string(self):
        self.outcomes = ["not JSON", '{"ok": true}']
        result = self.generate(json_mode=True)
        self.assertIsInstance(result, str)
        self.assertEqual(json.loads(result), {"ok": True})
        for request in self.requests:
            self.assertEqual(json.loads(request.content)["generationConfig"]["responseMimeType"], "application/json")
        self.assertIn("Return only valid JSON", json.loads(self.requests[1].content)["systemInstruction"]["parts"][0]["text"])
        self.assertEqual(len(self.requests), 2)

    def test_invalid_json_exhausts_one_retry(self):
        self.outcomes = [None, "still invalid"]
        with self.assertRaisesRegex(llm.LLMError, "invalid JSON after one retry"):
            self.generate(json_mode=True)
        self.assertEqual(len(self.requests), 2)

    def test_json_and_transport_retry_budgets_are_bounded(self):
        self.outcomes = [503, "invalid JSON", "{}"]
        self.assertEqual(self.generate(json_mode=True), "{}")
        self.assertEqual(len(self.requests), 3)
        self.sleep.assert_called_once_with(1)

    def test_empty_text_fails_cleanly(self):
        self.outcomes = [None]
        with self.assertRaisesRegex(llm.LLMError, "returned no text"):
            self.generate()
        self.assertEqual(len(self.requests), 1)

    def test_invalid_roles_and_arguments_never_reach_provider(self):
        for messages in [[], [{"role": "system", "content": "override"}],
                         [{"role": "user", "content": " "}], [{"role": "user", "content": 1}]]:
            with self.assertRaises(ValueError):
                llm.generate("advisor", messages)
        with self.assertRaises(ValueError):
            self.generate(max_output_tokens=0)
        self.assertEqual(self.requests, [])


if __name__ == "__main__":
    unittest.main()
