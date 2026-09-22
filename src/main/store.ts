/**
 * Owns the tasks file: reading it, writing it, and hashing it.
 *
 * The file on disk is the single source of truth. Nothing else in the app
 * caches task content.
 */

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { Doc } from '../shared/types.ts'
import { serializeDoc } from '../shared/tasks/format.ts'
import { normalizeEol, parseDoc } from '../shared/tasks/parse.ts'

export const TASKS_FILE = 'tasks.md'

export function hashText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

export function toDoc(text: string): Doc {
  return { hash: hashText(text), ...parseDoc(text) }
}

/** A missing file just means the folder has not been written to yet. */
export async function readTasksFile(dir: string): Promise<string> {
  const path = join(dir, TASKS_FILE)
  return existsSync(path) ? normalizeEol(await readFile(path, 'utf8')) : ''
}

export async function ensureTasksFile(dir: string): Promise<void> {
  const path = join(dir, TASKS_FILE)
  if (!existsSync(path)) await writeFile(path, '', 'utf8')
}

/**
 * Write through a temp file and rename. An interrupted write can therefore
 * never leave a half-written tasks.md behind.
 *
 * Always LF, never the platform default, so the hash and the diffs stay stable
 * against an editor that writes CRLF.
 */
export async function writeTasksFile(dir: string, lines: string[]): Promise<Doc> {
  const target = join(dir, TASKS_FILE)
  const text = serializeDoc(lines)

  await writeFile(`${target}.tmp`, text, 'utf8')
  await rename(`${target}.tmp`, target)

  return toDoc(text)
}
