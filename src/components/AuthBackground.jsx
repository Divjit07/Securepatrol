/**
 * Dark Ops login backdrop — charcoal canvas, soft lime aura, subtle hatch.
 * No images/video; instant on any connection.
 */
export default function AuthBackground() {
  return (
    <div className="kratos-auth-bg-stage" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(90% 70% at 78% 12%, rgba(150, 238, 96, 0.12) 0%, transparent 52%),' +
            'radial-gradient(70% 55% at 8% 88%, rgba(127, 208, 159, 0.08) 0%, transparent 48%),' +
            'linear-gradient(165deg, #1c1f1a 0%, #151814 48%, #121512 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.28]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 10px)',
        }}
      />
    </div>
  )
}
