const version = process.env.NEXT_PUBLIC_APP_VERSION

export default function VersionBadge() {
  if (!version) return null

  return (
    <div
      dir="ltr"
      className="fixed bottom-2 left-2 z-50 select-none rounded-full bg-deep-espresso/40 px-2 py-0.5 font-mono text-[10px] leading-none text-white/40 backdrop-blur-sm transition-opacity hover:text-white/70"
    >
      v{version}
    </div>
  )
}
