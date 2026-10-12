import { ExternalLink, LogOut, RefreshCw } from 'lucide-react'

import { useStore } from '../store.ts'
import { IconButton } from './IconButton.tsx'

/** Which repo the tasks persist to, and the ways back out to GitHub. */
export function RepoBar() {
  const connection = useStore((state) => state.connection)
  const saving = useStore((state) => state.saving)
  const refresh = useStore((state) => state.refresh)
  const disconnect = useStore((state) => state.disconnect)

  if (!connection) return null

  const url = githubUrl(connection)

  return (
    <footer className="flex items-center justify-between gap-3 border-t border-border pt-4">
      <button
        type="button"
        title={url}
        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
        className="flex min-w-0 items-center gap-2 text-xs text-muted transition-colors duration-150 hover:text-fg"
      >
        {/* The dot doubles as the sync indicator: it holds still while idle
            and pulses while a mutation is on its way to GitHub. */}
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${saving ? 'animate-pulse bg-accent' : 'bg-subtle'}`}
        />
        <span className="truncate">
          {connection.owner}/{connection.repo} · {connection.branch}
          {saving && ' · saving…'}
        </span>
      </button>

      <div className="flex items-center gap-1">
        <IconButton label="Refresh from GitHub" onClick={() => void refresh()} disabled={saving}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        </IconButton>

        <IconButton
          label="Open tasks.md on GitHub"
          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </IconButton>

        <IconButton label="Disconnect this repo" onClick={() => void disconnect()}>
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        </IconButton>
      </div>
    </footer>
  )
}

function githubUrl(connection: { owner: string; repo: string; branch: string; path: string }): string {
  return `https://github.com/${connection.owner}/${connection.repo}/blob/${connection.branch}/${connection.path}`
}
