// Invoice generator — admin bills a client for extra services (special
// coverage, event security, call-outs). Line items × rate, optional tax %,
// printable light PDF with the company logo. Nothing is persisted; the PDF
// is the artifact.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { EMPLOYER, loadLogoDataUrl } from './paystub.js'

const money = (n) => `$${(Math.round(n * 100) / 100).toFixed(2)}`

export function emptyInvoiceItem() {
  return { description: '', qty: 1, price: '' }
}

export function computeInvoice({ items = [], taxPct = 0 }) {
  const lines = items
    .map((item) => ({
      ...item,
      amount: (Number(item.qty) || 0) * (Number(item.price) || 0),
    }))
    .filter((l) => l.description.trim() || l.amount > 0)
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0)
  const tax = subtotal * ((Number(taxPct) || 0) / 100)
  return { lines, subtotal, tax, total: subtotal + tax }
}

/** Build the jsPDF document (exported for testing). */
export function buildInvoiceDoc({ logo, number, date, dueDate, billTo, billToAddress, calc, taxPct, notes }) {
  const doc = new jsPDF()

  if (logo) {
    try {
      doc.addImage(logo, 'PNG', 14, 10, 18, 18)
    } catch {
      /* text header still renders */
    }
  }
  doc.setTextColor(20)
  doc.setFontSize(13)
  doc.setFont(undefined, 'bold')
  doc.text(EMPLOYER.name, logo ? 35 : 14, 16)
  doc.setFontSize(8)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(90)
  doc.text(EMPLOYER.web, logo ? 35 : 14, 21)

  doc.setTextColor(20)
  doc.setFontSize(22)
  doc.setFont(undefined, 'bold')
  doc.text('INVOICE', 196, 18, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont(undefined, 'normal')
  doc.text(`Invoice #: ${number || '—'}`, 196, 26, { align: 'right' })
  doc.text(`Date: ${date || new Date().toLocaleDateString()}`, 196, 31, { align: 'right' })
  if (dueDate) doc.text(`Due: ${dueDate}`, 196, 36, { align: 'right' })

  doc.setFontSize(8)
  doc.setFont(undefined, 'bold')
  doc.text('BILL TO', 14, 42)
  doc.setFont(undefined, 'normal')
  doc.setFontSize(10)
  doc.text(billTo || '—', 14, 47)
  if (billToAddress) {
    doc.setFontSize(8)
    doc.setTextColor(90)
    doc.text(billToAddress, 14, 52, { maxWidth: 90 })
    doc.setTextColor(20)
  }

  autoTable(doc, {
    startY: 60,
    theme: 'grid',
    styles: { fontSize: 9, textColor: 20, lineColor: [60, 60, 60], lineWidth: 0.15, cellPadding: 2 },
    headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: 'bold' },
    columnStyles: {
      1: { cellWidth: 20, halign: 'right' },
      2: { cellWidth: 28, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
    },
    head: [['Description', 'Qty', 'Rate', 'Amount']],
    body: calc.lines.length
      ? calc.lines.map((l) => [l.description, l.qty, money(Number(l.price) || 0), money(l.amount)])
      : [['—', '', '', money(0)]],
  })

  const y = doc.lastAutoTable.finalY + 6
  doc.setFontSize(9)
  doc.text(`Subtotal: ${money(calc.subtotal)}`, 196, y, { align: 'right' })
  doc.text(`Tax (${Number(taxPct) || 0}%): ${money(calc.tax)}`, 196, y + 5, { align: 'right' })
  doc.setFontSize(12)
  doc.setFont(undefined, 'bold')
  doc.text(`Total: ${money(calc.total)}`, 196, y + 12, { align: 'right' })

  if (notes) {
    doc.setFontSize(8)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(90)
    doc.text(`Notes: ${notes}`, 14, y + 20, { maxWidth: 180 })
  }

  return doc
}

export async function downloadInvoicePdf(params) {
  const logo = await loadLogoDataUrl()
  const doc = buildInvoiceDoc({ ...params, logo })
  doc.save(`invoice-${(params.number || 'draft').replace(/\s+/g, '-')}.pdf`)
}
