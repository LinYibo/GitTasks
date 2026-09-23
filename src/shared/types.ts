/**
 * Types shared by all three Electron targets (main, preload, renderer).
 *
 * This file must stay free of `node:` imports — the renderer bundles it.
 */

/** A project: one `## heading` in the document, holding any number of tasks. */
export type Project = {
  title: string
  /** Index into `Doc.lines`. This is the project's identity. */
  line: number
}

/** The content of a task, independent of where it lives in the document. */
export type TaskFields = {
  title: string
  completed: boolean
}

/** A task as it appears in the document. */
export type Task = TaskFields & {
  /** Index into `Doc.lines`. This is the task's identity. */
  line: number
  /** The exact source line, verbatim. Never regenerate this. */
  raw: string
  /**
   * `line` of the owning project. Null means the checkbox sits above the first
   * `## heading`, so it belongs to no project — the list never shows it, and no
   * mutation can reach it. The line itself is still left alone.
   */
  projectLine: number | null
}

/** The parsed document, without the concurrency token. */
export type ParsedDoc = {
  /** Every line of the file, verbatim. Unrecognised lines are never interpreted or dropped. */
  lines: string[]
  /** Every `## heading`, in document order. */
  projects: Project[]
  /** Derived view over `lines`, in document order. */
  tasks: Task[]
}

/** What the renderer holds and sends back. */
export type Doc = ParsedDoc & {
  /** sha256 of the LF-normalised file. The concurrency token for mutations. */
  hash: string
}

export type Mutation =
  | { kind: 'add-project'; title: string }
  | { kind: 'rename-project'; line: number; title: string }
  | { kind: 'delete-project'; line: number }
  | { kind: 'add'; text: string; projectLine: number }
  | { kind: 'toggle'; line: number }
  | { kind: 'edit'; line: number; text: string }
  | { kind: 'delete'; line: number }

export type ErrCode =
  | 'NOT_OPEN'
  | 'STALE_DOC'
  | 'EMPTY_TASK'
  | 'DUPLICATE_PROJECT'
  | 'IO'
  | 'UNKNOWN'

export type ErrorInfo = {
  code: ErrCode
  message: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorInfo }

/** Everything the renderer needs to draw the app. */
export type FolderState = {
  folderPath: string | null
  doc: Doc
}
