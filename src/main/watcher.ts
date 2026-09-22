/** Keeping the UI in step with edits made outside the app. */

import { watch } from 'node:fs'

import { TASKS_FILE } from './store.ts'

/** An atomic save arrives as a burst of events; wait for it to settle first. */
const SETTLE_MS = 120

/**
 * Watch the tasks *directory* and filter by name, rather than watching
 * tasks.md directly.
 *
 * Saving is temp-file-plus-rename, which replaces the directory entry. A watch
 * attached to the file itself can therefore stop firing after the first save,
 * silently and permanently. A directory watch survives create/replace/delete.
 *
 * Returns a function that stops watching.
 */
export function watchTasksFile(dir: string, onChange: () => void): () => void {
  let timer: NodeJS.Timeout | null = null

  const watcher = watch(dir, (_event, filename) => {
    // Either event type is only a prompt to re-read; neither says anything
    // about the content, so both are treated alike.
    if (filename && filename !== TASKS_FILE) return

    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      onChange()
    }, SETTLE_MS)
  })

  return () => {
    if (timer) clearTimeout(timer)
    watcher.close()
  }
}
