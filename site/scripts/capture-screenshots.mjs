/**
 * Captures the site's screenshots from the real app.
 *
 * The script points a scratch copy of the app at a throwaway demo repo (so the
 * shots show a believable, populated list), drives the window over the Chrome
 * DevTools Protocol, and writes 2x PNGs into public/screenshots/.
 *
 *   node scripts/capture-screenshots.mjs
 *
 * Requires: the packaged app built at ../GitTasks/dist/win-unpacked, git on
 * PATH, and no running GitTasks instance (it would fight over the config file).
 * The app's config.json is backed up and restored around the run.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SITE = join(HERE, '..')
const OUT_DIR = join(SITE, 'public', 'screenshots')
const APP_EXE = 'C:/Users/islyb/Projects/GitTasks/dist/win-unpacked/GitTasks.exe'

const PORT = 9222
const VIEW = { width: 720, height: 820, deviceScaleFactor: 2 }

const DEMO_ROOT = join(tmpdir(), 'gittasks-capture')
const DEMO_REPO = join(DEMO_ROOT, 'my-tasks')
const CONFIG_PATHS = [
  join(process.env.APPDATA, 'gittasks'),
  join(process.env.APPDATA, 'GitTasks'),
].map((dir) => join(dir, 'config.json'))

const TASKS_MD = `- [ ] Draft the launch post #marketing +site p1 due:2026-09-18
- [ ] Record a short demo loop for the README +site p2
- [ ] Polish empty states for every filter #design p3 due:2026-09-15
- [x] Set up the git-backed storage layer +core
- [x] Wire the file watcher so editor edits show up #sync
- [x] Ship the first Windows installer +release
`

// ---------------------------------------------------------------- demo repo

function git(args) {
  return execFileSync('git', args, { cwd: DEMO_REPO, stdio: 'pipe' }).toString().trim()
}

async function seedDemoRepo() {
  await rm(DEMO_ROOT, { recursive: true, force: true })
  await mkdir(DEMO_REPO, { recursive: true })
  git(['init', '-b', 'main'])
  git(['config', 'user.name', 'GitTasks'])
  git(['config', 'user.email', 'gittasks@localhost'])

  // Three believable commits so the status footer has a history to show.
  const active = [
    '- [ ] Draft the launch post #marketing +site p1 due:2026-09-18',
    '- [ ] Record a short demo loop for the README +site p2',
    '- [ ] Polish empty states for every filter #design p3 due:2026-09-15',
  ]
  const done = [
    '- [x] Set up the git-backed storage layer +core',
    '- [x] Wire the file watcher so editor edits show up #sync',
    '- [x] Ship the first Windows installer +release',
  ]

  await writeFile(join(DEMO_REPO, 'tasks.md'), `${active.join('\n')}\n`, 'utf8')
  git(['add', 'tasks.md'])
  git(['commit', '-m', 'tasks: +3'])

  await writeFile(
    join(DEMO_REPO, 'tasks.md'),
    `${[done[0], ...active].join('\n')}\n`,
    'utf8',
  )
  git(['add', 'tasks.md'])
  git(['commit', '-m', 'tasks: ✓1'])

  await writeFile(join(DEMO_REPO, 'tasks.md'), TASKS_MD, 'utf8')
  git(['add', 'tasks.md'])
  git(['commit', '-m', 'tasks: +3 ✓2'])

  return git(['log', '--oneline'])
}

// ------------------------------------------------------------ app config

async function seedConfig() {
  const backups = []
  // `repoPath` is what the app restores on launch; keep any other keys intact.
  for (const path of CONFIG_PATHS) {
    const existed = existsSync(path)
    const original = existed ? await readFile(path, 'utf8') : null
    backups.push({ path, existed, original })

    let config = {}
    try {
      config = existed ? JSON.parse(original) : {}
    } catch {
      // A corrupt config is the app's own first-run state; overwrite it freely.
    }
    config.repoPath = DEMO_REPO
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  }
  return backups
}

async function restoreConfig(backups) {
  for (const { path, existed, original } of backups) {
    if (existed) await writeFile(path, original, 'utf8')
    else await rm(path, { force: true })
  }
}

// ------------------------------------------------------------------- cdp

class Cdp {
  constructor(url) {
    this.url = url
    this.nextId = 0
    this.pending = new Map()
  }

  async connect() {
    this.socket = new WebSocket(this.url)
    this.socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data)
      const entry = this.pending.get(message.id)
      if (!entry) return
      this.pending.delete(message.id)
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)))
      else entry.resolve(message.result)
    })
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
  }

  send(method, params = {}) {
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async eval(expression) {
    const { result } = await this.send('Runtime.evaluate', { expression, returnByValue: true })
    return result.value
  }

  async waitFor(expression, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (await this.eval(expression)) return
      await sleep(200)
    }
    throw new Error(`timed out waiting for: ${expression}`)
  }

  async shoot(name) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    const file = join(OUT_DIR, name)
    await writeFile(file, Buffer.from(data, 'base64'))
    return file
  }

  close() {
    try {
      this.socket.close()
    } catch {
      /* already gone */
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function findPageTarget() {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await response.json()
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch {
      /* app still starting */
    }
    await sleep(400)
  }
  throw new Error(`the app never exposed a debuggable page on port ${PORT}`)
}

