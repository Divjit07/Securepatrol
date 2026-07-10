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
      const result = await submitScanWithGps(checkpointId, user.id, { scanInputMethod: mode })

      navigate('/guard/scan/result', {
        state: {
          passed: result.status === 'pass',
          checkpointName: result.checkpoint?.name || 'Checkpoint',
          distance: result.distance_metres,
          scannedAt: result.scanned_at,
          offline: result.offline,
          serverValidated: result.serverValidated,
          radius: result.checkpoint?.radius_metres ?? 20,
          failureMessage: result.failureMessage,
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
        <p className="mt-1 flex items-center gap-1 text-sm text-ink-2">
          <MapPin className="h-4 w-4" />
          {mode === 'nfc'
            ? 'NFC tap verifies the visit — GPS logged when available'
            : 'GPS will be captured at scan time'}
        </p>
      </div>

      {isIOS() && (
        <div className="mb-4 rounded-xl border border-accent-cyan-line/30 bg-accent-cyan/10 px-4 py-3 text-sm text-ink">
          <strong className="text-accent-cyan-line">iPhone:</strong> Use <strong>QR Code</strong> to scan checkpoints. Apple does not allow NFC scanning in web apps — only Android supports tap-to-scan.
        </div>
      )}

      <div className="mb-4 flex rounded-xl border border-white/10 bg-white/5 p-1">
        {['nfc', 'qr'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              mode === m ? 'bg-white text-black' : 'text-ink-2 hover:bg-white/10'
            }`}
          >
            {m === 'nfc' ? 'NFC Tag' : 'QR Code'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-accent-red/15 p-4 text-sm text-accent-red">{error}</div>
      )}

      {processing ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-surface py-16">
          <Loader2 className="h-10 w-10 animate-spin text-accent-cyan-line" />
          <p className="mt-4 font-medium">
            {mode === 'nfc' ? 'Recording NFC scan…' : 'Getting GPS fix (hold still)…'}
          </p>
        </div>
      ) : mode === 'nfc' ? (
        <NFCScanner onScan={handleScan} disabled={processing} />
      ) : (
        <QRScanner onScan={handleScan} disabled={processing} />
      )}
    </Layout>
  )
}
