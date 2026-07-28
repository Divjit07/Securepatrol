/**
 * Magic UI–style animated shine border. Wrap a card; children stay interactive.
 */
export default function ShineBorder({
  children,
  className = '',
  borderWidth = 1,
  duration = 10,
  color = ['#96ee60', '#7fd09f', '#ffffff'],
}) {
  const colors = Array.isArray(color) ? color.join(',') : color

  return (
    <div
      className={`kratos-shine-border ${className}`}
      style={{
        '--shine-border-width': `${borderWidth}px`,
        '--shine-duration': `${duration}s`,
        '--shine-colors': colors,
      }}
    >
      <div className="kratos-shine-border-inner">{children}</div>
    </div>
  )
}
