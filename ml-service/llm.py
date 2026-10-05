"""Single provider boundary for text generation, returning text or safe errors."""
import json
import os
import time

import httpx
from google import genai
from google.genai import errors, types


class LLMError(RuntimeError):
    """Safe, user-facing provider failure."""


def generate(system_prompt, messages, json_mode=False, max_output_tokens=1024) -> str:
    """Generate text; JSON mode validates JSON and still returns a string.

    Allow one transient retry and one JSON repair retry per invocation.
    SDK retries are disabled so these limits cannot multiply invisibly.
    """
    if not isinstance(system_prompt, str) or not system_prompt.strip():
        raise ValueError("System prompt must be a non-empty string")
    if not isinstance(messages, list) or not messages:
        raise ValueError("Messages must be a non-empty list")
    if type(json_mode) is not bool or type(max_output_tokens) is not int or max_output_tokens < 1:
        raise ValueError("Invalid generation options")
    contents = []
    for message in messages:
        if (not isinstance(message, dict) or set(message) != {"role", "content"}
                or message["role"] not in ("user", "assistant")
                or not isinstance(message["content"], str) or not message["content"].strip()):
            raise ValueError("Invalid generation message")
        contents.append(types.Content(
            role="model" if message["role"] == "assistant" else "user",
            parts=[types.Part.from_text(text=message["content"])],
        ))

    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise LLMError("AI service is not configured. Set GEMINI_API_KEY.")
    model = os.environ.get("GEMINI_MODEL", "").strip() or "gemini-3.5-flash-lite"
    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        max_output_tokens=max_output_tokens,
        response_mime_type="application/json" if json_mode else "text/plain",
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )
    transient_retried = False
    json_retried = False
    with genai.Client(api_key=key, vertexai=False, http_options=types.HttpOptions(
        timeout=10000, retry_options=types.HttpRetryOptions(attempts=1),
    )) as client:
        while True:
            try:
                response = client.models.generate_content(model=model, contents=contents, config=config)
            except (errors.APIError, httpx.TransportError) as error:
                code = getattr(error, "code", None)
                transient = isinstance(error, httpx.TransportError) or code in (408, 429, 500, 502, 503, 504)
                if transient and not transient_retried:
                    transient_retried = True
                    time.sleep(1)
                    continue
                if code == 429:
                    raise LLMError("AI quota exhausted or rate limit reached. Try again later.") from None
                if code in (400, 401, 403):
                    raise LLMError("AI request rejected. Check GEMINI_API_KEY and GEMINI_MODEL configuration.") from None
                raise LLMError("AI service temporarily unavailable. Try again later.") from None

            text = (response.text or "").strip()
            if json_mode:
                try:
                    json.loads(text)
                except (ValueError, RecursionError):
                    if json_retried:
                        raise LLMError("AI returned invalid JSON after one retry.") from None
                    json_retried = True
                    config.system_instruction = system_prompt + "\nReturn only valid JSON, without Markdown fences."
                    continue
            if not text:
                raise LLMError("AI returned no text. Try rephrasing your request.")
            return text
