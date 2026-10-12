/**
 * The app's session: which repo is connected and what tasks.md currently says.
 *
 * This is the port of the Electron main-process session. The GitHub repo takes
 * over from the local folder as the source of truth: the fs watcher becomes a
 * poll of the Contents API, and every mutation becomes one commit.
 *
 * This is the only module holding mutable state. Everything it delegates to
 * (parse, format, mutate, github) is stateless.
 */

import type { Doc, Mutation, RepoRef, SessionState } from '../../../shared/types.ts'
import { AppError } from '../../../shared/errors.ts'
import { serializeDoc } from '../../../shared/tasks/format.ts'
import { parseDoc } from '../../../shared/tasks/parse.ts'
import { applyMutation as applyToLines } from '../../../shared/tasks/mutate.ts'
import * as github from './github.ts'

const CONNECTION_KEY = 'gittasks.connection'
const CACHE_KEY = 'gittasks.docCache'

/** Poll cadence for edits made outside the app (in another tab or on GitHub). */
const POLL_MS = 20_000

let connection: RepoRef | null = null
let doc: Doc = toDoc(null, '')
let lastSha: string | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let listeners = new Set<(doc: Doc) => void>()

/**
 * Reads and writes are chained through one promise. A write is a full
 * round-trip, and two writes racing the same sha would turn the second into a
 * pointless conflict — so every job waits for the previous one.
 */
let queue: Promise<unknown> = Promise.resolve()

function toDoc(sha: string | null, text: string): Doc {
  return { hash: sha ?? '', ...parseDoc(text) }
}

// --- Events -----------------------------------------------------------------

function publish(): void {
  for (const listener of listeners) listener(doc)
}

/** What the renderer subscribes to: remote changes, polled while visible. */
export function onDocChanged(listener: (doc: Doc) => void): () => void {
  listeners.add(listener)
  startPolling()
  return () => listeners.delete(listener)
}

function startPolling(): void {
  if (pollTimer) return

  pollTimer = setInterval(() => {
    // A hidden tab neither needs fresh data nor should burn rate limit.
    if (document.hidden) return
    void run(() => fetchLatest()).catch(() => {
      // A failed poll is silent: the next tick retries, and an explicit
      // refresh reports errors to the user.
    })
  }, POLL_MS)

  // Returning to the tab is the moment stale data is most noticeable.
  document.addEventListener('visibilitychange', onVisible)
}

function onVisible(): void {
  if (document.hidden || !connection) return
  void run(() => fetchLatest()).catch(() => {})
}

function stopPolling(): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  document.removeEventListener('visibilitychange', onVisible)
}

/** Serialize a job behind whatever reads and writes are already in flight. */
function run<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job)
  queue = next.catch(() => {})
  return next
}

// --- Reads ------------------------------------------------------------------

export function state(): SessionState {
  return { connection, doc }
}

function requireConnection(): RepoRef {
  if (!connection) throw new AppError('NOT_CONNECTED', 'No GitHub repo is connected yet.')
  return connection
}

/** Re-read tasks.md from GitHub and publish it if it changed under us. */
async function fetchLatest(): Promise<void> {
  const { owner, repo, branch, path } = requireConnection()
  // Already validated at connect time, so a missing file is probed no further.
  const file = await github.getFile(owner, repo, path, branch, { probe404: false })
  if (file.sha === lastSha) return

  lastSha = file.sha
  doc = toDoc(file.sha, file.text)
  cacheDoc()
  publish()
}

/**
 * Re-read tasks.md from GitHub and publish it if it changed under us.
 * Unlike the poll, an explicit refresh reports errors to its caller.
 */
export async function fetchLatestState(): Promise<SessionState> {
  await run(() => fetchLatest())
  return state()
}

/**
 * Reopen the connected repo from what was remembered, without waiting on the
 * network: the cached document paints immediately and a background fetch
 * corrects it if GitHub has newer content. Offline, the cached copy still
 * shows; writes will report the network error honestly.
 */
export function restore(): SessionState {
  const remembered = readJson<RepoRef>(CONNECTION_KEY)
  const token = github.readToken()
  if (!remembered || !token) return state()

  connection = remembered

  const cached = readJson<{ sha: string | null; text: string; key: string }>(CACHE_KEY)
  if (cached && cached.key === cacheKey(remembered)) {
    lastSha = cached.sha
    doc = toDoc(cached.sha, cached.text)
  }

  void run(() => fetchLatest()).catch(() => {})
  startPolling()

  return state()
}

