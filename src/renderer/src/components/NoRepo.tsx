import { FolderOpen } from 'lucide-react'

import { useStore } from '../store.ts'

export function NoRepo() {
  const chooseRepo = useStore((state) => state.chooseRepo)

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/50 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-elevated text-muted">
        <FolderOpen className="h-5 w-5" aria-hidden="true" />
      </div>

      <p className="text-base font-medium text-fg">No folder yet</p>
      <p className="max-w-xs text-sm text-muted">
        Choose a folder for your tasks. GitTasks will create tasks.md in it, and a git repository
        too if there isn&rsquo;t one already.
      </p>

      <button
        type="button"
        onClick={() => void chooseRepo()}
        className="mt-1 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg transition-transform duration-150 hover:bg-primary/90 active:scale-[0.98]"
      >
        Choose a folder
      </button>
    </div>
  )
}
