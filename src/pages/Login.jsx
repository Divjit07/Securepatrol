import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import Logo from '../components/Logo.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { isSupabaseConfigured } from '../lib/supabase.js'

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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="h-20" showText={false} />
          <h1 className="mt-4 text-3xl font-bold text-white">SecurePatrol</h1>
          <p className="mt-1 text-sm text-slate-400">Productive Security Inc.</p>
          <p className="mt-2 text-slate-300">NFC guard tour verification</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-500/20 p-3 text-sm text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Add Supabase credentials to <code className="text-amber-100">.env.local</code> to connect.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">Sign in</h2>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
