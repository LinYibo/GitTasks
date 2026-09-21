/**
 * The app's session: which repo is open, what tasks.md currently says, and what
 * state the git repo is in.
 *
 * This is the only module holding mutable state. Everything it delegates to
 * (parse, format, mutate, diff, git, store, watcher) is stateless.
 */

import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { app, BrowserWindow } from 'electron'

import { CHANNELS } from '../shared/ipc-contract.ts'
import type { Doc, ErrorInfo, Mutation, RepoState, RepoStatus, SyncPhase } from '../shared/types.ts'
import { commitTasks, createAutoCommit } from './autocommit.ts'
import { readConfig, writeConfig } from './config.ts'
import { AppError, toErrorInfo } from './errors.ts'
import { git, isGitAvailable, setGitPath } from './git.ts'
import { bindRepo, hasRemote, isRepo } from './repo.ts'
import { ensureTasksFile, readTasksFile, TASKS_FILE, toDoc, writeTasksFile } from './store.ts'
import { applyMutation as applyToLines } from './tasks/mutate.ts'
import { watchTasksFile } from './watcher.ts'

let repoPath: string | null = null
let doc: Doc = toDoc('')
let lastSeenHash = doc.hash
let stopWatching: (() => void) | null = null
let gitAvailable = true

let status: RepoStatus = {
  phase: 'idle',
  dirty: false,
  ahead: 0,
  behind: 0,
  hasRemote: false,
}

// --- Events -----------------------------------------------------------------

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload)
  }
}

function publishDoc(): void {
  broadcast(CHANNELS.docChanged, doc)
}

function publishStatus(): void {
  broadcast(CHANNELS.statusChanged, status)
}

function setPhase(phase: SyncPhase, error?: ErrorInfo): void {
  status = { ...status, phase, error }
  publishStatus()
}

// --- Reads ------------------------------------------------------------------

export function state(): RepoState {
  return { repoPath, doc, status, gitAvailable }
}

export function folder(): string {
  return repoPath ?? ''
}

export function tasksFile(): string {
  return repoPath ? join(repoPath, TASKS_FILE) : TASKS_FILE
}

/**
 * Check for a usable git binary once at startup. A GUI-launched process on
 * Windows may not inherit the PATH that a shell has, so this is worth knowing
 * before the user tries to open a folder.
 */
export async function detectGit(): Promise<void> {
  const { gitPath } = await readConfig()
  if (gitPath) setGitPath(gitPath)
  gitAvailable = await isGitAvailable()
}

function requireRepo(): string {
  if (!repoPath) throw new AppError('NOT_A_REPO', 'No folder is open yet.')
  return repoPath
}

/**
 * Re-read tasks.md. Returns whether the content actually changed, which is what
 * tells our own writes apart from someone else's.
 */
async function reload(): Promise<boolean> {
  const next = toDoc(await readTasksFile(requireRepo()))
  if (next.hash === lastSeenHash) return false

  doc = next
  lastSeenHash = next.hash
  return true
}

/**
 * Fired by the watcher for every change to tasks.md, including our own. The
 * hash comparison in `reload` is the whole of the distinction — an in-flight
 * flag would race the OS event and could not dedupe a multi-event save.
 */
async function onFileChanged(): Promise<void> {
  if (!repoPath) return
  if (await reload()) publishDoc()
}

// --- Commits ----------------------------------------------------------------

const autoCommit = createAutoCommit(async () => {
  const dir = repoPath
  if (!dir) return

  setPhase('committing')

  // No caller to handle a rejection here, so this is one of the two places an
  // error is caught rather than thrown.
  try {
    if (await commitTasks(dir, doc.tasks)) await refreshStatus()
    else setPhase('idle')
  } catch (error) {
    setPhase('error', toErrorInfo(error))
  }
})

/** Commit anything pending. Runs from window blur and before-quit. */
export async function flushPending(): Promise<void> {
  await autoCommit.flush()
}

// --- Status -----------------------------------------------------------------

