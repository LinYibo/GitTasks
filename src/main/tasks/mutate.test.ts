import assert from 'node:assert/strict'
import { test } from 'node:test'

import { applyMutation } from './mutate.ts'
import { parseDoc } from '../../shared/tasks/parse.ts'

test('a task is written under the heading of the project it was asked for', () => {
  assert.deepStrictEqual(
    applyMutation(parseDoc('## A\n'), { kind: 'add', text: 'Buy milk', projectLine: 0 }),
    ['## A', '', '- [ ] Buy milk'],
  )
})

test('a task is added after the last task of its project', () => {
  const source = '## A\n\n- [ ] one\n- [ ] two\n'
  const lines = applyMutation(parseDoc(source), { kind: 'add', text: 'third', projectLine: 0 })
  assert.deepStrictEqual(lines, ['## A', '', '- [ ] one', '- [ ] two', '- [ ] third', ''])
})

test('a task is never written into the project below', () => {
  // The heading at line 3 is the boundary, and the new line stays above it with
  // a blank between them.
  const source = '## A\n\n- [ ] one\n## B\n\n- [ ] two\n'
  const lines = applyMutation(parseDoc(source), { kind: 'add', text: 'more', projectLine: 0 })
  assert.deepStrictEqual(lines, [
    '## A',
    '',
    '- [ ] one',
    '- [ ] more',
    '',
    '## B',
    '',
    '- [ ] two',
    '',
  ])
})

test('adds a task with its text kept as written', () => {
  const lines = applyMutation(parseDoc('## A\n'), {
    kind: 'add',
    text: 'Ship it #work p1 due:2026-09-20',
    projectLine: 0,
  })
  assert.deepStrictEqual(lines, ['## A', '', '- [ ] Ship it #work p1 due:2026-09-20'])
})

test('rejects a task with no title', () => {
  assert.throws(
    () => applyMutation(parseDoc('## A\n'), { kind: 'add', text: '   ', projectLine: 0 }),
    (error: Error & { code?: string }) => error.code === 'EMPTY_TASK',
  )
})

test('toggles a task', () => {
  assert.deepStrictEqual(applyMutation(parseDoc('- [ ] one'), { kind: 'toggle', line: 0 }), ['- [x] one'])
  assert.deepStrictEqual(applyMutation(parseDoc('- [x] one'), { kind: 'toggle', line: 0 }), ['- [ ] one'])
})

test('toggling rewrites nothing but the checkbox', () => {
  // The author's bullet choice and loose spacing survive a completion.
  const lines = applyMutation(parseDoc('* [ ]   loose   spacing #a'), { kind: 'toggle', line: 0 })
  assert.deepStrictEqual(lines, ['* [x]   loose   spacing #a'])
})

test('edits a task and keeps its completed state', () => {
  const lines = applyMutation(parseDoc('- [x] old text'), { kind: 'edit', line: 0, text: 'new text #tag' })
  assert.deepStrictEqual(lines, ['- [x] new text #tag'])
})

test('editing canonicalizes only the line it touches', () => {
  const source = '* [ ]   messy   line\n- [ ] untouched  #a'
  const lines = applyMutation(parseDoc(source), { kind: 'edit', line: 0, text: 'tidy #a' })
  assert.deepStrictEqual(lines, ['- [ ] tidy #a', '- [ ] untouched  #a'])
})

test('rejects an edit that would leave no title', () => {
  assert.throws(
    () => applyMutation(parseDoc('- [ ] one'), { kind: 'edit', line: 0, text: '  ' }),
    (error: Error & { code?: string }) => error.code === 'EMPTY_TASK',
  )
})

test('deletes a task without disturbing its neighbours', () => {
  const source = '# Tasks\n- [ ] one\n- [ ] two\n- [ ] three\n'
  const lines = applyMutation(parseDoc(source), { kind: 'delete', line: 2 })
  assert.deepStrictEqual(lines, ['# Tasks', '- [ ] one', '- [ ] three', ''])
})

test('refuses to touch a line that is not a task', () => {
  const doc = parseDoc('# Tasks\n\n- [ ] one')
  const isStale = (error: Error & { code?: string }) => error.code === 'STALE_DOC'

  assert.throws(() => applyMutation(doc, { kind: 'toggle', line: 0 }), isStale)
  assert.throws(() => applyMutation(doc, { kind: 'toggle', line: 99 }), isStale)
  assert.throws(() => applyMutation(doc, { kind: 'delete', line: 1 }), isStale)
  assert.throws(() => applyMutation(doc, { kind: 'edit', line: 0, text: 'x' }), isStale)
})

