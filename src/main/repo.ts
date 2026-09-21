/** Locating, creating and preparing the git repo that backs the tasks file. */

import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { git, gitOrThrow } from './git.ts'

/**
 * Keeps the working tree on LF so an editor writing CRLF doesn't churn the file
 * against git. Only written for repos GitTasks creates — an existing repo is
 * left with whatever conventions its owner chose.
 */
const GITATTRIBUTES = '* text=auto eol=lf\n'

export async function isRepo(dir: string): Promise<boolean> {
  const { code, stdout } = await git(['rev-parse', '--is-inside-work-tree'], dir)
  return code === 0 && stdout.trim() === 'true'
}

export async function repoRoot(dir: string): Promise<string> {
  return (await gitOrThrow(['rev-parse', '--show-toplevel'], dir, 'Could not locate the repository')).trim()
}

/**
 * Bind `dir` as the tasks repo, initialising one if it isn't already a repo.
 * Returns the repository root.
 */
export async function bindRepo(dir: string): Promise<string> {
  if (!(await isRepo(dir))) {
    // `-b main` explicitly: with init.defaultBranch unset, git would otherwise
    // create `master` and print a hint.
    await gitOrThrow(['init', '-b', 'main'], dir, 'Could not create a repository')
    if (!existsSync(join(dir, '.gitattributes'))) {
      await writeFile(join(dir, '.gitattributes'), GITATTRIBUTES, 'utf8')
    }
  }

  const root = await repoRoot(dir)
  await ensureIdentity(root)
  return root
}

/**
 * Committing needs an identity. If the user has none configured, give the repo
 * a local one rather than failing at the first commit with git's own error.
 * `--local` means this never touches their global config.
 */
async function ensureIdentity(dir: string): Promise<void> {
  const existing = await git(['config', '--get', 'user.email'], dir)
  if (existing.code === 0 && existing.stdout.trim()) return

  await git(['config', '--local', 'user.name', 'GitTasks'], dir)
  await git(['config', '--local', 'user.email', 'gittasks@localhost'], dir)
}

export async function hasRemote(dir: string): Promise<boolean> {
  const { code, stdout } = await git(['remote'], dir)
  return code === 0 && stdout.trim() !== ''
}
