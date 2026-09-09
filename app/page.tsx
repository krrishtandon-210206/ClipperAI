import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ maxWidth: 600, margin: '100px auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>Viral Shorts Generator</h1>
      <p>Turn long-form videos into viral clips, ranked and ready to post.</p>
      <Link href="/signup" style={{ marginRight: 16 }}>Sign up</Link>
      <Link href="/login">Log in</Link>
    </div>
  )
}
