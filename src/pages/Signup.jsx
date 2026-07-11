import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import AuthShell from '../components/AuthShell.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { BRAND } from '../lib/brand.js'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const result = await signUp(email, password, name)
      if (result.needsEmailConfirmation) {
        setSuccess(
          'Account created. Confirm your email if prompted, install Kratos to your home screen, then sign in once an admin assigns your site.',
        )
        return
      }
      navigate('/guard')
    } catch (err) {
      setError(err.message || 'Could not create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell mode="signup">
      <header className="mb-6">
        <h2 className="kratos-auth-card-title">Create account</h2>
        <p className="kratos-auth-card-sub">
          Enlist on {BRAND.name} — your admin assigns sites after approval.
        </p>
      </header>

      {!isSupabaseConfigured && (
        <div className="kratos-auth-alert mb-5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Add Supabase credentials to <code className="rounded bg-black/20 px-1">.env.local</code>
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="kratos-auth-error">{error}</div>}
        {success && (
          <div className="kratos-auth-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        <div>
          <label htmlFor="name" className="kratos-auth-label">
            Full name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Your name"
            className="kratos-auth-input"
          />
        </div>

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
            placeholder="Enter your email"
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
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="kratos-auth-input"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="kratos-auth-label">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="Repeat password"
            className="kratos-auth-input"
          />
        </div>

        <button type="submit" disabled={loading || Boolean(success)} className="kratos-auth-submit">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}
