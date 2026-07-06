import jsPDF from 'jspdf'
import {
  formatIncidentReportTime,
  getIncidentPhotoSignedUrl,
  isHeicPhotoPath,
  normalizeIncidentAttachments,
} from './incidentReports.js'

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function pdfImageFormat(dataUrl, path) {
  if (/^data:image\/png/i.test(dataUrl) || /\.png$/i.test(path)) return 'PNG'
  return 'JPEG'
}

function safeFilename(siteName, createdAt) {
  const date = new Date(createdAt).toISOString().slice(0, 10)
  const slug = (siteName || 'site').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
  return `securepatrol-incident-${slug}-${date}.pdf`
}

export async function downloadIncidentReportPdf({ report, siteName }) {
  const doc = new jsPDF()
  const margin = 14
  const pageWidth = doc.internal.pageSize.getWidth()
  const maxTextWidth = pageWidth - margin * 2
  let y = 20

  const guardName = report.guard?.name || 'Guard'
  const submitted = formatIncidentReportTime(report.created_at)
  const attachments = normalizeIncidentAttachments(report)

  doc.setFontSize(18)
  doc.text('SecurePatrol Incident Report', margin, y)
  y += 8

  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text('Productive Security Inc.', margin, y)
  y += 10

  doc.setFontSize(11)
  doc.setTextColor(0)
  doc.text(`Site: ${siteName || '—'}`, margin, y)
  y += 7
  doc.text(`Guard: ${guardName}`, margin, y)
  y += 7
  doc.text(`Submitted: ${submitted}`, margin, y)
  y += 7

  if (report.guard_lat != null && report.guard_lng != null) {
    doc.text(
      `Location: ${report.guard_lat.toFixed(6)}, ${report.guard_lng.toFixed(6)}`,
      margin,
      y,
    )
    y += 7
  }

  y += 4
  doc.setFontSize(12)
  doc.text('Report', margin, y)
  y += 6

  doc.setFontSize(10)
  const lines = doc.splitTextToSize(report.description || '', maxTextWidth)
  doc.text(lines, margin, y)
  y += lines.length * 5 + 6

  if (attachments.length) {
    doc.setFontSize(12)
    doc.text('Attachments', margin, y)
    y += 6
    doc.setFontSize(10)
    for (const att of attachments) {
      doc.text(`• ${att.name} (${att.kind})`, margin, y)
      y += 5
    }
    y += 4
  }

  const images = attachments.filter((a) => a.kind === 'image' && !isHeicPhotoPath(a.path))

  for (const att of images) {
    try {
      const url = await getIncidentPhotoSignedUrl(att.path)
      if (!url) continue

      const res = await fetch(url)
      if (!res.ok) continue

      const blob = await res.blob()
      const dataUrl = await blobToDataUrl(blob)
      const format = pdfImageFormat(dataUrl, att.path)

      const imgWidth = maxTextWidth
      const imgHeight = imgWidth * 0.65

      if (y + imgHeight > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage()
        y = margin
      }

      doc.setFontSize(10)
      doc.text(att.name, margin, y)
      y += 5
      doc.addImage(dataUrl, format, margin, y, imgWidth, imgHeight)
      y += imgHeight + 10
    } catch {
      // Skip images that cannot be embedded
    }
  }

  if (attachments.some((a) => isHeicPhotoPath(a.path))) {
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage()
      y = margin
    }
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text('Note: iPhone HEIC photos are listed above but may only be viewable in the app.', margin, y)
  }

  doc.save(safeFilename(siteName, report.created_at))
}
