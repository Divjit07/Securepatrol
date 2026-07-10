import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import AuthShell from '../components/AuthShell.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { BRAND } from '../lib/brand.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { profile } = await signIn(email, password)
      if (profile?.role === 'guard') {
        navigate('/guard')
      } else if (profile?.role === 'client') {
        navigate('/client')
      } else if (profile?.role === 'admin' || profile?.role === 'super_admin') {
        navigate('/admin')
      } else {
        navigate('/guard')
      }
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell mode="signin">
      <h2 className="kratos-auth-card-title">Secure sign-in</h2>
      <p className="kratos-auth-card-sub">
        Organization credentials for guards, clients, and operations
      </p>

      {!isSupabaseConfigured && (
        <div className="kratos-auth-alert mb-5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Add Supabase credentials to <code className="rounded bg-black/10 px-1">.env.local</code>
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="kratos-auth-error">{error}</div>}

        <div>
          <label htmlFor="email" className="kratos-auth-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="name@organization.com"
            className="kratos-auth-input"
          />
        </div>

        <div>
          <label htmlFor="password" className="kratos-auth-label">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="kratos-auth-input"
          />
        </div>

        <button type="submit" disabled={loading} className="kratos-auth-submit">
          {loading ? 'Signing in…' : 'Enter'}
        </button>
      </form>

      <p className="kratos-auth-footnote mt-6">
        Unauthorized access is prohibited · {BRAND.name} logs all activity
      </p>
    </AuthShell>
  )
}
