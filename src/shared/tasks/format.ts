/**
 * Task -> markdown. The inverse of parse.ts.
 *
 * `formatTaskLine` is deliberately only ever applied to a line that is being
 * written. Untouched lines keep whatever shape their author gave them, so
 * canonical token ordering can never churn the rest of the file.
 */

import type { TaskFields } from '../types.ts'

/**
 * The editable text of a task: title followed by metadata, no checkbox. This is
 * what the composer and the inline editor round-trip, so the app never needs a
 * separate set of widgets for tags, priorities or dates.
 */
export function taskToText(fields: TaskFields): string {
  const meta: string[] = fields.tags.map((tag) => `#${tag}`)
  if (fields.priority) meta.push(`p${fields.priority}`)
  if (fields.due) meta.push(`due:${fields.due}`)

  return [fields.title, ...meta].join(' ')
}

export function formatTaskLine(fields: TaskFields): string {
  return `- [${fields.completed ? 'x' : ' '}] ${taskToText(fields)}`
}

/** A project title as the `## heading` line that owns its tasks. */
export function formatProjectHeading(title: string): string {
  return `## ${title}`
}

/**
 * Flip only the checkbox. Metadata, bullet style and spacing are left exactly
 * as written, so completing a task never rewrites its text.
 */
export function setCompleted(raw: string, completed: boolean): string {
  return raw.replace(/^([-*+][ \t]+)\[[ xX]\]/, `$1[${completed ? 'x' : ' '}]`)
}

/** The document is its lines; serialization is a join. */
export function serializeDoc(lines: string[]): string {
  return lines.join('\n')
}
