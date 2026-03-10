'use client'

import Link from 'next/link'

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

export default function Navbar() {
  const scrollToContact = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 bg-white/75 backdrop-blur-md border-b border-white/40 shadow-sm">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 group"
          aria-label="ארוחת 10 — חזרה לדף הבית"
        >
          <span
            className="transition-transform duration-150 group-hover:scale-110"
            style={{ transformOrigin: 'center' }}
          >
            <SandwichLogo />
          </span>
          <span className="text-xl font-black text-deep-espresso tracking-tight group-hover:text-sunrise-orange transition-colors duration-150">
            ארוחת 10
          </span>
        </Link>

        <div className="flex items-center gap-5">
          <Link
            href="/about"
            className="text-sm font-semibold text-deep-espresso/70 hover:text-deep-espresso transition-colors duration-150"
          >
            אודות
          </Link>
          <button onClick={scrollToContact} className="btn-primary text-sm px-5 py-2.5">
            הצטרפו עכשיו
          </button>
        </div>
      </div>
    </nav>
  )
}
