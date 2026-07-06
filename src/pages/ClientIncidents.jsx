import { useEffect, useState } from 'react'
import { AlertTriangle, ExternalLink, MapPin, X } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase.js'
import IncidentReportAttachments from '../components/IncidentReportAttachments.jsx'
import { fetchIncidentReportsForSite, incidentAttachmentCount } from '../lib/incidentReports.js'

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
  }

  if (!siteId) {
    return (
      <Layout variant="client">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
          <h1 className="text-lg font-semibold text-amber-900">No site assigned</h1>
          <p className="mt-2 text-sm text-amber-800">
            Contact your administrator to link your account to a patrol site.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout variant="client">
      <PageHeader
        title="Incident reports"
        description={`Guard-submitted site reports for ${site?.name || 'your site'}. These are written by on-duty guards during their shift.`}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium text-slate-700">No incident reports yet</p>
          <p className="mt-1 text-sm text-slate-500">
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
              className="sp-card w-full p-5 text-left transition hover:border-brand-200 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base font-semibold text-slate-900">
                    {report.guard?.name || 'Guard'}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">{formatReportTime(report.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {incidentAttachmentCount(report) > 0 && (
                    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                      {incidentAttachmentCount(report)} file{incidentAttachmentCount(report) === 1 ? '' : 's'}
                    </span>
                  )}
                  {(report.guard_lat != null && report.guard_lng != null) && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      GPS
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-slate-700">{report.description}</p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
          onClick={closeReport}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-semibold">{selected.guard?.name || 'Guard'}</h2>
                <p className="text-sm text-slate-500">{formatReportTime(selected.created_at)}</p>
              </div>
              <button
                type="button"
                onClick={closeReport}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {selected.description}
                </p>
              </div>

              {selected.guard_lat != null && selected.guard_lng != null && (
                <a
                  href={mapsUrl(selected.guard_lat, selected.guard_lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  <MapPin className="h-4 w-4" />
                  View location on map
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}

              <IncidentReportAttachments report={selected} />
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
