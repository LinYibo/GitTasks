/** The wire contract between main, preload and renderer. */

import type { Doc, FolderState, Mutation, Result } from './types.ts'

export const CHANNELS = {
  state: 'repo:state',
  choose: 'repo:choose',
  apply: 'doc:apply',
  open: 'app:open',
  docChanged: 'doc:changed',
} as const

export type ApplyRequest = {
  /** Hash of the document the renderer was looking at when it made this edit. */
  expectedHash: string
  mutation: Mutation
}

export type OpenTarget = 'folder' | 'tasks'

/** What preload exposes as `window.gittasks`. */
export type GitTasksApi = {
  /** Hydrate on boot. Resolves the remembered folder, if there is one. */
  state(): Promise<Result<FolderState>>
  /** Native folder picker. Resolves `null` if the user cancels. */
  choose(): Promise<Result<FolderState | null>>
  /** The single mutation entry point. */
  apply(request: ApplyRequest): Promise<Result<FolderState>>
  open(target: OpenTarget): Promise<Result<void>>
  onDocChanged(listener: (doc: Doc) => void): () => void
}
