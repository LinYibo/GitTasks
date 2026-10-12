/**
 * OAuth authorization-code proxy for GitTasks.
 *
 * GitHub's token exchange requires the client secret, which the static app
 * cannot hold, so the deployed Worker does that one call. The same Worker
 * also serves the site itself (wrangler.jsonc hands out dist/ as static
 * assets); `run_worker_first` means this fetch handler is invoked for exactly
 * one path, /oauth/callback — every other request is answered from assets
 * and never reaches here.
 *
 * The flow it serves:
 *
 *   app → github.com/login/oauth/authorize (redirect_uri = this Worker)
 *   GitHub → this Worker /oauth/callback?code=…&state=…
 *   Worker → github.com/login/oauth/access_token (secret lives here)
 *   Worker → app/#token=…&state=…   (fragment: never hits any server log)
 *
 * The Worker is stateless: it forwards `state` untouched, and it is the app
 * that verifies it against what it stored before the redirect.
 */

export interface Env {
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  /** Where the app itself is served from. Both success and failure return here. */
  APP_URL: string
}

const TOKEN_URL = 'https://github.com/login/oauth/access_token'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // The Worker serves exactly one route — gittasks.com/oauth/callback in
    // production, the wrangler-dev origin locally — so the path needs no
    // further checking; anything that arrives is treated as the callback.
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })
    return handleCallback(new URL(request.url), env)
  },
}

export async function handleCallback(url: URL, env: Env): Promise<Response> {
  const appUrl = env.APP_URL.replace(/\/+$/, '')

  const fail = (message: string): Response =>
    Response.redirect(`${appUrl}/#oauth_error=${encodeURIComponent(message)}`, 302)

  // The user said no on GitHub's page, or the app is misconfigured.
  const error = url.searchParams.get('error')
  if (error) {
    const description = url.searchParams.get('error_description')
    return fail(description ? `${error}: ${description}` : error)
  }

  const code = url.searchParams.get('code')
  if (!code) return fail('GitHub did not return an authorization code.')

  let exchange: { access_token?: string; error_description?: string }
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    })
    exchange = (await response.json()) as typeof exchange
  } catch {
    return fail('Could not reach GitHub to exchange the authorization code.')
  }

  if (!exchange.access_token) {
    return fail(exchange.error_description ?? 'GitHub rejected the authorization code.')
  }

  const state = url.searchParams.get('state')
  return Response.redirect(
    `${appUrl}/#token=${encodeURIComponent(exchange.access_token)}${
      state ? `&state=${encodeURIComponent(state)}` : ''
    }`,
    302,
  )
}
