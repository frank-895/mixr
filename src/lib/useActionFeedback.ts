import { useCallback, useEffect, useState } from 'react'

const REJECTED_MS = 420

function unwrapConvexErrorMessage(message: string): string {
  const lines = message
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    const uncaughtMatch = line.match(/^Uncaught Error:\s*(.+)$/)
    if (uncaughtMatch) return uncaughtMatch[1]
  }

  return message
}

function getErrorMessage(reason: unknown, fallback: string): string {
  if (typeof reason === 'string' && reason) return reason
  if (reason instanceof Error && reason.message) {
    return unwrapConvexErrorMessage(reason.message)
  }
  return fallback
}

export function useActionFeedback() {
  const [error, setError] = useState('')
  const [isRejected, setIsRejected] = useState(false)

  useEffect(() => {
    if (!isRejected) return

    const timeout = window.setTimeout(() => setIsRejected(false), REJECTED_MS)
    return () => window.clearTimeout(timeout)
  }, [isRejected])

  const clearError = useCallback(() => {
    setError('')
  }, [])

  const reject = useCallback((reason: unknown, fallback = 'TRY AGAIN') => {
    setError(getErrorMessage(reason, fallback))
    setIsRejected(false)
    window.requestAnimationFrame(() => setIsRejected(true))
  }, [])

  return { error, isRejected, clearError, reject }
}
