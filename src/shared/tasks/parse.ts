/**
 * Markdown -> document model.
 *
 * Pure: no `fs`, no Electron. Everything here is unit-tested by `node --test`.
 */

import type { ParsedDoc, Task } from '../types.ts'

/**
 * A checkbox line. Only indent-0 lines are tasks, so the bullet must be the
 * first character — an indented checkbox is a passthrough line, not a task.
 */
const TASK_LINE = /^([-*+])[ \t]+\[([ xX])\][ \t]*(.*)$/

/**
 * A project. Exactly two hashes: `#` is a document title and `###` a subsection,
 * and neither should be mistaken for a container of tasks.
 */
const PROJECT_HEADING = /^##[ \t]+(.+?)[ \t]*$/

/** CRLF and lone CR both collapse to LF so hashing and diffs stay stable. */
export function normalizeEol(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

/** The title of a `## heading` line, or null if the line is not one. */
export function parseProjectHeading(raw: string): string | null {
  return PROJECT_HEADING.exec(raw)?.[1] ?? null
}

/**
 * A checkbox with nothing after it has no title, and is treated as non-task
 * content rather than claimed as an empty task.
 */
export function parseTaskLine(raw: string, line: number, projectLine: number | null): Task | null {
  const match = TASK_LINE.exec(raw)
  if (!match) return null

  const title = match[3].trim()
  if (!title) return null

  return { line, raw, projectLine, title, completed: match[2] !== ' ' }
}

export function parseDoc(text: string): ParsedDoc {
  const lines = normalizeEol(text).split('\n')
  const projects: ParsedDoc['projects'] = []
  const tasks: Task[] = []

  // A task belongs to the nearest `## heading` above it. One above the first
  // heading belongs to no project, and stays null so nothing claims it.
  let projectLine: number | null = null

  lines.forEach((raw, index) => {
    const title = parseProjectHeading(raw)
    if (title !== null) {
      projects.push({ line: index, title })
      projectLine = index
      return
    }

    const task = parseTaskLine(raw, index, projectLine)
    if (task) tasks.push(task)
  })

  return { lines, projects, tasks }
}
