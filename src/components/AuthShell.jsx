import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { BRAND } from '../lib/brand.js'
import AuthBackground from './AuthBackground.jsx'

/** Dark Ops auth shell — brand hero, mascot, sign-in card (matches login art). */
export default function AuthShell({ children, mode = 'signin' }) {
  return (
    <div className="kratos-auth">
      <AuthBackground />

      <div className="kratos-auth-layout">
        <section className="kratos-auth-hero-panel">
          <div className="kratos-auth-brand">
            <span className="kratos-auth-brand-mark" aria-hidden>
              <Shield className="h-6 w-6" strokeWidth={2} fill="currentColor" fillOpacity={0.15} />
            </span>
            <p className="kratos-auth-brand-name">{BRAND.nameUpper}</p>
          </div>

          <h1 className="kratos-auth-headline">{BRAND.heroLine}</h1>
          <p className="kratos-auth-lead">{BRAND.tagline}</p>
          <p className="kratos-auth-copy">{BRAND.heroSub}</p>
        </section>

        <div className="kratos-auth-mascot" aria-hidden>
          <div className="kratos-auth-mascot-glow" />
          <img
            src="/brand/kratos-guard-mascot.png"
            alt=""
            className="kratos-auth-mascot-img"
            draggable={false}
          />
        </div>

        <aside className="kratos-auth-aside">
          <div className="kratos-auth-card">
            {children}
            <p className="kratos-auth-switch">
              {mode === 'signin' ? (
                <>
                  New to {BRAND.name}?{' '}
                  <Link to="/signup" className="kratos-auth-link">
                    Create an account
                  </Link>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <Link to="/login" className="kratos-auth-link">
                    Sign in
                  </Link>
                </>
              )}
            </p>
          </div>
        </aside>
      </div>

      <p className="kratos-auth-copyright">Copyrighted by Divjit Singh Dhatt</p>
    </div>
  )
}
