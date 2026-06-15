import { Link, useLocation, Navigate } from 'react-router-dom'
import { CheckCircle2, XCircle, WifiOff } from 'lucide-react'
import Layout from '../components/Layout.jsx'

export default function ScanResult() {
  const { state } = useLocation()

  if (!state) {
    return <Navigate to="/guard/scan" replace />
  }

  const { passed, checkpointName, distance, scannedAt, offline, radius, failureMessage } = state

  return (
    <Layout variant="guard">
      <div className="mx-auto max-w-md text-center">
        {passed ? (
          <CheckCircle2 className="mx-auto h-24 w-24 text-green-500" />
        ) : (
          <XCircle className="mx-auto h-24 w-24 text-red-500" />
        )}

        <h1 className={`mt-6 text-2xl font-bold ${passed ? 'text-green-700' : 'text-red-700'}`}>
          {passed ? 'Scan Verified' : 'Too Far From Checkpoint'}
        </h1>

        <p className="mt-2 text-lg font-medium text-slate-800">{checkpointName}</p>

        <div className="mt-6 space-y-2 rounded-xl bg-white p-6 text-left shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-600">
            <span className="font-medium">Distance:</span> {distance?.toFixed?.(1) ?? distance}m
            {!passed && ` (max ${radius}m)`}
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-medium">Time:</span>{' '}
            {new Date(scannedAt).toLocaleString()}
          </p>
          {offline && (
            <p className="flex items-center gap-2 text-sm text-amber-700">
              <WifiOff className="h-4 w-4" />
              Saved offline — will sync when connected
            </p>
          )}
        </div>

        {!passed && (
          <p className="mt-4 text-sm text-slate-600">
            {failureMessage ||
              'Move closer to the checkpoint and try again. Failed attempts are logged for admin review.'}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <Link
            to="/guard/scan"
            className="rounded-lg bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Scan Another
          </Link>
          <Link
            to="/guard"
            className="rounded-lg border border-slate-300 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </Layout>
  )
}
