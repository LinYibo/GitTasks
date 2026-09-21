/**
 * Channel registration, and the app's single error boundary.
 *
 * Every other module throws and never catches. Only the wrapper below converts
 * a throw into something the renderer can display, which is why no business
 * logic carries a try/catch of its own.
 */

import { BrowserWindow, dialog, ipcMain, shell } from 'electron'

import type { IpcMainInvokeEvent } from 'electron'

import type { OpenTarget, ApplyRequest, SyncMode } from '../shared/ipc-contract.ts'
import { CHANNELS } from '../shared/ipc-contract.ts'
import type { RepoState, Result } from '../shared/types.ts'
import { AppError, toErrorInfo } from './errors.ts'
import * as session from './session.ts'

function handle<A, R>(run: (arg: A) => R | Promise<R>) {
  return async (_event: IpcMainInvokeEvent, arg: A): Promise<Result<Awaited<R>>> => {
    try {
      return { ok: true, data: await run(arg) }
    } catch (error) {
      return { ok: false, error: toErrorInfo(error) }
    }
  }
}

export function registerIpc(): void {
  ipcMain.handle(CHANNELS.state, handle(() => session.state()))
  ipcMain.handle(CHANNELS.choose, handle(() => chooseRepo()))
  ipcMain.handle(CHANNELS.apply, handle((request: ApplyRequest) => session.applyMutation(request.expectedHash, request.mutation)))
  ipcMain.handle(CHANNELS.sync, handle((mode: SyncMode) => session.sync(mode)))
  ipcMain.handle(CHANNELS.open, handle((target: OpenTarget) => open(target)))
}

async function chooseRepo(): Promise<RepoState | null> {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!window) return null

  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    title: 'Choose a folder for your tasks',
    buttonLabel: 'Use this folder',
    properties: ['openDirectory', 'createDirectory'],
  })

  const [dir] = filePaths
  if (canceled || !dir) return null

  return session.openRepo(dir)
}

/**
 * Hand the user off to their own tools. The whole point of storing tasks as
 * markdown in a git repo is that other programs can work with them.
 */
async function open(target: OpenTarget): Promise<void> {
  const path = target === 'folder' ? session.folder() : session.tasksFile()

  // `openPath` reports failure by returning a message rather than throwing.
  const failure = await shell.openPath(path)
  if (failure) throw new AppError('UNKNOWN', failure)
}
