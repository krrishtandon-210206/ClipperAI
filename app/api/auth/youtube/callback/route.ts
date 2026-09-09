import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(new URL('/dashboard?error=missing_code', req.url))
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()
  if (!tokenRes.ok) {
    console.error('YouTube token exchange failed', tokens)
    return NextResponse.redirect(new URL('/dashboard?error=token_exchange', req.url))
  }

  const supabase = createServerSupabase()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await supabase.from('platform_connections').upsert({
    user_id: userData.user.id,
    platform: 'youtube',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
  }, { onConflict: 'user_id,platform' })

  return NextResponse.redirect(new URL('/clips?connected=youtube', req.url))
}
