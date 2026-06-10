export default function Logo({ className = 'h-12', showText = true, variant = 'default' }) {
  const textClass = variant === 'light' ? 'text-white' : 'text-slate-900'
  const subClass = variant === 'light' ? 'text-slate-300' : 'text-slate-500'

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src="/logo.png"
        alt="Productive Security Inc."
        className="h-full w-auto max-h-14 object-contain"
      />
      {showText && (
        <div className="leading-tight">
          <p className={`text-sm font-bold tracking-wide ${textClass}`}>SecurePatrol</p>
          <p className={`text-xs ${subClass}`}>Productive Security Inc.</p>
        </div>
      )}
    </div>
  )
}
