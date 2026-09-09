from supabase import create_client, Client
import config


def get_client() -> Client:
    # Service role key bypasses row-level security -- worker acts on
    # behalf of all users, so keep this key server-side only, never
    # ship it to the frontend.
    return create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)


def fetch_pending_videos(client: Client, limit: int = 5):
    resp = (
        client.table("videos")
        .select("*")
        .eq("status", "pending")
        .order("created_at")
        .limit(limit)
        .execute()
    )
    return resp.data


def mark_video_status(client: Client, video_id: str, status: str, error: str | None = None):
    payload = {"status": status}
    if error:
        payload["error"] = error
    client.table("videos").update(payload).eq("id", video_id).execute()


def insert_clip(client: Client, clip: dict):
    return client.table("clips").insert(clip).execute()


def download_upload_from_storage(client: Client, storage_path: str, dest_path: str):
    data = client.storage.from_("source-videos").download(storage_path)
    with open(dest_path, "wb") as f:
        f.write(data)


def upload_clip_to_storage(client: Client, local_path: str, storage_path: str) -> str:
    with open(local_path, "rb") as f:
        client.storage.from_("clips").upload(
            storage_path, f, {"content-type": "video/mp4", "upsert": "true"}
        )
    return client.storage.from_("clips").get_public_url(storage_path)
