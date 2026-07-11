// Paystub math + PDF (Dayforce-style layout: logo top-left, employer/employee
// blocks, one bordered grid with Current + YTD columns and Earnings / Taxes /
// Net Pay sections). Earnings come from the same derived payroll rows as the
// hours report (raw punches stay immutable); rates live on guards.hourly_rate.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export const OVERTIME_MULTIPLIER = 1.5

export const EMPLOYER = {
  name: 'PRODUCTIVE SECURITY INC.',
  web: 'prodsec.ca',
}

// Statutory deductions are PERCENTAGES computed off gross, not typed amounts:
// Net = Gross − (Gross × EI%) − ((Gross − exemption) × CPP%) − other fees.
// Defaults per the owner: EI 1.63%, CPP 5.95% over the $134.62 per-period
// basic exemption ($3,500/yr ÷ 26 weekly periods). Editable in the UI so a
// rate-year change doesn't need a deploy.
export const DEFAULT_DEDUCTION_RATES = {
  eiPct: 1.63,
  cppPct: 5.95,
  cppExemption: 134.62,
}

const money = (n) => `$${(Math.round(n * 100) / 100).toFixed(2)}`
const hoursFmt = (mins) => (mins / 60).toFixed(2)

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

export function computePaystub({ totals, rate, rates = DEFAULT_DEDUCTION_RATES, otherFees = 0 }) {
  const r = Number(rate) || 0
  const lines = [
    { code: 'REG HRS', minutes: totals.regularMinutes, rate: r, amount: (totals.regularMinutes / 60) * r },
    { code: `OT HRS (${OVERTIME_MULTIPLIER}x)`, minutes: totals.overtimeMinutes, rate: r * OVERTIME_MULTIPLIER, amount: (totals.overtimeMinutes / 60) * r * OVERTIME_MULTIPLIER },
    { code: 'STAT $', minutes: totals.statMinutes, rate: r, amount: (totals.statMinutes / 60) * r },
  ].filter((l) => l.minutes > 0)

  const gross = lines.reduce((sum, l) => sum + l.amount, 0)

  const eiPct = Number(rates.eiPct) || 0
  const cppPct = Number(rates.cppPct) || 0
  const cppExemption = Number(rates.cppExemption) || 0
  const other = Number(otherFees) || 0

  const deductionLines = [
    { code: 'E.I.', label: `E.I. (${eiPct}% of gross)`, amount: gross * (eiPct / 100) },
    {
      code: 'C.P.P.',
      label: `C.P.P. (${cppPct}% over ${money(cppExemption)})`,
      amount: Math.max(0, gross - cppExemption) * (cppPct / 100),
    },
    { code: 'OTHER', label: 'Other fees', amount: other },
  ].filter((d) => d.amount > 0)

  const totalDeductions = deductionLines.reduce((sum, d) => sum + d.amount, 0)

  return { lines, gross, deductionLines, totalDeductions, net: gross - totalDeductions }
}

// ---------------------------------------------------------------------------
// PDF rendering
// ---------------------------------------------------------------------------

let logoPromise = null
/** Brand logo as a data URL (cached). Returns null when unavailable. */
export function loadLogoDataUrl() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (!logoPromise) {
    logoPromise = fetch('/logo.png')
      .then((res) => (res.ok ? res.blob() : null))
      .then(
        (blob) =>
          blob &&
          new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(blob)
          }),
      )
      .catch(() => null)
  }
  return logoPromise
}

function headerBlock(doc, { logo, guardName, employeeNo, siteName, fromDate, toDate }) {
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', 14, 10, 18, 18)
    } catch {
      /* corrupt/unsupported logo — text header still renders */
    }
  }

  doc.setTextColor(20)
  doc.setFontSize(10.5)
  doc.setFont(undefined, 'bold')
  doc.text(EMPLOYER.name, logo ? 35 : 14, 15)
  doc.setFontSize(8)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(90)
  doc.text(EMPLOYER.web, logo ? 35 : 14, 20)

  doc.setTextColor(20)
  doc.setFontSize(8)
  const left = [
    ['Employee Name:', guardName],
    ['Employee #:', employeeNo || '—'],
    ['Department:', siteName || '—'],
  ]
  const right = [
    ['Pay Date:', new Date().toLocaleDateString()],
    ['Pay Period:', `${fromDate} - ${toDate}`],
    ['Generated:', new Date().toLocaleString()],
  ]
  left.forEach(([k, v], i) => {
    doc.setFont(undefined, 'bold')
    doc.text(k, 100, 13 + i * 4.5)
    doc.setFont(undefined, 'normal')
    doc.text(String(v), 126, 13 + i * 4.5)
  })
  right.forEach(([k, v], i) => {
    doc.setFont(undefined, 'bold')
    doc.text(k, 152, 13 + i * 4.5)
    doc.setFont(undefined, 'normal')
    doc.text(String(v), 170, 13 + i * 4.5)
  })
}

/**
 * One Dayforce-style paystub page. `ytd` = { stub, totals } computed over
 * Jan 1 → period end with the same engine (null → YTD column shows —).
 */
