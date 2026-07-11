// Paystub math + PDF. Earnings come from the same derived payroll rows as the
// hours report (raw punches stay immutable); rates live on guards.hourly_rate.
// Deductions are entered by the payroll admin — we don't guess tax tables.
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { BRAND } from './brand.js'

export const OVERTIME_MULTIPLIER = 1.5

export const DEDUCTION_FIELDS = [
  { id: 'incomeTax', label: 'Income tax' },
  { id: 'cpp', label: 'CPP' },
  { id: 'ei', label: 'EI' },
  { id: 'other', label: 'Other' },
]

const money = (n) => `$${(Math.round(n * 100) / 100).toFixed(2)}`
const hours = (mins) => (mins / 60).toFixed(2)

/** Sum a guard's weekly payroll rows into one pay-period earnings block. */
export function periodTotalsForGuard(weeklyRows, guardId) {
  const totals = { regularMinutes: 0, overtimeMinutes: 0, statMinutes: 0, days: 0 }
  for (const w of weeklyRows) {
    if (w.guardId !== guardId) continue
    totals.regularMinutes += w.regularMinutes
    totals.overtimeMinutes += w.overtimeMinutes
    totals.statMinutes += w.statMinutes
    totals.days += w.days
  }
  return totals
}

export function computePaystub({ totals, rate, deductions = {} }) {
  const r = Number(rate) || 0
  const lines = [
    { label: 'Regular', minutes: totals.regularMinutes, rate: r, amount: (totals.regularMinutes / 60) * r },
    { label: `Overtime (${OVERTIME_MULTIPLIER}×)`, minutes: totals.overtimeMinutes, rate: r * OVERTIME_MULTIPLIER, amount: (totals.overtimeMinutes / 60) * r * OVERTIME_MULTIPLIER },
    { label: 'Statutory holiday', minutes: totals.statMinutes, rate: r, amount: (totals.statMinutes / 60) * r },
  ].filter((l) => l.minutes > 0)

  const gross = lines.reduce((sum, l) => sum + l.amount, 0)
  const deductionLines = DEDUCTION_FIELDS
    .map((f) => ({ label: f.label, amount: Number(deductions[f.id]) || 0 }))
    .filter((d) => d.amount > 0)
  const totalDeductions = deductionLines.reduce((sum, d) => sum + d.amount, 0)

  return { lines, gross, deductionLines, totalDeductions, net: gross - totalDeductions }
}

/** One paystub page onto an existing jsPDF doc (printables stay light). */
function renderPaystubPage(doc, { guardName, siteName, fromDate, toDate, stub, rate }) {
  doc.setTextColor(20)
  doc.setFontSize(18)
  doc.text(`${BRAND.name} Pay Statement`, 14, 20)
  doc.setFontSize(9)
  doc.text(BRAND.tagline, 14, 26)

  doc.setFontSize(11)
  doc.text(`Employee: ${guardName}`, 14, 38)
  doc.text(`Site: ${siteName || '—'}`, 14, 45)
  doc.text(`Pay period: ${fromDate} to ${toDate}`, 14, 52)
  doc.text(`Hourly rate: ${money(Number(rate) || 0)}`, 120, 38)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 120, 45)

  autoTable(doc, {
    startY: 60,
    head: [['Earnings', 'Hours', 'Rate', 'Amount']],
    body: stub.lines.length
      ? stub.lines.map((l) => [l.label, hours(l.minutes), money(l.rate), money(l.amount)])
      : [['No hours in this period', '—', '—', money(0)]],
    foot: [['Gross pay', '', '', money(stub.gross)]],
  })

  let y = doc.lastAutoTable.finalY + 8
  autoTable(doc, {
    startY: y,
    head: [['Deductions', 'Amount']],
    body: stub.deductionLines.length
      ? stub.deductionLines.map((d) => [d.label, money(d.amount)])
      : [['None entered', money(0)]],
    foot: [['Total deductions', money(stub.totalDeductions)]],
  })

  y = doc.lastAutoTable.finalY + 12
  doc.setFontSize(14)
  doc.text(`Net pay: ${money(stub.net)}`, 14, y)
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(
    'Hours derived from verified clock punches (15-min payroll rounding). Deductions entered by payroll. Raw punch records remain the system of record.',
    14,
    y + 8,
    { maxWidth: 180 },
  )
}

/** Download one guard's paystub. */
export function downloadPaystubPdf(params) {
  const doc = new jsPDF()
  renderPaystubPage(doc, params)
  doc.save(`paystub-${params.guardName.replace(/\s+/g, '-').toLowerCase()}-${params.fromDate}.pdf`)
}

/** Download one PDF with a page per guard. */
export function downloadAllPaystubsPdf(guardParams, fromDate) {
  const doc = new jsPDF()
  guardParams.forEach((params, i) => {
    if (i > 0) doc.addPage()
    renderPaystubPage(doc, params)
  })
  doc.save(`paystubs-${fromDate}.pdf`)
}
