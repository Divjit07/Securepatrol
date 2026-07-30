/**
 * Schematic glyphs for the six chain links — drawn in the product's own register
 * (installation diagram, hairline, tabular) rather than borrowed from an icon set.
 * Each one shows the physical thing that link is about.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Sticker() {
  return (
    <>
      {/* A tag on a wall: plate, mounting corners, NFC arcs */}
      <rect x="9" y="7" width="26" height="30" rx="2" {...stroke} />
      <path d="M13 11h6M13 33h18" {...stroke} />
      <path d="M20 22a7 7 0 0 1 7-7M20 22a11 11 0 0 1 11-11" {...stroke} />
      <circle cx="20" cy="22" r="1.4" fill="currentColor" />
    </>
  )
}

function Scan() {
  return (
    <>
      {/* A phone held to the tag */}
      <rect x="6" y="9" width="17" height="26" rx="2.5" {...stroke} />
      <path d="M12 13h5" {...stroke} />
      <path d="M31 15v14" {...stroke} strokeDasharray="2 3" />
      <path d="M26 19l4 3-4 3" {...stroke} />
      <path d="M36 11v22" {...stroke} />
    </>
  )
}

function Radius() {
  return (
    <>
      {/* The validation radius around the checkpoint */}
      <circle cx="22" cy="22" r="14" {...stroke} strokeDasharray="3 3.5" />
      <circle cx="22" cy="22" r="2" fill="currentColor" />
      <path d="M22 22l9.5-9.5" {...stroke} />
      <circle cx="31.5" cy="12.5" r="2.4" {...stroke} />
    </>
  )
}

function Punch() {
  return (
    <>
      {/* A record written once and closed */}
      <rect x="8" y="8" width="28" height="28" rx="2" {...stroke} />
      <path d="M8 16h28" {...stroke} />
      <path d="M18 25h8v7h-8z" {...stroke} />
      <path d="M20 25v-2.5a2 2 0 0 1 4 0V25" {...stroke} />
    </>
  )
}

function Sum() {
  return (
    <>
      {/* Derived totals over the raw rows */}
      <path d="M9 12h12M9 18h16M9 24h10" {...stroke} />
      <path d="M9 30h26" {...stroke} strokeWidth="1.6" />
      <path d="M28 11l6 6-6 6" {...stroke} />
      <path d="M14 34.5h9" {...stroke} />
    </>
  )
}

function Filed() {
  return (
    <>
      {/* The report, stamped */}
      <path d="M11 6h15l7 7v25H11z" {...stroke} />
      <path d="M26 6v7h7" {...stroke} />
      <path d="M15 21h11M15 26h14" {...stroke} />
      <path d="M17 31l2.5 2.5L25 28" {...stroke} strokeWidth="1.7" />
    </>
  )
}

const GLYPHS = {
  sticker: Sticker,
  scan: Scan,
  gps: Radius,
  punch: Punch,
  hours: Sum,
  report: Filed,
}

export default function ChainGlyph({ id, className = '' }) {
  const G = GLYPHS[id]
  if (!G) return null
  return (
    <svg viewBox="0 0 44 44" className={className} aria-hidden="true" role="presentation">
      <G />
    </svg>
  )
}
