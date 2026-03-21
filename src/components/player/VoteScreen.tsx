import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { useWebHaptics } from 'web-haptics/react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useActionFeedback } from '../../lib/useActionFeedback'
import { useCountdown } from '../../lib/useCountdown'

export function VoteScreen({
  round,
  playerId,
  game: _game,
}: {
  round: Doc<'rounds'>
  playerId: Id<'players'>
  game: Doc<'games'>
}) {
  const candidates = useQuery(api.votes.getCandidates, {
    playerId,
    roundId: round._id,
    count: 5,
  })
  const castVote = useMutation(api.votes.castVote)
  const seconds = useCountdown(round.voteEndsAt)
  const [submitting, setSubmitting] = useState(false)
  const { error, isRejected, clearError, reject } = useActionFeedback()
  const { trigger } = useWebHaptics()
  const current = candidates?.[0]

  const handleVote = async (value: boolean) => {
    if (!current || submitting) return
    // Fire haptics immediately for responsiveness
    if (value) {
      trigger([{ duration: 30 }, { delay: 60, duration: 40, intensity: 1 }])
    } else {
      trigger([{ duration: 15, intensity: 0.5 }])
    }
    setSubmitting(true)
    clearError()
    try {
      await castVote({
        playerId,
        captionId: current.captionId,
        value,
      })
    } catch (e) {
      reject(e, 'VOTE REJECTED')
    } finally {
      setSubmitting(false)
    }
  }

  const formatted = String(seconds).padStart(2, '0')

  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        position: 'relative',
      }}
    >
      <div
        className="progress-timer"
        style={{ position: 'absolute', top: 16, right: 16 }}
      >
        {formatted}s
      </div>

      {current ? (
        <>
          {/* Meme Card */}
          <div
            className="meme-frame meme-frame--tall"
            style={{ maxHeight: 530, marginBottom: 32 }}
          >
            <img
              src={round.imageUrl}
              alt="Meme template"
              style={{ filter: 'grayscale(100%) contrast(1.25)' }}
            />
            {/* Caption Overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: 24,
                pointerEvents: 'none',
              }}
            >
              <h2 className="impact-text">{current.text}</h2>
            </div>
          </div>

          {/* Vote Buttons */}
          <div className={`vote-buttons ${isRejected ? 'ui-rejected' : ''}`}>
            <button
              type="button"
              className="vote-btn vote-btn--reject"
              onClick={() => handleVote(false)}
              aria-label="Reject"
              disabled={submitting}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <button
              type="button"
              className="vote-btn vote-btn--approve"
              onClick={() => handleVote(true)}
              aria-label="Approve"
              disabled={submitting}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                favorite
              </span>
            </button>
          </div>

          {error && (
            <p
              style={{
                marginTop: 12,
                color: '#ef4444',
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              {error}
            </p>
          )}
        </>
      ) : (
        <div
          className="brutal-card"
          style={{ padding: 32, textAlign: 'center' }}
        >
          <span
            className="material-symbols-outlined animate-spin"
            aria-hidden="true"
            style={{ fontSize: 48, marginBottom: 16, display: 'block' }}
          >
            hourglass_empty
          </span>
          <h2>NO MORE MEMES</h2>
          <p style={{ marginTop: 8 }}>WAITING FOR NEW CAPTIONS...</p>
        </div>
      )}
    </main>
  )
}
