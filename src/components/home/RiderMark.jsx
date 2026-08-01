/**
 * The Kronus rider as chrome — masthead, footer, section marks, document seals.
 *
 * Drawn as a CSS mask over `currentColor` rather than an <img>, so the mark takes
 * the ink of whatever it sits on exactly like the eagle glyph it replaces: lime on
 * the dark masthead, paper-ink on the light printables.
 *
 * `tight` drops the flag and keeps horse + rider, which is what reads at the
 * ~20px sizes used inline; the full composition is for anything 48px and up.
 */
export function RiderMark({ className = '', tight = true, style }) {
  const src = tight ? '/brand/kronus-rider-mask-tight.png' : '/brand/kronus-rider-mask.png'
  return (
    <span
      aria-hidden="true"
      role="presentation"
      className={`inline-block shrink-0 ${className}`}
      style={{
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        ...style,
      }}
    />
  )
}

export default RiderMark
