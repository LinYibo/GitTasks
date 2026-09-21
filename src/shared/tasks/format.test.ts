import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { TaskFields } from '../types.ts'
import { formatTaskLine, serializeDoc, setCompleted } from './format.ts'
import { parseDoc, parseTaskLine } from './parse.ts'

const fields = (title: string, overrides: Partial<TaskFields> = {}): TaskFields => ({
  title,
  completed: false,
  tags: [],
  ...overrides,
})

test('formats a bare task', () => {
  assert.equal(formatTaskLine(fields('Buy milk')), '- [ ] Buy milk')
})

test('formats a completed task', () => {
  assert.equal(formatTaskLine(fields('Buy milk', { completed: true })), '- [x] Buy milk')
})

test('emits metadata in a fixed order', () => {
  const line = formatTaskLine(
    fields('Ship it', { tags: ['work', 'urgent'], project: 'GitTasks', priority: 1, due: '2026-09-20' }),
  )
  assert.equal(line, '- [ ] Ship it #work #urgent +GitTasks p1 due:2026-09-20')
})

test('omits metadata that is absent', () => {
  assert.equal(formatTaskLine(fields('Thing', { priority: 3 })), '- [ ] Thing p3')
})

test('round-trips canonical lines unchanged', () => {
  const canonical = [
    '- [ ] Buy milk',
    '- [x] Ship the release #work #urgent +GitTasks p1 due:2026-09-20',
    '- [ ] Issue #42 stays in the title',
    '- [ ] Mention owner/repo#42 and C++',
  ]

  for (const line of canonical) {
    const task = parseTaskLine(line, 0)
    assert.ok(task, `expected ${line} to parse as a task`)
    assert.equal(formatTaskLine(task), line)
  }
})

test('normalizes a non-dash bullet to the canonical form', () => {
  // `*` and `+` bullets parse fine, but they are not canonical — so rewriting
  // such a line converts it to `-`. Until then the raw line is kept verbatim.
  assert.equal(formatTaskLine(parseTaskLine('* [ ] Star bullet', 0)!), '- [ ] Star bullet')
  assert.equal(formatTaskLine(parseTaskLine('+ [x] Plus bullet #a', 0)!), '- [x] Plus bullet #a')
})

test('parse(format(fields)) recovers the fields', () => {
  const original = fields('Ship it', {
    tags: ['work'],
    project: 'GitTasks',
    priority: 2,
    due: '2026-09-20',
  })

  const { line: _line, raw: _raw, ...recovered } = parseTaskLine(formatTaskLine(original), 0)!
  assert.deepStrictEqual(recovered, original)
})

test('serialize preserves every non-task line byte for byte', () => {
  const source = [
    '# My tasks',
    '',
    'Some hand-written notes.',
    '',
    '- [ ] First #work',
    '- [x] Second',
    '',
    '<!-- a comment -->',
    'A trailing paragraph',
    '',
  ].join('\n')

  const doc = parseDoc(source)
  assert.equal(doc.tasks.length, 2)
  assert.equal(serializeDoc(doc.lines), source)
})

test('serialize preserves a file with no trailing newline', () => {
  const source = '# Tasks\n\n- [ ] one'
  assert.equal(serializeDoc(parseDoc(source).lines), source)
})

test('serialize preserves an indented checkbox as ordinary content', () => {
  const source = '- [ ] parent\n  - [ ] nested child'
  const doc = parseDoc(source)
  assert.equal(doc.tasks.length, 1)
  assert.equal(serializeDoc(doc.lines), source)
})

test('setCompleted flips only the checkbox', () => {
  assert.equal(setCompleted('- [ ] Buy milk #home p1', true), '- [x] Buy milk #home p1')
  assert.equal(setCompleted('- [x] Buy milk', false), '- [ ] Buy milk')
})

test('setCompleted leaves the bullet and spacing untouched', () => {
  assert.equal(setCompleted('* [X]   loose   spacing', false), '* [ ]   loose   spacing')
})
