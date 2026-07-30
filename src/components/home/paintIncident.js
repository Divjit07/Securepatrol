import { INCIDENT } from './artifactData.js'
import { paintEagle } from './eagleShape.js'
import {
  ALERT,
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
  paragraph,
  rule,
} from './paperInk.js'

/**
 * The incident report, painted onto a 2D canvas so it can be mapped onto the
 * WebGL sheet next to the patrol report. Same stock, same margin, same
 * masthead — the difference is the red rule and the photographs, because this
 * is the one document in the family that carries evidence rather than counts.
 *
 * `progress` writes the page in the order a guard actually files it: the form
 * header exists first, the narrative is typed, the photographs come off the
 * camera roll, the actions are ticked, and only then is it sent.
 *
 * The accessible copy of this document is real DOM text in Artifacts.jsx
 * (`IncidentSheet`); this canvas is presentational only.
 */

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n)

/** 0 at `from`, 1 at `to`, smoothed at both ends. */
function ramp(p, from, to) {
  const u = clamp01((p - from) / (to - from))
  return u * u * (3 - 2 * u)
}

/* ── The attachments ──────────────────────────────────────────────────────── */

let pending = null
const decoded = new Map()

/** Loads the attached photographs once; resolves when they can be drawn. */
export function loadIncidentPhotos() {
  if (pending) return pending
  pending = Promise.all(
    INCIDENT.photos.map(
      (photo) =>
        new Promise((resolve) => {
          const img = new Image()
          img.decoding = 'async'
          img.onload = () => {
            decoded.set(photo.ref, img)
            resolve()
          }
          img.onerror = resolve
          img.src = photo.src
        }),
    ),
  )
  return pending
}

/** Draws `img` filling the box, cropping the overflowing axis rather than squashing it. */
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  ctx.restore()
}

/* ── The page ─────────────────────────────────────────────────────────────── */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} progress 0..1 — how much of the filing has happened.
 */
