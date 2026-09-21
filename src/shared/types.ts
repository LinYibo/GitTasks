/**
 * Types shared by all three Electron targets (main, preload, renderer).
 *
 * This file must stay free of `node:` imports — the renderer bundles it.
 */

export type Priority = 1 | 2 | 3

/** The content of a task, independent of where it lives in the document. */
export type TaskFields = {
  title: string
  completed: boolean
  tags: string[]
  project?: string
  priority?: Priority
  due?: string
  /** `YYYY-MM-DD`, validated as a real calendar date */
}

/** A task as it appears in the document. */
export type Task = TaskFields & {
  /** Index into `Doc.lines`. This is the task's identity. */
  line: number
  /** The exact source line, verbatim. Never regenerate this. */
  raw: string
}

/** The parsed document, without the concurrency token. */
export type ParsedDoc = {
  /** Every line of the file, verbatim. Unrecognised lines are never interpreted or dropped. */
  lines: string[]
  /** Derived view over `lines`, in document order. */
  tasks: Task[]
}

/** What the renderer holds and sends back. */
export type Doc = ParsedDoc & {
  /** sha256 of the LF-normalised file. The concurrency token for mutations. */
  hash: string
}

export type Mutation =
  | { kind: 'add'; text: string }
  | { kind: 'toggle'; line: number }
  | { kind: 'edit'; line: number; text: string }
  | { kind: 'delete'; line: number }

export type DiffSummary = {
  added: number
  modified: number
  removed: number
  completed: number
}

export type ErrCode =
  | 'GIT_NOT_FOUND'
  | 'NOT_A_REPO'
  | 'STALE_DOC'
  | 'EMPTY_TASK'
  | 'PUSH_REJECTED'
  | 'PULL_DIVERGED'
  | 'NO_REMOTE'
  | 'IO'
  | 'UNKNOWN'

export type ErrorInfo = {
  code: ErrCode
  message: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorInfo }

export type SyncPhase = 'idle' | 'committing' | 'syncing' | 'error'

export type RepoStatus = {
  phase: SyncPhase
  /** `tasks.md` differs from HEAD. */
  dirty: boolean
  /** Commits not yet pushed. */
  ahead: number
  /** Commits not yet pulled. */
  behind: number
  hasRemote: boolean
  lastCommit?: { hash: string; subject: string; at: string }
  error?: ErrorInfo
}

/** Everything the renderer needs to draw the app. */
export type RepoState = {
  repoPath: string | null
  doc: Doc
  status: RepoStatus
  /** False when no usable `git` binary was found. The app cannot work without one. */
  gitAvailable: boolean
}
