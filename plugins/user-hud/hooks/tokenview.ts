// Pure layout of the Tokens pane as one grid of cells: the API's totals, every group's share as a bar, and
// each group, when opened, its sub-items. Bars are runs of coloured cells; labels and numbers stay in text colours.
import type { GroupId, TokenState } from '../types'
import { builder, cut, line, pad, piece, put, runs, wrap } from './cells.ts'
import type { Run } from './cells.ts'
import type { Band } from './panelgrid.ts'
import { apiLine, apiTotal, fmt, groupOf, linesOf, pct, ranked, stack, standingLine, totalUsed } from './tokens.ts'

const SHARE_CELLS = 12
const LINE_NAME = 24

export const groupAction = (id: GroupId) => `tokens:group:${id}`

/** `tokens:group:files` → files; anything else → null. */
export const parseGroupAction = (action: string): string | null => (action.startsWith('tokens:group:') ? action.slice('tokens:group:'.length) : null)

/** Every group's share of the tokens used, in one bar `cells` wide, in the groups' fixed order. */
export function stackedBar(s: TokenState, cells: number): Run[] {
  const r: Run[] = []
  for (const seg of stack(s, cells)) put(r, ' '.repeat(seg.cells), { bg: groupOf(seg.id).color })
  return r
}

type Row = { row: Run[]; spans: { action: string; x0: number; x1: number }[] }

/** A group's head, pressed to open or close it, and its sub-items under it while open, most used first. */
function groupRows(s: TokenState, id: GroupId, share: number, width: number, isOpen: boolean): Row[] {
  const g = s.groups[id]
  const on = Math.round(share * SHARE_CELLS)
  const head: Run[] = []
  put(head, isOpen ? '▾ ' : '▸ ')
  put(head, '■', { color: groupOf(id).color })
  put(head, ' ')
  put(head, pad(groupOf(id).label, 18), { isBold: true })
  const spans = [{ action: groupAction(id), x0: 0, x1: head.reduce((n, x) => n + x.text.length, 0) }]
  put(head, pct(share).padStart(5))
  put(head, ' ')
  put(head, ' '.repeat(on), { bg: groupOf(id).color })
  put(head, ' '.repeat(SHARE_CELLS - on), { bg: 'subtle' })
  put(head, ' ')
  const numbers = `${fmt(g.used)} used · ${fmt(g.inContext)} in context · ${g.calls} calls`
  const rows: Row[] = []
  // Wide, the numbers follow the bar; narrow, they go on a line of their own.
  if (head.reduce((n, x) => n + x.text.length, 0) + numbers.length <= width) {
    put(head, numbers)
    rows.push({ row: head, spans })
  } else {
    rows.push({ row: cut(head, width), spans }, { row: cut(runs(`  ${numbers}`), width), spans: [] })
  }
  if (!isOpen) return rows
  const lines = Object.entries(linesOf(g))
    .filter(([, l]) => l.used > 0 || l.inContext > 0)
    .sort((a, b) => b[1].used - a[1].used || b[1].inContext - a[1].inContext)
  for (const [name, l] of lines) {
    const row: Run[] = []
    put(row, `    ${pad(name.length > LINE_NAME ? `${name.slice(0, LINE_NAME - 1)}…` : name, LINE_NAME)} ${fmt(l.used).padStart(6)} `)
    put(row, pct(g.used > 0 ? l.used / g.used : 0).padStart(5))
    if (l.inContext > 0) put(row, `   ${fmt(l.inContext)} in context`, { isDim: true })
    rows.push({ row: cut(row, width), spans: [] })
  }
  return rows
}

export function tokensPaneGrid(s: TokenState, width: number, open: readonly GroupId[]): Band {
  const b = builder()
  const actions = line(width, [piece(' r: Refresh ', { bg: 'subtle' }, 'tokens:refresh'), piece(' x: Reset ', { bg: 'subtle' }, 'tokens:reset')])
  b.add(actions.row, actions.spans)
  b.add([])
  if (totalUsed(s) <= 0) {
    for (const row of wrap('No tokens counted yet: the next request starts the tally.', width, { isDim: true })) b.add(row)
  } else {
    for (const row of wrap(apiLine(s), width)) b.add(row)
    if (s.agents.requests + s.plugins.requests > 0) {
      const of = `Of those: subagents ${fmt(apiTotal(s.agents))} (${s.agents.requests} requests) · plugin model calls ${fmt(apiTotal(s.plugins))} (${s.plugins.requests})`
      for (const row of wrap(of, width, { isDim: true })) b.add(row)
    }
    b.add([])
    b.add(stackedBar(s, Math.max(10, Math.min(width, 100))))
    b.add([])
    for (const g of ranked(s)) for (const r of groupRows(s, g.id, g.share, width, open.includes(g.id))) b.add(r.row, r.spans)
  }
  const standing = standingLine(s)
  if (standing) {
    b.add([])
    for (const row of wrap(standing, width, { isDim: true })) b.add(row)
  }
  b.add([])
  const note =
    'used: real API tokens; each request’s input is split by what each group held in the context when it went out, its output by what was written (the rest is thinking). in context and the breakdowns are estimates at about 4 characters a token.'
  for (const row of wrap(note, width, { isDim: true })) b.add(row)
  return { ...b.grid, keys: { r: 'tokens:refresh', x: 'tokens:reset' }, width }
}
