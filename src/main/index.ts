import { join } from 'node:path'

import { app, BrowserWindow, Menu } from 'electron'

import { registerIpc } from './ipc.ts'
import { restore } from './session.ts'

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1040,
    height: 860,
    // Wide enough for the project sidebar and the task pane together. The
    // sidebar does not collapse, so there is no point going narrower.
    minWidth: 760,
    minHeight: 520,
    // Matches the app background, so there is no white flash on open.
    backgroundColor: '#0a0a0b',
    // The packaged exe carries its own icon (build/icon.ico), but under
    // electron-vite the window would show the stock Electron one. The 64px
    // frame is deliberate: a dev window hands Windows one bitmap for every
    // slot, and the title bar wants as little as 16-24px, so a large image
    // would come out aliased. Paths do not exist inside asar, hence dev only.
    icon: process.env.ELECTRON_RENDERER_URL ? join(__dirname, '../../build/icon-dev.png') : undefined,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  window.once('ready-to-show', () => window.show())

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

void app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  registerIpc()

  // Restore before the window exists, so the renderer's first `repo:state` call
  // always sees a settled session rather than racing this.
  await restore()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
