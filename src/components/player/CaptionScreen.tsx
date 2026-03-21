import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { MAX_CAPTION_LENGTH } from '../../../convex/input'
import { useActionFeedback } from '../../lib/useActionFeedback'
import { useCountdown } from '../../lib/useCountdown'

const COOLDOWN_SECONDS = 5

export function CaptionScreen({
  round,
  playerId,
  game: _game,
  deadline,
}: {
  round: Doc<'rounds'>
  playerId: Id<'players'>
  game: Doc<'games'>
  deadline?: number
}) {
  const submitCaption = useMutation(api.captions.submit)
  const myCaptions = useQuery(api.captions.getPlayerCaptions, {
    playerId,
    roundId: round._id,
  })
  const timerTarget = deadline ?? round.captionEndsAt
  const seconds = useCountdown(timerTarget)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cooldownEnd, setCooldownEnd] = useState(0)
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { error, isRejected, clearError, reject } = useActionFeedback()

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
      await submitCaption({
        playerId,
        roundId: round._id,
        text: text.trim(),
      })
      setText('')
      setCooldownEnd(Date.now() + COOLDOWN_SECONDS * 1000)
      setCooldownLeft(COOLDOWN_SECONDS)
    } catch (e) {
      reject(e, 'CAPTION REJECTED')
    } finally {
      setSubmitting(false)
    }
  }

  const formatted = String(seconds).padStart(2, '0')
  const sortedCaptions = [...(myCaptions ?? [])].sort(
    (a, b) =>
      (b.createdAt ?? b._creationTime) - (a.createdAt ?? a._creationTime)
  )

  return (
    <>
      {/* Header */}
      <header className="brutal-header">
        <div style={{ width: 48 }} />
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
            placeholder="MAKE IT FUNNY..."
            value={text}
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

        {/* Submitted Captions */}
        {sortedCaptions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              YOUR CAPTIONS ({sortedCaptions.length})
            </p>
            {sortedCaptions.map((c) => (
              <div
                key={c._id}
                style={{
                  border: '2px solid var(--black)',
                  padding: '8px 12px',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  background: 'var(--white)',
                }}
              >
                "{c.text}"
                <span style={{ float: 'right', fontWeight: 700 }}>
                  {c.score > 0 ? '+' : ''}
                  {c.score} PTS
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Fixed Bottom Button */}
      <div className="fixed-bottom">
        <button
          type="button"
          className="brutal-btn brutal-btn--green"
          onClick={handleSubmit}
          disabled={submitting || !text.trim() || cooldownLeft > 0}
        >
          <span>
            {cooldownLeft > 0
              ? `WAIT ${cooldownLeft}S...`
              : submitting
                ? 'SUBMITTING...'
                : 'SUBMIT CAPTION'}
          </span>
          <span className="material-symbols-outlined" aria-hidden="true">
            {cooldownLeft > 0 ? 'hourglass_empty' : 'send'}
          </span>
        </button>
      </div>
    </>
  )
}
