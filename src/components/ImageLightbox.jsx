import { Download, X, ZoomIn } from 'lucide-react'

export default function ImageLightbox({ src, alt, onClose, onDownload }) {
  if (!src) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Full size image"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="min-w-0 truncate text-sm font-medium">{alt || 'Photo'}</p>
        <div className="flex shrink-0 items-center gap-2">
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/20"
            >
              <Download className="h-4 w-4" />
              Save
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className="flex flex-1 items-center justify-center overflow-auto p-4"
        onClick={onClose}
      >
        <img
          src={src}
          alt={alt || 'Incident photo'}
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}

export function ImageThumbnail({ src, alt, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-left"
    >
      <img
        src={src}
        alt={alt}
        className="max-h-64 w-full object-contain sm:max-h-80"
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20 group-active:bg-black/30">
        <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
          <ZoomIn className="h-3.5 w-3.5" />
          View full size
        </span>
      </span>
    </button>
  )
}
