import type { GitTasksApi } from '../../shared/ipc-contract.ts'

declare global {
  interface Window {
    gittasks: GitTasksApi
  }
}

/** The typed bridge that the preload script exposes. */
export const api: GitTasksApi = window.gittasks
