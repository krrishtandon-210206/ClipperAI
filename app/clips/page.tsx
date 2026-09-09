'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'

type Clip = {
  id: string
  video_id: string
  virality_score: number
  caption: string
  description: string
  clip_url: string
  status: string
  created_at: string
}

export default function ClipsPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [clips, setClips] = useState<Clip[]>([])
  const [youtubeConnected, setYoutubeConnected] = useState(false)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login')
        return
      }
    })
    loadClips()
    checkYoutubeConnection()

    if (searchParams.get('connected') === 'youtube') {
      setMessage('YouTube connected.')
    }
  }, [])

  async function loadClips() {
    const { data } = await supabase
      .from('clips')
      .select('*')
      .order('virality_score', { ascending: false })
    if (data) setClips(data as Clip[])
  }

  async function checkYoutubeConnection() {
    const { data } = await supabase
      .from('platform_connections')
      .select('id')
      .eq('platform', 'youtube')
      .maybeSingle()
    setYoutubeConnected(!!data)
  }

  async function exportToYoutube(clipId: string) {
    setExportingId(clipId)
    setMessage(null)
    try {
      const res = await fetch('/api/export/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMessage(`Uploaded to YouTube (video id: ${json.youtubeVideoId}, set to private -- review then publish).`)
    } catch (e: any) {
      setMessage(`Export failed: ${e.message}`)
    } finally {
      setExportingId(null)
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Your clips</h1>

      <div style={{ marginBottom: 24, padding: 12, background: '#f5f5f5' }}>
        <strong>Export connections</strong>
        <div style={{ marginTop: 8 }}>
          {youtubeConnected ? (
            <span>✅ YouTube connected</span>
          ) : (
            <a href="/api/auth/youtube"><button>Connect YouTube</button></a>
          )}
        </div>
        <div style={{ marginTop: 8, color: '#888', fontSize: 14 }}>
          Instagram Reels and TikTok export require Meta/TikTok to approve
          this app for your account before it works for real users -- see
          README for how to apply.
        </div>
      </div>

      {message && <p>{message}</p>}

      {clips.length === 0 && <p>No clips yet -- submit a video from the dashboard.</p>}

      {clips.map((clip) => (
        <div key={clip.id} style={{ border: '1px solid #ddd', padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>Virality score: {clip.virality_score}</strong>
            <span>{new Date(clip.created_at).toLocaleString()}</span>
          </div>
          <video src={clip.clip_url} controls style={{ width: 240, marginTop: 8 }} />
          <p><strong>Caption:</strong> {clip.caption}</p>
          <p><strong>Description:</strong> {clip.description}</p>
          <a href={clip.clip_url} download>
            <button style={{ marginRight: 8 }}>Download</button>
          </a>
          <button
            disabled={!youtubeConnected || exportingId === clip.id}
            onClick={() => exportToYoutube(clip.id)}
          >
            {exportingId === clip.id ? 'Uploading...' : 'Export to YouTube Shorts'}
          </button>
        </div>
      ))}
    </div>
  )
}
