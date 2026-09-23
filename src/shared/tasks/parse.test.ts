import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalizeEol, parseDoc, parseProjectHeading, parseTaskLine } from './parse.ts'

const parse = (line: string) => parseTaskLine(line, 0, null)

test('parses a plain incomplete task', () => {
  assert.deepStrictEqual(parse('- [ ] Buy milk'), {
    line: 0,
    raw: '- [ ] Buy milk',
    title: 'Buy milk',
    completed: false,
    projectLine: null,
  })
})

test('treats both x and X as completed', () => {
  assert.equal(parse('- [x] Done')?.completed, true)
  assert.equal(parse('- [X] Shouty')?.completed, true)
  assert.equal(parse('- [ ] Not yet')?.completed, false)
})

test('accepts all three markdown bullets', () => {
  assert.equal(parse('- [ ] Dash')?.title, 'Dash')
  assert.equal(parse('* [ ] Star')?.title, 'Star')
  assert.equal(parse('+ [ ] Plus')?.title, 'Plus')
})

test('only indent-0 checkbox lines are tasks', () => {
  assert.equal(parse('  - [ ] Indented'), null)
  assert.equal(parse('\t- [ ] Tabbed'), null)
})

test('ignores lines that are not checkboxes', () => {
  assert.equal(parse('# A heading'), null)
  assert.equal(parse('Just prose'), null)
  assert.equal(parse('- a plain list item'), null)
  assert.equal(parse('- [] missing the inner space'), null)
  assert.equal(parse(''), null)
})

test('the whole text after the checkbox is the title', () => {
  // Former metadata tokens are just words the author typed.
  assert.equal(parse('- [ ] Ship the release #work p1 due:2026-09-20')?.title, 'Ship the release #work p1 due:2026-09-20')
  assert.equal(parse('- [ ] Fix issue #42')?.title, 'Fix issue #42')
  assert.equal(parse('- [ ] Buy #2 pencils')?.title, 'Buy #2 pencils')
  assert.equal(parse('- [ ] Learn C++')?.title, 'Learn C++')
})

test('trims the title but keeps its internal spacing', () => {
  assert.equal(parse('- [ ]   Weird    spacing  ')?.title, 'Weird    spacing')
})

test('returns null for a checkbox with no title', () => {
  assert.equal(parse('- [ ]'), null)
  assert.equal(parse('- [ ]   '), null)
})

test('preserves the raw line verbatim', () => {
  const raw = '* [X]   Weird    spacing #a'
  assert.equal(parse(raw)?.raw, raw)
})

test('normalizes CRLF and lone CR to LF', () => {
  assert.equal(normalizeEol('a\r\nb\rc'), 'a\nb\nc')
})

test('parseDoc keeps every line and derives tasks in order', () => {
  const doc = parseDoc('- [ ] one\ntext\n- [x] two')
  assert.deepStrictEqual(doc.lines, ['- [ ] one', 'text', '- [x] two'])
  assert.deepStrictEqual(
    doc.tasks.map((task) => [task.line, task.title, task.completed]),
    [
      [0, 'one', false],
      [2, 'two', true],
    ],
  )
})

test('parseDoc tolerates CRLF input', () => {
  const doc = parseDoc('# Tasks\r\n\r\n## Release\r\n\r\n- [ ] one\r\n')
  assert.deepStrictEqual(doc.lines, ['# Tasks', '', '## Release', '', '- [ ] one', ''])
  assert.deepStrictEqual(doc.projects, [{ line: 2, title: 'Release' }])
  assert.equal(doc.tasks.length, 1)
})

test('a project is a heading of exactly two hashes', () => {
  assert.equal(parseProjectHeading('## Release'), 'Release')
  assert.equal(parseProjectHeading('##\tRelease'), 'Release')
  assert.equal(parseProjectHeading('##   Release   '), 'Release')
})

test('document titles and subsections are not projects', () => {
  // Claiming only `##` leaves the rest of the author's headings alone.
  assert.equal(parseProjectHeading('# Tasks'), null)
  assert.equal(parseProjectHeading('### Roadmap'), null)
  assert.equal(parseProjectHeading('##Release'), null)
  assert.equal(parseProjectHeading('## '), null)
})

test('parseDoc files tasks under the nearest heading above them', () => {
  const doc = parseDoc('- [ ] loose\n## A\n- [ ] first\n## B\n- [ ] second\n- [x] third')
  assert.deepStrictEqual(doc.projects, [
    { line: 1, title: 'A' },
    { line: 3, title: 'B' },
  ])
  assert.deepStrictEqual(
    doc.tasks.map((task) => [task.line, task.title, task.projectLine]),
    [
      [0, 'loose', null],
      [2, 'first', 1],
      [4, 'second', 3],
      [5, 'third', 3],
    ],
  )
})
