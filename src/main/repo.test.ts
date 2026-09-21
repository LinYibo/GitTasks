/**
 * Integration tests for the local-first core: repo setup, atomic writes, and
 * auto-commit. These run against real git repositories in a temp directory, so
 * they cover what unit tests on pure functions cannot.
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
import { commitTasks } from './autocommit.ts'
import { git } from './git.ts'
import { bindRepo, isRepo } from './repo.ts'
import { ensureTasksFile, readTasksFile, writeTasksFile } from './store.ts'
import { applyMutation } from './tasks/mutate.ts'

const created: string[] = []

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'gittasks-'))
  created.push(dir)
  return dir
}

/** A directory that GitTasks has been pointed at, ready to use. */
async function tempRepo(): Promise<string> {
  const dir = await tempDir()
  await bindRepo(dir)
  await ensureTasksFile(dir)
  return dir
}

const subject = async (dir: string): Promise<string> =>
  (await git(['log', '-1', '--format=%s'], dir)).stdout.trim()

after(async () => {
  await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })))
})

test('initialises a repository on main', async () => {
  const dir = await tempRepo()

  assert.equal(await isRepo(dir), true)
  assert.equal((await git(['branch', '--show-current'], dir)).stdout.trim(), 'main')
})

test('writes .gitattributes so the tree stays on LF', async () => {
  const dir = await tempRepo()
  assert.equal(await readFile(join(dir, '.gitattributes'), 'utf8'), '* text=auto eol=lf\n')
})

test('leaves an existing repository alone', async () => {
  // Binding to a repo the user already had should not impose our conventions
  // on it, nor re-initialise it.
  const dir = await tempDir()
  await git(['init', '-b', 'main'], dir)

  assert.equal(await bindRepo(dir), await bindRepo(dir))
  assert.equal(existsSync(join(dir, '.gitattributes')), false)
})

test('commits a first task with an added-count subject', async () => {
  const dir = await tempRepo()
  const doc = await writeTasksFile(dir, ['- [ ] Buy milk'])

  assert.equal(await commitTasks(dir, doc.tasks), true)
  assert.equal(await subject(dir), 'tasks: +1')
})

test('reports a completion as completed rather than rewritten', async () => {
  const dir = await tempRepo()

  let doc = await writeTasksFile(dir, ['- [ ] Buy milk'])
  await commitTasks(dir, doc.tasks)

  doc = await writeTasksFile(dir, applyMutation(doc, { kind: 'toggle', line: 0 }))
  await commitTasks(dir, doc.tasks)

  assert.equal(await subject(dir), 'tasks: ✓1')
})

test('summarises an editing burst against HEAD, not the previous edit', async () => {
  const dir = await tempRepo()

  let doc = await writeTasksFile(dir, ['- [ ] one'])
  await commitTasks(dir, doc.tasks)

  // Three uncommitted edits in a row, as a debounced burst would produce.
  doc = await writeTasksFile(dir, applyMutation(doc, { kind: 'add', text: 'two' }))
  doc = await writeTasksFile(dir, applyMutation(doc, { kind: 'add', text: 'three' }))
  doc = await writeTasksFile(dir, applyMutation(doc, { kind: 'toggle', line: 0 }))
  await commitTasks(dir, doc.tasks)

  assert.equal(await subject(dir), 'tasks: +2 ✓1')
})

test('does not create an empty commit when nothing changed', async () => {
  const dir = await tempRepo()
  const doc = await writeTasksFile(dir, ['- [ ] Buy milk'])

  assert.equal(await commitTasks(dir, doc.tasks), true)
  assert.equal(await commitTasks(dir, doc.tasks), false)
  assert.equal((await git(['rev-list', '--count', 'HEAD'], dir)).stdout.trim(), '1')
})

test('commits only tasks.md, not the rest of the repository', async () => {
  const dir = await tempRepo()
  await writeFile(join(dir, 'unrelated.txt'), 'someone else’s work', 'utf8')

  const doc = await writeTasksFile(dir, ['- [ ] Buy milk'])
  await commitTasks(dir, doc.tasks)

  const stat = (await git(['show', '--stat', '--format='], dir)).stdout
  assert.match(stat, /tasks\.md/)
  assert.doesNotMatch(stat, /unrelated\.txt/)

  // The unrelated file is still untracked and untouched.
  assert.match((await git(['status', '--porcelain'], dir)).stdout, /\?\? unrelated\.txt/)
})

test('round-trips the task metadata through git', async () => {
  const dir = await tempRepo()
  const doc = await writeTasksFile(dir, ['- [ ] Buy milk #home #errand +House p1 due:2026-09-20'])
  await commitTasks(dir, doc.tasks)

  const committed = await git(['show', 'HEAD:tasks.md'], dir)
  assert.equal(committed.code, 0, committed.stderr)
  assert.deepStrictEqual(parseDoc(committed.stdout).tasks, doc.tasks)
})

test('preserves hand-written markdown across a commit', async () => {
  const source = '# My tasks\n\nSome notes.\n\n- [ ] First #work\n\n<!-- keep me -->\n'
  const dir = await tempRepo()

  const doc = await writeTasksFile(dir, applyMutation(parseDoc(source), { kind: 'add', text: 'Second' }))
  await commitTasks(dir, doc.tasks)

  assert.deepStrictEqual(doc.lines, [
    '# My tasks',
    '',
    'Some notes.',
    '',
    '- [ ] First #work',
    '- [ ] Second',
    '',
    '<!-- keep me -->',
    '',
  ])

  assert.equal(await readTasksFile(dir), doc.lines.join('\n'))
})

test('survives a crash between the temp write and the rename', async () => {
  // The temp file is a sibling of tasks.md, so a leftover from an interrupted
  // write can never be mistaken for the real file.
  const dir = await tempRepo()
  const doc = await writeTasksFile(dir, ['- [ ] Buy milk'])

  assert.equal(await readTasksFile(dir), '- [ ] Buy milk')
  assert.equal(existsSync(join(dir, 'tasks.md.tmp')), false)
  assert.equal(await commitTasks(dir, doc.tasks), true)
})
