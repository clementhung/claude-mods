// Pure next-steps logic: what a small model is asked after a turn, and how its reply becomes prompts.

/** Suggestions shown at most; each is a hotkey, 1 to 3. */
export const MAX_NEXT = 3
/** The model asked: a short, cheap call on the last exchange alone, not the whole conversation. */
export const NEXT_MODEL = 'haiku'
/** The most of the person's prompt and of the reply sent: the prompt's start, the reply's end. */
const PROMPT_CHARS = 2_000
const ANSWER_CHARS = 6_000
/** A suggestion longer than this is cut: it is a prompt to edit, not an essay. */
const MAX_CHARS = 160

export const NEXT_SYSTEM = [
  'You suggest what a developer might type next to their coding assistant.',
  `Given their last prompt and the assistant's reply, write ${MAX_NEXT} short follow-up prompts they are likely to send next,`,
  'in their own voice, as imperative requests (e.g. "Run the tests", "Commit this and open a PR").',
  'Make each one specific to the reply, different from the others, and under 12 words.',
  'Answer with the prompts alone, one per line, with no numbering, quotes or commentary.',
].join(' ')

/** The one user message: the last prompt (its start) and the reply (its end), where follow-ups come from. */
export function nextRequest(prompt: string, answer: string): string {
  const p = prompt.trim().slice(0, PROMPT_CHARS)
  const a = answer.trim()
  const tail = a.length > ANSWER_CHARS ? `…${a.slice(-ANSWER_CHARS)}` : a
  return `${p ? `<prompt>\n${p}\n</prompt>\n\n` : ''}<reply>\n${tail}\n</reply>`
}

/** The model's reply as prompts: one a line, numbering, bullets and quotes stripped, duplicates and blanks dropped. */
export function parseNext(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split('\n')) {
    let s = raw
      .trim()
      .replace(/^(?:[-*•]|\d+[.)]|\(\d+\))\s*/, '')
      .replace(/^["“'`](.*)["”'`]$/, '$1')
      .trim()
    if (!s || s.endsWith(':')) continue
    if (s.length > MAX_CHARS) s = `${s.slice(0, MAX_CHARS - 1).trimEnd()}…`
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
    if (out.length === MAX_NEXT) break
  }
  return out
}
