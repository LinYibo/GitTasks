# GitTasks

A no-server, markdown-based todo app that runs entirely in the browser and
persists your tasks to **your own GitHub repository**.

Your tasks live in a plain `tasks.md` file — one `## heading` per project,
one `- [ ]` checkbox line per task. Every edit is a single descriptive commit,
so your repo's history reads like a changelog, and any markdown editor can
work on the same file alongside the app.

Built with [Vite](https://vite.dev/) + [React](https://react.dev/) +
[Tailwind CSS](https://tailwindcss.com/). There is no backend: the app talks
to the GitHub REST API directly from your browser.

## Connecting a repo

1. Open GitTasks and **Sign in with GitHub** (or paste a fine-grained token —
   see below), pick a repository, branch and file path (default `tasks.md`),
   and connect.

The token and your last document are cached in `localStorage` of your browser
only. Nothing is sent anywhere except `api.github.com`. Because the token
lives in the browser, treat the host you deploy to as part of the trust
boundary — deploy to a host you control over HTTPS.

### Sign in with GitHub (OAuth)

GitHub's token exchange requires the OAuth App's client secret, which a static
site cannot hold. A small proxy Worker (in `worker/`) holds the secret and does
that one call; the app itself stays static. One-time setup:

1. Create an **OAuth App** at [github.com/settings/developers](https://github.com/settings/developers)
   (not a GitHub App). Homepage URL: `https://gittasks.com`. Authorization callback
   URL: `https://gittasks.com/oauth/callback`. Note the client ID and generate a
   client secret.
2. Store the secret in the Worker (the app and the proxy deploy as one Worker
   via the root `wrangler.jsonc`):
   ```bash
   npm install
   npx wrangler login
   npx wrangler secret put GITHUB_CLIENT_SECRET
   ```
   and fill in the real client ID — either edit `GITHUB_CLIENT_ID` in
   `wrangler.jsonc` / `VITE_GITHUB_CLIENT_ID` in `.env.production`, or set
   `VITE_GITHUB_CLIENT_ID` as an environment variable on the build (the
   environment takes precedence).

For local development with OAuth, copy `.dev.vars.example` to `.dev.vars`,
add a second callback `http://localhost:8787/callback` to the OAuth App, and
run `npm run dev:cf` — the site and the callback together on port 8787. For
fast iteration without OAuth, `npm run dev` (Vite HMR) with
`VITE_OAUTH_PROXY_URL=http://localhost:8787` in `.env.local` works too; the
page is served from Vite while the callback still hits wrangler dev.

### Pasting a token instead

The OAuth button needs the setup above, so builds without it fall back to a
fine-grained personal access token:
[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
with **Contents: read and write** permission for the repo you want to use.

## How syncing works

- The connected repo's `tasks.md` is the single source of truth; the app holds
  a projection of it, cached for instant reloads and offline viewing.
- Each mutation is applied to the in-memory document and written back as one
  commit with a message describing it (`Add task: …`, `Complete task: …`).
- Writes carry the file's blob sha, so a change committed elsewhere in the
  meantime is detected as a conflict: the app refreshes and asks you to retry
  rather than overwriting anyone's work.
- While the tab is visible, the file is polled every 20 seconds, so edits made
  in another tab or on GitHub show up without a reload.

## Development

```bash
npm install
npm run dev          # dev server with hot reload
npm run typecheck    # tsc --build
npm run test         # node --test (pure core: parse, format, mutations)
npm run build        # production build into dist/
```

## Deployment

The site and the OAuth proxy deploy together as **one Cloudflare Worker with
static assets** (root `wrangler.jsonc`): `npm run build` produces `dist/`,
and `npx wrangler deploy` ships the assets plus the callback handler to the
`gittasks.com/*` route. That is the entire Cloudflare Workers Builds
pipeline — build command `npm run build`, deploy command `npx wrangler deploy`.

Requirements on the Cloudflare side: the gittasks.com zone on Cloudflare with
a proxied DNS record for the apex. If the hostname was previously served by a
Pages project, detach that custom domain so the Worker route can take over.

## License

MIT
