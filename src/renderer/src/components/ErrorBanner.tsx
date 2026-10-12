import { TriangleAlert, X } from 'lucide-react'

import { useStore } from '../store.ts'

/**
 * A floating banner, so an error is visible on the connect screen as well as
 * over the task list.
 */
export function ErrorBanner() {
  const error = useStore((state) => state.error)
  const dismissError = useStore((state) => state.dismissError)

  if (!error) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        role="alert"
        className="pointer-events-auto flex max-w-xl items-start gap-2.5 rounded-lg border border-danger/40 bg-danger-soft px-3 py-2.5 shadow-lg"
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
    </div>
  )
}
