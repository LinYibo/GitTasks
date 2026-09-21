import assert from 'node:assert/strict'
import { test } from 'node:test'

import { applyMutation } from './mutate.ts'
import { parseDoc } from '../../shared/tasks/parse.ts'

test('adds a task to an empty document', () => {
  // `''` parses to a single empty line, which is the trailing newline. The task
  // goes in front of it, so the file keeps ending with one.
  assert.deepStrictEqual(applyMutation(parseDoc(''), { kind: 'add', text: 'Buy milk' }), [
    '- [ ] Buy milk',
    '',
  ])
})

test('adds a task after the last existing task', () => {
  const lines = applyMutation(parseDoc('- [ ] first\n- [ ] second'), { kind: 'add', text: 'third' })
  assert.deepStrictEqual(lines, ['- [ ] first', '- [ ] second', '- [ ] third'])
})

test('adds a task below a heading without disturbing it', () => {
  const source = '# Tasks\n\nSome notes.\n'
  const lines = applyMutation(parseDoc(source), { kind: 'add', text: 'Buy milk' })
  assert.deepStrictEqual(lines, ['# Tasks', '', 'Some notes.', '- [ ] Buy milk', ''])
})

test('adds a task with metadata already parsed', () => {
  const lines = applyMutation(parseDoc(''), { kind: 'add', text: 'Ship it #work +GitTasks p1 due:2026-09-20' })
  assert.deepStrictEqual(lines, ['- [ ] Ship it #work +GitTasks p1 due:2026-09-20', ''])
})

test('rejects a task with no title', () => {
  assert.throws(
    () => applyMutation(parseDoc(''), { kind: 'add', text: '  #urgent  ' }),
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
    () => applyMutation(parseDoc('- [ ] one'), { kind: 'edit', line: 0, text: '#tag' }),
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
  const doc = parseDoc('- [ ] one')
  applyMutation(doc, { kind: 'toggle', line: 0 })
  applyMutation(doc, { kind: 'delete', line: 0 })
  applyMutation(doc, { kind: 'add', text: 'two' })

  assert.deepStrictEqual(doc.lines, ['- [ ] one'])
  assert.equal(doc.tasks.length, 1)
})
