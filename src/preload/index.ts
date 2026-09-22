import { contextBridge, ipcRenderer } from 'electron'

import type { IpcRendererEvent } from 'electron'

import type { ApplyRequest, GitTasksApi, OpenTarget } from '../shared/ipc-contract.ts'
import { CHANNELS } from '../shared/ipc-contract.ts'

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: IpcRendererEvent, payload: T): void => listener(payload)

  ipcRenderer.on(channel, wrapped)

  // A real unsubscribe, not a no-op: React remounts components, and without
  // removeListener every remount would leave a listener behind.
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const api: GitTasksApi = {
  state: () => ipcRenderer.invoke(CHANNELS.state),
  choose: () => ipcRenderer.invoke(CHANNELS.choose),
  apply: (request: ApplyRequest) => ipcRenderer.invoke(CHANNELS.apply, request),
  open: (target: OpenTarget) => ipcRenderer.invoke(CHANNELS.open, target),
  onDocChanged: (listener) => subscribe(CHANNELS.docChanged, listener),
}

contextBridge.exposeInMainWorld('gittasks', api)
