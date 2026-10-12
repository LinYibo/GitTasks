/**
 * The handshake that connects the app to a GitHub repo.
 *
 * Sign in is "Sign in with GitHub" when the OAuth proxy is configured in the
 * build; pasting a fine-grained PAT stays as the fallback for builds without
 * it. Either way the user ends up on the repo picker, and only the final
 * connect goes through the store, which re-validates everything before
 * anything is remembered.
 */

import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'

import type { RepoInfo } from '../lib/github.ts'
import * as github from '../lib/github.ts'
import { beginOAuth, consumeOAuthReturn, oauthConfigured } from '../lib/oauth.ts'
import logo from '../assets/logo.png'
import { useStore } from '../store.ts'

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

/** The GitHub mark. lucide-react dropped brand icons, so it lives here. */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

type Authenticated = { login: string; repos: RepoInfo[]; token: string }

export function ConnectScreen() {
  const [authenticated, setAuthenticated] = useState<Authenticated | null>(null)
  const [oauthError, setOauthError] = useState<string | null>(null)
  const [exchanging, setExchanging] = useState(false)

  // The OAuth return leg: the Worker redirected back here with the token in
  // the fragment. Consume it, then validate it like a pasted one.
  useEffect(() => {
    const outcome = consumeOAuthReturn()
    if (!outcome) return

    if (outcome.kind === 'error') {
      setOauthError(outcome.message)
      return
    }

    setExchanging(true)
    void (async () => {
      try {
        const user = await github.getUser(outcome.token)
        const repos = await github.listRepos(outcome.token)
        setAuthenticated({ login: user.login, repos, token: outcome.token })
      } catch (cause) {
        setOauthError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        setExchanging(false)
      }
    })()
  }, [])

  return (
    <div className="m-auto flex w-full max-w-sm flex-col items-center justify-center gap-5 py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <img src={logo} alt="" className="h-14 w-14" aria-hidden="true" />
        <div>
          <p className="text-lg font-semibold tracking-tight text-fg">Connect a repo</p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Your tasks live in a tasks.md file in your own GitHub repository, as plain markdown.
          </p>
        </div>
      </header>

      {exchanging ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking your GitHub account…
        </p>
      ) : authenticated ? (
        <RepoStep
          token={authenticated.token}
          login={authenticated.login}
          repos={authenticated.repos}
          onBack={() => setAuthenticated(null)}
        />
      ) : (
        <AuthStep oauthError={oauthError} onAuthenticated={setAuthenticated} />
      )}
    </div>
  )
}

