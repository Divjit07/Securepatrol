const POSTER = '/kratos-login-bg.jpg'
const POSTER_MOBILE = '/kratos-login-bg-mobile.jpg'

/**
 * Static sketch artwork background — image only. Phones get a 125KB JPEG,
 * desktops a 560KB one. The slow Ken Burns drift is pure CSS transform
 * (GPU-cheap) and disabled for reduced-motion users.
 */
export default function AuthBackground() {
  return (
    <div className="kratos-auth-bg-stage" aria-hidden>
      <picture>
        <source media="(max-width: 1023px)" srcSet={POSTER_MOBILE} />
        <img
          src={POSTER}
          alt=""
          width="1920"
          height="1080"
          decoding="async"
          fetchPriority="high"
          className="kratos-auth-bg kratos-auth-bg--animate"
        />
      </picture>
    </div>
  )
}
