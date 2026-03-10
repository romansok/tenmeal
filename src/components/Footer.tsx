export default function Footer() {
  return (
    <footer className="bg-deep-espresso py-10 px-6">
      <div className="h-px bg-gradient-to-r from-transparent via-sunrise-orange/40 to-transparent" />
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 pt-10">
        <div className="text-lg font-black text-white">ארוחת 10</div>
        <p className="text-white/40 text-sm text-center">
          ארוחות בוקר מזינות לילדים — בלי לחץ, עם חיוך
        </p>
        <p className="text-white/25 text-xs">
          © {new Date().getFullYear()} ארוחת 10. כל הזכויות שמורות.
        </p>
      </div>
    </footer>
  )
}
