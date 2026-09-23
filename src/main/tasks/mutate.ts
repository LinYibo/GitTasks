/**
 * Pure line operations. Every mutation returns a fresh `lines` array; only the
 * lines it actually touches are regenerated.
 */

import type { Mutation, ParsedDoc, Project, Task } from '../../shared/types.ts'
import { AppError } from '../errors.ts'
import { formatProjectHeading, formatTaskLine, setCompleted } from '../../shared/tasks/format.ts'
import { parseProjectHeading } from '../../shared/tasks/parse.ts'

export function applyMutation(doc: ParsedDoc, mutation: Mutation): string[] {
  switch (mutation.kind) {
    case 'add-project':
      return addProject(doc, mutation.title)
    case 'rename-project':
      return renameProject(doc, mutation.line, mutation.title)
    case 'delete-project':
      return deleteProject(doc, mutation.line)
    case 'add':
      return addTask(doc, mutation.text, mutation.projectLine)
    case 'toggle':
      return toggleTask(doc, mutation.line)
    case 'edit':
      return editTask(doc, mutation.line, mutation.text)
    case 'delete':
      return deleteTask(doc, mutation.line)
  }
}

/** Where a new task belongs: after the last task of its project, else its end. */
function insertionIndex(doc: ParsedDoc, projectLine: number): number {
  const lastOfProject = doc.tasks.filter((task) => task.projectLine === projectLine).at(-1)
  if (lastOfProject) return lastOfProject.line + 1

  const project = projectAt(doc, projectLine)

  // The blank line under a heading is the usual shape, so a first task goes
  // beneath it rather than squeezing in between.
  return doc.lines[project.line + 1] === '' ? project.line + 2 : project.line + 1
}

/** New projects go at the end of the file, keeping their own section complete. */
function appendProject(lines: string[], heading: string): string[] {
  while (lines.at(-1) === '') lines.pop()

  const gap = lines.length === 0 ? [] : ['']
  return [...lines, ...gap, heading, '']
}

/**
 * Splice a task in at `at`, keeping a blank line between it and a `## heading`
 * that follows. The app's own output separates sections this way, so a task
 * added to an empty project does not glue itself onto the next one.
 */
function insertTask(lines: string[], at: number, text: string): string[] {
  const next = lines[at]
  const entry = next !== undefined && next !== '' && parseProjectHeading(next) !== null ? [text, ''] : [text]
  lines.splice(at, 0, ...entry)
  return lines
}

/** Line indices arrive from the renderer, so this is a genuine boundary check. */
function taskAt(doc: ParsedDoc, line: number): Task {
  const task = doc.tasks.find((candidate) => candidate.line === line)
  if (!task) throw new AppError('STALE_DOC', `No task at line ${line}.`)
  return task
}

function projectAt(doc: ParsedDoc, line: number): Project {
  const project = doc.projects.find((candidate) => candidate.line === line)
  if (!project) throw new AppError('STALE_DOC', `No project at line ${line}.`)
  return project
}

function taskTitle(text: string): string {
  const title = text.trim()
  if (!title) throw new AppError('EMPTY_TASK', 'A task needs a title.')
  return title
}

function projectTitle(text: string): string {
  const title = text.trim()
  if (!title) throw new AppError('EMPTY_TASK', 'A project needs a name.')
  return title
}

function assertUnique(doc: ParsedDoc, title: string, exceptLine?: number): void {
  // Two identical headings would make a project's `line` identity ambiguous to
  // read, even though it stays valid internally.
  const clash = doc.projects.some(
    (project) => project.line !== exceptLine && project.title === title,
  )
  if (clash) throw new AppError('DUPLICATE_PROJECT', `There is already a project called “${title}”.`)
}

function addProject(doc: ParsedDoc, title: string): string[] {
  const name = projectTitle(title)
  assertUnique(doc, name)

  return appendProject([...doc.lines], formatProjectHeading(name))
}

function renameProject(doc: ParsedDoc, line: number, title: string): string[] {
  const project = projectAt(doc, line)
  const name = projectTitle(title)
  assertUnique(doc, name, project.line)

  const lines = [...doc.lines]
  lines[project.line] = formatProjectHeading(name)
  return lines
}

/**
 * `split('\n')` represents a trailing newline as a final empty line. Removing
 * lines from the middle of the document must not take that marker with it.
 */
function keepTrailingNewline(doc: ParsedDoc, lines: string[]): string[] {
  if (doc.lines.at(-1) === '' && lines.length > 0 && lines.at(-1) !== '') lines.push('')
  return lines
}

/**
 * Delete the whole section. Without an inbox, leaving the tasks behind would
 * hand them to whichever project sits above, so a deletion takes its tasks with
 * it rather than relocating them somewhere the user never asked for.
 */
function deleteProject(doc: ParsedDoc, line: number): string[] {
  const project = projectAt(doc, line)
  const end = doc.projects.find((next) => next.line > project.line)?.line ?? doc.lines.length

  return keepTrailingNewline(doc, [...doc.lines.slice(0, project.line), ...doc.lines.slice(end)])
}

function addTask(doc: ParsedDoc, text: string, projectLine: number): string[] {
  const title = taskTitle(text)
  projectAt(doc, projectLine)

  return insertTask(
    [...doc.lines],
    insertionIndex(doc, projectLine),
    formatTaskLine({ title, completed: false }),
  )
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
  lines[line] = formatTaskLine({ title: taskTitle(text), completed: task.completed })
  return lines
}

function deleteTask(doc: ParsedDoc, line: number): string[] {
  const target = taskAt(doc, line)
  return doc.lines.filter((_, index) => index !== target.line)
}
