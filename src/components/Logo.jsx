import { BRAND } from '../lib/brand.js'

const sizes = {
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-14 w-14',
  xl: 'h-16 w-16',
  hero: 'h-20 w-20',
}

export default function Logo({
  size = 'md',
  showText = true,
  variant = 'default',
  className = '',
}) {
  const box = sizes[size] || sizes.md
  const textClass = variant === 'light' ? 'text-white' : 'text-ink'

  return (
    <div className={`flex items-center gap-3 sm:gap-3.5 ${className}`}>
      {/* The plated PNG carries its own dark ground, so the white horse holds
          contrast on the light client sidebar and the dark guard bar alike. */}
      <img
        src="/brand/kronus-mark.png"
        alt={showText ? '' : BRAND.name}
        width="96"
        height="96"
        className={`shrink-0 rounded-xl object-cover ring-1 ring-white/12 ${box}`}
      />

      {showText && (
        <p className={`font-display text-base font-bold tracking-tight sm:text-lg ${textClass}`}>
          {BRAND.name}
        </p>
      )}
    </div>
  )
}
