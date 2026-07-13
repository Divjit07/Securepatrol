/**
 * Dark Ops login backdrop — deep charcoal/forest canvas, lime auras,
 * faint mechanical watermark, and soft sparkles (matches Kratos sign-in art).
 */
export default function AuthBackground() {
  return (
    <div className="kratos-auth-bg-stage" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(85% 65% at 72% 18%, rgba(150, 238, 96, 0.14) 0%, transparent 55%),' +
            'radial-gradient(60% 50% at 12% 82%, rgba(127, 208, 159, 0.10) 0%, transparent 50%),' +
            'radial-gradient(40% 35% at 88% 78%, rgba(150, 238, 96, 0.06) 0%, transparent 60%),' +
            'linear-gradient(165deg, #141714 0%, #0e110e 45%, #0b0d0b 100%)',
        }}
      />

      {/* Faint gear / circuit watermark on the left */}
      <svg
        className="absolute -left-8 top-1/2 h-[min(90vh,720px)] w-[min(55vw,520px)] -translate-y-1/2 opacity-[0.07]"
        viewBox="0 0 400 520"
        fill="none"
      >
        <circle cx="120" cy="160" r="70" stroke="#96ee60" strokeWidth="2" />
        <circle cx="120" cy="160" r="42" stroke="#96ee60" strokeWidth="1.5" />
        <circle cx="120" cy="160" r="12" fill="#96ee60" opacity="0.5" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const r = (deg * Math.PI) / 180
          const x1 = 120 + Math.cos(r) * 70
          const y1 = 160 + Math.sin(r) * 70
          const x2 = 120 + Math.cos(r) * 88
          const y2 = 160 + Math.sin(r) * 88
          return (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#96ee60"
              strokeWidth="8"
              strokeLinecap="round"
            />
          )
        })}
        <circle cx="260" cy="300" r="48" stroke="#96ee60" strokeWidth="1.5" />
        <circle cx="260" cy="300" r="28" stroke="#96ee60" strokeWidth="1" />
        <path d="M120 230 V380 H280" stroke="#96ee60" strokeWidth="1.5" opacity="0.7" />
        <path d="M180 300 H260" stroke="#96ee60" strokeWidth="1.5" opacity="0.7" />
        <circle cx="180" cy="300" r="4" fill="#96ee60" />
        <circle cx="280" cy="380" r="4" fill="#96ee60" />
        <rect x="60" y="400" width="90" height="50" rx="6" stroke="#96ee60" strokeWidth="1.25" />
        <path d="M75 425 H135 M75 438 H120" stroke="#96ee60" strokeWidth="1" opacity="0.6" />
      </svg>

      {/* Soft hatch */}
      <div
        className="absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 11px)',
        }}
      />

      {/* Sparkles */}
      <span className="kratos-auth-sparkle kratos-auth-sparkle--a" />
      <span className="kratos-auth-sparkle kratos-auth-sparkle--b" />
      <span className="kratos-auth-sparkle kratos-auth-sparkle--c" />
    </div>
  )
}
