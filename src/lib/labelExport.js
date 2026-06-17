export const PROVIDER_LINE = 'SecurePatrol · Productive Security Inc.'
export const FOOTER_LINE = 'Protected by Productive Security'

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/** Render the full branded checkpoint label as a PNG data URL. */
export async function buildFullLabelPng(siteName, label) {
  const width = 390
  const height = 520
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = '#0a1628'
  ctx.lineWidth = 3
  drawRoundedRect(ctx, 1.5, 1.5, width - 3, height - 3, 12)
  ctx.stroke()

  const headerH = siteName ? 76 : 52
  ctx.fillStyle = '#0a1628'
  drawRoundedRect(ctx, 4, 4, width - 8, headerH, 10)
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (siteName) {
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 15px Arial, Helvetica, sans-serif'
    const site = siteName.toUpperCase()
    ctx.fillText(site.length > 28 ? `${site.slice(0, 26)}…` : site, width / 2, 30)
  }

  ctx.fillStyle = '#94a3b8'
  ctx.font = '600 8px Arial, Helvetica, sans-serif'
  ctx.fillText(PROVIDER_LINE.toUpperCase(), width / 2, siteName ? 58 : 30)

  let y = headerH + 22
  if (label.floorName) {
    ctx.fillStyle = '#475569'
    ctx.font = '600 10px Arial, Helvetica, sans-serif'
    ctx.fillText(label.floorName.toUpperCase(), width / 2, y)
    y += 18
  }

  const qrImg = await loadImage(label.dataUrl)
  const qrSize = 200
  ctx.drawImage(qrImg, (width - qrSize) / 2, y, qrSize, qrSize)
  y += qrSize + 24

  ctx.fillStyle = '#0a1628'
  ctx.font = '800 16px Arial, Helvetica, sans-serif'
  const name = label.name
  ctx.fillText(name.length > 24 ? `${name.slice(0, 22)}…` : name, width / 2, y)

  const footerY = height - 68
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(10, footerY, width - 20, 58)

  ctx.strokeStyle = '#e2e8f0'
  ctx.beginPath()
  ctx.moveTo(10, footerY)
  ctx.lineTo(width - 10, footerY)
  ctx.stroke()

  ctx.fillStyle = '#0a1628'
  ctx.font = '800 9px Arial, Helvetica, sans-serif'
  ctx.fillText(FOOTER_LINE.toUpperCase(), width / 2, footerY + 20)

  ctx.fillStyle = '#64748b'
  ctx.font = '8px Arial, Helvetica, sans-serif'
  ctx.fillText('Scan with SecurePatrol guard app', width / 2, footerY + 40)

  return canvas.toDataURL('image/png')
}

export function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}

export function slugify(text) {
  return String(text).replace(/\s+/g, '-').toLowerCase()
}
