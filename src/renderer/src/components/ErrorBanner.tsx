import { TriangleAlert, X } from 'lucide-react'

import { useStore } from '../store.ts'

export function ErrorBanner() {
  const error = useStore((state) => state.error)
  const dismissError = useStore((state) => state.dismissError)

  if (!error) return null

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger-soft px-3 py-2.5"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />

      <p className="flex-1 text-sm text-fg">{error.message}</p>

      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismissError}
        className="shrink-0 text-muted transition-colors duration-150 hover:text-fg"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
