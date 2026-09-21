import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { DiffSummary } from '../../shared/types.ts'
import { formatCommitSubject, summarizeDiff } from './diff.ts'
import { parseDoc } from '../../shared/tasks/parse.ts'

const tasks = (text: string) => parseDoc(text).tasks

test('counts an added task', () => {
  const summary = summarizeDiff(tasks('- [ ] one'), tasks('- [ ] one\n- [ ] two'))
  assert.deepStrictEqual(summary, { added: 1, modified: 0, removed: 0, completed: 0 })
})

test('counts a completed task as completed, not modified', () => {
  const summary = summarizeDiff(tasks('- [ ] one'), tasks('- [x] one'))
  assert.deepStrictEqual(summary, { added: 0, modified: 0, removed: 0, completed: 1 })
})

test('counts an uncompleted task as modified', () => {
  const summary = summarizeDiff(tasks('- [x] one'), tasks('- [ ] one'))
  assert.deepStrictEqual(summary, { added: 0, modified: 1, removed: 0, completed: 0 })
})

test('counts a metadata change as modified', () => {
  const summary = summarizeDiff(tasks('- [ ] one'), tasks('- [ ] one #work'))
  assert.deepStrictEqual(summary, { added: 0, modified: 1, removed: 0, completed: 0 })
})

test('counts a rename as one removal and one addition', () => {
  const summary = summarizeDiff(tasks('- [ ] old name'), tasks('- [ ] new name'))
  assert.deepStrictEqual(summary, { added: 1, modified: 0, removed: 1, completed: 0 })
})

test('counts a deletion', () => {
  const summary = summarizeDiff(tasks('- [ ] one\n- [ ] two'), tasks('- [ ] one'))
  assert.deepStrictEqual(summary, { added: 0, modified: 0, removed: 1, completed: 0 })
})

test('handles duplicate titles by count, not by identity', () => {
  const summary = summarizeDiff(tasks('- [ ] same'), tasks('- [ ] same\n- [ ] same'))
  assert.deepStrictEqual(summary, { added: 1, modified: 0, removed: 0, completed: 0 })
})

test('reports nothing for an unchanged list', () => {
  const summary = summarizeDiff(tasks('- [ ] one\n- [x] two'), tasks('- [ ] one\n- [x] two'))
  assert.deepStrictEqual(summary, { added: 0, modified: 0, removed: 0, completed: 0 })
})

test('does not double-count when a title gains occurrences', () => {
  const summary = summarizeDiff(tasks('- [ ] same'), tasks('- [ ] same\n- [ ] same\n- [ ] same'))
  assert.deepStrictEqual(summary, { added: 2, modified: 0, removed: 0, completed: 0 })
})

test('formats a commit subject from the parts that are non-zero', () => {
  const summary = (overrides: Partial<DiffSummary>): DiffSummary => ({
    added: 0,
    modified: 0,
    removed: 0,
    completed: 0,
    ...overrides,
  })

  assert.equal(formatCommitSubject(summary({ added: 2 })), 'tasks: +2')
  assert.equal(formatCommitSubject(summary({ completed: 3 })), 'tasks: ✓3')
  assert.equal(
    formatCommitSubject(summary({ added: 2, modified: 1, completed: 3 })),
    'tasks: +2 ~1 ✓3',
  )
  assert.equal(formatCommitSubject(summary({ added: 1, modified: 1, removed: 2 })), 'tasks: +1 ~1 -2')
})

test('falls back to a neutral subject when nothing moved', () => {
  assert.equal(formatCommitSubject({ added: 0, modified: 0, removed: 0, completed: 0 }), 'tasks: update')
})
