import { Link, useLocation, Navigate } from 'react-router-dom'
import { CheckCircle2, XCircle, WifiOff } from 'lucide-react'
import Layout from '../components/Layout.jsx'

export default function ScanResult() {
  const { state } = useLocation()

  if (!state) {
    return <Navigate to="/guard/scan" replace />
  }

  const { passed, checkpointName, distance, scannedAt, offline, radius, failureMessage } = state

  const isWrongFloor = !passed && failureMessage?.startsWith('Wrong floor detected')
  const heading = passed
    ? 'Scan Verified'
    : isWrongFloor
      ? 'Wrong Floor Detected'
      : 'Too Far From Checkpoint'

  return (
    <Layout variant="guard">
      <div className="mx-auto max-w-md text-center">
        {passed ? (
          <CheckCircle2 className="mx-auto h-24 w-24 text-accent-orange" />
        ) : (
          <XCircle className="mx-auto h-24 w-24 text-accent-red" />
        )}

        <h1 className={`mt-6 text-2xl font-bold ${passed ? 'text-accent-orange' : 'text-accent-red'}`}>
          {heading}
        </h1>

        <p className="mt-2 text-lg font-medium text-ink">{checkpointName}</p>

        <div className="mt-6 space-y-2 rounded-xl border border-white/10 bg-surface p-6 text-left">
          <p className="text-sm text-ink-2">
            <span className="font-medium">Distance:</span> {distance?.toFixed?.(1) ?? distance}m
            {!passed && ` (max ${radius}m)`}
          </p>
          <p className="text-sm text-ink-2">
            <span className="font-medium">Time:</span>{' '}
            {new Date(scannedAt).toLocaleString()}
          </p>
          {offline && (
            <p className="flex items-center gap-2 text-sm text-accent-orange">
              <WifiOff className="h-4 w-4" />
              Saved offline — will sync when connected
            </p>
          )}
        </div>

        {!passed && (
          <p className="mt-4 text-sm text-ink-2">
            {failureMessage ||
              'Move closer to the checkpoint and try again. Failed attempts are logged for admin review.'}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <Link to="/guard/scan" className="dk-cta w-full py-3">
            Scan Another
          </Link>
          <Link to="/guard" className="dk-btn-2 w-full py-3">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </Layout>
  )
}
