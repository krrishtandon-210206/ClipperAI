import os
import yt_dlp
from faster_whisper import WhisperModel

import config
import supabase_client as sb

# Loaded once per worker process. "small" is a reasonable CPU-friendly
# default; use "medium"/"large-v3" with a GPU box for better accuracy.
_model: WhisperModel | None = None


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel("small", device="auto", compute_type="int8")
    return _model


def download_youtube(url: str, out_path: str) -> str:
    ydl_opts = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4",
        "outtmpl": out_path,
        "merge_output_format": "mp4",
        "quiet": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    return out_path


def fetch_source_video(client, video_row: dict) -> str:
    """Returns a local filesystem path to the source video."""
    video_id = video_row["id"]
    local_path = os.path.join(config.WORK_DIR, f"{video_id}.mp4")

    if video_row["source_type"] == "youtube_url":
        download_youtube(video_row["source_url"], local_path)
    else:
        # source_url holds the storage bucket path for uploads
        sb.download_upload_from_storage(client, video_row["source_url"], local_path)

    return local_path


def transcribe(local_video_path: str) -> list[dict]:
    """Returns word-level segments: [{start, end, text}, ...]"""
    model = get_model()
    segments, _info = model.transcribe(local_video_path, word_timestamps=True)

    words = []
    for seg in segments:
        for w in seg.words:
            words.append({"start": w.start, "end": w.end, "text": w.word.strip()})
    return words
