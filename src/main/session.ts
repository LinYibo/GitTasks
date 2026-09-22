/**
 * The app's session: which folder is open and what tasks.md currently says.
 *
 * This is the only module holding mutable state. Everything it delegates to
 * (parse, format, mutate, store, watcher) is stateless.
 */

import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { app, BrowserWindow } from 'electron'

import { CHANNELS } from '../shared/ipc-contract.ts'
import type { Doc, FolderState, Mutation } from '../shared/types.ts'
import { readConfig, writeConfig } from './config.ts'
import { AppError } from './errors.ts'
import { ensureTasksFile, readTasksFile, TASKS_FILE, toDoc, writeTasksFile } from './store.ts'
import { applyMutation as applyToLines } from './tasks/mutate.ts'
import { watchTasksFile } from './watcher.ts'

let folderPath: string | null = null
let doc: Doc = toDoc('')
let lastSeenHash = doc.hash
let stopWatching: (() => void) | null = null

// --- Events -----------------------------------------------------------------

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload)
  }
}

function publishDoc(): void {
  broadcast(CHANNELS.docChanged, doc)
}

// --- Reads ------------------------------------------------------------------

export function state(): FolderState {
  return { folderPath, doc }
}

export function folder(): string {
  return folderPath ?? ''
}

export function tasksFile(): string {
  return folderPath ? join(folderPath, TASKS_FILE) : TASKS_FILE
}

function requireFolder(): string {
  if (!folderPath) throw new AppError('NOT_OPEN', 'No folder is open yet.')
  return folderPath
}

/**
 * Re-read tasks.md. Returns whether the content actually changed, which is what
 * tells our own writes apart from someone else's.
 */
async function reload(): Promise<boolean> {
  const next = toDoc(await readTasksFile(requireFolder()))
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
  if (!folderPath) return
  if (await reload()) publishDoc()
}

// --- Operations -------------------------------------------------------------

export async function openFolder(dir: string): Promise<FolderState> {
  await mkdir(dir, { recursive: true })
  await ensureTasksFile(dir)

  stopWatching?.()
  folderPath = dir
  stopWatching = watchTasksFile(dir, () => void onFileChanged())
  await writeConfig({ folderPath: dir })

  await reload()

  return state()
}

/**
 * Reopen the previously used folder at launch. For a new user (no valid
 * remembered path), creates a default one at Documents/GitTasks.
 */
export async function restore(): Promise<FolderState> {
  const { folderPath: remembered } = await readConfig()
  if (remembered && existsSync(remembered)) return openFolder(remembered)

  const defaultDir = join(app.getPath('documents'), 'GitTasks')
  return openFolder(defaultDir)
}

export async function applyMutation(
  expectedHash: string,
  mutation: Mutation,
): Promise<FolderState> {
  const dir = requireFolder()

  // The renderer sends the hash of the document it was looking at. A mismatch
  // means someone else edited the file in the meantime.
  if (expectedHash !== doc.hash) {
    throw new AppError(
      'STALE_DOC',
      'The file changed on disk. The list has been refreshed — try again.',
    )
  }

  doc = await writeTasksFile(dir, applyToLines(doc, mutation))
  lastSeenHash = doc.hash

  return state()
}
