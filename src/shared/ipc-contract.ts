/** The wire contract between main, preload and renderer. */

import type { Doc, Mutation, RepoState, RepoStatus, Result } from './types.ts'

export const CHANNELS = {
  state: 'repo:state',
  choose: 'repo:choose',
  apply: 'doc:apply',
  sync: 'repo:sync',
  open: 'app:open',
  docChanged: 'doc:changed',
  statusChanged: 'status:changed',
} as const

export type ApplyRequest = {
  /** Hash of the document the renderer was looking at when it made this edit. */
  expectedHash: string
  mutation: Mutation
}

export type SyncMode = 'push' | 'pull'
export type OpenTarget = 'folder' | 'tasks'

/** What preload exposes as `window.gittasks`. */
export type GitTasksApi = {
  /** Hydrate on boot. Resolves the remembered repo, if there is one. */
  state(): Promise<Result<RepoState>>
  /** Native folder picker. Resolves `null` if the user cancels. */
  choose(): Promise<Result<RepoState | null>>
  /** The single mutation entry point. */
  apply(request: ApplyRequest): Promise<Result<RepoState>>
  sync(mode: SyncMode): Promise<Result<RepoState>>
  open(target: OpenTarget): Promise<Result<void>>
  onDocChanged(listener: (doc: Doc) => void): () => void
  onStatusChanged(listener: (status: RepoStatus) => void): () => void
}