test('mutations are pure', () => {
  const doc = parseDoc('## A\n\n- [ ] one')
  applyMutation(doc, { kind: 'toggle', line: 2 })
  applyMutation(doc, { kind: 'delete', line: 2 })
  applyMutation(doc, { kind: 'add', text: 'two', projectLine: 0 })
  applyMutation(doc, { kind: 'add-project', title: 'B' })

  assert.deepStrictEqual(doc.lines, ['## A', '', '- [ ] one'])
  assert.equal(doc.tasks.length, 1)
})

test('a new project becomes a section at the end of the file', () => {
  const lines = applyMutation(parseDoc('- [ ] one\n'), { kind: 'add-project', title: 'Release' })
  assert.deepStrictEqual(lines, ['- [ ] one', '', '## Release', ''])
})

test('the first project in an empty file does not gain a leading blank line', () => {
  assert.deepStrictEqual(applyMutation(parseDoc(''), { kind: 'add-project', title: 'Release' }), [
    '## Release',
    '',
  ])
})

test('renaming a project rewrites only its heading', () => {
  const source = '## A\n\n- [ ] one\n'
  const lines = applyMutation(parseDoc(source), { kind: 'rename-project', line: 0, title: 'B' })
  assert.deepStrictEqual(lines, ['## B', '', '- [ ] one', ''])
})

test('deleting a project takes its tasks with it', () => {
  // Without an inbox, leaving them behind would hand them to whichever project
  // sits above — data teleporting somewhere the user never asked for.
  const source = '# Tasks\n\n## A\n\n- [ ] one\n\n## B\n\n- [ ] two\n'
  const doc = parseDoc(source)
  const lines = applyMutation(doc, { kind: 'delete-project', line: doc.projects[0].line })

  assert.deepStrictEqual(lines, ['# Tasks', '', '## B', '', '- [ ] two', ''])
})

test('deleting the middle project leaves the others intact', () => {
  const source = '## A\n\n- [ ] one\n\n## B\n\n- [ ] two\n\n## C\n\n- [ ] three\n'
  const doc = parseDoc(source)
  const middle = doc.projects.find((project) => project.title === 'B')!.line
  const lines = applyMutation(doc, { kind: 'delete-project', line: middle })

  assert.equal(
    lines.join('\n'),
    '## A\n\n- [ ] one\n\n## C\n\n- [ ] three\n',
  )
})

test('deleting the only project empties the file', () => {
  const doc = parseDoc('## A\n\n- [ ] one\n')
  assert.deepStrictEqual(applyMutation(doc, { kind: 'delete-project', line: 0 }), [])
})

test('the first task in an empty project lands under its heading', () => {
  const source = '## A\n\n## B\n\n- [ ] two\n'
  const doc = parseDoc(source)
  const line = doc.projects.find((project) => project.title === 'A')!.line

  assert.deepStrictEqual(applyMutation(doc, { kind: 'add', text: 'first', projectLine: line }), [
    '## A',
    '',
    '- [ ] first',
    '',
    '## B',
    '',
    '- [ ] two',
    '',
  ])
})

test('a project name must be unique and non-empty', () => {
  const doc = parseDoc('## A\n')
  const isCode = (code: string) => (error: Error & { code?: string }) => error.code === code

  assert.throws(() => applyMutation(doc, { kind: 'add-project', title: ' A ' }), isCode('DUPLICATE_PROJECT'))
  assert.throws(() => applyMutation(doc, { kind: 'add-project', title: '   ' }), isCode('EMPTY_TASK'))
  assert.throws(
    () => applyMutation(parseDoc('## A\n\n## B\n'), { kind: 'rename-project', line: 0, title: 'B' }),
    isCode('DUPLICATE_PROJECT'),
  )
})

test('renaming or deleting a project that is gone is refused', () => {
  const doc = parseDoc('## A\n\n- [ ] one')
  const isStale = (error: Error & { code?: string }) => error.code === 'STALE_DOC'

  assert.throws(() => applyMutation(doc, { kind: 'rename-project', line: 2, title: 'B' }), isStale)
  assert.throws(() => applyMutation(doc, { kind: 'delete-project', line: 99 }), isStale)
  assert.throws(() => applyMutation(doc, { kind: 'add', text: 'x', projectLine: 99 }), isStale)
})
