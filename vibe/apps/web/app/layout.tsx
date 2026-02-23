import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VIBE - AI Coding Assistant',
  description: 'Build software faster with your AI coding assistant',
}

export const viewport: Viewport = {
  themeColor: '#1a1a2e',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
