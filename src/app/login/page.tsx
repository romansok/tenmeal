'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  async function handleGoogleSignIn() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #FFF8F0 0%, #FFE8D6 50%, #FFB347 100%)' }}
    >
      {/* Background decorative blobs */}
      <div
        className="absolute top-[-80px] right-[-80px] w-[320px] h-[320px] rounded-full opacity-30 blur-3xl"
        style={{ background: '#FF6B35' }}
      />
      <div
        className="absolute bottom-[-60px] left-[-60px] w-[240px] h-[240px] rounded-full opacity-20 blur-3xl"
        style={{ background: '#FFB347' }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 shadow-lg"
            style={{ background: '#FF6B35' }}>
            <span className="text-4xl">🍳</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#2C1810]">ארוחת 10</h1>
          <p className="text-[#2C1810]/60 mt-1 text-sm">ארוחות בוקר שילדים אוהבים</p>
        </div>

        {/* Glass card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(12px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.35)',
            boxShadow: '0 8px 32px rgba(31,38,135,0.12)',
          }}
        >
          <h2 className="text-xl font-bold text-[#2C1810] mb-2 text-center">
            ברוכים הבאים
          </h2>
          <p className="text-[#2C1810]/60 text-sm text-center mb-8">
            התחברו כדי לנהל הזמנות ארוחות הבוקר
          </p>

          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl font-bold text-[#2C1810] transition-transform active:scale-95 hover:shadow-md"
            style={{
              background: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.6)',
              boxShadow: '0 2px 8px rgba(31,38,135,0.08)',
            }}
          >
            <GoogleIcon />
            המשך עם Google
          </button>

          <p className="text-xs text-[#2C1810]/40 text-center mt-6 leading-relaxed">
            בהתחברות אתם מסכימים ל
            <span className="text-[#FF6B35]">תנאי השימוש</span>
            {' '}ו
            <span className="text-[#FF6B35]">מדיניות הפרטיות</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
