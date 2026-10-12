/**
 * The typed facade the store talks to — the web equivalent of what the preload
 * bridge used to expose. Every method catches, so the store's entire error
 * strategy stays "unwrap a Result".
 */

import type { Doc, Mutation, Result, SessionState } from '../../shared/types.ts'
import { toErrorInfo } from '../../shared/errors.ts'
import * as session from './lib/session.ts'

export type ConnectInput = {
  token: string
  owner: string
  repo: string
  branch: string
  path: string
}

export type ApplyRequest = {
  /** Blob sha of the document the renderer was looking at when it made this edit. */
  expectedHash: string
  mutation: Mutation
}

export type GitTasksApi = {
  /** Hydrate on boot from what was remembered, then correct it in the background. */
  restore(): Promise<Result<SessionState>>
  /** Validate and remember a token plus the repo to persist to. */
  connect(input: ConnectInput): Promise<Result<SessionState>>
  disconnect(): Promise<Result<void>>
  /** Re-read tasks.md from GitHub now. */
  refresh(): Promise<Result<SessionState>>
  /** The single mutation entry point. */
  apply(request: ApplyRequest): Promise<Result<SessionState>>
  /** Pushed whenever polling notices the remote file changed. */
  onDocChanged(listener: (doc: Doc) => void): () => void
}

async function call<T>(run: () => T | Promise<T>): Promise<Result<Awaited<T>>> {
  try {
    return { ok: true, data: await run() }
  } catch (error) {
    return { ok: false, error: toErrorInfo(error) }
  }
}

export const api: GitTasksApi = {
  restore: () => call(() => session.restore()),
  connect: (input) => call(() => session.connect(input)),
  disconnect: () => call(() => session.disconnect()),
  refresh: () => call(() => session.fetchLatestState()),
  apply: (request) => call(() => session.applyMutation(request.expectedHash, request.mutation)),
  onDocChanged: session.onDocChanged,
}
