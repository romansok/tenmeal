import type { Metadata } from 'next'
import { Rubik } from 'next/font/google'
import '@/styles/globals.css'

const rubik = Rubik({
  subsets: ['latin', 'hebrew'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-rubik',
})

export const metadata: Metadata = {
  title: 'ארוחת 10 | ארוחות בוקר לילדים',
  description: 'ארוחות בוקר מזינות, טריות וצבעוניות שמגיעות ישירות לבית הספר.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable}>
      <body className="font-rubik">{children}</body>
    </html>
  )
}
