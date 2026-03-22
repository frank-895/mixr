import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { useWebHaptics } from 'web-haptics/react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { MAX_CAPTION_LENGTH } from '../../../convex/constants'
import { useActionFeedback } from '../../lib/useActionFeedback'
import { useCountdown } from '../../lib/useCountdown'

const COOLDOWN_SECONDS = 5

export function CaptionScreen({
  round,
  playerId,
  game,
  deadline,
}: {
  round: Doc<'rounds'>
  playerId: Id<'players'>
  game: Doc<'games'>
  deadline?: number
}) {
  const myStats = useQuery(api.players.getMyStats, {
    gameId: game._id,
    playerId,
  })
  const myCaptions = useQuery(api.captions.getPlayerCaptions, {
    playerId,
    roundId: round._id,
  })
  const submitCaption = useMutation(api.captions.submit)
  const timerTarget = deadline ?? round.captionEndsAt
  const seconds = useCountdown(timerTarget)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cooldownEnd, setCooldownEnd] = useState(0)
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { error, isRejected, clearError, reject } = useActionFeedback()
  const { trigger } = useWebHaptics()

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Cooldown ticker
  useEffect(() => {
    if (cooldownEnd <= 0) return
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((cooldownEnd - Date.now()) / 1000)
      )
      setCooldownLeft(remaining)
      if (remaining <= 0) {
        setCooldownEnd(0)
        clearInterval(interval)
      }
    }, 200)
    return () => clearInterval(interval)
  }, [cooldownEnd])

  const handleSubmit = async () => {
    if (!text.trim() || submitting || cooldownLeft > 0) return
    setSubmitting(true)
    clearError()
    try {
      const result = await submitCaption({
        playerId,
        roundId: round._id,
        text: text.trim(),
      })
      if (result.status === 'removed') {
        reject(result.message, 'CAPTION REJECTED')
        return
      }
      setText('')
      setCooldownEnd(Date.now() + COOLDOWN_SECONDS * 1000)
      setCooldownLeft(COOLDOWN_SECONDS)
      trigger([{ duration: 20 }, { delay: 40, duration: 30, intensity: 1 }])
    } catch (e) {
      reject(e, 'CAPTION REJECTED')
    } finally {
      setSubmitting(false)
    }
  }

  const maxCaptions = game.maxCaptionsPerPlayer ?? Infinity
  const captionCount = myCaptions?.length ?? 0
  const limitReached = captionCount >= maxCaptions

  const formatted = String(seconds).padStart(2, '0')

  return (
    <>
      {/* Header */}
      <header className="brutal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="badge"
            style={{
              padding: '8px 16px',
              maxWidth: 160,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              background: 'var(--white)',
            }}
          >
            {myStats?.name ?? '...'}
          </span>
          <span className="badge badge--primary">
            {myStats?.totalScore ?? 0}
          </span>
        </div>
        <div className="timer-badge">
          <span>{formatted}s</span>
        </div>
      </header>

      {/* Main */}
      <main
        style={{
          flex: 1,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          paddingBottom: 120,
          overflowY: 'auto',
        }}
      >
        {/* Meme Image */}
        <div className="meme-frame">
          <img src={round.imageUrl} alt="Meme template" />
        </div>

        {/* Caption Input */}
        <div style={{ position: 'relative' }}>
          <label className="sr-only" htmlFor="caption">
            Enter your meme caption
          </label>
          <textarea
            ref={textareaRef}
            id="caption"
            className={`brutal-textarea ${isRejected ? 'ui-rejected' : ''}`}
            placeholder={limitReached ? 'LIMIT REACHED' : 'MAKE IT FUNNY...'}
            value={text}
            disabled={limitReached}
            onChange={(e) => {
              setText(e.target.value.slice(0, MAX_CAPTION_LENGTH))
              clearError()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            maxLength={MAX_CAPTION_LENGTH}
          />
          <div className="char-counter">
            <span>{text.length}</span>/{MAX_CAPTION_LENGTH}
          </div>
        </div>

        {error && (
          <p
            style={{
              color: '#ef4444',
              margin: 0,
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            {error}
          </p>
        )}
      </main>

      {/* Fixed Bottom Button */}
      <div className="fixed-bottom">
        <button
          type="button"
          className="brutal-btn brutal-btn--green"
          onClick={handleSubmit}
          disabled={
            limitReached || submitting || !text.trim() || cooldownLeft > 0
          }
        >
          <span>
            {limitReached
              ? 'LIMIT REACHED'
              : cooldownLeft > 0
                ? `WAIT ${cooldownLeft}S...`
                : submitting
                  ? 'SUBMITTING...'
                  : 'SUBMIT CAPTION'}
          </span>
          <span className="material-symbols-outlined" aria-hidden="true">
            {limitReached
              ? 'block'
              : cooldownLeft > 0
                ? 'hourglass_empty'
                : 'send'}
          </span>
        </button>
      </div>
    </>
  )
}
