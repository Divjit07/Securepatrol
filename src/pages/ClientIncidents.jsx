import { useEffect, useState } from 'react'
import { AlertTriangle, Download, ExternalLink, FileText, Loader2, MapPin, X } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import ViewportModal, { ModalBody, ModalHeader } from '../components/ViewportModal.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js'
import { supabase } from '../lib/supabase.js'
import IncidentReportAttachments from '../components/IncidentReportAttachments.jsx'
import ImageLightbox from '../components/ImageLightbox.jsx'
import { downloadIncidentReportPdf } from '../lib/incidentReportPdf.js'
import {
  fetchIncidentReportsForSite,
  getIncidentPhotoSignedUrl,
  incidentAttachmentCount,
  previewImagePath,
} from '../lib/incidentReports.js'

function formatReportTime(iso) {
  return new Date(iso).toLocaleString('en-CA', {
    timeZone: 'America/Toronto',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export default function ClientIncidents() {
  const { profile } = useAuth()
  const siteId = profile?.site_id
  const [site, setSite] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [previews, setPreviews] = useState({})
  const [lightbox, setLightbox] = useState(null)

  useBodyScrollLock(Boolean(selected))

  // Sign a preview URL for each report's first photo so rows show a thumbnail.
  useEffect(() => {
    const withImages = reports
      .map((r) => [r.id, previewImagePath(r)])
      .filter(([, path]) => path)
    if (!withImages.length) {
      setPreviews({})
      return undefined
    }
    let cancelled = false
    Promise.all(
      withImages.map(async ([id, path]) => {
        try {
          return [id, await getIncidentPhotoSignedUrl(path)]
        } catch {
          return [id, null]
        }
      }),
    ).then((entries) => {
      if (!cancelled) setPreviews(Object.fromEntries(entries.filter(([, url]) => url)))
    })
    return () => {
      cancelled = true
    }
  }, [reports])

  useEffect(() => {
    if (!siteId) return
    supabase.from('sites').select('name, address').eq('id', siteId).single().then(({ data }) => setSite(data))
  }, [siteId])

  useEffect(() => {
    if (!siteId) return

    setLoading(true)
    fetchIncidentReportsForSite(siteId)
      .then(setReports)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [siteId])

  const openReport = (report) => {
    setSelected(report)
  }

  const closeReport = () => {
    setSelected(null)
    setPdfLoading(false)
  }

  const handleDownloadPdf = async () => {
    if (!selected || pdfLoading) return
    setPdfLoading(true)
    try {
      await downloadIncidentReportPdf({
        report: selected,
        siteName: site?.name,
      })
    } catch (err) {
      console.error(err)
      window.alert(err.message || 'Could not create PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  if (!siteId) {
    return (
      <Layout variant="client">
        <div className="rounded-xl border border-accent-orange/30 bg-accent-orange/10 p-8 text-center">
          <h1 className="text-lg font-semibold text-accent-orange">No site assigned</h1>
          <p className="mt-2 text-sm text-accent-orange">
            Contact your administrator to link your account to a patrol site.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout variant="client">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#FDECC8] to-[#F4C877] text-[#4a3510] shadow-[0_10px_24px_-8px_rgba(244,200,119,0.75)]">
            <AlertTriangle className="h-7 w-7" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="deck-eyebrow text-[#E8A33D]">Client Portal · Reports</p>
            <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight sm:text-[2rem]">Incident reports</h1>
            <p className="mt-1 text-sm text-ink-2">
              Guard-submitted site reports for {site?.name || 'your site'} — written on-duty during their shift.
            </p>
          </div>
        </div>
        {reports.length > 0 && (
          <span className="hidden shrink-0 items-center gap-2 rounded-full bg-[#E8A33D]/15 px-3.5 py-2 text-sm font-bold text-[#E8A33D] sm:flex">
            <FileText className="h-4 w-4" /> {reports.length} report{reports.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-surface p-10 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-ink-3" />
          <p className="mt-3 font-medium text-ink-2">No incident reports yet</p>
          <p className="mt-1 text-sm text-ink-2">
            When a guard submits a report from the field, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <button
              key={report.id}
              type="button"
              onClick={() => openReport(report)}
              className="sp-card w-full p-5 text-left transition hover:border-accent-cyan-line/20 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-base font-semibold text-ink">
                      {report.guard?.name || 'Guard'}
                    </p>
                    {incidentAttachmentCount(report) > 0 && (
                      <span className="rounded-full bg-accent-cyan/10 px-2.5 py-0.5 text-xs font-medium text-accent-cyan-line">
                        {incidentAttachmentCount(report)} file{incidentAttachmentCount(report) === 1 ? '' : 's'}
                      </span>
                    )}
                    {(report.guard_lat != null && report.guard_lng != null) && (
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-ink-2">
                        GPS
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-2">{formatReportTime(report.created_at)}</p>
                  <p className="mt-3 line-clamp-2 text-sm text-ink-2">{report.description}</p>
                </div>
                {previews[report.id] && (
                  <img
                    src={previews[report.id]}
                    alt="Report photo preview"
                    loading="lazy"
                    onClick={(e) => {
                      e.stopPropagation()
                      setLightbox({ src: previews[report.id], alt: `${report.guard?.name || 'Guard'} — report photo` })
                    }}
                    className="h-20 w-20 shrink-0 cursor-zoom-in rounded-xl border border-white/10 object-cover transition hover:brightness-110 sm:h-24 sm:w-24"
                  />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <ViewportModal onClose={closeReport} labelledBy="client-incident-title">
          <ModalHeader>
            <div className="min-w-0">
              <h2 id="client-incident-title" className="font-display text-lg font-semibold text-ink">
                {selected.guard?.name || 'Guard'}
              </h2>
              <p className="text-sm text-ink-2">{formatReportTime(selected.created_at)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-accent-cyan/10 px-3 py-2 text-xs font-semibold text-accent-cyan-line hover:bg-accent-cyan/15 disabled:opacity-50 touch-manipulation"
              >
                {pdfLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                PDF
              </button>
              <button
                type="button"
                onClick={closeReport}
                className="rounded-lg p-2 text-ink-2 hover:bg-ink/10 hover:text-ink touch-manipulation"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </ModalHeader>

          <ModalBody>
            <div>
              <p className="deck-eyebrow">Report</p>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.7] text-ink">
                {selected.description}
              </p>
            </div>

            {selected.guard_lat != null && selected.guard_lng != null && (
              <a
                href={mapsUrl(selected.guard_lat, selected.guard_lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-cyan-line hover:text-accent-cyan-line"
              >
                <MapPin className="h-4 w-4" />
                View location on map
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            <IncidentReportAttachments report={selected} />
          </ModalBody>
        </ViewportModal>
      )}

      {lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </Layout>
  )
}