export function renderPaystubPage(doc, params) {
  const { fromDate, toDate, stub, ytd } = params
  headerBlock(doc, params)

  const ytdStub = ytd?.stub || null
  const ytdTotals = ytd?.totals || null
  const dash = '—'

  const ytdLineAmount = (code) => {
    if (!ytdStub) return dash
    const line = ytdStub.lines.find((l) => l.code === code)
    return line ? money(line.amount) : money(0)
  }
  const ytdLineHours = (code) => {
    if (!ytdTotals) return dash
    const mins =
      code === 'REG HRS'
        ? ytdTotals.regularMinutes
        : code.startsWith('OT')
          ? ytdTotals.overtimeMinutes
          : ytdTotals.statMinutes
    return hoursFmt(mins)
  }
  const ytdDeduction = (code) => {
    if (!ytdStub) return dash
    const line = ytdStub.deductionLines.find((d) => d.code === code)
    return line ? money(line.amount) : money(0)
  }

  const sectionStyle = { fontStyle: 'bold', fillColor: [235, 235, 235] }
  const body = []

  body.push([
    { content: 'Earnings', styles: sectionStyle },
    { content: '', styles: sectionStyle },
    { content: '', styles: sectionStyle },
    { content: money(stub.gross), styles: { ...sectionStyle, halign: 'right' } },
    { content: '', styles: sectionStyle },
    { content: ytdStub ? money(ytdStub.gross) : dash, styles: { ...sectionStyle, halign: 'right' } },
  ])
  const earnCodes = new Set([...stub.lines.map((l) => l.code), ...(ytdStub?.lines.map((l) => l.code) || [])])
  for (const code of ['REG HRS', `OT HRS (${OVERTIME_MULTIPLIER}x)`, 'STAT $']) {
    if (!earnCodes.has(code)) continue
    const line = stub.lines.find((l) => l.code === code)
    body.push([
      `  ${code}`,
      line ? hoursFmt(line.minutes) : '',
      line ? line.rate.toFixed(4) : '',
      { content: line ? money(line.amount) : money(0), styles: { halign: 'right' } },
      ytdLineHours(code),
      { content: ytdLineAmount(code), styles: { halign: 'right' } },
    ])
  }

  body.push([
    { content: 'Taxes', styles: sectionStyle },
    { content: '', styles: sectionStyle },
    { content: '', styles: sectionStyle },
    { content: money(stub.totalDeductions), styles: { ...sectionStyle, halign: 'right' } },
    { content: '', styles: sectionStyle },
    { content: ytdStub ? money(ytdStub.totalDeductions) : dash, styles: { ...sectionStyle, halign: 'right' } },
  ])
  const dedCodes = new Set([
    ...stub.deductionLines.map((d) => d.code),
    ...(ytdStub?.deductionLines.map((d) => d.code) || []),
  ])
  for (const code of ['E.I.', 'C.P.P.', 'OTHER']) {
    if (!dedCodes.has(code)) continue
    const line = stub.deductionLines.find((d) => d.code === code)
    body.push([
      `  ${line?.label || code}`,
      '',
      '',
      { content: money(line?.amount || 0), styles: { halign: 'right' } },
      '',
      { content: ytdDeduction(code), styles: { halign: 'right' } },
    ])
  }

  body.push([
    { content: 'Net Pay', styles: { fontStyle: 'bold' } },
    '',
    '',
    { content: money(stub.net), styles: { fontStyle: 'bold', halign: 'right' } },
    '',
    { content: ytdStub ? money(ytdStub.net) : dash, styles: { fontStyle: 'bold', halign: 'right' } },
  ])

  autoTable(doc, {
    startY: 30,
    theme: 'grid',
    styles: { fontSize: 8, textColor: 20, lineColor: [60, 60, 60], lineWidth: 0.15, cellPadding: 1.6 },
    headStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 24, halign: 'right' },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 26 },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 24 },
    },
    head: [
      [
        { content: '' },
        { content: `Current\n${fromDate} - ${toDate}`, colSpan: 3 },
        { content: `YTD\nAs of ${toDate}`, colSpan: 2 },
      ],
      ['', 'Hours/Units', 'Rate', 'Amount', 'Hours/Units', 'Amount'],
    ],
    body,
  })

  // Messages box — mirrors the reference layout's employer-message section.
  const y = doc.lastAutoTable.finalY + 8
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 7.5, textColor: 60, lineColor: [60, 60, 60], lineWidth: 0.15, cellPadding: 1.8 },
    head: [[{ content: 'Messages from your Employer', styles: { fontStyle: 'bold', fontSize: 9, textColor: 20 } }]],
    headStyles: { fillColor: [255, 255, 255] },
    body: [
      [
        'Hours derived from verified clock punches (15-min payroll rounding). E.I./C.P.P. computed as percentages of gross per company settings. Raw punch records remain the system of record.',
      ],
    ],
  })
}

/** Build the jsPDF document (exported for testing). */
export function buildPaystubDoc(paramsList) {
  const doc = new jsPDF()
  paramsList.forEach((params, i) => {
    if (i > 0) doc.addPage()
    renderPaystubPage(doc, params)
  })
  return doc
}

/** Download one guard's paystub. */
export async function downloadPaystubPdf(params) {
  const logo = await loadLogoDataUrl()
  const doc = buildPaystubDoc([{ ...params, logo }])
  doc.save(`paystub-${params.guardName.replace(/\s+/g, '-').toLowerCase()}-${params.fromDate}.pdf`)
}

/** Download one PDF with a page per guard. */
export async function downloadAllPaystubsPdf(guardParams, fromDate) {
  const logo = await loadLogoDataUrl()
  const doc = buildPaystubDoc(guardParams.map((p) => ({ ...p, logo })))
  doc.save(`paystubs-${fromDate}.pdf`)
}
