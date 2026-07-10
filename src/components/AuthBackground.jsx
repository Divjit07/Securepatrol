import { useEffect, useRef, useState } from 'react'

const POSTER = '/kratos-login-bg.png'
const VIDEO_MP4 = '/kratos-login-bg.mp4'

/** Looping login background video with poster + Ken Burns fallback. */
export default function AuthBackground() {
  const videoRef = useRef(null)
  const [mode, setMode] = useState('video') // video | image

  useEffect(() => {
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
  }, [])

  return (
    <div className="kratos-auth-bg-stage" aria-hidden>
      <video
        ref={videoRef}
        className={`kratos-auth-bg ${mode === 'video' ? 'kratos-auth-bg--live' : 'kratos-auth-bg--hidden'}`}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={POSTER}
        onError={() => setMode('image')}
        onLoadedData={() => setMode('video')}
      >
        <source src={VIDEO_MP4} type="video/mp4" />
      </video>

      <img
        src={POSTER}
        alt=""
        className={`kratos-auth-bg kratos-auth-bg--animate ${mode === 'video' ? 'kratos-auth-bg--hidden' : ''}`}
        fetchPriority="high"
      />
    </div>
  )
}
