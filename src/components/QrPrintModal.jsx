import { useEffect, useState } from 'react'
import { Printer, Download, X } from 'lucide-react'
import { buildCheckpointQrDataUrl, getCheckpointQrPayload } from '../lib/qr.js'

function buildPrintHtml({ siteName, labels }) {
  const cards = labels
    .map(
      (label) => `
    <div class="label">
      <div class="brand">SecurePatrol · Productive Security Inc.</div>
      ${siteName ? `<div class="site">${escapeHtml(siteName)}</div>` : ''}
      ${label.floorName ? `<div class="floor">Floor: ${escapeHtml(label.floorName)}</div>` : ''}
      <img src="${label.dataUrl}" alt="QR" width="200" height="200" />
      <div class="checkpoint">${escapeHtml(label.name)}</div>
      <div class="hint">Scan with SecurePatrol guard app</div>
    </div>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SecurePatrol QR Labels</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 16px; color: #0f172a; }
    .sheet { display: flex; flex-wrap: wrap; gap: 16px; justify-content: flex-start; }
    .label {
      width: 3.25in;
      min-height: 4.25in;
      border: 2px solid #0a1628;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      page-break-inside: avoid;
    }
    .brand { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
    .site { margin-top: 8px; font-size: 11px; font-weight: 700; color: #0a1628; }
    .floor { margin-top: 4px; font-size: 10px; color: #475569; }
    img { display: block; margin: 12px auto; }
    .checkpoint { font-size: 14px; font-weight: 700; line-height: 1.3; margin-top: 4px; }
    .hint { margin-top: 8px; font-size: 9px; color: #64748b; }
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

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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

  const handleDownload = (label) => {
    const link = document.createElement('a')
    link.href = label.dataUrl
    link.download = `securepatrol-${label.name.replace(/\s+/g, '-').toLowerCase()}.png`
    link.click()
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
            <p className="mt-1 text-sm text-slate-500">Print and stick at the checkpoint location.</p>
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
              <div className="mx-auto max-w-xs rounded-2xl border-2 border-navy-900 p-5 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  SecurePatrol
                </p>
                {siteName && <p className="mt-2 text-xs font-bold text-navy-900">{siteName}</p>}
                {primary.floorName && (
                  <p className="mt-1 text-xs text-slate-600">Floor: {primary.floorName}</p>
                )}
                <img src={primary.dataUrl} alt="QR code" className="mx-auto my-4" />
                <p className="text-base font-bold text-navy-900">{primary.name}</p>
                <p className="mt-2 text-[10px] text-slate-500">Scan with SecurePatrol guard app</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {labels.map((label) => (
                  <div key={label.id} className="rounded-xl border border-slate-200 p-4 text-center">
                    <img src={label.dataUrl} alt="" className="mx-auto h-32 w-32" />
                    <p className="mt-2 text-sm font-semibold">{label.name}</p>
                    {label.floorName && <p className="text-xs text-slate-500">{label.floorName}</p>}
                    <button
                      type="button"
                      onClick={() => handleDownload(label)}
                      className="mt-2 text-xs font-medium text-brand-600 hover:underline"
                    >
                      Download PNG
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={handlePrint} className="sp-btn-primary flex-1">
                <Printer className="h-4 w-4" />
                {labels.length === 1 ? 'Print label' : `Print ${labels.length} labels`}
              </button>
              {labels.length === 1 && primary && (
                <button type="button" onClick={() => handleDownload(primary)} className="sp-btn-secondary">
                  <Download className="h-4 w-4" /> Download
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
