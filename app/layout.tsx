export const metadata = {
  title: 'Viral Shorts Generator',
  description: 'Turn long-form videos into viral shorts',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
