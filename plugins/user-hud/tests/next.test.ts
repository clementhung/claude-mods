import { expect, test } from 'claude-code/testing'

import { MAX_NEXT, nextRequest, parseNext } from '../hooks/next.ts'

test('the reply becomes up to three prompts: numbering, bullets and quotes stripped, duplicates dropped', () => {
  const reply = ['Here are some ideas:', '1. Run the tests', '2) "Commit this and open a PR"', '- run the tests', '', '* Add a test for the empty case', '• Fourth one']
  expect(parseNext(reply.join('\n'))).toEqual(['Run the tests', 'Commit this and open a PR', 'Add a test for the empty case'])
  expect(parseNext('')).toEqual([])
  expect(parseNext('x'.repeat(300))[0]).toHaveLength(160)
  expect(MAX_NEXT).toBe(3)
})

test('the request carries the prompt’s start and the reply’s end, not the whole conversation', () => {
  expect(nextRequest('fix the bug', 'Fixed it.')).toBe('<prompt>\nfix the bug\n</prompt>\n\n<reply>\nFixed it.\n</reply>')
  expect(nextRequest('', 'Done.')).toBe('<reply>\nDone.\n</reply>')
  const long = nextRequest('p', `${'a'.repeat(10_000)}END`)
  expect(long.length).toBeLessThan(6_100)
  expect(long).toContain('…')
  expect(long).toContain('END')
})
