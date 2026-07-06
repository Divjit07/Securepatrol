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
import { fetchSitesForAdmin } from '../lib/scans.js'
import IncidentReportAttachments from '../components/IncidentReportAttachments.jsx'
import {
  deleteIncidentReport,
  fetchIncidentReportsForSite,
  fetchIncidentReportsForSites,
  formatIncidentReportTime,
  incidentAttachmentCount,
  updateIncidentReportDescription,
} from '../lib/incidentReports.js'

function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export default function AdminIncidents() {
  const { user, isSuperAdmin, canApproveScans, canManageShiftClock } = useAuth()
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

  const siteIds = useMemo(() => sites.map((s) => s.id), [sites])

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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium text-slate-700">No incident reports</p>
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
                  <p className="mt-0.5 text-sm text-slate-500">
                    {report.site?.name || 'Site'} · {formatIncidentReportTime(report.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {incidentAttachmentCount(report) > 0 && (
                    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                      {incidentAttachmentCount(report)} file{incidentAttachmentCount(report) === 1 ? '' : 's'}
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
                <p className="text-sm text-slate-500">
                  {selected.site?.name || 'Site'} · {formatIncidentReportTime(selected.created_at)}
                </p>
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
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report</p>
                  {canEdit && !editing && (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
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
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                    {selected.description}
                  </p>
                )}
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

              {message && (
                <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {message.text}
                </p>
              )}

              {canEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? 'Deleting…' : 'Delete report'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
