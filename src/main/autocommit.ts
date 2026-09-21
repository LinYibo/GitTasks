/** Turning a burst of edits into a single, readable commit. */

import type { Task } from '../shared/types.ts'
import { git, gitOrThrow } from './git.ts'
import { TASKS_FILE } from './store.ts'
import { formatCommitSubject, summarizeDiff } from './tasks/diff.ts'
import { parseDoc } from '../shared/tasks/parse.ts'

/**
 * Long enough that writing a sentence isn't twenty commits, short enough that
 * `git log` reads as undo history. The file itself is already durably written,
 * so nothing is at risk while this waits.
 */
const DEBOUNCE_MS = 1500

export type AutoCommit = {
  schedule(): void
  flush(): Promise<void>
}

export function createAutoCommit(commit: () => Promise<void>): AutoCommit {
  let timer: NodeJS.Timeout | null = null

  const cancel = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  return {
    schedule(): void {
      cancel()
      timer = setTimeout(() => {
        timer = null
        void commit()
      }, DEBOUNCE_MS)
    },

    async flush(): Promise<void> {
      if (!timer) return
      cancel()
      await commit()
    },
  }
}

/**
 * Stage and commit tasks.md if it actually changed. Returns whether a commit
 * was made.
 */
export async function commitTasks(dir: string, tasks: Task[]): Promise<boolean> {
  // Stage only our own file. `git add -A` would sweep up whatever else the user
  // keeps in their repo, which is not ours to commit.
  await git(['add', '--', TASKS_FILE], dir)

  // Exit 0 from `--quiet` means nothing is staged, so skip rather than create
  // an empty commit.
  if ((await git(['diff', '--cached', '--quiet', '--', TASKS_FILE], dir)).code === 0) return false

  // Measured against HEAD rather than the previous edit, so a burst of edits
  // summarises as one accurate change.
  const subject = formatCommitSubject(summarizeDiff(await headTasks(dir), tasks))

  // The `--` pathspec keeps the commit to our file even if the user has staged
  // something else.
  await gitOrThrow(['commit', '-m', subject, '--', TASKS_FILE], dir, 'Could not commit')

  return true
}

/** The tasks as of the last commit; empty before the first one. */
async function headTasks(dir: string): Promise<Task[]> {
  const { code, stdout } = await git(['show', `HEAD:${TASKS_FILE}`], dir)
  return code === 0 ? parseDoc(stdout).tasks : []
}
