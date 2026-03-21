export function normalizeCaptionText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0
  }

  let dot = 0
  let magnitudeA = 0
  let magnitudeB = 0

  for (let i = 0; i < a.length; i++) {
    const valueA = a[i]
    const valueB = b[i]
    dot += valueA * valueB
    magnitudeA += valueA * valueA
    magnitudeB += valueB * valueB
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0
  }

  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
}
