import { useState } from 'react'
import { isIOS, preferredScanMode } from '../lib/device.js'
import { useNavigate } from 'react-router-dom'
import { Loader2, MapPin } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import NFCScanner from '../components/NFCScanner.jsx'
import QRScanner from '../components/QRScanner.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { submitScanWithGps } from '../lib/offlineQueue.js'

export default function ScanScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState(preferredScanMode)

  const handleScan = async (checkpointId) => {
    if (!user || processing) return
    setProcessing(true)
    setError(null)

    try {
      const result = await submitScanWithGps(checkpointId, user.id)

      navigate('/guard/scan/result', {
        state: {
          passed: result.status === 'pass',
          checkpointName: result.checkpoint?.name || 'Checkpoint',
          distance: result.distance_metres,
          scannedAt: result.scanned_at,
          offline: result.offline,
          serverValidated: result.serverValidated,
          radius: result.checkpoint?.radius_metres ?? 20,
        },
      })
    } catch (err) {
      setError(err.message || 'Scan failed')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Layout variant="guard">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Scan Checkpoint</h1>
        <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
          <MapPin className="h-4 w-4" />
          GPS will be captured at scan time
        </p>
      </div>

      {isIOS() && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <strong>iPhone:</strong> Use <strong>QR Code</strong> to scan checkpoints. Apple does not allow NFC scanning in web apps — only Android supports tap-to-scan.
        </div>
      )}

      <div className="mb-4 flex rounded-lg border border-slate-200 bg-white p-1">
        {['nfc', 'qr'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${
              mode === m ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {m === 'nfc' ? 'NFC Tag' : 'QR Code'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {processing ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
          <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
          <p className="mt-4 font-medium">Getting GPS & verifying…</p>
        </div>
      ) : mode === 'nfc' ? (
        <NFCScanner onScan={handleScan} disabled={processing} />
      ) : (
        <QRScanner onScan={handleScan} disabled={processing} />
      )}
    </Layout>
  )
}
