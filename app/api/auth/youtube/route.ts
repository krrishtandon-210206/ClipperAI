import { NextResponse } from 'next/server'

// Kicks off Google OAuth so we can upload to the user's YouTube channel later.
// Requires a Google Cloud project with the YouTube Data API v3 enabled and
// an OAuth 2.0 Client ID (Web application) -- see README for setup.
export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/youtube.upload',
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
