/** Canonical brand palette — menu swatches, KPI gradients, roster shift chips. */

export const PALETTE = {
  lime: '#96EE60',
  meadow: '#ECFAB5',
  moss: '#7FD09F',
  sky: '#D9F0FF',
  lavender: '#ECEEFE',
  blossom: '#FBE4E3',
  graphite: '#141414',
  gray: '#F4F4F4',
  white: '#FFFFFF',
  ink: '#0A0E09',
}

/** Studio Glass accent stat card — frosted lime/sky gradient on gray canvas. */
export const STUDIO_GLASS = {
  canvasFrom: '#CBCDCE',
  canvasTo: '#747577',
  accentGradientFrom: '#E2F4E8',
  accentGradientMid: '#D9F0FF',
  accentGradientTo: '#B8E89A',
  valueInk: '#12290D',
  labelInk: '#3D3F41',
  hintInk: '#5C5E60',
  guardClockInBg: '#3E4E56',
  guardClockInSub: '#B0BEC5',
  shiftStatusBg: '#96EE60',
  shiftStatusInk: '#FFFFFF',
  clockOutBtnBg: '#3E4E56',
  neutralCardBg: 'rgba(255, 255, 255, 0.28)',
  neutralCardBorder: 'rgba(255, 255, 255, 0.45)',
}

/** KPI card gradient tones — one per menu swatch family. */
export const KPI_TONES = {
  lime: {
    bg: 'bg-gradient-to-br from-[#ECFAB5] to-[#96EE60]',
    ink: 'text-[#12290d]',
    sub: 'text-[#173611]/70',
    icon: 'text-[#173611]/50',
  },
  moss: {
    bg: 'bg-gradient-to-br from-[#DFF4E8] to-[#7FD09F]',
    ink: 'text-[#0e2c1b]',
    sub: 'text-[#123524]/70',
    icon: 'text-[#123524]/50',
  },
  sky: {
    bg: 'bg-gradient-to-br from-[#EDF8FF] to-[#D9F0FF]',
    ink: 'text-[#12293b]',
    sub: 'text-[#173347]/70',
    icon: 'text-[#173347]/50',
  },
  lavender: {
    bg: 'bg-gradient-to-br from-[#F5F6FF] to-[#ECEEFE]',
    ink: 'text-[#20244d]',
    sub: 'text-[#2c3057]/70',
    icon: 'text-[#2c3057]/50',
  },
  blossom: {
    bg: 'bg-gradient-to-br from-[#FDF1F0] to-[#FBE4E3]',
    ink: 'text-[#42201c]',
    sub: 'text-[#4a2723]/70',
    icon: 'text-[#4a2723]/50',
  },
  mint: {
    bg: 'bg-gradient-to-br from-[#DFF4E8] to-[#7FD09F]',
    ink: 'text-[#0e2c1b]',
    sub: 'text-[#123524]/70',
    icon: 'text-[#123524]/50',
  },
  graphite: {
    bg: 'bg-gradient-to-br from-[#F4F4F4] to-[#FFFFFF]',
    ink: 'text-[#141414]',
    sub: 'text-[#141414]/70',
    icon: 'text-[#141414]/50',
  },
}

/** Roster shift chip colors — mapped to brand palette. */
export const SHIFT_CHIP_STYLES = {
  blue: 'bg-[#D9F0FF] text-[#1d3d52] hover:brightness-105',
  violet: 'bg-[#ECEEFE] text-[#33375c] hover:brightness-105',
  teal: 'bg-[#7FD09F] text-[#123524] hover:brightness-105',
  amber: 'bg-[#96EE60] text-[#173611] hover:brightness-105',
  rose: 'bg-[#FBE4E3] text-[#5c2f2c] hover:brightness-105',
}

export const SHIFT_SHEET_SWATCHES = {
  blue: 'bg-[#D9F0FF]',
  violet: 'bg-[#ECEEFE]',
  teal: 'bg-[#7FD09F]',
  amber: 'bg-[#96EE60]',
  rose: 'bg-[#FBE4E3]',
}

/** Chart / ratio-bar colors — follow active theme via CSS variables. */
export const CHART = {
  onPatrol: 'var(--color-accent-orange)',
  upNext: 'var(--color-accent-cyan)',
  noShow: 'var(--color-surface-2)',
  missed: 'var(--color-ink)',
  unscheduled: 'rgba(255,255,255,0.22)',
  unscheduledBar: '#71717a',
  axis: 'var(--color-ink-3)',
  grid: 'rgba(255,255,255,0.08)',
  peak: 'var(--color-inset)',
}
