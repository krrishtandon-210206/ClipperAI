# Processing worker

Polls the `videos` table for `status = 'pending'`, and for each one:

1. Downloads it (yt-dlp for YouTube links, Supabase Storage for uploads)
2. Transcribes it with faster-whisper (word-level timestamps)
3. Sends the transcript to Gemini to score and rank the strongest
   candidate segments for virality
4. Cuts each candidate with ffmpeg: crops to 9:16, burns in word-by-word
   captions
5. Uploads each clip to the `clips` storage bucket
6. Asks Gemini for a title/caption/description grounded in that clip's
   transcript
7. Writes a row into the `clips` table with the score, caption,
   description, and public clip URL

## Requirements

- Python 3.10+
- **ffmpeg installed on the system** (`apt install ffmpeg` on
  Debian/Ubuntu, `brew install ffmpeg` on Mac) -- this is a system binary,
  not a pip package
- A machine with decent CPU (or a GPU for faster/higher-accuracy
  transcription -- swap `compute_type` in `transcribe.py` to `"float16"`
  and `device="cuda"` if you have one)

## Setup

```bash
cd worker
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
python main.py
```

The worker runs forever, polling every `POLL_INTERVAL_SECONDS`. Leave it
running as a background process / systemd service / Docker container in
production -- it's a separate long-running service from the Next.js app,
not something you deploy to Vercel.

## Where to run this in production

Vercel (where you'd likely deploy the Next.js app) can't run a
long-lived polling process. Good options:
- **Railway / Render** -- easiest, supports long-running Python workers
  and lets you attach more CPU/RAM as videos get longer
- A small VPS (Hetzner/DigitalOcean) with the worker running under
  `systemd` or `pm2`
- If you outgrow polling, swap the poll loop for a proper queue
  (Supabase's `pg_net`/webhooks, or Redis + Celery) so new videos are
  picked up instantly instead of within `POLL_INTERVAL_SECONDS`

## Notes on quality/cost

- `faster-whisper` "small" is fast and cheap but will make more
  transcription errors on noisy audio/accents than "medium" or
  "large-v3" -- bump the model size in `transcribe.py` if quality
  matters more than speed/cost.
- The face-tracking crop is currently a plain center-crop
  (`clipper.py`). For talking-head or two-person interview footage
  you'll usually want real face/active-speaker tracking so the crop
  doesn't cut people off -- that's a good next upgrade
  (e.g. `mediapipe` face detection to choose the crop window per clip).
- Gemini calls in `scoring.py`/`captions.py` use
  `response_mime_type: application/json` to keep output parseable;
  if you ever swap models, re-check that the new one supports
  structured JSON output the same way.
