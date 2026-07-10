import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

function homePath({ isAdmin, isClient, isGuard }) {
  if (isAdmin) return '/admin'
  if (isClient) return '/client'
  if (isGuard) return '/guard'
  return '/login'
}

export default function ProtectedRoute({ children, requireAdmin, requireGuard, requireClient }) {
  const { user, profile, loading, isAdmin, isGuard, isClient } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const fallback = homePath({ isAdmin, isClient, isGuard })

  if (requireAdmin && !isAdmin) {
    return <Navigate to={fallback} replace />
  }

  if (requireGuard && !isGuard) {
    return <Navigate to={fallback} replace />
  }

  if (requireClient && !isClient) {
    return <Navigate to={fallback} replace />
  }

  if (!profile?.active && profile?.role !== 'super_admin') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold text-accent-red">Account Inactive</h1>
          <p className="mt-2 text-ink-2">Contact your administrator to reactivate your account.</p>
        </div>
      </div>
    )
  }

  return children
}
