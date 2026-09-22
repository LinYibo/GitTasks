import { FileText, FolderOpen } from 'lucide-react'

import { useStore } from '../store.ts'
import { IconButton } from './IconButton.tsx'

/** Where the file lives, and the two ways out of the app to reach it. */
export function RepoBar() {
  const folderPath = useStore((state) => state.folderPath)
  const open = useStore((state) => state.open)
  const chooseFolder = useStore((state) => state.chooseFolder)

  return (
    <footer className="flex items-center justify-between gap-3 border-t border-border pt-4">
      <button
        type="button"
        title={folderPath ?? ''}
        onClick={() => void open('folder')}
        className="truncate text-xs text-muted transition-colors duration-150 hover:text-fg"
      >
        {folderName(folderPath ?? '')}
      </button>

      <div className="flex items-center gap-1">
        <IconButton label="Open tasks.md in your editor" onClick={() => void open('tasks')}>
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        </IconButton>

        <IconButton label="Change folder" onClick={() => void chooseFolder()}>
          <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
        </IconButton>
      </div>
    </footer>
  )
}

/** Last segment of a path, without needing node:path in the renderer. */
function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}
