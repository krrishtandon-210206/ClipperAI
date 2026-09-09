'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'

type VideoRow = {
  id: string
  source_type: 'youtube_url' | 'upload'
  source_url: string | null
  status: string
  created_at: string
}

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()

  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login')
        return
      }
      setUserEmail(data.user.email ?? null)
    })
    loadVideos()
  }, [])

  async function loadVideos() {
    const { data } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setVideos(data as VideoRow[])
  }

  async function handleYoutubeSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { error } = await supabase.from('videos').insert({
      user_id: userData.user.id,
      source_type: 'youtube_url',
      source_url: youtubeUrl,
      status: 'pending',
    })

    setSubmitting(false)
    if (error) {
      setMessage(`Error: ${error.message}`)
      return
    }
    setYoutubeUrl('')
    setMessage('Video queued for processing.')
    loadVideos()
  }

  async function handleFileUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setSubmitting(true)
    setMessage(null)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const path = `${userData.user.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('source-videos')
      .upload(path, file)

    if (uploadError) {
      setSubmitting(false)
      setMessage(`Upload error: ${uploadError.message}`)
      return
    }

    const { error: dbError } = await supabase.from('videos').insert({
      user_id: userData.user.id,
      source_type: 'upload',
      source_url: path,
      status: 'pending',
    })

    setSubmitting(false)
    if (dbError) {
      setMessage(`Error: ${dbError.message}`)
      return
    }
    setFile(null)
    setMessage('Video uploaded and queued for processing.')
    loadVideos()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>Dashboard</h1>
        <div>
          <span style={{ marginRight: 12 }}>{userEmail}</span>
          <a href="/clips" style={{ marginRight: 12 }}>View clips</a>
          <button onClick={handleLogout}>Log out</button>
        </div>
      </div>

      <h2>Paste a YouTube link</h2>
      <form onSubmit={handleYoutubeSubmit} style={{ marginBottom: 24 }}>
        <input
          type="url"
          required
          placeholder="https://www.youtube.com/watch?v=..."
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          style={{ width: '70%', padding: 8, marginRight: 8 }}
        />
        <button type="submit" disabled={submitting}>Submit</button>
      </form>

      <h2>Or upload a video</h2>
      <form onSubmit={handleFileUpload} style={{ marginBottom: 24 }}>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={submitting || !file} style={{ marginLeft: 8 }}>
          Upload
        </button>
      </form>

      {message && <p>{message}</p>}

      <h2>Your videos</h2>
      <ul>
        {videos.map((v) => (
          <li key={v.id}>
            [{v.status}] {v.source_type === 'youtube_url' ? v.source_url : v.source_url}
            {' — '}
            {new Date(v.created_at).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  )
}
