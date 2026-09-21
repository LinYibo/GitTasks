import { CloudUpload, Download, FileText, FolderOpen, GitBranch } from 'lucide-react'

import type { RepoStatus } from '../../../shared/types.ts'
import { useStore } from '../store.ts'
import { IconButton } from './IconButton.tsx'

export function SyncStatus() {
  const status = useStore((state) => state.status)
  const repoPath = useStore((state) => state.repoPath)
  const sync = useStore((state) => state.sync)
  const open = useStore((state) => state.open)
  const chooseRepo = useStore((state) => state.chooseRepo)

  return (
    <footer className="flex flex-col gap-2 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />

          <button
            type="button"
            title={repoPath ?? ''}
            onClick={() => void open('folder')}
            className="truncate text-xs text-muted transition-colors duration-150 hover:text-fg"
          >
            {folderName(repoPath ?? '')}
          </button>

          <span className="text-xs text-subtle">·</span>
          <span className="whitespace-nowrap text-xs text-subtle">{describe(status)}</span>
        </div>

        <div className="flex items-center gap-1">
          <IconButton label="Open tasks.md in your editor" onClick={() => void open('tasks')}>
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          </IconButton>

          <IconButton label="Change folder" onClick={() => void chooseRepo()}>
            <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
          </IconButton>

          {status.hasRemote && (
            <>
              <IconButton label="Pull from remote" onClick={() => void sync('pull')}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              </IconButton>
              <IconButton label="Push to remote" onClick={() => void sync('push')}>
                <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
              </IconButton>
            </>
          )}
        </div>
      </div>

      {status.lastCommit && (
        <p className="truncate text-xs text-subtle">
          <span className="tabular-nums text-muted">{status.lastCommit.hash}</span>{' '}
          {status.lastCommit.subject}
        </p>
      )}
    </footer>
  )
}

function describe(status: RepoStatus): string {
  switch (status.phase) {
    case 'committing':
      return 'Committing…'
    case 'syncing':
      return 'Syncing…'
    case 'error':
      return 'Last commit failed'
    default:
      break
  }

  if (status.dirty) return 'Not committed yet'

  const pending: string[] = []
  if (status.ahead) pending.push(`${status.ahead} to push`)
  if (status.behind) pending.push(`${status.behind} to pull`)
  if (pending.length) return pending.join(', ')

  return status.lastCommit ? 'Everything committed' : 'No commits yet'
}

/** Last segment of a path, without needing node:path in the renderer. */
function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}