// --- Connection -------------------------------------------------------------

/**
 * Validate a token and repo before anything is remembered, so "connected"
 * always means "readable and writable".
 */
export async function connect(input: {
  token: string
  owner: string
  repo: string
  branch: string
  path: string
}): Promise<SessionState> {
  await github.getUser(input.token)

  const next: RepoRef = {
    owner: input.owner,
    repo: input.repo,
    branch: input.branch,
    path: input.path,
  }
  const file = await github.getFile(
    next.owner,
    next.repo,
    next.path,
    next.branch,
  )

  github.clearToken()
  github.storeToken(input.token)
  writeJson(CONNECTION_KEY, next)

  connection = next
  lastSha = file.sha
  doc = toDoc(file.sha, file.text)
  cacheDoc()
  startPolling()

  return state()
}

/** Forget the connection and the cached document; the token goes with it. */
export function disconnect(): void {
  stopPolling()
  github.clearToken()
  localStorage.removeItem(CONNECTION_KEY)
  localStorage.removeItem(CACHE_KEY)

  connection = null
  lastSha = null
  doc = toDoc(null, '')
}

// --- Mutations --------------------------------------------------------------

export async function applyMutation(
  expectedHash: string,
  mutation: Mutation,
): Promise<SessionState> {
  await run(async () => {
    const ref = requireConnection()

    // The renderer sends the blob sha of the document it was looking at. A
    // mismatch means GitHub (or another tab) has newer content.
    if (expectedHash !== doc.hash) {
      await fetchLatest()
      throw new AppError(
        'STALE_DOC',
        'The file changed on GitHub. The list has been refreshed — try again.',
      )
    }

    const lines = applyToLines(doc, mutation)
    const text = serializeDoc(lines)

    try {
      const result = await github.putFile(ref.owner, ref.repo, ref.path, ref.branch, {
        text,
        sha: lastSha,
        message: commitMessage(mutation, doc),
      })

      lastSha = result.sha
      doc = toDoc(result.sha, text)
      cacheDoc()
      publish()
    } catch (error) {
      // Our sha was rejected, so GitHub has content we have not seen. Pull it
      // in before surfacing the error, so the refreshed list is on screen by
      // the time the user reads the message.
      if (error instanceof AppError && error.code === 'STALE_DOC') {
        await fetchLatest()
      }
      throw error
    }
  })

  return state()
}

// --- Persistence helpers ----------------------------------------------------

function cacheKey(ref: RepoRef): string {
  return `${ref.owner}/${ref.repo}@${ref.branch}:${ref.path}`
}

/** The last known document, so a reload paints instantly and offline still shows tasks. */
function cacheDoc(): void {
  if (!connection) return
  writeJson(CACHE_KEY, { key: cacheKey(connection), sha: lastSha, text: serializeDoc(doc.lines) })
}

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

// --- Commit messages --------------------------------------------------------

function taskTitleAt(d: Doc, line: number): string {
  return d.tasks.find((task) => task.line === line)?.title ?? 'unknown task'
}

function projectTitleAt(d: Doc, line: number): string {
  return d.projects.find((project) => project.line === line)?.title ?? 'unknown project'
}

/**
 * One mutation, one commit. The repo's history then reads like a changelog,
 * which is most of the point of persisting to git in the first place.
 */
function commitMessage(mutation: Mutation, d: Doc): string {
  switch (mutation.kind) {
    case 'add-project':
      return `Create project: ${mutation.title}`
    case 'rename-project':
      return `Rename project: ${projectTitleAt(d, mutation.line)} → ${mutation.title}`
    case 'delete-project':
      return `Delete project: ${projectTitleAt(d, mutation.line)}`
    case 'add':
      return `Add task: ${mutation.text}`
    case 'toggle': {
      const wasCompleted = d.tasks.find((task) => task.line === mutation.line)?.completed ?? false
      const title = taskTitleAt(d, mutation.line)
      return wasCompleted ? `Reopen task: ${title}` : `Complete task: ${title}`
    }
    case 'edit':
      return `Edit task: ${mutation.text}`
    case 'delete':
      return `Delete task: ${taskTitleAt(d, mutation.line)}`
  }
}
