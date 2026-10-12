import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import worker, { handleCallback, type Env } from './index.ts'

const ENV: Env = {
  GITHUB_CLIENT_ID: 'client-id',
  GITHUB_CLIENT_SECRET: 'client-secret',
  APP_URL: 'https://app.example.com/',
}

const CALLBACK = 'https://worker.example.com/callback'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function githubReturns(body: unknown): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })) as typeof fetch
}

test('a successful exchange redirects to the app with the token and the state', async () => {
  githubReturns({ access_token: 'tok123', token_type: 'bearer', scope: 'repo' })

  const response = await handleCallback(new URL(`${CALLBACK}?code=abc&state=st1`), ENV)

  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), 'https://app.example.com/#token=tok123&state=st1')
})

test('GitHub sends the secret to the token endpoint', async () => {
  // An array, not a `let`: control-flow analysis does not track assignments
  // made inside the mocked fetch and would narrow the variable to `null`.
  const captured: Array<{ url: string; init: RequestInit }> = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({ url: String(input), init: init ?? {} })
    return new Response(JSON.stringify({ access_token: 'tok123' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  await handleCallback(new URL(`${CALLBACK}?code=abc`), ENV)

  assert.equal(captured.length, 1)
  assert.equal(captured[0]?.url, 'https://github.com/login/oauth/access_token')
  const body = JSON.parse(String(captured[0]?.init.body)) as Record<string, string>
  assert.equal(body.client_id, 'client-id')
  assert.equal(body.client_secret, 'client-secret')
  assert.equal(body.code, 'abc')
})

test('a user who denies access is sent back with the reason', async () => {
  const response = await handleCallback(
    new URL(`${CALLBACK}?error=access_denied&error_description=The%20user%20has%20denied`),
    ENV,
  )

  assert.equal(response.status, 302)
  assert.equal(
    response.headers.get('location'),
    `https://app.example.com/#oauth_error=${encodeURIComponent('access_denied: The user has denied')}`,
  )
})

test('a callback with no code at all fails informatively', async () => {
  const response = await handleCallback(new URL(CALLBACK), ENV)

  assert.equal(response.status, 302)
  assert.match(response.headers.get('location') ?? '', /oauth_error=/)
})

test('an exchange without a token in the answer fails with GitHub\u2019s own words', async () => {
  githubReturns({ error: 'bad_verification_code', error_description: 'The code passed is incorrect.' })

  const response = await handleCallback(new URL(`${CALLBACK}?code=abc`), ENV)

  assert.equal(response.status, 302)
  assert.match(response.headers.get('location') ?? '', /The%20code%20passed%20is%20incorrect/)
})

test('the route-bound path gittasks.com/oauth/callback works through the default export', async () => {
  githubReturns({ access_token: 'tok123' })

  const request = new Request('https://gittasks.com/oauth/callback?code=abc&state=st1')
  const response = await worker.fetch(request, ENV)

  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), 'https://app.example.com/#token=tok123&state=st1')
})

test('non-GET requests are refused before anything is exchanged', async () => {
  const request = new Request('https://gittasks.com/oauth/callback', { method: 'POST' })
  const response = await worker.fetch(request, ENV)

  assert.equal(response.status, 405)
})
