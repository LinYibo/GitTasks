import { join } from 'node:path'

import { app, BrowserWindow, Menu } from 'electron'

import { registerIpc } from './ipc.ts'
import { detectGit, flushPending, restore } from './session.ts'

/**
 * Guards the async flush in `before-quit`: preventing the quit to commit first
 * means a second quit attempt arrives while the first is still pending.
 */
let quitting = false

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 720,
    height: 820,
    minWidth: 420,
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

  // Commit pending edits when the user looks away, so history stays tidy
  // without needing a commit per keystroke.
  window.on('blur', () => void flushPending())

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
  await detectGit()
  await restore()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (quitting) return

  event.preventDefault()
  quitting = true

  // `flushPending` reports its own failures rather than rejecting, so this
  // always reaches `quit`.
  void flushPending().finally(() => app.quit())
})