/** Fail fast instead of fighting a running instance over config.json. */
function assertAppClosed() {
  const listing = execFileSync('tasklist', ['/FI', 'IMAGENAME eq GitTasks.exe'], { stdio: 'pipe' })
  if (listing.toString().includes('GitTasks.exe')) {
    throw new Error('GitTasks is running — close it first, then re-run this script')
  }
}

async function pngSize(file) {
  const header = await readFile(file)
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) }
}

// ------------------------------------------------------------------ main

async function main() {
  assertAppClosed()
  if (!existsSync(APP_EXE)) throw new Error(`packaged app not found: ${APP_EXE}`)

  console.log('seeding demo repo…')
  console.log(await seedDemoRepo())

  const backups = await seedConfig()
  await mkdir(OUT_DIR, { recursive: true })

  const app = spawn(APP_EXE, [`--remote-debugging-port=${PORT}`], { stdio: 'ignore' })
  let cdp = null

  try {
    const target = await findPageTarget()
    cdp = new Cdp(target)
    await cdp.connect()
    await cdp.send('Page.enable')

    // The composer only exists once a repo is bound and the state has settled.
    await cdp.waitFor(`!!document.querySelector('[aria-label="New task"]')`)

    try {
      await cdp.send('Emulation.setDeviceMetricsOverride', { ...VIEW, mobile: false })
    } catch (error) {
      console.warn('device metrics override unsupported, capturing at native scale:', error.message)
    }
    await sleep(800)

    const shots = []
    shots.push(await cdp.shoot('all.png'))

    const clicked = await cdp.eval(`
      (() => {
        const tab = [...document.querySelectorAll('[role="tab"]')].find((el) => el.textContent.trim() === 'Active')
        if (!tab) return false
        tab.click()
        return true
      })()
    `)
    if (!clicked) throw new Error('could not find the Active filter tab')
    await sleep(600)
    shots.push(await cdp.shoot('active.png'))

    const typed = await cdp.eval(`
      (() => {
        const input = document.querySelector('[aria-label="New task"]')
        if (!input) return false
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(input, 'Review the landing page copy #web +site p1 due:2026-09-21')
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.focus()
        return true
      })()
    `)
    if (!typed) throw new Error('could not type into the composer')
    await sleep(600)
    shots.push(await cdp.shoot('composer.png'))

    for (const file of shots) {
      const { width, height } = await pngSize(file)
      console.log(`wrote ${file} (${width}x${height})`)
    }
  } finally {
    cdp?.close()
    execFileSync('taskkill', ['/PID', String(app.pid), '/T', '/F'], { stdio: 'ignore' })
    await sleep(500)
    await restoreConfig(backups)
    await rm(DEMO_ROOT, { recursive: true, force: true })
    console.log('app closed, config restored, demo repo removed')
  }
}

main().catch((error) => {
  console.error(error)
  console.error('if this failed mid-run, the config backup is the file the script rewrote under %APPDATA%')
  process.exitCode = 1
})
