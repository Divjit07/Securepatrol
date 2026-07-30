import { REPORT } from './reportData.js'
import { paintEagle } from './eagleShape.js'

/**
 * Paints the patrol verification report onto a 2D canvas so it can be used as a
 * colour map on the WebGL sheet. Drawing the document (rather than overlaying DOM
 * text) is what lets the paper actually behave like paper — the type curls, catches
 * the key light, and falls into shadow with the stock it is printed on.
 *
 * The accessible copy of this document is real DOM text in ReportSheet.jsx; this
 * canvas is presentational only.
 */

export const SHEET_W = 1000
export const SHEET_H = 1414 // √2, so the sheet is a real A-series page

const PAPER = '#f7f6f2'
const INK = '#171a12'
const INK_2 = '#585f4c'
const INK_3 = '#8c9179'
const RULE = 'rgba(23, 26, 18, 0.14)'
const VERIFIED = '#2f7d34'
const ALERT = '#b3261e'

const MONO = '"SF Mono", "JetBrains Mono", Menlo, monospace'
const DISPLAY = 'Archivo, "Instrument Sans", sans-serif'
const BODY = '"DM Sans", sans-serif'

const M = 76 // page margin

function label(ctx, text, x, y, size = 17, spacing = 2.4) {
  ctx.font = `600 ${size}px ${DISPLAY}`
  ctx.fillStyle = INK_3
  ctx.letterSpacing = `${spacing}px`
  ctx.fillText(text.toUpperCase(), x, y)
  ctx.letterSpacing = '0px'
}

function rule(ctx, y, x1 = M, x2 = SHEET_W - M, color = RULE, width = 1) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y + 0.5)
  ctx.lineTo(x2, y + 0.5)
  ctx.stroke()
}

