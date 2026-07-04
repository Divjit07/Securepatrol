import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, CheckCircle2, Loader2, MapPin, Send } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { getBestPosition } from '../lib/gps.js'
import {
  submitIncidentReport,
  uploadIncidentPhoto,
  validateIncidentPhoto,
} from '../lib/incidentReports.js'

export default function GuardIncidentReport() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      setPhoto(null)
      setPhotoPreview(null)
      return
    }

    try {
      validateIncidentPhoto(file)
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
      setMessage(null)
    } catch (err) {
      setPhoto(null)
      setPhotoPreview(null)
      setMessage({ type: 'error', text: err.message })
      event.target.value = ''
    }
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

      let photoPath = null
      if (photo) {
        photoPath = await uploadIncidentPhoto(user.id, photo)
      }

      const result = await submitIncidentReport({
        description: trimmed,
        photoPath,
        guardLat,
        guardLng,
      })

      setMessage({
        type: 'success',
        text: result.message || 'Report sent to admin.',
      })
      setDescription('')
      setPhoto(null)
      setPhotoPreview(null)

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
        description={`Report an issue at ${profile?.sites?.name || 'your site'}. Admin receives this by email at admin@prodsec.ca.`}
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
          <label htmlFor="incident-photo" className="sp-label">
            Photo (optional)
          </label>
          <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="sp-btn-secondary inline-flex cursor-pointer items-center gap-2">
              <Camera className="h-4 w-4" />
              {photo ? 'Change photo' : 'Attach photo'}
              <input
                id="incident-photo"
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={handlePhotoChange}
              />
            </label>
            {photo && (
              <span className="text-sm text-slate-600">
                {photo.name} ({Math.round(photo.size / 1024)} KB)
              </span>
            )}
          </div>
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Incident preview"
              className="mt-3 max-h-48 rounded-lg border border-slate-200 object-cover"
            />
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
