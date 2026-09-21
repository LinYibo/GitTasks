/**
 * Pure line operations. Every mutation returns a fresh `lines` array; only the
 * lines it actually touches are regenerated.
 */

import type { Mutation, ParsedDoc, Task } from '../../shared/types.ts'
import { AppError } from '../errors.ts'
import { formatTaskLine, setCompleted } from '../../shared/tasks/format.ts'
import { parseTaskFields } from '../../shared/tasks/parse.ts'

export function applyMutation(doc: ParsedDoc, mutation: Mutation): string[] {
  switch (mutation.kind) {
    case 'add':
      return addTask(doc, mutation.text)
    case 'toggle':
      return toggleTask(doc, mutation.line)
    case 'edit':
      return editTask(doc, mutation.line, mutation.text)
    case 'delete':
      return deleteTask(doc, mutation.line)
  }
}

/** New tasks go after the last existing task, else at the end of the file. */
function insertionIndex(doc: ParsedDoc): number {
  const last = doc.tasks.at(-1)
  if (last) return last.line + 1

  // Skip the empty string `split('\n')` leaves behind a trailing newline.
  return doc.lines.at(-1) === '' ? doc.lines.length - 1 : doc.lines.length
}

/** Line indices arrive from the renderer, so this is a genuine boundary check. */
function taskAt(doc: ParsedDoc, line: number): Task {
  const task = doc.tasks.find((candidate) => candidate.line === line)
  if (!task) throw new AppError('STALE_DOC', `No task at line ${line}.`)
  return task
}

function titleFields(text: string) {
  const fields = parseTaskFields(text)
  if (!fields) throw new AppError('EMPTY_TASK', 'A task needs a title.')
  return fields
}

function addTask(doc: ParsedDoc, text: string): string[] {
  const lines = [...doc.lines]
  lines.splice(insertionIndex(doc), 0, formatTaskLine(titleFields(text)))
  return lines
}

function toggleTask(doc: ParsedDoc, line: number): string[] {
  const task = taskAt(doc, line)
  const lines = [...doc.lines]
  lines[line] = setCompleted(task.raw, !task.completed)
  return lines
}

function editTask(doc: ParsedDoc, line: number, text: string): string[] {
  const task = taskAt(doc, line)
  const lines = [...doc.lines]
  lines[line] = formatTaskLine({ ...titleFields(text), completed: task.completed })
  return lines
}

function deleteTask(doc: ParsedDoc, line: number): string[] {
  const target = taskAt(doc, line)
  return doc.lines.filter((_, index) => index !== target.line)
}
