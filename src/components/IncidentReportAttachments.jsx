import { useEffect, useState } from 'react'
import { ExternalLink, FileText, Loader2 } from 'lucide-react'
import {
  getIncidentPhotoSignedUrl,
  isHeicPhotoPath,
  normalizeIncidentAttachments,
} from '../lib/incidentReports.js'

export default function IncidentReportAttachments({ report }) {
  const attachments = normalizeIncidentAttachments(report)
  const [urls, setUrls] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!attachments.length) {
      setUrls({})
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all(
      attachments.map(async (att) => {
        try {
          const url = await getIncidentPhotoSignedUrl(att.path)
          return [att.path, url]
        } catch {
          return [att.path, null]
        }
      }),
    )
      .then((entries) => {
        if (cancelled) return
        setUrls(Object.fromEntries(entries))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load attachments')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [report?.id, attachments.map((a) => a.path).join('|')])

  if (!attachments.length) return null

  const images = attachments.filter((a) => a.kind === 'image')
  const documents = attachments.filter((a) => a.kind === 'document')

  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex h-24 items-center justify-center rounded-lg bg-slate-50">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {images.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Photos ({images.length})
          </p>
          <div className="mt-2 space-y-3">
            {images.map((att) => {
              const url = urls[att.path]
              if (!url) {
                return (
                  <p key={att.path} className="text-sm text-slate-500">
                    {att.name} — could not load preview
                  </p>
                )
              }
              if (isHeicPhotoPath(att.path)) {
                return (
                  <a
                    key={att.path}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600"
                  >
                    {att.name} (open iPhone photo)
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )
              }
              return (
                <div key={att.path}>
                  <img
                    src={url}
                    alt={att.name}
                    className="max-h-80 w-full rounded-lg border border-slate-200 object-contain"
                  />
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600"
                  >
                    {att.name}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Documents ({documents.length})
          </p>
          <ul className="mt-2 space-y-2">
            {documents.map((att) => {
              const url = urls[att.path]
              return (
                <li key={att.path}>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      {att.name}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-sm text-slate-500">{att.name} — unavailable</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
