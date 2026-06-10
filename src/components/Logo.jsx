const sizes = {
  sm: { box: 'h-10 w-10', img: 'h-8 w-8' },
  md: { box: 'h-12 w-12', img: 'h-10 w-10' },
  lg: { box: 'h-14 w-14', img: 'h-11 w-11' },
  xl: { box: 'h-20 w-20', img: 'h-16 w-16' },
  hero: { img: 'h-32 w-auto max-w-[280px] sm:h-40 sm:max-w-[340px] md:h-48' },
}

export default function Logo({
  size = 'md',
  showText = true,
  variant = 'default',
  framed = false,
  className = '',
}) {
  const s = sizes[size] || sizes.md
  const textClass = variant === 'light' ? 'text-white' : 'text-slate-900'
  const subClass = variant === 'light' ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className={`flex items-center gap-3 sm:gap-4 ${className}`}>
      {framed || size === 'hero' ? (
        <div className={size === 'hero' ? 'sp-logo-frame-lg' : 'sp-logo-frame p-2'}>
          <img
            src="/logo.png"
            alt="Productive Security Inc."
            className={`object-contain ${s.img}`}
          />
        </div>
      ) : (
        <div className={`relative shrink-0 ${s.box}`}>
          <img
            src="/logo.png"
            alt="Productive Security Inc."
            className={`object-contain ${s.img}`}
          />
        </div>
      )}

      {showText && (
        <div className="min-w-0 leading-tight">
          <p className={`font-display text-base font-bold tracking-tight sm:text-lg ${textClass}`}>
            SecurePatrol
          </p>
          <p className={`text-[11px] font-medium uppercase tracking-[0.12em] sm:text-xs ${subClass}`}>
            Productive Security Inc.
          </p>
        </div>
      )}
    </div>
  )
}
