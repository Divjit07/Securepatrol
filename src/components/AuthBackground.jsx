import { useEffect, useRef, useState } from 'react'

const POSTER = '/kratos-login-bg.jpg'
const POSTER_MOBILE = '/kratos-login-bg-mobile.jpg'
const VIDEO_MP4 = '/kratos-login-bg.mp4'

/**
 * Desktop gets the looping video (heavy). Phones, slow/data-saver connections,
 * and reduced-motion users get a lightweight Ken Burns still — the mp4 is
 * never requested there.
 */
function allowVideo() {
  if (typeof window === 'undefined') return false
  if (navigator.connection?.saveData) return false
  if (!window.matchMedia('(min-width: 1024px)').matches) return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return true
}

export default function AuthBackground() {
  const videoRef = useRef(null)
  const [withVideo] = useState(allowVideo)
  const [mode, setMode] = useState(() => (allowVideo() ? 'video' : 'image'))

  useEffect(() => {
    if (!withVideo) return undefined
    const video = videoRef.current
    if (!video) return undefined

    const tryPlay = async () => {
      try {
        await video.play()
        setMode('video')
      } catch {
        setMode('image')
      }
    }

    tryPlay()
    return undefined
  }, [withVideo])

  return (
    <div className="kratos-auth-bg-stage" aria-hidden>
      {withVideo && (
        <video
          ref={videoRef}
          className={`kratos-auth-bg ${mode === 'video' ? 'kratos-auth-bg--live' : 'kratos-auth-bg--hidden'}`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={POSTER}
          onError={() => setMode('image')}
          onLoadedData={() => setMode('video')}
        >
          <source src={VIDEO_MP4} type="video/mp4" />
        </video>
      )}

      <img
        src={POSTER}
        srcSet={`${POSTER_MOBILE} 828w, ${POSTER} 1920w`}
        sizes="100vw"
        alt=""
        decoding="async"
        className={`kratos-auth-bg kratos-auth-bg--animate ${mode === 'video' ? 'kratos-auth-bg--hidden' : ''}`}
        fetchPriority="high"
      />
    </div>
  )
}
