import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

# Local scratch space for downloads/intermediate files
WORK_DIR = os.environ.get("WORK_DIR", "/tmp/shorts-worker")

# How many top-ranked segments to turn into clips per source video
MAX_CLIPS_PER_VIDEO = int(os.environ.get("MAX_CLIPS_PER_VIDEO", "5"))

# Candidate segment length range (seconds) when scanning the transcript
MIN_CLIP_SECONDS = int(os.environ.get("MIN_CLIP_SECONDS", "25"))
MAX_CLIP_SECONDS = int(os.environ.get("MAX_CLIP_SECONDS", "75"))

# Seconds between polls for new pending videos
POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL_SECONDS", "10"))

os.makedirs(WORK_DIR, exist_ok=True)
