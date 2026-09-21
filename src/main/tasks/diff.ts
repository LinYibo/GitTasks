/**
 * What changed between two task lists, for the auto-commit message.
 *
 * This is a cosmetic heuristic — nothing depends on its accuracy, and it is
 * deliberately not derived from `git diff --numstat`, which counts lines and
 * therefore cannot tell a completion toggle from a rename.
 */

import type { DiffSummary, Task } from '../../shared/types.ts'

export function summarizeDiff(before: Task[], after: Task[]): DiffSummary {
  const beforeByTitle = groupByTitle(before)
  const afterByTitle = groupByTitle(after)

  const summary: DiffSummary = { added: 0, modified: 0, removed: 0, completed: 0 }

  // Line indices shift as soon as anything is inserted or removed, so tasks are
  // matched by title instead — the nth occurrence against the nth occurrence.
  for (const [title, next] of afterByTitle) {
    const previous = beforeByTitle.get(title) ?? []
    const paired = Math.min(previous.length, next.length)

    for (let index = 0; index < paired; index++) {
      const from = previous[index]
      const to = next[index]
      if (!from.completed && to.completed) summary.completed++
      else if (!sameContent(from, to)) summary.modified++
    }

    summary.added += next.length - paired
  }

  for (const [title, previous] of beforeByTitle) {
    summary.removed += Math.max(0, previous.length - (afterByTitle.get(title)?.length ?? 0))
  }

  return summary
}

export function formatCommitSubject(summary: DiffSummary): string {
  const parts: string[] = []
  if (summary.added) parts.push(`+${summary.added}`)
  if (summary.modified) parts.push(`~${summary.modified}`)
  if (summary.removed) parts.push(`-${summary.removed}`)
  if (summary.completed) parts.push(`✓${summary.completed}`)

  return parts.length > 0 ? `tasks: ${parts.join(' ')}` : 'tasks: update'
}

function groupByTitle(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>()

  for (const task of tasks) {
    const group = groups.get(task.title)
    if (group) group.push(task)
    else groups.set(task.title, [task])
  }

  return groups
}

function sameContent(a: Task, b: Task): boolean {
  return (
    a.completed === b.completed &&
    a.project === b.project &&
    a.priority === b.priority &&
    a.due === b.due &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => tag === b.tags[index])
  )
}
