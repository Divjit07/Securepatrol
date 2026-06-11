import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Shield, MapPin, Radio } from 'lucide-react'
import Logo from '../components/Logo.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { isSupabaseConfigured } from '../lib/supabase.js'

const features = [
  { icon: Shield, text: 'NFC checkpoint verification' },
  { icon: MapPin, text: 'GPS-validated patrol proof' },
  { icon: Radio, text: 'Live compliance dashboard' },
]

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
    <div className="flex min-h-dvh">
      {/* Brand panel */}
      <div className="relative hidden w-[48%] overflow-hidden bg-navy-900 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(59,107,219,0.15)_0%,_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(212,175,55,0.08)_0%,_transparent_45%)]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-12 py-16">
          <Logo size="hero" showText={false} framed variant="light" />
          <h1 className="mt-10 text-center font-display text-4xl font-bold tracking-tight text-white">
            SecurePatrol
          </h1>
          <p className="mt-2 text-center text-sm font-medium uppercase tracking-[0.2em] text-gold-400">
            Productive Security Inc.
          </p>
          <p className="mt-6 max-w-sm text-center text-base leading-relaxed text-slate-400">
            Enterprise guard tour verification with real-time compliance monitoring and audit-ready reporting.
          </p>

          <ul className="mt-12 w-full max-w-sm space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                  <Icon className="h-4 w-4 text-gold-400" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 px-12 py-8 text-xs text-slate-600">
          © {new Date().getFullYear()} Productive Security Inc. · Confidential
        </p>
      </div>

      {/* Login panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-slate-100 px-6 py-12 sm:px-10">
        <div className="mb-8 lg:hidden">
          <Logo size="xl" showText framed />
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500">
              Sign in to your command center or guard patrol app.
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Add Supabase credentials to <code className="rounded bg-amber-100 px-1">.env.local</code></span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="sp-card-elevated p-8 sm:p-10">
            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="sp-label">Email address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="sp-input"
                />
              </div>
              <div>
                <label htmlFor="password" className="sp-label">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="sp-input"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="sp-btn-primary mt-8 w-full py-3.5">
              {loading ? 'Authenticating…' : 'Sign in to SecurePatrol'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Authorized personnel only · All patrol activity is logged
          </p>
        </div>
      </div>
    </div>
  )
}
