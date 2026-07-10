/**
 * Simple, zero-network login backdrop: deep charcoal gradient with a faint
 * lime aura. No images, no video — instant on any connection.
 */
export default function AuthBackground() {
  return (
    <div className="kratos-auth-bg-stage" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 85% 10%, rgba(150, 238, 96, 0.10) 0%, transparent 45%),' +
            'radial-gradient(100% 80% at 10% 95%, rgba(127, 208, 159, 0.07) 0%, transparent 50%),' +
            'linear-gradient(160deg, #14180f 0%, #0a0e09 55%, #090c0f 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 9px)',
        }}
      />
    </div>
  )
}
