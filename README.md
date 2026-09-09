# Viral Shorts Generator

Turn long-form videos into viral short clips — automatically.
Paste a YouTube link or upload a video, and AI transcribes it, identifies
and ranks the most viral moments, cuts and captions the clips, and gets
them ready to export to YouTube Shorts, Instagram Reels, and TikTok.

## Features

- 🔐 Email/password authentication
- 🔗 Ingest video via YouTube link or direct upload
- 🎙️ Automatic transcription with word-level timestamps (Whisper)
- 🤖 AI-ranked viral moment detection (Gemini) — hook strength, emotional
  intensity, standalone clarity, quotability
- ✂️ Automatic clip cutting, 9:16 reframing, and burned-in word-by-word
  captions (ffmpeg)
- ✍️ AI-generated titles, captions, and descriptions per clip, grounded
  in that clip's actual transcript
- 📤 One-click export to YouTube Shorts (OAuth); Instagram Reels and
  TikTok export follow the same pattern, pending platform app review
- ⬇️ Direct mp4 download and in-browser preview for every generated clip

## Tech stack

| Layer          | Choice                                   |
|----------------|-------------------------------------------|
| Frontend       | Next.js (App Router), React, TypeScript   |
| Auth / DB      | Supabase (Postgres, Auth, Storage)        |
| Processing     | Python worker — yt-dlp, faster-whisper, ffmpeg |
| AI             | Google Gemini (virality scoring + copywriting) |
| Video export   | YouTube Data API v3 (Instagram/TikTok pending review) |

## Architecture

```
┌────────────┐      ┌──────────────┐      ┌───────────────┐
│  Next.js   │◄────►│   Supabase   │◄────►│ Python worker │
│  frontend  │      │ (DB/Auth/    │      │ (yt-dlp,      │
│            │      │  Storage)    │      │  Whisper,     │
└────────────┘      └──────────────┘      │  Gemini,      │
                                           │  ffmpeg)      │
                                           └───────────────┘
```

The frontend writes a `pending` row to the `videos` table on submit. The
worker polls for pending rows, does all the heavy processing, and writes
ranked clips back to the `clips` table — the frontend just reads and
displays them.

## Project structure

```
shorts-app/
├── app/                     # Next.js pages & API routes
│   ├── signup/, login/      # Auth pages
│   ├── dashboard/           # Video ingestion (link or upload)
│   ├── clips/               # Ranked clips: preview, download, export
│   └── api/
│       ├── auth/youtube/    # YouTube OAuth connect + callback
│       └── export/youtube/  # Uploads a clip to YouTube Shorts
├── lib/                     # Supabase client helpers
├── worker/                  # Python processing service
│   ├── transcribe.py        # yt-dlp download + Whisper transcription
│   ├── scoring.py           # Gemini virality scoring
│   ├── clipper.py           # ffmpeg cut + crop + burned-in captions
│   ├── captions.py          # Gemini caption/description generation
│   └── main.py              # Poll loop tying it all together
└── supabase-schema.sql      # Tables + row-level security policies
```

## Setup

### 1. Supabase
1. Create a project at supabase.com
2. SQL Editor → run `supabase-schema.sql`
3. Authentication → Providers → Email is on by default; disable
   "Confirm email" while developing
4. Project Settings → API → copy the URL, anon key, and service role key

### 2. Gemini
Get a key at https://aistudio.google.com/app/apikey

### 3. Google Cloud (for YouTube export)
1. Create a project, enable "YouTube Data API v3"
2. OAuth consent screen → External → add yourself as a test user
3. Credentials → OAuth client ID → Web application → redirect URI:
   `http://localhost:3000/api/auth/youtube/callback`

### 4. Run the frontend
```bash
cp .env.example .env.local   # fill in Supabase + Google values
npm install
npm run dev
```

### 5. Run the worker
```bash
cd worker
cp .env.example .env         # fill in Supabase + Gemini values
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py
```
This is a separate long-running process — see `worker/README.md` for
production hosting (Railway/Render/a VPS; not Vercel).

## Usage
1. Sign up / log in
2. Paste a YouTube link or upload a video on `/dashboard`
3. The worker processes it (download → transcribe → score → cut → caption)
4. Ranked clips appear on `/clips` with previews and download buttons
5. Connect YouTube and export directly (uploads as private for review)

## Instagram Reels & TikTok
Same OAuth-connect-then-upload pattern as YouTube, but both platforms
require you to complete their own app review before real users can
auto-post:
- **Instagram**: Meta App Review + a Business/Creator account +
  `instagram_content_publish` permission
- **TikTok**: TikTok Developer app approval for the Content Posting API

You can test both with your own developer/test accounts before review.

## Roadmap / known limitations
- [ ] Face/active-speaker tracking for reframing (currently center-crop)
- [ ] Replace polling with a queue (Supabase webhooks or Redis+Celery)
- [ ] Configurable Whisper model size for accuracy vs. speed
- [ ] Retry/backoff on worker failures instead of failing the whole video
- [ ] Instagram + TikTok export once platform review is complete

## License
Add a license of your choice (MIT is a common default for solo/startup
projects — add a `LICENSE` file if you want one).
