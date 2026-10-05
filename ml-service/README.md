---
title: CareerCompass AI ML
emoji: 🚀
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 8000
pinned: false
---

# CareerCompass AI - ML Service
This service handles resume analysis using spaCy.

Career chat uses Google's official `google-genai` SDK through `llm.py`.
Copy `.env.example` to `.env` locally, or configure Hugging Face Space Secrets:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash-lite
INTERNAL_API_KEY=replace_with_shared_random_secret
```

`GEMINI_MODEL` is optional; the default is `gemini-3.5-flash-lite`.
The internal key must match the Node backend. Keep keys server-side.
See the root README for [SDK documentation](https://googleapis.github.io/python-genai/),
model availability, retry behavior, and deployment order.

`generate(system_prompt, messages, json_mode=False, max_output_tokens=1024) -> str`
preserves all supplied history. JSON mode validates output and retries malformed JSON once.
Provider requests have a 10-second timeout and one transient retry after a one-second backoff.
Unavailable service, bad configuration, and exhausted quota return safe JSON HTTP 503 responses.

From the repository root, with dependencies installed:

```bash
python -m unittest discover -s ml-service -p 'test_*.py'
```

Tests use the real Gemini SDK with a fake HTTP transport; no API key or network is required.
