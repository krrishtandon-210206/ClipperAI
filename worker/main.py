import os
import time
import traceback

import config
import supabase_client as sb
import transcribe
import scoring
import clipper
import captions as caption_gen


def process_video(client, video_row: dict):
    video_id = video_row["id"]
    print(f"[worker] Processing video {video_id}")
    sb.mark_video_status(client, video_id, "processing")

    local_source = transcribe.fetch_source_video(client, video_row)
    words = transcribe.transcribe(local_source)

    if not words:
        sb.mark_video_status(client, video_id, "failed", "No speech detected")
        return

    candidates = scoring.score_segments(words)

    for i, cand in enumerate(candidates):
        start, end = cand["start"], cand["end"]
        clip_local_path = os.path.join(config.WORK_DIR, f"{video_id}_clip{i}.mp4")

        clipper.cut_clip_with_captions(local_source, words, start, end, clip_local_path)

        storage_path = f"{video_row['user_id']}/{video_id}_clip{i}.mp4"
        public_url = sb.upload_clip_to_storage(client, clip_local_path, storage_path)

        clip_transcript = scoring.transcript_text_for_range(words, start, end)
        meta = caption_gen.generate_caption_and_description(clip_transcript)

        sb.insert_clip(client, {
            "video_id": video_id,
            "user_id": video_row["user_id"],
            "start_seconds": start,
            "end_seconds": end,
            "virality_score": cand["virality_score"],
            "caption": meta["caption"],
            "description": meta["description"],
            "clip_url": public_url,
            "status": "done",
        })

        os.remove(clip_local_path)

    os.remove(local_source)
    sb.mark_video_status(client, video_id, "done")
    print(f"[worker] Finished video {video_id} -> {len(candidates)} clips")


def run_forever():
    client = sb.get_client()
    print("[worker] Started. Polling for pending videos...")

    while True:
        try:
            pending = sb.fetch_pending_videos(client)
            for video_row in pending:
                try:
                    process_video(client, video_row)
                except Exception as e:
                    print(f"[worker] Failed video {video_row['id']}: {e}")
                    traceback.print_exc()
                    sb.mark_video_status(client, video_row["id"], "failed", str(e))
        except Exception as e:
            print(f"[worker] Poll loop error: {e}")
            traceback.print_exc()

        time.sleep(config.POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    run_forever()
