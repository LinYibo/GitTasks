import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalizeEol, parseDoc, parseProjectHeading, parseTaskFields, parseTaskLine } from './parse.ts'

const parse = (line: string) => parseTaskLine(line, 0, null)

test('parses a plain incomplete task', () => {
  assert.deepStrictEqual(parse('- [ ] Buy milk'), {
    line: 0,
    raw: '- [ ] Buy milk',
    title: 'Buy milk',
    completed: false,
    tags: [],
    projectLine: null,
    priority: undefined,
    due: undefined,
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

test('extracts inline metadata', () => {
  const task = parse('- [ ] Ship the release #work #urgent p1 due:2026-09-20')
  assert.deepStrictEqual(
    { title: task?.title, tags: task?.tags, priority: task?.priority, due: task?.due },
    { title: 'Ship the release', tags: ['work', 'urgent'], priority: 1, due: '2026-09-20' },
  )
})

test('recognises metadata anywhere on the line, not just at the end', () => {
  assert.equal(parse('- [ ] #work Ship the release')?.title, 'Ship the release')
  assert.equal(parse('- [ ] Ship #work the release')?.title, 'Ship the release')
})

test('leaves `Fix issue #42` alone', () => {
  // A tag name must start with a letter or underscore, so `#42` is not a tag.
  assert.deepStrictEqual(parseTaskFields('Fix issue #42'), {
    title: 'Fix issue #42',
    completed: false,
    tags: [],
    priority: undefined,
    due: undefined,
  })
})

test('leaves `owner/repo#42` alone', () => {
  // Metadata is matched per whitespace-delimited token, so the `#` is not at
  // the start of one.
  assert.equal(parse('- [ ] See owner/repo#42')?.tags.length, 0)
  assert.equal(parse('- [ ] See owner/repo#42')?.title, 'See owner/repo#42')
})

test('leaves `C++` alone', () => {
  assert.equal(parse('- [ ] Learn C++')?.title, 'Learn C++')
})

test('leaves an old `+project` token in the title', () => {
  // Projects became `## headings`, so a token the app used to claim is now
  // just words the author typed.
  assert.equal(parse('- [ ] Ship it +GitTasks')?.title, 'Ship it +GitTasks')
})

test('leaves `#2 pencils` alone', () => {
  assert.equal(parse('- [ ] Buy #2 pencils')?.tags.length, 0)
  assert.equal(parse('- [ ] Buy #2 pencils')?.title, 'Buy #2 pencils')
})

test('rejects an impossible calendar date', () => {
  // 2026-02-30 does not exist, so it stays in the title rather than becoming a due date.
  assert.equal(parse('- [ ] Pay rent due:2026-02-30')?.due, undefined)
  assert.equal(parse('- [ ] Pay rent due:2026-02-30')?.title, 'Pay rent due:2026-02-30')
})

test('accepts a leap day', () => {
  assert.equal(parse('- [ ] Party due:2028-02-29')?.due, '2028-02-29')
})

test('collapses duplicate tags case-insensitively', () => {
  assert.deepStrictEqual(parse('- [ ] Thing #Home #home')?.tags, ['Home'])
})

test('keeps a repeated singleton metadata token in the title', () => {
  // Dropping the second `p2` would silently lose text the author typed.
  const task = parse('- [ ] Thing p1 p2')
  assert.equal(task?.priority, 1)
  assert.equal(task?.title, 'Thing p2')
})

test('only matches lowercase priorities', () => {
  // Narrowing the match keeps `P1` usable in prose. It stays a title word.
  assert.equal(parse('- [ ] Version P1')?.priority, undefined)
  assert.equal(parse('- [ ] Version P1')?.title, 'Version P1')
})

test('returns null for a task with no title once metadata is stripped', () => {
  assert.equal(parse('- [ ] #urgent'), null)
  assert.equal(parse('- [ ] due:2026-09-20'), null)
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
