import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const displayName =
    user.user_metadata?.full_name ?? user.email ?? 'משתמש'

  async function signOut() {
    'use server'
    const supabase = createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #FFF8F0 0%, #FFE8D6 50%, #FFB347 100%)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 text-center"
        style={{
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(12px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.35)',
          boxShadow: '0 8px 32px rgba(31,38,135,0.12)',
        }}
      >
        <div className="text-5xl mb-4">🍳</div>
        <h1 className="text-2xl font-extrabold text-[#2C1810] mb-1">
          שלום, {displayName}!
        </h1>
        <p className="text-[#2C1810]/60 text-sm mb-8">ברוכים הבאים ל-ארוחת 10</p>

        <form action={signOut}>
          <button
            type="submit"
            className="w-full py-3 px-6 rounded-xl font-bold text-white transition-transform active:scale-95"
            style={{ background: '#FF6B35' }}
          >
            התנתק
          </button>
        </form>
      </div>
    </div>
  )
}