function AuthStep({
  oauthError,
  onAuthenticated,
}: {
  oauthError: string | null
  onAuthenticated(auth: Authenticated): void
}) {
  const [showTokenForm, setShowTokenForm] = useState(!oauthConfigured())

  if (showTokenForm) {
    return (
      <div className="flex w-full flex-col gap-3">
        <TokenStep onAuthenticated={onAuthenticated} />
        {oauthConfigured() && (
          <button
            type="button"
            onClick={() => setShowTokenForm(false)}
            className="self-center text-xs text-subtle transition-colors duration-150 hover:text-fg"
          >
            Sign in with GitHub instead
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        type="button"
        onClick={() => beginOAuth()}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-fg transition-transform duration-150 hover:bg-primary/90 active:scale-[0.98]"
      >
        <GithubMark className="h-4 w-4" />
        Sign in with GitHub
      </button>

      {oauthError && <p className="text-sm text-danger">{oauthError}</p>}

      <button
        type="button"
        onClick={() => setShowTokenForm(true)}
        className="self-center text-xs text-subtle transition-colors duration-150 hover:text-fg"
      >
        Or paste a personal access token
      </button>
    </div>
  )
}

function TokenStep({ onAuthenticated }: { onAuthenticated(auth: Authenticated): void }) {
  const [token, setToken] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function checkToken(): Promise<void> {
    const trimmed = token.trim()
    if (!trimmed || checking) return

    setChecking(true)
    setError(null)
    try {
      const user = await github.getUser(trimmed)
      const repos = await github.listRepos(trimmed)
      onAuthenticated({ login: user.login, repos, token: trimmed })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setChecking(false)
    }
  }

  return (
    <form
      className="flex w-full flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void checkToken()
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fg">GitHub token</span>
        <input
          type="password"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="github_pat_…"
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
      </label>

      <p className="text-xs leading-relaxed text-subtle">
        Create a{' '}
        <a
          href={TOKEN_URL}
          target="_blank"
          rel="noreferrer"
          className="text-accent underline-offset-2 hover:underline"
        >
          fine-grained personal access token
        </a>{' '}
        with <span className="text-muted">Contents: read and write</span> access to the repo you
        want to use. It is stored in this browser only.
      </p>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={!token.trim() || checking}
        className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-fg transition-transform duration-150 hover:bg-primary/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
      >
        {checking && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Continue
      </button>
    </form>
  )
}

function RepoStep({
  token,
  login,
  repos,
  onBack,
}: {
  token: string
  login: string
  repos: RepoInfo[]
  onBack(): void
}) {
  const connect = useStore((state) => state.connect)

  const [manual, setManual] = useState(repos.length === 0)
  const [fullName, setFullName] = useState('')
  const [owner, setOwner] = useState('')
  const [repoName, setRepoName] = useState('')
  const [branches, setBranches] = useState<string[] | null>(null)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [branch, setBranch] = useState('')
  const [path, setPath] = useState('tasks.md')
  const [connecting, setConnecting] = useState(false)

  const repo = manual ? { owner: owner.trim(), name: repoName.trim() } : splitFullName(fullName)

  async function loadBranches(owner: string, repo: string): Promise<void> {
    setLoadingBranches(true)
    try {
      const names = await github.listBranches(owner, repo)
      setBranches(names)
      setBranch((current) => (names.includes(current) ? current : (names[0] ?? current)))
    } catch {
      // A repo the token cannot read, or a typo: fall back to a free-text
      // branch and let the connect attempt explain what is wrong.
      setBranches(null)
    } finally {
      setLoadingBranches(false)
    }
  }

  function pickRepo(value: string): void {
    setFullName(value)
    setBranches(null)
    setBranch('')

    const info = repos.find((candidate) => `${candidate.owner}/${candidate.name}` === value)
    if (info) {
      setBranch(info.defaultBranch)
      void loadBranches(info.owner, info.name)
    }
  }

  const ready =
    !!repo.owner && !!repo.name && !!branch.trim() && !!path.trim() && !connecting && !loadingBranches

  async function submit(): Promise<void> {
    if (!ready) return

    setConnecting(true)
    try {
      await connect({ token, owner: repo.owner, repo: repo.name, branch: branch.trim(), path: path.trim() })
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Signed in as <span className="font-medium text-fg">{login}</span>
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-subtle transition-colors duration-150 hover:text-fg"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" />
          Back
        </button>
      </div>

      {!manual ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">Repository</span>
          <select
            autoFocus
            className="h-10 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-fg outline-none focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
            value={fullName}
            onChange={(event) => void pickRepo(event.target.value)}
          >
            <option value="">Select a repo…</option>
            {repos.map((candidate) => (
              <option key={`${candidate.owner}/${candidate.name}`} value={`${candidate.owner}/${candidate.name}`}>
                {candidate.owner}/{candidate.name}
                {candidate.private ? ' (private)' : ''}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="flex gap-2">
          <input
            aria-label="Repository owner"
            placeholder="owner"
            autoComplete="off"
            spellCheck={false}
            className="h-10 w-1/2 rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          />
          <input
            aria-label="Repository name"
            placeholder="repo"
            autoComplete="off"
            spellCheck={false}
            className="h-10 w-1/2 rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
            value={repoName}
            onChange={(event) => setRepoName(event.target.value)}
          />
        </div>
      )}

      {manual && repo.owner && repo.name && !loadingBranches && (
        <button
          type="button"
          onClick={() => void loadBranches(repo.owner, repo.name)}
          className="-mt-1 self-start text-xs text-subtle transition-colors duration-150 hover:text-fg"
        >
          Look up branches
        </button>
      )}

      {loadingBranches ? (
        <p className="inline-flex items-center gap-2 text-xs text-subtle">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Loading branches…
        </p>
      ) : branches ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">Branch</span>
          <select
            className="h-10 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-fg outline-none focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
          >
            {branches.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">Branch</span>
          <input
            placeholder="main"
            autoComplete="off"
            spellCheck={false}
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fg">File path</span>
        <input
          placeholder="tasks.md"
          autoComplete="off"
          spellCheck={false}
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
          value={path}
          onChange={(event) => setPath(event.target.value)}
        />
      </label>

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!ready}
        className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-fg transition-transform duration-150 hover:bg-primary/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
      >
        {connecting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Connect
      </button>

      <button
        type="button"
        onClick={() => setManual(!manual)}
        className="self-center text-xs text-subtle transition-colors duration-150 hover:text-fg"
      >
        {manual ? 'Pick from the list instead' : 'Enter a repo manually'}
      </button>
    </div>
  )
}

function splitFullName(fullName: string): { owner: string; name: string } {
  const [owner = '', name = ''] = fullName.split('/')
  return { owner, name }
}
