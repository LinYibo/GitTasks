/**
 * Browser-side half of the "Sign in with GitHub" flow.
 *
 * GitHub's OAuth token exchange needs the client secret, which a static site
 * cannot hold, so it runs in a tiny proxy Worker. This module drives the
 * browser through the dance: leave for GitHub's authorize page with a CSRF
 * state, and on return pick the token (or error) out of the URL fragment the
 * Worker redirected back with.
 *
 * The token rides in the fragment, never the query — fragments are not sent to
 * any server, so it stays out of logs.
 */

import { storeToken } from './github.ts'

const OAUTH_STATE_KEY = 'gittasks.oauthState'
const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'

export type OAuthOutcome =
  | { kind: 'token'; token: string }
  | { kind: 'error'; message: string }

export function oauthConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GITHUB_CLIENT_ID && import.meta.env.VITE_OAUTH_PROXY_URL)
}

/** Leave the app for GitHub's authorize page. The user lands back via the Worker. */
export function beginOAuth(): void {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
  const proxyUrl = import.meta.env.VITE_OAUTH_PROXY_URL
  if (!clientId || !proxyUrl) throw new Error('OAuth is not configured in this build.')

  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  sessionStorage.setItem(OAUTH_STATE_KEY, state)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${proxyUrl.replace(/\/+$/, '')}/callback`,
    scope: 'repo',
    state,
    allow_signup: 'true',
  })
  location.assign(`${AUTHORIZE_URL}?${params}`)
}

/**
 * Consume the return leg, once. Reads the fragment the Worker redirected to,
 * verifies the state against what we stored before leaving, stores the token,
 * and scrubs the URL. Returns null when the page was loaded normally.
 */
export function consumeOAuthReturn(): OAuthOutcome | null {
  if (!location.hash) return null

  const params = new URLSearchParams(location.hash.slice(1))

  // Failure leg: the Worker forwards GitHub's denial (or its own failure).
  const oauthError = params.get('oauth_error')
  if (oauthError) {
    clearFragment()
    return { kind: 'error', message: oauthError }
  }

  const token = params.get('token')
  if (!token) return null

  clearFragment()

  // The state check is what makes a forged return — someone handing this
  // browser a token that is not the user's — useless.
  const expected = sessionStorage.getItem(OAUTH_STATE_KEY)
  sessionStorage.removeItem(OAUTH_STATE_KEY)
  if (!expected || params.get('state') !== expected) {
    return { kind: 'error', message: 'Sign-in could not be verified. Please try again.' }
  }

  storeToken(token)
  return { kind: 'token', token }
}

function clearFragment(): void {
  history.replaceState(null, '', location.pathname + location.search)
}
