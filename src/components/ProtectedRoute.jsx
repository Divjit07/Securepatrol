import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export default function ProtectedRoute({ children, requireAdmin, requireGuard }) {
  const { user, profile, loading, isAdmin, isGuard } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/guard" replace />
  }

  if (requireGuard && !isGuard) {
    return <Navigate to="/admin" replace />
  }

  if (!profile?.active && profile?.role !== 'super_admin') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold text-red-600">Account Inactive</h1>
          <p className="mt-2 text-slate-600">Contact your administrator to reactivate your account.</p>
        </div>
      </div>
    )
  }

  return children
}
