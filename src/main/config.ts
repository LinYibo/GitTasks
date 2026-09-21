/** Remembers which repo the user last had open, in Electron's userData dir. */

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { app } from 'electron'

type Config = {
  repoPath?: string
  gitPath?: string
}

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

export async function readConfig(): Promise<Config> {
  const path = configPath()
  // Absent or corrupt config is the ordinary first-run state, so it resolves to
  // an empty config rather than an error.
  if (!existsSync(path)) return {}

  try {
    return JSON.parse(await readFile(path, 'utf8')) as Config
  } catch {
    return {}
  }
}

export async function writeConfig(patch: Config): Promise<void> {
  const config = { ...(await readConfig()), ...patch }
  const path = configPath()

  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}
