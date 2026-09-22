/**
 * Markdown -> document model.
 *
 * Pure: no `fs`, no Electron. Everything here is unit-tested by `node --test`.
 */

import type { ParsedDoc, Priority, Task, TaskFields } from '../types.ts'

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

// Metadata is recognised per whitespace-delimited token, anywhere on the line.
// Tokenising this way is what makes `owner/repo#42` and `C++` safe: neither
// forms a whole token that starts with `#`.
const TAG = /^#([\p{L}_][\p{L}\p{N}_-]*)$/u
const PRIORITY = /^p([1-3])$/
const DUE = /^due:(\d{4})-(\d{2})-(\d{2})$/i

/** CRLF and lone CR both collapse to LF so hashing and diffs stay stable. */
export function normalizeEol(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/**
 * Split a task's text into its title and metadata.
 *
 * Returns `null` when nothing is left once metadata is removed — a task made
 * only of metadata has no title, and the caller should treat the line as
 * non-task content rather than write an empty one.
 */
export function parseTaskFields(text: string): TaskFields | null {
  const title: string[] = []
  const tags: string[] = []
  let priority: Priority | undefined
  let due: string | undefined

  for (const word of text.split(/\s+/)) {
    if (!word) continue

    const tag = TAG.exec(word)
    if (tag) {
      // Tags are a set: `#Home #home` collapses to one.
      if (!tags.some((existing) => existing.toLowerCase() === tag[1].toLowerCase())) {
        tags.push(tag[1])
      }
      continue
    }

    // priority / due are singletons. A second occurrence is left in the title
    // rather than silently swallowed.
    const pri = PRIORITY.exec(word)
    if (pri && !priority) {
      priority = Number(pri[1]) as Priority
      continue
    }

    const date = DUE.exec(word)
    if (date && !due) {
      const [year, month, day] = [Number(date[1]), Number(date[2]), Number(date[3])]
      if (isRealDate(year, month, day)) {
        due = `${date[1]}-${date[2]}-${date[3]}`
        continue
      }
    }

    title.push(word)
  }

  const joined = title.join(' ')
  return joined ? { title: joined, completed: false, tags, priority, due } : null
}

/** The title of a `## heading` line, or null if the line is not one. */
export function parseProjectHeading(raw: string): string | null {
  return PROJECT_HEADING.exec(raw)?.[1] ?? null
}

export function parseTaskLine(raw: string, line: number, projectLine: number | null): Task | null {
  const match = TASK_LINE.exec(raw)
  if (!match) return null

  const fields = parseTaskFields(match[3])
  if (!fields) return null

  return { line, raw, projectLine, ...fields, completed: match[2] !== ' ' }
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
