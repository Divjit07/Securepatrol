import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, FileUp, Loader2, MapPin, Send, X } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { getBestPosition } from '../lib/gps.js'
import {
  MAX_INCIDENT_ATTACHMENTS,
  formatFileSize,
  submitIncidentReport,
  uploadIncidentAttachments,
  validateIncidentAttachment,
} from '../lib/incidentReports.js'

export default function GuardIncidentReport() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)

  const addFiles = (incoming) => {
    const selected = [...incoming]
    if (!selected.length) return

    try {
      const next = [...files]
      for (const file of selected) {
        if (next.length >= MAX_INCIDENT_ATTACHMENTS) {
          throw new Error(`You can attach up to ${MAX_INCIDENT_ATTACHMENTS} files`)
        }
        validateIncidentAttachment(file)
        if (next.some((f) => f.name === file.name && f.size === file.size)) continue
        next.push(file)
      }
      setFiles(next)
      setMessage(null)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!user || submitting) return

    const trimmed = description.trim()
    if (trimmed.length < 10) {
      setMessage({ type: 'error', text: 'Please write at least 10 characters about the incident.' })
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      let guardLat = null
      let guardLng = null

      try {
        const position = await getBestPosition(2)
        guardLat = position.lat
        guardLng = position.lng
      } catch {
        // GPS is helpful but optional for incident reports
      }

      const attachments = files.length ? await uploadIncidentAttachments(user.id, files) : []

      const result = await submitIncidentReport({
        description: trimmed,
        attachments,
        guardLat,
        guardLng,
      })

      setMessage({
        type: 'success',
        text: result.message || 'Report sent to admin.',
      })
      setDescription('')
      setFiles([])

      setTimeout(() => navigate('/guard'), 2000)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not send report. Try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout variant="guard">
      <PageHeader
        title="Site incident report"
        description={`Report an issue at ${profile?.sites?.name || 'your site'}. Attach photos, PDF, or DOCX (up to ${MAX_INCIDENT_ATTACHMENTS} files).`}
      />

      <form onSubmit={handleSubmit} className="sp-card mx-auto max-w-2xl space-y-5 p-6">
        <div>
          <label htmlFor="incident-description" className="sp-label">
            What happened?
          </label>
          <textarea
            id="incident-description"
            className="sp-input mt-1.5 w-full"
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the incident, location on site, people involved, and any action taken…"
            required
            minLength={10}
            maxLength={5000}
          />
          <p className="mt-1 text-xs text-slate-500">{description.trim().length}/5000 characters</p>
        </div>

        <div>
          <label htmlFor="incident-files" className="sp-label">
            Attachments (optional)
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Photos, PDF, or DOCX · up to {MAX_INCIDENT_ATTACHMENTS} files · 10 MB each
          </p>
          <div className="mt-2">
            <label className="sp-btn-secondary inline-flex cursor-pointer items-center gap-2">
              <FileUp className="h-4 w-4" />
              Add files
              <input
                id="incident-files"
                type="file"
                multiple
                accept="image/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files || [])
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium text-slate-800">{file.name}</span>
                  <span className="shrink-0 text-slate-500">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-white hover:text-red-600"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5" />
          Your location is included when GPS is available.
        </p>

        {message && (
          <p
            className={`flex items-center gap-2 text-sm ${
              message.type === 'success' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {message.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {message.text}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting || description.trim().length < 10}
            className="sp-btn-primary inline-flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send report to admin
              </>
            )}
          </button>
          <Link to="/guard" className="sp-btn-secondary inline-flex items-center">
            Cancel
          </Link>
        </div>
      </form>
    </Layout>
  )
}
