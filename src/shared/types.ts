/**
 * Types shared by the pure core and the renderer.
 *
 * This file must stay free of `node:` imports — the browser bundles it, and
 * `node --test` runs the pure core directly.
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
  /**
   * The git blob sha of tasks.md in the GitHub repo. The concurrency token for
   * mutations. Empty string means the file does not exist remotely yet.
   */
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

/** Where tasks.md lives: one file in one branch of one GitHub repo. */
export type RepoRef = {
  owner: string
  repo: string
  branch: string
  /** Path of the tasks file inside the repo, e.g. `tasks.md`. */
  path: string
}

export type ErrCode =
  | 'NOT_CONNECTED'
  | 'STALE_DOC'
  | 'EMPTY_TASK'
  | 'DUPLICATE_PROJECT'
  | 'AUTH'
  | 'NOT_FOUND'
  | 'NETWORK'
  | 'RATE_LIMIT'
  | 'IO'
  | 'UNKNOWN'

export type ErrorInfo = {
  code: ErrCode
  message: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorInfo }

/** Everything the renderer needs to draw the app. */
export type SessionState = {
  connection: RepoRef | null
  doc: Doc
}
