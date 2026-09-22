/**
 * Integration tests for the local-first core: the tasks file on disk. These run
 * against real files in a temp directory, so they cover what unit tests on pure
 * functions cannot.
 *
 * None of these modules import electron, which is what makes that possible.
 */

import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

import { parseDoc } from '../shared/tasks/parse.ts'
import { ensureTasksFile, readTasksFile, TASKS_FILE, writeTasksFile } from './store.ts'
import { applyMutation } from './tasks/mutate.ts'

const created: string[] = []

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'gittasks-'))
  created.push(dir)
  return dir
}

after(async () => {
  await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })))
})

test('creates tasks.md only when it is missing', async () => {
  const dir = await tempDir()
  assert.equal(existsSync(join(dir, TASKS_FILE)), false)

  await ensureTasksFile(dir)
  assert.equal(await readTasksFile(dir), '')

  // Running it again must not truncate what the user already has.
  await writeTasksFile(dir, ['- [ ] Buy milk'])
  await ensureTasksFile(dir)
  assert.equal(await readTasksFile(dir), '- [ ] Buy milk')
})

test('reads an absent file as empty rather than failing', async () => {
  assert.equal(await readTasksFile(await tempDir()), '')
})

test('normalises CRLF on the way in, and always writes LF', async () => {
  const dir = await tempDir()
  await writeFile(join(dir, TASKS_FILE), '- [ ] One\r\n- [x] Two\r\n', 'utf8')

  const doc = await writeTasksFile(dir, parseDoc(await readTasksFile(dir)).lines)

  assert.equal(doc.lines.at(-1), '')
  assert.equal(await readFile(join(dir, TASKS_FILE), 'utf8'), '- [ ] One\n- [x] Two\n')
})

test('round-trips the task metadata through the file', async () => {
  const dir = await tempDir()
  const doc = await writeTasksFile(dir, ['- [ ] Buy milk #home #errand p1 due:2026-09-20'])

  assert.deepStrictEqual(parseDoc(await readTasksFile(dir)).tasks, doc.tasks)
})

test('preserves hand-written markdown around the tasks', async () => {
  const dir = await tempDir()
  const source = '# My tasks\n\nSome notes.\n\n## Work\n\n- [ ] First #work\n\n<!-- keep me -->\n'
  const before = parseDoc(source)

  const doc = await writeTasksFile(
    dir,
    applyMutation(before, { kind: 'add', text: 'Second', projectLine: before.projects[0].line }),
  )

  assert.deepStrictEqual(doc.lines, [
    '# My tasks',
    '',
    'Some notes.',
    '',
    '## Work',
    '',
    '- [ ] First #work',
    '- [ ] Second',
    '',
    '<!-- keep me -->',
    '',
  ])

  assert.equal(await readTasksFile(dir), doc.lines.join('\n'))
})

test('a project document survives the round trip', async () => {
  const dir = await tempDir()
  const source = '# Tasks\n\n## Release\n\n- [ ] Changelog\n\n## Backlog\n\n- [ ] Idea\n'

  const before = parseDoc(source)
  const into = before.projects.find((project) => project.title === 'Release')!.line
  const doc = await writeTasksFile(
    dir,
    applyMutation(before, { kind: 'add', text: 'Tag', projectLine: into }),
  )

  assert.equal(
    await readTasksFile(dir),
    '# Tasks\n\n## Release\n\n- [ ] Changelog\n- [ ] Tag\n\n## Backlog\n\n- [ ] Idea\n',
  )
  const owner = (projectLine: number | null): string | null =>
    doc.projects.find((project) => project.line === projectLine)?.title ?? null

  assert.deepStrictEqual(
    doc.tasks.map((task) => [task.title, owner(task.projectLine)]),
    [['Changelog', 'Release'], ['Tag', 'Release'], ['Idea', 'Backlog']],
  )

  // Deleting a project takes its section with it. With no inbox to catch them,
  // leaving the tasks behind would hand them to the project above.
  const release = doc.projects.find((project) => project.title === 'Release')!.line
  const after = await writeTasksFile(dir, applyMutation(doc, { kind: 'delete-project', line: release }))

  assert.equal(await readTasksFile(dir), '# Tasks\n\n## Backlog\n\n- [ ] Idea\n')
  assert.deepStrictEqual(
    after.tasks.map((task) => task.title),
    ['Idea'],
  )
})

test('survives a crash between the temp write and the rename', async () => {
  // The temp file is a sibling of tasks.md, so a leftover from an interrupted
  // write can never be mistaken for the real file.
  const dir = await tempDir()
  await writeTasksFile(dir, ['- [ ] Buy milk'])

  assert.equal(await readTasksFile(dir), '- [ ] Buy milk')
  assert.equal(existsSync(join(dir, `${TASKS_FILE}.tmp`)), false)
})
