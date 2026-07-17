import { useState } from 'react'
import { isIOS, supportsWebNfc } from '../lib/device.js'
import { useNavigate } from 'react-router-dom'
import { Loader2, MapPin, ScanFace } from 'lucide-react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import NFCScanner from '../components/NFCScanner.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { submitScanWithGps } from '../lib/offlineQueue.js'

// Checkpoints are physical NFC tags — QR scanning was retired (labels took up
// wall space and QR was already blocked for clock punches). NFC tap only.
export default function ScanScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

  const handleScan = async (checkpointId, nfcSerial = null) => {
    if (!user || processing) return
    setProcessing(true)
    setError(null)

    try {
      const result = await submitScanWithGps(checkpointId, user.id, { scanInputMethod: 'nfc', nfcSerial })

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
          NFC tap verifies the visit — GPS logged when available
        </p>
      </div>

      {!supportsWebNfc() && (
        <div className="mb-4 rounded-xl border border-accent-cyan-line/30 bg-accent-cyan/10 px-4 py-3 text-sm text-ink">
          {isIOS() ? (
            <>
              <strong className="text-accent-cyan-line">iPhone:</strong> Apple doesn’t allow NFC
              scanning in web apps yet — checkpoint taps need an Android phone until the native app
              ships. You can still{' '}
              <Link to="/guard" className="font-semibold text-accent-cyan-line underline underline-offset-2">
                clock in with Face ID
              </Link>{' '}
              from the dashboard.
            </>
          ) : (
            <>This browser can’t read NFC tags. Use Chrome on Android to scan checkpoints.</>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-accent-red/15 p-4 text-sm text-accent-red">{error}</div>
      )}

      {processing ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-surface py-16">
          <Loader2 className="h-10 w-10 animate-spin text-accent-cyan-line" />
          <p className="mt-4 font-medium">Recording NFC scan…</p>
        </div>
      ) : (
        <NFCScanner onScan={handleScan} disabled={processing} />
      )}

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-3">
        <ScanFace className="h-3.5 w-3.5" />
        Clock in/out lives on your dashboard — Face ID, or tap the clock NFC tag here.
      </p>
    </Layout>
  )
}
