import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  AlertTriangle,
  ExternalLink,
  MapPin,
  Pencil,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js'
import { fetchSitesForAdmin } from '../lib/scans.js'
import IncidentReportAttachments from '../components/IncidentReportAttachments.jsx'
import ImageLightbox from '../components/ImageLightbox.jsx'
import {
  deleteIncidentReport,
  fetchIncidentReportsForSite,
  fetchIncidentReportsForSites,
  formatIncidentReportTime,
  getIncidentPhotoSignedUrl,
  incidentAttachmentCount,
  previewImagePath,
  updateIncidentReportDescription,
} from '../lib/incidentReports.js'

function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export default function AdminIncidents() {
  const { user, isSuperAdmin, canApproveScans, canManageShiftClock, privilegesLoading } = useAuth()
  const canView = canApproveScans || canManageShiftClock || isSuperAdmin
  const canEdit = canApproveScans || isSuperAdmin

  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState('all')
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState(null)
  const [previews, setPreviews] = useState({})
  const [lightbox, setLightbox] = useState(null)

  useBodyScrollLock(Boolean(selected))

  const siteIds = useMemo(() => sites.map((s) => s.id), [sites])

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

  const loadReports = async () => {
    if (!siteIds.length) {
      setReports([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const rows =
        selectedSite === 'all'
          ? await fetchIncidentReportsForSites(siteIds)
          : await fetchIncidentReportsForSite(selectedSite)
      setReports(rows)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to load reports' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user || !canView) return

    const role = isSuperAdmin ? 'super_admin' : 'admin'
    fetchSitesForAdmin(user.id, role).then((siteList) => {
      setSites(siteList)
    })
  }, [user?.id, canView, isSuperAdmin])

  useEffect(() => {
    if (!canView || !siteIds.length) return
    loadReports()
  }, [selectedSite, siteIds.join(',')])

  const openReport = (report) => {
    setSelected(report)
    setEditing(false)
    setEditText(report.description)
    setMessage(null)
  }

  const closeReport = () => {
    setSelected(null)
    setEditing(false)
    setMessage(null)
  }

  const handleSave = async () => {
    if (!selected || !canEdit) return

    setSaving(true)
    setMessage(null)
    try {
      await updateIncidentReportDescription(selected.id, editText)
      const updated = { ...selected, description: editText.trim() }
      setSelected(updated)
      setReports((prev) => prev.map((r) => (r.id === selected.id ? updated : r)))
      setEditing(false)
      setMessage({ type: 'success', text: 'Report updated. Clients will see the corrected text.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not save' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected || !canEdit) return
    if (!window.confirm('Delete this incident report? Clients will no longer see it.')) return

    setDeleting(true)
    setMessage(null)
    try {
      await deleteIncidentReport(selected.id, selected)
      setReports((prev) => prev.filter((r) => r.id !== selected.id))
      closeReport()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not delete' })
    } finally {
      setDeleting(false)
    }
  }

  if (!canView) {
    // Access flags resolve async (DB checks) — don't bounce until they land.
    if (privilegesLoading) {
      return (
        <Layout>
          <div className="flex justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
          </div>
        </Layout>
      )
    }
    return <Navigate to="/admin" replace />
  }

  return (
    <Layout>
      <PageHeader
        title="Incident reports"
        description={
          canEdit
            ? 'Review guard site reports. You can edit or remove reports before clients see mistakes.'
            : 'Review guard site reports submitted from the field.'
        }
      />

      <div className="mb-6 sp-card p-4">
        <label className="sp-label" htmlFor="incident-site">
          Site
        </label>
        <select
          id="incident-site"
          className="sp-input mt-1.5 max-w-md"
          value={selectedSite}
          onChange={(e) => setSelectedSite(e.target.value)}
        >
          <option value="all">All sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-surface p-10 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-ink-3" />
          <p className="mt-3 font-medium text-ink-2">No incident reports</p>
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
                  </div>
                  <p className="mt-0.5 text-sm text-ink-2">
                    {report.site?.name || 'Site'} · {formatIncidentReportTime(report.created_at)}
                  </p>
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
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
          onClick={closeReport}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-white/5 px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-semibold">{selected.guard?.name || 'Guard'}</h2>
                <p className="text-sm text-ink-2">
                  {selected.site?.name || 'Site'} · {formatIncidentReportTime(selected.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReport}
                className="rounded-lg p-1 text-ink-3 hover:bg-white/10 hover:text-ink-2"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">Report</p>
                  {canEdit && !editing && (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-accent-cyan-line hover:text-accent-cyan-line"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit text
                    </button>
                  )}
                </div>
                {editing ? (
                  <>
                    <textarea
                      className="sp-input mt-2 w-full"
                      rows={6}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      maxLength={5000}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || editText.trim().length < 10}
                        className="sp-btn-primary inline-flex items-center gap-1.5 py-2 text-sm"
                      >
                        <Save className="h-4 w-4" />
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(false)
                          setEditText(selected.description)
                        }}
                        className="sp-btn-secondary py-2 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    {selected.description}
                  </p>
                )}
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

              {message && (
                <p className={`text-sm ${message.type === 'success' ? 'text-accent-green' : 'text-accent-red'}`}>
                  {message.text}
                </p>
              )}

              {canEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-red hover:text-accent-red"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? 'Deleting…' : 'Delete report'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </Layout>
  )
}
