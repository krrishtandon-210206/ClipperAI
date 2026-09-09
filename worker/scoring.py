import json
import re
import google.generativeai as genai

import config

genai.configure(api_key=config.GEMINI_API_KEY)

SCORING_PROMPT = """You are an expert short-form video editor who has cut hundreds \
of viral TikTok/Reels/Shorts clips from long-form podcasts and interviews.

Below is a timestamped transcript. Identify the {max_clips} strongest candidate \
segments for standalone viral short-form clips. Each segment must:
- Be between {min_sec} and {max_sec} seconds long
- Make sense on its own without earlier context (a clear hook, a self-contained \
story/point/payoff)
- Have a strong opening line that would stop someone from scrolling

For each candidate, score 0-100 on: hook_strength, emotional_intensity, \
standalone_clarity, quotability. Then compute an overall virality_score (0-100) \
as your holistic judgment (not necessarily the average).

Respond with ONLY a JSON array, no other text, in this exact shape:
[
  {{
    "start": <seconds, number>,
    "end": <seconds, number>,
    "virality_score": <0-100>,
    "hook_strength": <0-100>,
    "emotional_intensity": <0-100>,
    "standalone_clarity": <0-100>,
    "quotability": <0-100>,
    "reason": "<one sentence on why this clip works>"
  }},
  ...
]

Transcript (word, start_seconds, end_seconds per line):
{transcript_lines}
"""


def _format_transcript(words: list[dict]) -> str:
    lines = [f"{w['text']} [{w['start']:.1f}-{w['end']:.1f}]" for w in words]
    return "\n".join(lines)


def _extract_json_array(text: str) -> list:
    # Gemini sometimes wraps JSON in ```json fences despite instructions;
    # strip those before parsing.
    text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    return json.loads(text)


def score_segments(words: list[dict]) -> list[dict]:
    model = genai.GenerativeModel(config.GEMINI_MODEL)

    prompt = SCORING_PROMPT.format(
        max_clips=config.MAX_CLIPS_PER_VIDEO,
        min_sec=config.MIN_CLIP_SECONDS,
        max_sec=config.MAX_CLIP_SECONDS,
        transcript_lines=_format_transcript(words),
    )

    response = model.generate_content(
        prompt,
        generation_config={"temperature": 0.4, "response_mime_type": "application/json"},
    )

    candidates = _extract_json_array(response.text)
    candidates.sort(key=lambda c: c["virality_score"], reverse=True)
    return candidates[: config.MAX_CLIPS_PER_VIDEO]


def transcript_text_for_range(words: list[dict], start: float, end: float) -> str:
    return " ".join(w["text"] for w in words if start <= w["start"] <= end)
