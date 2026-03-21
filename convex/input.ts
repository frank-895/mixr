const GAME_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizePlayerName(name: string): string {
  return normalizeWhitespace(name).normalize('NFKC').toUpperCase()
}

export function hasInvalidPlayerNameChars(name: string): boolean {
  const normalized = name.normalize('NFKC')

  for (const char of normalized) {
    const codePoint = char.codePointAt(0)

    if (codePoint === undefined) continue
    if (codePoint <= 0x1f || codePoint === 0x7f) return true
    if (codePoint >= 0x200b && codePoint <= 0x200d) return true
    if (codePoint === 0xfeff) return true
  }

  return false
}

export function normalizeCaptionText(text: string): string {
  return normalizeWhitespace(text).toLowerCase()
}

export function normalizeGameCode(code: string): string {
  return code.trim().toUpperCase()
}

export function isValidGameCode(code: string): boolean {
  return GAME_CODE_RE.test(normalizeGameCode(code))
}
