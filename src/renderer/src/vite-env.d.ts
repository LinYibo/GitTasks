/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Client ID of the GitHub OAuth App. OAuth sign-in is offered only when set. */
  readonly VITE_GITHUB_CLIENT_ID?: string
  /** Base URL of the deployed OAuth proxy Worker, e.g. https://gittasks-oauth-proxy.example.workers.dev */
  readonly VITE_OAUTH_PROXY_URL?: string
}
