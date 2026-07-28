/**
 * Magic UI–style shiny CTA — white pill with sweeping light.
 */
export default function ShinyButton({
  children,
  className = '',
  disabled = false,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`kratos-shiny-btn ${className}`}
      {...props}
    >
      <span className="kratos-shiny-btn-label">{children}</span>
      <span className="kratos-shiny-btn-sheen" aria-hidden />
    </button>
  )
}
