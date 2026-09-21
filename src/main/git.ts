/**
 * The only place `git` is ever executed.
 *
 * GitTasks never runs a destructive command. Deliberately absent, and not to be
 * added: `reset --hard`, `checkout -- <file>`, `clean`, `restore`, and
 * `push --force`. The invariant is that a user's tasks.md is never silently
 * discarded — every failure mode here leaves the working tree untouched.
 */

import { spawn } from 'node:child_process'

import { AppError } from './errors.ts'

/** Conventional shell exit code for "command not found". */
const GIT_MISSING = 127

export type GitResult = {
  code: number
  stdout: string
  stderr: string
}

let gitPath = 'git'

export function setGitPath(path: string): void {
  gitPath = path
}

export async function git(args: string[], cwd: string): Promise<GitResult> {
  return new Promise((resolve) => {
    // Arguments go through as an array. Concatenating them into a shell string
    // is what breaks on Windows paths and on any filename with a space.
    const child = spawn(gitPath, ['-c', 'core.quotepath=false', ...args], {
      cwd,
      shell: false,
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => (stdout += chunk))
    child.stderr.on('data', (chunk: string) => (stderr += chunk))

    // A missing binary is reported as an exit code rather than a rejection, so
    // callers have one control flow to reason about instead of two.
    child.on('error', (error) => resolve({ code: GIT_MISSING, stdout: '', stderr: error.message }))
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }))
  })
}

/** Run git, throwing a typed error unless it succeeded. Returns stdout. */
export async function gitOrThrow(args: string[], cwd: string, action: string): Promise<string> {
  const { code, stdout, stderr } = await git(args, cwd)
  if (code === 0) return stdout

  if (code === GIT_MISSING) {
    throw new AppError('GIT_NOT_FOUND', 'Git was not found. Install Git and restart GitTasks.')
  }

  throw new AppError('UNKNOWN', `${action}: ${(stderr || stdout).trim()}`)
}

export async function isGitAvailable(): Promise<boolean> {
  return (await git(['--version'], process.cwd())).code === 0
}
