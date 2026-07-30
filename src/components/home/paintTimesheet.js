import { TIMESHEET } from './artifactData.js'
import { paintEagle } from './eagleShape.js'
import {
  BODY,
  DISPLAY,
  INK,
  INK_2,
  INK_3,
  M,
  MONO,
  PAPER,
  SHEET_H,
  SHEET_W,
  VERIFIED,
  grain,
  label,
  rule,
} from './paperInk.js'

/**
 * Paints the guard's pay stub onto a 2D canvas for the WebGL sheet.
 *
 * The document's argument is the pair at the foot: RAW PUNCHES beside AFTER
 * ROUNDING, both printed, so the reader can see that the billable figure is
 * derived from the raw one rather than replacing it. That is the whole reason
 * this artifact exists on the page, so it is set larger than the line items.
 *
 * The accessible copy lives in Artifacts.jsx; this canvas is presentational.
 */

export { SHEET_W, SHEET_H } from './paperInk.js'

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} progress 0..1 — line items land one at a time, then the
 *   derived totals resolve underneath them.
 */
export function paintTimesheet(ctx, progress = 1) {
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
  ctx.fillText('PAYROLL STUB', SHEET_W - M, M + 22)
  ctx.font = `400 15px ${MONO}`
  ctx.fillStyle = INK_3
  ctx.letterSpacing = '0px'
  ctx.fillText(TIMESHEET.docRef, SHEET_W - M, M + 46)
  ctx.textAlign = 'left'

  rule(ctx, M + 66, M, SHEET_W - M, 'rgba(23, 26, 18, 0.5)', 2)

  // ---- Meta block ---------------------------------------------------------
  let y = M + 118
  const col2 = SHEET_W / 2 + 20

  label(ctx, 'Guard', M, y)
  ctx.font = `600 27px ${BODY}`
  ctx.fillStyle = INK
  ctx.fillText(TIMESHEET.guard, M, y + 36)
  ctx.font = `400 16px ${MONO}`
  ctx.fillStyle = INK_3
  ctx.fillText(`#${TIMESHEET.guardId} · $${TIMESHEET.rate}/h`, M, y + 62)

  label(ctx, 'Period', col2, y)
  ctx.font = `600 22px ${BODY}`
  ctx.fillStyle = INK
  ctx.fillText(TIMESHEET.period, col2, y + 34)

  // ---- Line items ---------------------------------------------------------
  y += 118
  rule(ctx, y)
  y += 30
  const cHours = SHEET_W - M - 230
  const cAmount = SHEET_W - M

  label(ctx, 'Line', M, y)
  ctx.textAlign = 'right'
  label(ctx, 'Hours', cHours, y)
  label(ctx, 'Amount', cAmount, y)
  ctx.textAlign = 'left'
  y += 16
  rule(ctx, y)

  const rowH = 78
  const shown = Math.round(p * TIMESHEET.lines.length)

  TIMESHEET.lines.forEach((line, i) => {
    if (i >= shown) return
    const ry = y + rowH * (i + 1) - 30

    // The newest line still has ink settling.
    ctx.globalAlpha = i === shown - 1 && p < 1 ? 0.45 : 1

    ctx.font = `500 23px ${BODY}`
    ctx.fillStyle = INK
    ctx.fillText(line.label, M, ry)
    ctx.font = `400 16px ${BODY}`
    ctx.fillStyle = INK_3
    ctx.fillText(line.detail, M, ry + 24)

    ctx.textAlign = 'right'
    ctx.font = `400 22px ${MONO}`
    ctx.fillStyle = INK_2
    ctx.fillText(line.hours, cHours, ry)
    ctx.font = `500 22px ${MONO}`
    ctx.fillStyle = INK
    ctx.fillText(line.amount, cAmount, ry)
    ctx.textAlign = 'left'
    ctx.globalAlpha = 1

    rule(ctx, y + rowH * (i + 1), M, SHEET_W - M, 'rgba(23, 26, 18, 0.09)')
  })

  // ---- Derived totals -----------------------------------------------------
  // Raw and rounded are printed side by side on purpose: the claim the page
  // makes is that payroll is a view over the punches, not a retyping of them.
  const sy = y + rowH * TIMESHEET.lines.length + 66
  rule(ctx, sy - 40, M, SHEET_W - M, 'rgba(23, 26, 18, 0.5)', 2)

  const totalsIn = Math.max(0, (p - 0.55) / 0.45)
  if (totalsIn > 0) {
    ctx.globalAlpha = Math.min(1, totalsIn)

    label(ctx, 'Raw punches', M, sy, 13, 1.1)
    ctx.font = `600 34px ${MONO}`
    ctx.fillStyle = INK_2
    ctx.fillText(`${TIMESHEET.raw} h`, M, sy + 42)

    label(ctx, 'After rounding', M + 290, sy, 13, 1.1)
    ctx.font = `600 34px ${MONO}`
    ctx.fillStyle = INK
    ctx.fillText(`${TIMESHEET.billable} h`, M + 290, sy + 42)

    ctx.textAlign = 'right'
    label(ctx, 'Gross', cAmount, sy, 13, 1.1)
    ctx.font = `700 44px ${MONO}`
    ctx.fillStyle = INK
    ctx.fillText(`$${TIMESHEET.gross}`, cAmount, sy + 48)
    ctx.textAlign = 'left'

    ctx.globalAlpha = 1
  }

  // ---- Signature ----------------------------------------------------------
  // Sets last: the guard signs a finished sheet, never a partial one.
  const signIn = Math.max(0, (p - 0.86) / 0.14)
  if (signIn > 0) {
    ctx.globalAlpha = Math.min(1, signIn)
    const gy = sy + 128

    ctx.strokeStyle = VERIFIED
    ctx.lineWidth = 2.6
    ctx.beginPath()
    ctx.moveTo(M, gy - 7)
    ctx.lineTo(M + 7, gy)
    ctx.lineTo(M + 19, gy - 14)
    ctx.stroke()

    ctx.font = `400 19px ${MONO}`
    ctx.fillStyle = VERIFIED
    ctx.fillText(TIMESHEET.signed, M + 34, gy)
    ctx.globalAlpha = 1
  }

  // ---- Foot ---------------------------------------------------------------
  ctx.font = `400 15px ${MONO}`
  ctx.fillStyle = INK_3
  ctx.fillText(TIMESHEET.docRef, M, SHEET_H - M + 10)
  ctx.textAlign = 'right'
  ctx.fillText('SYNTHETIC SAMPLE DATA', SHEET_W - M, SHEET_H - M + 10)
  ctx.textAlign = 'left'

  grain(ctx)
}
