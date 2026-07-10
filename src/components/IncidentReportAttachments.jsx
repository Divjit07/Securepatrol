import { useEffect, useState } from 'react'
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react'
import ImageLightbox, { ImageThumbnail } from './ImageLightbox.jsx'
import {
  downloadAttachmentFromUrl,
  getIncidentPhotoSignedUrl,
  isHeicPhotoPath,
  normalizeIncidentAttachments,
} from '../lib/incidentReports.js'

export default function IncidentReportAttachments({ report }) {
  const attachments = normalizeIncidentAttachments(report)
  const [urls, setUrls] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const [downloading, setDownloading] = useState(null)

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

  const handleDownload = async (att) => {
    const url = urls[att.path]
    if (!url) return

    setDownloading(att.path)
    try {
      await downloadAttachmentFromUrl(url, att.name)
    } catch (err) {
      setError(err.message || 'Could not download file')
    } finally {
      setDownloading(null)
    }
  }

  if (!attachments.length) return null

  const images = attachments.filter((a) => a.kind === 'image')
  const documents = attachments.filter((a) => a.kind === 'document')

  return (
    <>
      <div className="space-y-4">
        {loading && (
          <div className="flex h-24 items-center justify-center rounded-lg bg-white/5">
            <Loader2 className="h-6 w-6 animate-spin text-accent-cyan-line" />
          </div>
        )}

        {error && <p className="text-sm text-accent-red">{error}</p>}

        {images.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">
              Photos ({images.length})
            </p>
            <p className="mt-1 text-xs text-ink-2">Tap a photo to view full size</p>
            <div className="mt-2 space-y-3">
              {images.map((att) => {
                const url = urls[att.path]
                if (!url) {
                  return (
                    <p key={att.path} className="text-sm text-ink-2">
                      {att.name} — could not load preview
                    </p>
                  )
                }

                if (isHeicPhotoPath(att.path)) {
                  return (
                    <div
                      key={att.path}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3"
                    >
                      <span className="text-sm text-ink-2">{att.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDownload(att)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-accent-cyan-line"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {downloading === att.path ? 'Saving…' : 'Save photo'}
                      </button>
                    </div>
                  )
                }

                return (
                  <div key={att.path} className="space-y-2">
                    <ImageThumbnail
                      src={url}
                      alt={att.name}
                      onOpen={() => setLightbox({ src: url, alt: att.name, att })}
                    />
                    <button
                      type="button"
                      onClick={() => handleDownload(att)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-cyan-line"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {downloading === att.path ? 'Saving…' : 'Download photo'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {documents.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">
              Documents ({documents.length})
            </p>
            <ul className="mt-2 space-y-2">
              {documents.map((att) => {
                const url = urls[att.path]
                return (
                  <li key={att.path}>
                    {url ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownload(att)}
                          className="inline-flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-accent-cyan-line hover:bg-accent-cyan/10 touch-manipulation"
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="truncate">{att.name}</span>
                          <Download className="ml-auto h-3.5 w-3.5 shrink-0" />
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-ink-2 touch-manipulation"
                        >
                          Open
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-sm text-ink-2">{att.name} — unavailable</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
          onDownload={() => handleDownload(lightbox.att)}
        />
      )}
    </>
  )
}
