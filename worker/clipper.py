import os
import subprocess

import config


def _seconds_to_ass_time(t: float) -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h:d}:{m:02d}:{s:05.2f}"


def _build_ass_captions(words: list[dict], clip_start: float, clip_end: float, ass_path: str):
    """Word-by-word highlighted captions, styled like CapCut/TikTok clips."""
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV
Style: Default,Arial Black,72,&H00FFFFFF,&H00000000,1,1,4,0,2,80,80,300

[Events]
Format: Layer, Start, End, Style, Text
"""
    lines = [header]
    for w in words:
        if w["start"] < clip_start or w["end"] > clip_end + 1:
            continue
        rel_start = max(0.0, w["start"] - clip_start)
        rel_end = max(rel_start + 0.05, w["end"] - clip_start)
        text = w["text"].replace("{", "").replace("}", "")
        lines.append(
            f"Dialogue: 0,{_seconds_to_ass_time(rel_start)},"
            f"{_seconds_to_ass_time(rel_end)},Default,{text}\n"
        )

    with open(ass_path, "w") as f:
        f.writelines(lines)


def cut_clip_with_captions(
    source_video_path: str,
    words: list[dict],
    start: float,
    end: float,
    out_path: str,
):
    """
    Cuts [start, end] from the source, crops/scales to 9:16, and burns in
    word-by-word captions. Uses a center crop -- swap in a face-tracking
    crop later if you want smarter reframing for wide two-shot interviews.
    """
    ass_path = out_path.replace(".mp4", ".ass")
    _build_ass_captions(words, start, end, ass_path)

    vf = (
        "scale=1080:1920:force_original_aspect_ratio=increase,"
        "crop=1080:1920,"
        f"ass={ass_path}"
    )

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start),
        "-to", str(end),
        "-i", source_video_path,
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-c:a", "aac",
        out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return out_path
