import {
  EAGLE_CUTOUTS,
  EAGLE_POLYGONS,
  EAGLE_VIEWBOX,
  eaglePathData,
} from './eagleShape.js'

/**
 * The Kronus eagle as chrome — masthead, footer, section marks.
 * Uses `currentColor`, so it takes the ink of whatever it sits on.
 */
export function EagleMark({ className = '', withEye = true }) {
  return (
    <svg
      viewBox={`0 0 ${EAGLE_VIEWBOX} ${EAGLE_VIEWBOX}`}
      className={className}
      aria-hidden="true"
      role="presentation"
      fill="currentColor"
    >
      <path d={eaglePathData(EAGLE_POLYGONS)} />
      {withEye && (
        <path d={eaglePathData(EAGLE_CUTOUTS)} className="text-[var(--kr-void)]" fill="currentColor" style={{ mixBlendMode: 'destination-out' }} />
      )}
    </svg>
  )
}

/**
 * The eagle as a seal: what signs off a finished record. Double ring, the mark,
 * and the authority line — the visual promise the whole page is built on.
 */
export function EagleSeal({ className = '', label = 'Verified record', ref: docRef }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      <defs>
        <path id="kr-seal-arc" d="M60 60 m-42 0 a42 42 0 1 1 84 0" fill="none" />
        <path id="kr-seal-arc-b" d="M60 60 m-38 0 a38 38 0 1 0 76 0" fill="none" />
      </defs>

      <circle cx="60" cy="60" r="55" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="48.5" fill="none" stroke="currentColor" strokeWidth="1" />

      <text
        fontSize="10.5"
        fontWeight="700"
        letterSpacing="3.4"
        fill="currentColor"
        style={{ fontFamily: 'Archivo, sans-serif' }}
      >
        <textPath href="#kr-seal-arc" startOffset="50%" textAnchor="middle">
          KRONUS
        </textPath>
      </text>

      <text
        fontSize="7.6"
        fontWeight="600"
        letterSpacing="2.2"
        fill="currentColor"
        style={{ fontFamily: 'Archivo, sans-serif' }}
      >
        <textPath href="#kr-seal-arc-b" startOffset="50%" textAnchor="middle">
          {label.toUpperCase()}
        </textPath>
      </text>

      <g transform="translate(38 34) scale(0.68)">
        <path d={eaglePathData(EAGLE_POLYGONS)} fill="currentColor" />
      </g>

      {docRef && (
        <text
          x="60"
          y="82"
          fontSize="6.4"
          textAnchor="middle"
          fill="currentColor"
          style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}
        >
          {docRef}
        </text>
      )}
    </svg>
  )
}

export default EagleMark
