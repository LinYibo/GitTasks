import { CloudOff } from 'lucide-react'

export function GitMissing() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/50 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-elevated text-danger">
        <CloudOff className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-base font-medium text-fg">Git was not found</p>
      <p className="max-w-xs text-sm text-muted">
        GitTasks keeps your tasks in a git repository, so it needs Git installed and on your PATH.
        Install Git, then restart GitTasks.
      </p>
    </div>
  )
}
