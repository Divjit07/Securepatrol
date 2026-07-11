import { createPortal } from 'react-dom'

/**
 * Viewport-locked overlay. Portals to document.body so it isn't clipped by
 * Layout's .animate-rise transform (which creates a fixed containing block).
 */
export default function ViewportModal({ children, onClose, labelledBy }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/55"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-xl"
        style={{ maxHeight: 'calc(100dvh - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function ModalHeader({ children }) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
      {children}
    </div>
  )
}

export function ModalBody({ children }) {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
      {children}
    </div>
  )
}
