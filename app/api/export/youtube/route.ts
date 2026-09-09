import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'

async function refreshAccessTokenIfNeeded(supabase: any, connection: any) {
  if (new Date(connection.expires_at) > new Date()) {
    return connection.access_token
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const tokens = await res.json()
  if (!res.ok) throw new Error('Failed to refresh YouTube token')

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  await supabase
    .from('platform_connections')
    .update({ access_token: tokens.access_token, expires_at: expiresAt })
    .eq('id', connection.id)

  return tokens.access_token
}

export async function POST(req: NextRequest) {
  const { clipId } = await req.json()
  const supabase = createServerSupabase()

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: clip, error: clipError } = await supabase
    .from('clips')
    .select('*')
    .eq('id', clipId)
    .single()
  if (clipError || !clip) {
    return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
  }

  const { data: connection, error: connError } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('user_id', userData.user.id)
    .eq('platform', 'youtube')
    .single()
  if (connError || !connection) {
    return NextResponse.json(
      { error: 'YouTube not connected. Connect it first.' },
      { status: 400 }
    )
  }

  const accessToken = await refreshAccessTokenIfNeeded(supabase, connection)

  // Download the clip bytes from Supabase storage's public URL
  const videoRes = await fetch(clip.clip_url)
  const videoBuffer = await videoRes.arrayBuffer()

  const metadata = {
    snippet: {
      title: clip.caption?.slice(0, 90) || 'Short clip',
      description: `${clip.description || ''}\n\n#Shorts`,
      categoryId: '22',
    },
    status: { privacyStatus: 'private' }, // flip to 'public' once you're confident
  }

  // Resumable upload: initiate session, then send the video bytes
  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify(metadata),
    }
  )

  const uploadUrl = initRes.headers.get('location')
  if (!uploadUrl) {
    const err = await initRes.text()
    console.error('YouTube upload init failed', err)
    return NextResponse.json({ error: 'Failed to initiate YouTube upload' }, { status: 500 })
  }

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4' },
    body: Buffer.from(videoBuffer),
  })

  const uploadJson = await uploadRes.json()
  if (!uploadRes.ok) {
    console.error('YouTube upload failed', uploadJson)
    return NextResponse.json({ error: 'YouTube upload failed' }, { status: 500 })
  }

  return NextResponse.json({ youtubeVideoId: uploadJson.id })
}
