import { createPortal } from 'react-dom'

/**
 * Viewport-locked overlay. Portals to document.body so it isn't clipped by
 * Layout's .animate-rise transform (which creates a fixed containing block).
 */
export default function ViewportModal({ children, onClose, labelledBy }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="animate-rise relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-surface shadow-2xl shadow-black/60"
        style={{ maxHeight: 'calc(100dvh - 1.5rem)' }}
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
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/8 px-6 py-4">
      {children}
    </div>
  )
}

export function ModalBody({ children }) {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-5">
      {children}
    </div>
  )
}
