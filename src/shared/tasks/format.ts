/**
 * Task -> markdown. The inverse of parse.ts.
 *
 * `formatTaskLine` is deliberately only ever applied to a line that is being
 * written. Untouched lines keep whatever shape their author gave them, so
 * canonical formatting can never churn the rest of the file.
 */

import type { TaskFields } from '../types.ts'

export function formatTaskLine(fields: TaskFields): string {
  return `- [${fields.completed ? 'x' : ' '}] ${fields.title}`
}

/** A project title as the `## heading` line that owns its tasks. */
export function formatProjectHeading(title: string): string {
  return `## ${title}`
}

/**
 * Flip only the checkbox. The rest of the line is left exactly as written, so
 * completing a task never rewrites its text.
 */
export function setCompleted(raw: string, completed: boolean): string {
  return raw.replace(/^([-*+][ \t]+)\[[ xX]\]/, `$1[${completed ? 'x' : ' '}]`)
}

/** The document is its lines; serialization is a join. */
export function serializeDoc(lines: string[]): string {
  return lines.join('\n')
}
