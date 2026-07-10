import { Shield } from 'lucide-react'
import { BRAND } from '../lib/brand.js'

const sizes = {
  sm: { box: 'h-10 w-10', icon: 'h-5 w-5' },
  md: { box: 'h-12 w-12', icon: 'h-6 w-6' },
  lg: { box: 'h-14 w-14', icon: 'h-7 w-7' },
  xl: { box: 'h-16 w-16', icon: 'h-8 w-8' },
  hero: { box: 'h-20 w-20', icon: 'h-10 w-10' },
}

export default function Logo({
  size = 'md',
  showText = true,
  variant = 'default',
  className = '',
}) {
  const s = sizes[size] || sizes.md
  const textClass = variant === 'light' ? 'text-white' : 'text-ink'

  return (
    <div className={`flex items-center gap-3 sm:gap-3.5 ${className}`}>
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl bg-accent-orange/15 ${s.box}`}
      >
        <Shield className={`${s.icon} text-accent-orange`} strokeWidth={1.75} />
      </div>

      {showText && (
        <p className={`font-display text-base font-bold tracking-tight sm:text-lg ${textClass}`}>
          {BRAND.name}
        </p>
      )}
    </div>
  )
}
