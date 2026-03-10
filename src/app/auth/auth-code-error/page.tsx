import Link from 'next/link'

export default function AuthCodeErrorPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #FFF8F0 0%, #FFB347 100%)' }}
    >
      <div
        className="max-w-md w-full mx-4 p-8 text-center rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(12px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.35)',
          boxShadow: '0 8px 32px rgba(31,38,135,0.12)',
        }}
      >
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-[#2C1810] mb-3">
          שגיאה בהתחברות
        </h1>
        <p className="text-[#2C1810]/70 mb-8 leading-relaxed">
          לא הצלחנו להשלים את תהליך ההתחברות. ייתכן שהקישור פג תוקפו או שאירעה
          שגיאה זמנית.
        </p>
        <Link
          href="/login"
          className="inline-block px-8 py-3 rounded-xl font-bold text-white transition-transform active:scale-95"
          style={{ background: '#FF6B35' }}
        >
          נסה שוב
        </Link>
      </div>
    </div>
  )
}
