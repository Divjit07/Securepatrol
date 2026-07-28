import { Component, lazy, Suspense, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { gsap } from 'gsap'
import { BRAND } from '../lib/brand.js'
import AuthBackground from './AuthBackground.jsx'
import ShineBorder from './auth/ShineBorder.jsx'
import Spotlight from './auth/Spotlight.jsx'
import DecryptedText from './auth/DecryptedText.jsx'

const HoloPedestal = lazy(() =>
  import('./auth/HoloPedestal.jsx').catch(() => ({
    default: () => null,
  })),
)

/** Isolates Three.js failures so auth still signs in. */
class PedestalGate extends Component {
  state = { ok: true }
  static getDerivedStateFromError() {
    return { ok: false }
  }
  componentDidCatch() {}
  render() {
    return this.state.ok ? this.props.children : null
  }
}

function prefersReduced() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/** Dark Ops auth shell — Holo Command Gate (mascot + 3D pedestal + shine card). */
export default function AuthShell({ children, mode = 'signin' }) {
  const rootRef = useRef(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || prefersReduced()) return undefined
    const ctx = gsap.context(() => {
      gsap.from('[data-auth-reveal]', {
        opacity: 0,
        y: 22,
        filter: 'blur(8px)',
        duration: 0.7,
        stagger: 0.1,
        ease: 'power3.out',
        clearProps: 'filter',
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div className="kratos-auth" ref={rootRef}>
      <AuthBackground />
      <Spotlight />

      <div className="kratos-auth-layout">
        <section className="kratos-auth-hero-panel" data-auth-reveal>
          <div className="kratos-auth-brand">
            <span className="kratos-auth-brand-mark" aria-hidden>
              <Shield className="h-6 w-6" strokeWidth={2} fill="currentColor" fillOpacity={0.15} />
            </span>
            <p className="kratos-auth-brand-name">{BRAND.nameUpper}</p>
          </div>

          <DecryptedText text={BRAND.heroLine} className="kratos-auth-headline" />
          <p className="kratos-auth-lead">{BRAND.tagline}</p>
          <p className="kratos-auth-copy">{BRAND.heroSub}</p>
        </section>

        <div className="kratos-auth-mascot" aria-hidden data-auth-reveal>
          <div className="kratos-auth-mascot-glow" />
          <PedestalGate>
            <Suspense fallback={null}>
              <HoloPedestal />
            </Suspense>
          </PedestalGate>
          <img
            src="/brand/kratos-guard-mascot.png"
            alt=""
            className="kratos-auth-mascot-img"
            draggable={false}
          />
        </div>

        <aside className="kratos-auth-aside" data-auth-reveal>
          <ShineBorder className="w-full max-w-[24rem] sm:max-w-[26rem]" duration={9}>
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
          </ShineBorder>
        </aside>
      </div>

      <p className="kratos-auth-copyright">Copyrighted by Divjit Singh Dhatt</p>
    </div>
  )
}
