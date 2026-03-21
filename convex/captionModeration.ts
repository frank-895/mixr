import type { Doc } from './_generated/dataModel'

const BLACKLIST_REJECTION_MESSAGE =
  "YOU'VE BEEN REMOVED FOR INAPPROPRIATE CAPTIONS"

const SEVERE_BLACKLIST_TERMS = [
  'chink',
  'fag',
  'faggot',
  'gook',
  'kike',
  'nigga',
  'nigger',
  'paki',
  'spic',
  'wetback',
] as const

const LEETSPEAK_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
}

const PUNCTUATION_RE = /[^\p{L}\p{N}\s]+/gu
const WHITESPACE_RE = /\s+/g
const LETTER_OR_NUMBER_RE = '[a-z0-9]'

function replaceLeetspeak(value: string): string {
  return [...value].map((char) => LEETSPEAK_MAP[char] ?? char).join('')
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function normalizeCaptionForBlacklist(text: string): string {
  const lowercased = text.normalize('NFKC').toLowerCase()
  const withoutPunctuation = lowercased.replace(PUNCTUATION_RE, ' ')
  const collapsedWhitespace = withoutPunctuation
    .replace(WHITESPACE_RE, ' ')
    .trim()

  return replaceLeetspeak(collapsedWhitespace)
}

function buildPattern(term: string): RegExp {
  const words = term.split(' ')
  const body = words
    .map((word) => [...word].map((char) => escapeRegex(char)).join('\\s*'))
    .join('\\s+')

  return new RegExp(
    `(^|[^${LETTER_OR_NUMBER_RE.slice(1, -1)}])${body}($|[^${LETTER_OR_NUMBER_RE.slice(1, -1)}])`
  )
}

const BLACKLIST_PATTERNS = SEVERE_BLACKLIST_TERMS.map((term) => ({
  term,
  pattern: buildPattern(normalizeCaptionForBlacklist(term)),
}))

export function getBlacklistRejectionMessage(text: string): string | null {
  const normalized = normalizeCaptionForBlacklist(text)
  const matchedTerm =
    BLACKLIST_PATTERNS.find(({ pattern }) => pattern.test(normalized))?.term ??
    null

  console.info('[mixr-moderation] blacklist-check', {
    originalText: text,
    normalizedText: normalized,
    matchedTerm,
  })

  return matchedTerm ? BLACKLIST_REJECTION_MESSAGE : null
}

export function isPlayerKicked(
  player: Pick<Doc<'players'>, 'kickedAt'>
): boolean {
  return player.kickedAt !== undefined
}

export function getPlayerModerationError(
  player: Pick<Doc<'players'>, 'kickedAt'>
): string | null {
  return isPlayerKicked(player) ? BLACKLIST_REJECTION_MESSAGE : null
}