export function paintIncident(ctx, progress = 1) {
  const p = clamp01(progress)

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, SHEET_W, SHEET_H)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  // ---- Masthead -----------------------------------------------------------
  paintEagle(ctx, M, M + 6, 34, INK)
  ctx.font = `800 34px ${DISPLAY}`
  ctx.fillStyle = INK
  ctx.letterSpacing = '1px'
  ctx.fillText('KRONUS', M + 44, M + 34)
  ctx.letterSpacing = '0px'

  ctx.textAlign = 'right'
  ctx.font = `600 16px ${DISPLAY}`
  ctx.fillStyle = ALERT
  ctx.letterSpacing = '2.2px'
  ctx.fillText('INCIDENT REPORT', SHEET_W - M, M + 22)
  ctx.letterSpacing = '0px'
  ctx.font = `400 15px ${MONO}`
  ctx.fillStyle = INK_3
  ctx.fillText(INCIDENT.docRef, SHEET_W - M, M + 46)
  ctx.textAlign = 'left'

  // The red rule is this document's tell — you can identify it face down on a desk.
  rule(ctx, M + 66, M, SHEET_W - M, 'rgba(179, 38, 30, 0.55)', 2)

  // ---- Where, and how bad -------------------------------------------------
  let y = M + 122
  label(ctx, 'Where', M, y)
  ctx.font = `600 27px ${BODY}`
  ctx.fillStyle = INK
  ctx.fillText(INCIDENT.where, M, y + 36)
  ctx.font = `400 16px ${MONO}`
  ctx.fillStyle = INK_3
  ctx.fillText(`${INCIDENT.site} · ${INCIDENT.at}`, M, y + 64)

  // Severity pill, set right and measured so the plate always wraps the text.
  const pill = `${INCIDENT.type.toUpperCase()} · ${INCIDENT.severity.toUpperCase()}`
  ctx.font = `600 15px ${DISPLAY}`
  ctx.letterSpacing = '1.8px'
  const pillW = ctx.measureText(pill).width + 62
  const pillX = SHEET_W - M - pillW
  ctx.fillStyle = 'rgba(179, 38, 30, 0.10)'
  ctx.fillRect(pillX, y - 20, pillW, 40)
  ctx.fillStyle = ALERT
  ctx.fillText(pill, pillX + 46, y + 6)
  ctx.letterSpacing = '0px'

  // Warning triangle inside the pill.
  ctx.strokeStyle = ALERT
  ctx.lineWidth = 2.2
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(pillX + 24, y - 8)
  ctx.lineTo(pillX + 34, y + 8)
  ctx.lineTo(pillX + 14, y + 8)
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(pillX + 24, y - 2)
  ctx.lineTo(pillX + 24, y + 3)
  ctx.stroke()

  y += 100
  rule(ctx, y)

  // ---- Filed by -----------------------------------------------------------
  y += 44
  label(ctx, 'Filed by', M, y)
  ctx.font = `400 20px ${MONO}`
  ctx.fillStyle = INK_2
  ctx.fillText(INCIDENT.by, M, y + 32)

  // ---- Narrative ----------------------------------------------------------
  y += 88
  label(ctx, 'Narrative', M, y)
  ctx.font = `400 22px ${BODY}`
  ctx.fillStyle = INK
  const narrativeEnd = paragraph(
    ctx,
    INCIDENT.narrative,
    M,
    y + 36,
    SHEET_W - M * 2,
    32,
    ramp(p, 0.04, 0.46),
  )

  // ---- Attachments --------------------------------------------------------
  y = narrativeEnd + 44
  label(ctx, `Attachments · ${INCIDENT.photos.length} photos`, M, y)

  const gap = 24
  const shotW = (SHEET_W - M * 2 - gap) / 2
  const shotH = Math.round((shotW * 3) / 4)
  const shotY = y + 24

  INCIDENT.photos.forEach((photo, i) => {
    const x = M + (shotW + gap) * i
    const img = decoded.get(photo.ref)
    // Staggered, so the roll empties one frame at a time rather than at once.
    const in_ = ramp(p, 0.44 + i * 0.09, 0.72 + i * 0.09)

    ctx.fillStyle = 'rgba(23, 26, 18, 0.06)'
    ctx.fillRect(x, shotY, shotW, shotH)

    if (img && in_ > 0) {
      ctx.save()
      ctx.globalAlpha = in_
      drawCover(ctx, img, x, shotY, shotW, shotH)
      ctx.restore()
    }

    ctx.strokeStyle = 'rgba(23, 26, 18, 0.22)'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, shotY + 0.5, shotW - 1, shotH - 1)

    // Reference burnt into the corner, the way a filed photo is keyed.
    ctx.fillStyle = 'rgba(23, 26, 18, 0.72)'
    ctx.fillRect(x, shotY + shotH - 32, 96, 32)
    ctx.font = `500 15px ${MONO}`
    ctx.fillStyle = PAPER
    ctx.fillText(photo.ref, x + 12, shotY + shotH - 11)
  })

  // ---- What was done about it --------------------------------------------
  y = shotY + shotH + 58
  INCIDENT.actions.forEach((action, i) => {
    const ticked = ramp(p, 0.68 + i * 0.05, 0.8 + i * 0.05)
    const ay = y + 40 * i

    ctx.save()
    ctx.globalAlpha = 0.35 + ticked * 0.65
    ctx.strokeStyle = VERIFIED
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(M + 2, ay - 8)
    ctx.lineTo(M + 9, ay - 1)
    ctx.lineTo(M + 22, ay - 17)
    ctx.stroke()
    ctx.restore()

    ctx.font = `400 21px ${BODY}`
    ctx.fillStyle = INK
    ctx.fillText(action, M + 40, ay)
  })

  // ---- Delivery -----------------------------------------------------------
  y += 40 * INCIDENT.actions.length + 22
  ctx.font = `400 18px ${MONO}`
  ctx.fillStyle = INK_2
  ctx.fillText(INCIDENT.delivered, M, y)

  // ---- Stamp --------------------------------------------------------------
  // A struck plate rather than the patrol report's round seal: at a glance,
  // across a desk, you can tell which of the two documents you are holding.
  const stamped = ramp(p, 0.86, 1)
  if (stamped > 0) {
    ctx.save()
    ctx.globalAlpha = stamped * 0.9
    ctx.translate(SHEET_W - M - 168, y + 96)
    ctx.rotate((-5.5 * Math.PI) / 180)

    ctx.strokeStyle = ALERT
    ctx.lineWidth = 4
    ctx.strokeRect(-160, -46, 320, 92)
    ctx.lineWidth = 1.4
    ctx.strokeRect(-152, -38, 304, 76)

    ctx.textAlign = 'center'
    ctx.fillStyle = ALERT
    ctx.font = `800 26px ${DISPLAY}`
    ctx.letterSpacing = '2.4px'
    ctx.fillText('SENT TO CLIENT', 0, -6)
    ctx.font = `500 14px ${MONO}`
    ctx.letterSpacing = '1.2px'
    ctx.fillText('24 JUL 2026 · 23:11', 0, 24)
    ctx.letterSpacing = '0px'
    ctx.restore()
    ctx.textAlign = 'left'
    ctx.globalAlpha = 1
  }

  // ---- Foot ---------------------------------------------------------------
  ctx.font = `400 15px ${MONO}`
  ctx.fillStyle = INK_3
  ctx.fillText(INCIDENT.docRef, M, SHEET_H - M + 10)
  ctx.textAlign = 'right'
  ctx.fillText('SYNTHETIC SAMPLE DATA', SHEET_W - M, SHEET_H - M + 10)
  ctx.textAlign = 'left'

  grain(ctx)
}
