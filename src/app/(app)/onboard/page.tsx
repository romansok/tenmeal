export default function OnboardPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
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
        <div className="text-5xl mb-4">🥐</div>
        <h1 className="text-2xl font-extrabold text-[#2C1810] mb-2">
          הגדרת החשבון
        </h1>
        <p className="text-[#2C1810]/60 text-sm leading-relaxed">
          עוד רגע מוכנים! כאן תתקיים הגדרת הפרופיל וההעדפות.
        </p>
        <p className="text-xs text-[#2C1810]/40 mt-4">(בפיתוח)</p>
      </div>
    </div>
  )
}
