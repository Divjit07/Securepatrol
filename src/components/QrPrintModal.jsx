import { useEffect, useState } from 'react'
import { Printer, Download, X, Shield } from 'lucide-react'
import { buildCheckpointQrDataUrl, getCheckpointQrPayload } from '../lib/qr.js'
import { BRAND } from '../lib/brand.js'
import {
  downloadDataUrl,
  FOOTER_LINE,
  PROVIDER_LINE,
  slugify,
} from '../lib/labelExport.js'

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function labelCardHtml({ siteName, label }) {
  return `
    <div class="label">
      <div class="label-header">
        ${siteName ? `<div class="site">${escapeHtml(siteName)}</div>` : ''}
        <div class="provider">${PROVIDER_LINE}</div>
      </div>
      ${label.floorName ? `<div class="floor">${escapeHtml(label.floorName)}</div>` : ''}
      <img src="${label.dataUrl}" alt="QR" width="200" height="200" />
      <div class="checkpoint">${escapeHtml(label.name)}</div>
      <div class="label-footer">
        <div class="protected">${FOOTER_LINE}</div>
        <div class="hint">Scan with ${BRAND.name} guard app</div>
      </div>
    </div>`
}

function buildPrintHtml({ siteName, labels }) {
  const cards = labels.map((label) => labelCardHtml({ siteName, label })).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${BRAND.name} QR Labels</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 16px; color: #0f172a; }
    .sheet { display: flex; flex-wrap: wrap; gap: 16px; justify-content: flex-start; }
    .label {
      width: 3.25in;
      min-height: 4.5in;
      border: 2px solid #0a1628;
      border-radius: 12px;
      overflow: hidden;
      text-align: center;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
    }
    .label-header {
      background: #0a1628;
      color: #fff;
      padding: 12px 14px 10px;
    }
    .site {
      font-size: 13px;
      font-weight: 800;
      line-height: 1.25;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .provider {
      margin-top: 6px;
      font-size: 8px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #94a3b8;
    }
    .floor {
      margin-top: 10px;
      font-size: 10px;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    img { display: block; margin: 10px auto 8px; }
    .checkpoint {
      font-size: 15px;
      font-weight: 800;
      line-height: 1.25;
      padding: 0 12px;
      color: #0a1628;
    }
    .label-footer {
      margin-top: auto;
      border-top: 1px solid #e2e8f0;
      padding: 10px 12px 12px;
      background: #f8fafc;
    }
    .protected {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0a1628;
    }
    .hint { margin-top: 5px; font-size: 8px; color: #64748b; }
    @media print {
      body { padding: 0; }
      .label { border-color: #000; }
    }
  </style>
</head>
<body>
  <div class="sheet">${cards}</div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`
}

function LabelPreview({ siteName, label }) {
  return (
    <div className="mx-auto flex max-w-xs flex-col overflow-hidden rounded-2xl border-2 border-navy-900 text-center">
      <div className="bg-navy-900 px-4 py-3 text-white">
        {siteName && (
          <p className="text-sm font-extrabold uppercase tracking-wide leading-tight">{siteName}</p>
        )}
        <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {PROVIDER_LINE}
        </p>
      </div>
      <div className="px-4 pb-4 pt-3">
        {label.floorName && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {label.floorName}
          </p>
        )}
        <img src={label.dataUrl} alt="QR code" className="mx-auto my-3" width={200} height={200} />
        <p className="text-base font-extrabold leading-snug text-navy-900">{label.name}</p>
        <div className="mt-4 border-t border-slate-200 bg-slate-50 px-3 py-3">
          <p className="flex items-center justify-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-navy-900">
            <Shield className="h-3.5 w-3.5" />
            {FOOTER_LINE}
          </p>
          <p className="mt-1.5 text-[9px] text-slate-500">Scan with {BRAND.name} guard app</p>
        </div>
      </div>
    </div>
  )
}

export default function QrPrintModal({ checkpoints, siteName, title, onClose }) {
  const [labels, setLabels] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const items = await Promise.all(
        checkpoints.map(async (cp) => ({
          id: cp.id,
          name: cp.name,
          floorName: cp.floors?.floor_name || cp.floor_name || '',
          dataUrl: await buildCheckpointQrDataUrl(cp.id),
          payload: getCheckpointQrPayload(cp.id),
        })),
      )
      if (!cancelled) {
        setLabels(items)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [checkpoints])

  const handlePrint = () => {
    const html = buildPrintHtml({ siteName, labels })
    const win = window.open('', '_blank', 'noopener,noreferrer')
    if (!win) {
      alert('Allow pop-ups to print labels.')
      return
    }
    win.document.write(html)
    win.document.close()
  }

  const handleDownloadFullLabel = async (label) => {
    const png = await buildFullLabelPng(siteName, label)
    downloadDataUrl(png, `securepatrol-label-${slugify(label.name)}.png`)
  }

  const handleDownloadQrOnly = (label) => {
    downloadDataUrl(label.dataUrl, `securepatrol-qr-${slugify(label.name)}.png`)
  }

  const primary = labels[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-semibold">{title || 'QR checkpoint label'}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Labels include site name, checkpoint, and {BRAND.name} branding — ready to print and stick.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          </div>
        ) : (
          <div className="p-6">
            {labels.length === 1 && primary ? (
              <LabelPreview siteName={siteName} label={primary} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {labels.map((label) => (
                  <div key={label.id}>
                    <LabelPreview siteName={siteName} label={label} />
                    <button
                      type="button"
                      onClick={() => handleDownloadFullLabel(label)}
                      className="mt-2 w-full text-center text-xs font-medium text-brand-600 hover:underline"
                    >
                      Download full label
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3">
              <button type="button" onClick={handlePrint} className="sp-btn-primary w-full">
                <Printer className="h-4 w-4" />
                {labels.length === 1 ? 'Print full label' : `Print ${labels.length} full labels`}
              </button>
              {labels.length === 1 && primary && (
                <button
                  type="button"
                  onClick={() => handleDownloadFullLabel(primary)}
                  className="sp-btn-secondary w-full"
                >
                  <Download className="h-4 w-4" /> Download full label (PNG)
                </button>
              )}
              {labels.length === 1 && primary && (
                <button
                  type="button"
                  onClick={() => handleDownloadQrOnly(primary)}
                  className="text-center text-xs text-slate-500 hover:text-brand-600 hover:underline"
                >
                  QR code only (no branding)
                </button>
              )}
            </div>

            {primary && (
              <p className="mt-4 break-all text-center font-mono text-[10px] text-slate-400">
                {primary.payload}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
