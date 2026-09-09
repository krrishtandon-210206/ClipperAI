import json
import re
import google.generativeai as genai

import config

genai.configure(api_key=config.GEMINI_API_KEY)

CAPTION_PROMPT = """You are a social media growth expert writing captions for a short \
video clip pulled from a longer podcast/interview.

Here is the transcript of this specific clip:
---
{clip_transcript}
---

Write, grounded ONLY in what's actually said above (do not invent facts):
1. A short punchy title (under 60 characters)
2. A caption for TikTok/Reels/Shorts: a hook line + 3-5 relevant hashtags
3. A slightly longer description suitable for YouTube Shorts (1-3 sentences)

Respond with ONLY JSON, no other text, in this exact shape:
{{
  "title": "...",
  "caption": "...",
  "description": "..."
}}
"""


def _extract_json(text: str) -> dict:
    text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    return json.loads(text)


def generate_caption_and_description(clip_transcript: str) -> dict:
    model = genai.GenerativeModel(config.GEMINI_MODEL)

    prompt = CAPTION_PROMPT.format(clip_transcript=clip_transcript)

    response = model.generate_content(
        prompt,
        generation_config={"temperature": 0.7, "response_mime_type": "application/json"},
    )

    return _extract_json(response.text)
