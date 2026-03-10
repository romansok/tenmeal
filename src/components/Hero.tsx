export default function Hero() {
  return (
    <section className="relative overflow-hidden min-h-screen flex items-center justify-center px-6 pt-16" style={{ backgroundColor: '#F2DFC0' }}>
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute w-80 h-80 rounded-full bg-white/20 blur-3xl -top-10 -right-20" />
      <div className="pointer-events-none absolute w-64 h-64 rounded-full bg-sunrise-orange/25 blur-3xl bottom-10 -left-16" />
      <div className="pointer-events-none absolute w-48 h-48 rounded-full bg-warm-amber/30 blur-2xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      {/* Veggie-green blob — hints at the fresh lettuce/vegetables inside */}
      <div className="pointer-events-none absolute w-56 h-56 rounded-full blur-3xl top-16 left-10" style={{ backgroundColor: 'rgba(91, 173, 111, 0.18)' }} />

      <div className="relative max-w-xl w-full mx-auto py-24 flex flex-col items-center">
        {/* Glass card */}
        <div className="glass-hero w-full p-10 md:p-14 text-center animate-slide-up">
          <span className="inline-block bg-fresh-veggie-green/15 text-deep-espresso/75 text-sm font-semibold px-4 py-1.5 rounded-full mb-8 tracking-wide">
            כריך טרי עם ירקות — מגיע ישר לבית הספר
          </span>

          <h1 className="text-5xl md:text-7xl font-black text-deep-espresso leading-tight mb-6">
            הבוקר של הילד
            <br />
            <span className="text-sunrise-orange">מתחיל בחיוך</span>
          </h1>

          <p className="text-deep-espresso/60 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-12">
            כריכים עם ירקות טריים, מוכנים מדי בוקר ומגיעים לבית הספר.
            בלי לחץ, בלי פשרות — רק ארוחת בוקר שהילדים אוהבים לאכול.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a href="#plans" className="btn-primary text-base px-8 py-4">
              לבחירת חבילה
            </a>
            <a
              href="#contact"
              className="text-deep-espresso/65 font-semibold text-base hover:text-deep-espresso transition-colors px-8 py-4"
            >
              יש לי שאלה ←
            </a>
          </div>
        </div>

        {/* Stats strip below glass card */}
        <div className="mt-12 grid grid-cols-3 gap-8 max-w-lg mx-auto border-t border-deep-espresso/10 pt-8 w-full">
          {[
            { num: '3', label: 'חבילות לבחירה' },
            { num: '100%', label: 'ירקות וחומרים טריים' },
            { num: '∞', label: 'בוקרים רגועים' },
          ].map(({ num, label }) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-black text-sunrise-orange">{num}</div>
              <div className="text-deep-espresso/50 text-xs mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