async function refreshStatus(): Promise<void> {
  const dir = requireRepo()

  const [branch, file, remote, log] = await Promise.all([
    git(['status', '--porcelain=v2', '--branch', '--untracked-files=no'], dir),
    // Scoped to our file so "dirty" means tasks.md specifically, not the user's
    // unrelated work in the same repo.
    git(['status', '--porcelain', '--', TASKS_FILE], dir),
    hasRemote(dir),
    git(['log', '-1', '--format=%h%x00%s%x00%cI'], dir),
  ])

  // `# branch.ab +2 -1`, present only when an upstream is configured.
  const aheadBehind = branch.stdout.split('\n').find((line) => line.startsWith('# branch.ab '))?.split(' ')

  status = {
    phase: 'idle',
    dirty: file.stdout.trim() !== '',
    ahead: Math.abs(Number(aheadBehind?.[2] ?? 0)),
    behind: Math.abs(Number(aheadBehind?.[3] ?? 0)),
    hasRemote: remote,
    lastCommit: log.code === 0 ? parseCommit(log.stdout) : undefined,
  }

  publishStatus()
}

function parseCommit(output: string): RepoStatus['lastCommit'] {
  const [hash, subject, at] = output.trim().split('\0')
  return hash && subject !== undefined && at ? { hash, subject, at } : undefined
}

// --- Operations -------------------------------------------------------------

export async function openRepo(dir: string): Promise<RepoState> {
  // Settle anything pending against the old repo before we switch away from it.
  await autoCommit.flush()

  const root = await bindRepo(dir)
  await ensureTasksFile(root)

  stopWatching?.()
  repoPath = root
  stopWatching = watchTasksFile(root, () => void onFileChanged())
  await writeConfig({ repoPath: root })

  await reload()
  await refreshStatus()

  return state()
}

/**
 * Reopen the previously used repo at launch. For a new user (no valid
 * remembered path), creates a default repo at Documents/GitTasks.
 */
export async function restore(): Promise<RepoState> {
  const { repoPath: remembered } = await readConfig()
  if (remembered && existsSync(remembered) && await isRepo(remembered)) {
    return openRepo(remembered)
  }

  // First run: create the default repo directory and open it.
  const defaultDir = join(app.getPath('documents'), 'GitTasks')
  await mkdir(defaultDir, { recursive: true })
  return openRepo(defaultDir)
}

export async function applyMutation(expectedHash: string, mutation: Mutation): Promise<RepoState> {
  const dir = requireRepo()

  // The renderer sends the hash of the document it was looking at. A mismatch
  // means someone else edited the file in the meantime.
  if (expectedHash !== doc.hash) {
    throw new AppError('STALE_DOC', 'The file changed on disk. The list has been refreshed — try again.')
  }

  doc = await writeTasksFile(dir, applyToLines(doc, mutation))
  lastSeenHash = doc.hash

  autoCommit.schedule()
  return state()
}

export async function sync(mode: 'push' | 'pull'): Promise<RepoState> {
  const dir = requireRepo()
  setPhase('syncing')

  try {
    if (mode === 'pull') await pull(dir)
    else await push(dir)

    // A pull rewrites the file behind our back; pick it up immediately rather
    // than waiting for the watcher.
    if (await reload()) publishDoc()
  } finally {
    await refreshStatus()
  }

  return state()
}

async function pull(dir: string): Promise<void> {
  if (!(await hasRemote(dir))) throw new AppError('NO_REMOTE', 'This repo has no remote configured.')

  // Get the tree clean first, so the fast-forward has nothing to trip over.
  await autoCommit.flush()

  // `--ff-only` either advances the branch or refuses. It cannot create a
  // merge, so it cannot produce a conflict and cannot leave the tree in a
  // half-merged state this app has no way to resolve.
  const { code } = await git(['pull', '--ff-only'], dir)
  if (code !== 0) {
    throw new AppError(
      'PULL_DIVERGED',
      'Local and remote histories have diverged, so GitTasks left your files untouched. Resolve it in a terminal.',
    )
  }
}

async function push(dir: string): Promise<void> {
  if (!(await hasRemote(dir))) throw new AppError('NO_REMOTE', 'This repo has no remote configured.')

  // Commit pending work first, or the push would send nothing.
  await autoCommit.flush()

  const { code, stderr } = await git(['push'], dir)
  if (code === 0) return

  if (/rejected|non-fast-forward|fetch first/i.test(stderr)) {
    throw new AppError(
      'PUSH_REJECTED',
      'The remote has commits you do not have yet. Pull first, then push. Nothing changed locally.',
    )
  }

  throw new AppError('UNKNOWN', `Push failed: ${stderr.trim()}`)
}
