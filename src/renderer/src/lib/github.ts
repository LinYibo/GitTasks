/**
 * A minimal GitHub REST client for the browser.
 *
 * api.github.com serves CORS headers, so the app talks to it directly with no
 * backend of its own. The token is a fine-grained PAT the user pastes in;
 * scoping it to one repo with Contents read/write is exactly the access this
 * app needs, nothing more.
 *
 * Every failure becomes an `AppError` here, so callers can throw freely and
 * display `error.message` as-is.
 */

import { AppError } from '../../../shared/errors.ts'

const API_ROOT = 'https://api.github.com'
const API_VERSION = '2022-11-28'

const TOKEN_KEY = 'gittasks.token'

export function readToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export type UserInfo = { login: string }

export type RepoInfo = {
  owner: string
  name: string
  defaultBranch: string
  private: boolean
}

/** A tasks file as GitHub holds it. `sha` is null when the file doesn't exist. */
export type FileInfo = {
  sha: string | null
  text: string
}

export type PutResult = {
  /** The blob sha of the file after the write. */
  sha: string
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/vnd.github+json')
  headers.set('X-GitHub-Api-Version', API_VERSION)
  if (init.body !== undefined && init.body !== null) headers.set('Content-Type', 'application/json')

  const bearer = token ?? readToken()
  if (bearer) headers.set('Authorization', `Bearer ${bearer}`)

  let response: Response
  try {
    response = await fetch(`${API_ROOT}${path}`, { ...init, headers })
  } catch {
    throw new AppError('NETWORK', 'Could not reach GitHub. Check your connection and try again.')
  }

  if (response.ok) {
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  const body = (await response.json().catch(() => null)) as { message?: string } | null

  if (response.status === 401) {
    throw new AppError('AUTH', 'GitHub rejected the token. Check that it is valid and not expired.')
  }
  if (response.status === 404) {
    throw new AppError(
      'NOT_FOUND',
      'Not found on GitHub. Check the repo, branch and path, and that the token can access them.',
    )
  }
  // A exhausted rate limit or a forbidden resource both arrive as 403.
  if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
    throw new AppError('RATE_LIMIT', 'GitHub rate limit reached. Wait a few minutes and try again.')
  }
  // A stale sha arrives as 409; creating over a file that appeared in the
  // meantime arrives as 422. Both mean "GitHub has content you have not seen".
  if (response.status === 409 || response.status === 422) {
    throw new AppError(
      'STALE_DOC',
      'The file changed on GitHub. The list has been refreshed — try again.',
    )
  }

  throw new AppError('IO', body?.message ?? `GitHub request failed (${response.status}).`)
}

// --- Identity and repos ------------------------------------------------------

export async function getUser(token: string): Promise<UserInfo> {
  return request<UserInfo>('/user', {}, token)
}

export async function listRepos(token: string): Promise<RepoInfo[]> {
  const repos = await request<
    Array<{
      full_name: string
      default_branch: string
      private: boolean
      owner: { login: string }
    }>
  >('/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator', {}, token)

  return repos.map((repo) => ({
    owner: repo.owner.login,
    name: repo.full_name.split('/')[1],
    defaultBranch: repo.default_branch,
    private: repo.private,
  }))
}

/** A missing repo, a missing branch and an inaccessible repo all 404 alike. */
export async function listBranches(owner: string, repo: string): Promise<string[]> {
  const branches = await request<Array<{ name: string }>>(
    `/repos/${owner}/${repo}/branches?per_page=100`,
  )
  return branches.map((branch) => branch.name)
}

export async function getRepo(owner: string, repo: string): Promise<RepoInfo> {
  const repoData = await request<{ name: string; default_branch: string; private: boolean; owner: { login: string } }>(
    `/repos/${owner}/${repo}`,
  )
  return {
    owner: repoData.owner.login,
    name: repoData.name,
    defaultBranch: repoData.default_branch,
    private: repoData.private,
  }
}

// --- File contents -----------------------------------------------------------

/**
 * Read tasks.md at a ref. A missing *file* is the ordinary first-run state and
 * resolves to `{ sha: null, text: '' }`; a missing *repo* or *branch* throws.
 * The 404 probe that tells those apart costs two extra requests, so callers
 * that already validated the repo (the poller) can skip it.
 */
export async function getFile(
  owner: string,
  repo: string,
  path: string,
  ref: string,
  options: { probe404?: boolean } = {},
): Promise<FileInfo> {
  const probe404 = options.probe404 ?? true
  try {
    const data = await request<{
      sha: string
      content: string | null
      encoding: string
    }>(`/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`)

    const text = data.content ? decodeBase64(data.content) : ''
    return { sha: data.sha, text }
  } catch (error) {
    if (probe404 && error instanceof AppError && error.code === 'NOT_FOUND') {
      await getRepo(owner, repo)
      const branches = await listBranches(owner, repo)
      if (!branches.includes(ref)) throw new AppError('NOT_FOUND', `Branch “${ref}” not found.`)
      return { sha: null, text: '' }
    }
    throw error
  }
}

/**
 * Write tasks.md as one commit. Pass `sha` to replace an existing file; omit
 * it to create one. GitHub answers a stale sha with 409, which `request`
 * maps to STALE_DOC.
 */
export async function putFile(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  options: { text: string; sha: string | null; message: string },
  token?: string,
): Promise<PutResult> {
  const result = await request<{ content: { sha: string } }>(
    `/repos/${owner}/${repo}/contents/${encodePath(path)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message: options.message,
        content: encodeBase64(options.text),
        branch,
        ...(options.sha ? { sha: options.sha } : {}),
      }),
    },
    token,
  )

  return { sha: result.content.sha }
}

// --- Helpers -----------------------------------------------------------------

/** A path may contain slashes (a subfolder) but must stay inside the repo. */
function encodePath(path: string): string {
  return path
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map(encodeURIComponent)
    .join('/')
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const CHUNK = 0x8000
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK))
  }
  return btoa(binary)
}

function decodeBase64(base64: string): string {
  const bytes = Uint8Array.from(atob(base64.replace(/\s/g, '')), (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