/** Paper fibre. Subtle enough to read as stock, not as noise. */
function grain(ctx) {
  const n = 2600
  for (let i = 0; i < n; i++) {
    const x = Math.random() * SHEET_W
    const y = Math.random() * SHEET_H
    const a = Math.random() * 0.035
    ctx.fillStyle = `rgba(23, 26, 18, ${a})`
    ctx.fillRect(x, y, 1.5, 1.5)
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} progress 0..1 — how much of the record has landed. The rows
 *   arrive one at a time; this is the page writing itself as scans come in.
 */
export function paintReport(ctx, progress = 1) {
  const p = Math.max(0, Math.min(1, progress))

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, SHEET_W, SHEET_H)
  ctx.textBaseline = 'alphabetic'

  // ---- Masthead -----------------------------------------------------------
  paintEagle(ctx, M, M + 6, 34, INK)
  ctx.font = `800 34px ${DISPLAY}`
  ctx.fillStyle = INK
  ctx.letterSpacing = '1px'
  ctx.fillText('KRONUS', M + 44, M + 34)
  ctx.letterSpacing = '0px'

  ctx.font = `600 16px ${DISPLAY}`
  ctx.fillStyle = INK_2
  ctx.letterSpacing = '2.2px'
  ctx.textAlign = 'right'
  ctx.fillText('PATROL VERIFICATION REPORT', SHEET_W - M, M + 22)
  ctx.font = `400 15px ${MONO}`
  ctx.fillStyle = INK_3
  ctx.letterSpacing = '0px'
  ctx.fillText(REPORT.docRef, SHEET_W - M, M + 46)
  ctx.textAlign = 'left'

  rule(ctx, M + 66, M, SHEET_W - M, 'rgba(23, 26, 18, 0.5)', 2)

  // ---- Meta block ---------------------------------------------------------
  let y = M + 118
  const col2 = SHEET_W / 2 + 20

  const meta = [
    ['Site', REPORT.site, REPORT.address],
    ['Period', REPORT.period, `GPS radius ${REPORT.radius}`],
  ]
  meta.forEach(([l, v, sub], i) => {
    const x = i === 0 ? M : col2
    label(ctx, l, x, y)
    ctx.font = `600 27px ${BODY}`
    ctx.fillStyle = INK
    ctx.fillText(v, x, y + 36)
    ctx.font = `400 16px ${BODY}`
    ctx.fillStyle = INK_3
    ctx.fillText(sub, x, y + 62)
  })

  y += 106
  label(ctx, 'Guard', M, y)
  ctx.font = `600 27px ${BODY}`
  ctx.fillStyle = INK
  ctx.fillText(REPORT.guard, M, y + 36)
  const guardW = ctx.measureText(REPORT.guard).width
  ctx.font = `400 16px ${MONO}`
  ctx.fillStyle = INK_3
  ctx.fillText(`#${REPORT.guardId}`, M + guardW + 14, y + 36)

  label(ctx, 'Prepared', col2, y)
  ctx.font = `400 17px ${MONO}`
  ctx.fillStyle = INK_2
  ctx.fillText('06:04 · automatic', col2, y + 34)

  // ---- Ledger -------------------------------------------------------------
  y += 92
  rule(ctx, y)
  y += 30
  const cTime = M
  const cPoint = M + 108
  const cGps = SHEET_W - M - 210
  const cStatus = SHEET_W - M

  label(ctx, REPORT.excerpt, cTime, y - 26, 13, 1.1)
  label(ctx, 'Time', cTime, y)
  label(ctx, 'Checkpoint', cPoint, y)
  label(ctx, 'GPS', cGps, y)
  ctx.textAlign = 'right'
  label(ctx, 'Status', cStatus, y)
  ctx.textAlign = 'left'
  y += 16
  rule(ctx, y)

  const rowH = 55
  // Rows land one at a time as the record assembles.
  const shown = Math.round(p * REPORT.rows.length)

  REPORT.rows.forEach((r, i) => {
    if (i >= shown) return
    const ry = y + rowH * (i + 1) - 18
    const isAlert = r.status === 'alert'

    // The newest row still has ink settling.
    const fresh = i === shown - 1 && p < 1
    ctx.globalAlpha = fresh ? 0.45 : 1

    ctx.font = `500 22px ${MONO}`
    ctx.fillStyle = isAlert ? ALERT : INK
    ctx.fillText(r.time, cTime, ry)

    ctx.font = `${r.kind ? 600 : 400} 21px ${BODY}`
    ctx.fillStyle = isAlert ? ALERT : INK
    ctx.fillText(r.kind ? `${r.kind} · ${r.point}` : r.point, cPoint, ry)

    ctx.font = `400 20px ${MONO}`
    ctx.fillStyle = isAlert ? ALERT : INK_2
    ctx.fillText(r.gps, cGps, ry)

    ctx.textAlign = 'right'
    ctx.font = `600 15px ${DISPLAY}`
    ctx.letterSpacing = '1.6px'
    if (isAlert) {
      ctx.fillStyle = ALERT
      ctx.fillText('ALERT RAISED', cStatus, ry)
    } else {
      ctx.fillStyle = VERIFIED
      ctx.fillText('VERIFIED', cStatus, ry)
      // tick
      ctx.strokeStyle = VERIFIED
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.moveTo(cStatus - 108, ry - 7)
      ctx.lineTo(cStatus - 102, ry - 1)
      ctx.lineTo(cStatus - 91, ry - 14)
      ctx.stroke()
    }
    ctx.letterSpacing = '0px'
    ctx.textAlign = 'left'
    ctx.globalAlpha = 1

    rule(ctx, y + rowH * (i + 1), M, SHEET_W - M, 'rgba(23, 26, 18, 0.09)')
  })

  // ---- Summary ------------------------------------------------------------
  const sy = y + rowH * REPORT.rows.length + 58
  rule(ctx, sy - 34, M, SHEET_W - M, 'rgba(23, 26, 18, 0.5)', 2)

  // Four columns inside the text block — labels are set small and tight so the
  // longest ("Checkpoint passes") cannot run into the next column.
  const colW = (SHEET_W - M * 2) / REPORT.summary.length
  REPORT.summary.forEach((s, i) => {
    const x = M + colW * i
    label(ctx, s.label, x, sy, 13, 1.1)
    ctx.font = `600 34px ${MONO}`
    ctx.fillStyle = s.label === 'Alerts raised' ? ALERT : INK
    ctx.fillText(s.value, x, sy + 42)
  })

  // ---- Stamp --------------------------------------------------------------
  // Sets only once the record is complete — the page is not verified early.
  const stampIn = Math.max(0, (p - 0.82) / 0.18)
  if (stampIn > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, stampIn) * 0.92
    ctx.translate(SHEET_W - M - 108, sy + 176)
    ctx.rotate((-7 * Math.PI) / 180)

    const R = 100
    ctx.strokeStyle = VERIFIED
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(0, 0, R, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(0, 0, R - 12, 0, Math.PI * 2)
    ctx.stroke()

    // The eagle signs the record.
    paintEagle(ctx, -34, -46, 68, VERIFIED)

    ctx.fillStyle = VERIFIED
    ctx.textAlign = 'center'
    ctx.font = `800 19px ${DISPLAY}`
    ctx.letterSpacing = '3px'
    ctx.fillText('KRONUS', 0, 42)
    ctx.font = `600 12px ${DISPLAY}`
    ctx.letterSpacing = '2.2px'
    ctx.fillText('VERIFIED RECORD', 0, 62)
    ctx.letterSpacing = '0px'

    ctx.restore()
    ctx.textAlign = 'left'
    ctx.globalAlpha = 1
  }

  // ---- Foot ---------------------------------------------------------------
  ctx.font = `400 15px ${MONO}`
  ctx.fillStyle = INK_3
  ctx.fillText(`${REPORT.docRef} · ${REPORT.pages}`, M, SHEET_H - M + 10)
  ctx.textAlign = 'right'
  ctx.fillText('SYNTHETIC SAMPLE DATA', SHEET_W - M, SHEET_H - M + 10)
  ctx.textAlign = 'left'

  grain(ctx)
}
