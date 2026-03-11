'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

function SandwichLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 20"
      width="24"
      height="20"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      {/* Top bread dome */}
      <path
        d="M3 8 C3 3.5 21 3.5 21 8 L21 9.5 C21 10.3 20.3 11 19.5 11 L4.5 11 C3.7 11 3 10.3 3 9.5 Z"
        fill="#FFB347"
        stroke="#e8962a"
        strokeWidth="0.6"
      />
      {/* Sesame seeds on top bread */}
      <ellipse cx="9"  cy="7.2" rx="0.9" ry="0.55" fill="#FFF8F0" opacity="0.80" />
      <ellipse cx="13" cy="6.4" rx="0.9" ry="0.55" fill="#FFF8F0" opacity="0.80" />
      <ellipse cx="17" cy="7.2" rx="0.9" ry="0.55" fill="#FFF8F0" opacity="0.80" />

      {/* Lettuce layer */}
      <path
        d="M2 11 Q4.5 9.5 7 11.5 Q9.5 13 12 11 Q14.5 9 17 11.5 Q19.5 13.5 22 11"
        stroke="#5BAD6F"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Tomato layer */}
      <rect x="3.5" y="12.5" width="17" height="2.2" rx="1.1" fill="#FF6B35" opacity="0.90" />

      {/* Bottom bread flat */}
      <rect x="3" y="15.2" width="18" height="3.2" rx="1.6" fill="#FFB347" stroke="#e8962a" strokeWidth="0.6" />
    </svg>
  )
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <span className="navbar-avatar" aria-hidden="true">
      {initials || '?'}
    </span>
  )
}

export default function Navbar() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [scrolled, setScrolled] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const scrollToContact = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
  }

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? ''

  return (
    <nav className={`navbar-root${scrolled ? ' navbar-scrolled' : ''}`} role="navigation" aria-label="ניווט ראשי">
      {/* Gradient shimmer line at bottom */}
      <span className="navbar-shimmer-line" aria-hidden="true" />

      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link
          href="/"
          className="navbar-logo-link group"
          aria-label="ארוחת 10 — חזרה לדף הבית"
        >
          <span className="navbar-logo-icon-wrap">
            <SandwichLogo className="navbar-logo-svg" />
            <span className="navbar-logo-glow" aria-hidden="true" />
          </span>
          <span className="navbar-brand-text">
            ארוחת 10
          </span>
        </Link>

        {/* Right-side controls (RTL: visually on the left) */}
        <div className="flex items-center gap-1">

          {/* Nav link — אודות */}
          <Link
            href="/about"
            className="navbar-link"
          >
            אודות
          </Link>

          {/* Loading placeholder — prevents layout shift */}
          {user === undefined && (
            <div className="navbar-skeleton" aria-hidden="true" />
          )}

          {/* Logged out */}
          {user === null && (
            <>
              <button
                onClick={scrollToContact}
                className="navbar-link"
              >
                הצטרפו עכשיו
              </button>
              <Link href="/login" className="navbar-cta">
                התחבר
              </Link>
            </>
          )}

          {/* Logged in */}
          {user !== null && user !== undefined && (
            <div className="flex items-center gap-2">
              <Link
                href="/user"
                className="navbar-user-link group"
                aria-label={`פרופיל של ${displayName}`}
              >
                <span className="navbar-avatar-ring">
                  <UserAvatar name={displayName} />
                </span>
                <span className="navbar-user-name">
                  {displayName}
                </span>
              </Link>
              <button
                onClick={handleSignOut}
                className="navbar-signout"
                aria-label="יציאה מהחשבון"
              >
                יציאה
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
