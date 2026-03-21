import { useMutation, useQuery } from 'convex/react'
import {
  AnimatePresence,
  animate,
  motion,
  type PanInfo,
  useMotionValue,
  useTransform,
} from 'motion/react'
import { useRef, useState } from 'react'
import { useWebHaptics } from 'web-haptics/react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useActionFeedback } from '../../lib/useActionFeedback'
import { useCountdown } from '../../lib/useCountdown'

const SWIPE_THRESHOLD = 100

function SwipeableCard({
  candidate,
  imageUrl,
  onVote,
  disabled,
  trigger,
}: {
  candidate: { captionId: Id<'captions'>; text: string }
  imageUrl: string
  onVote: (value: boolean) => void
  disabled: boolean
  trigger: ReturnType<typeof useWebHaptics>['trigger']
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 0, 200], [-12, 0, 12])
  const approveOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1])
  const rejectOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0])
  const pastThreshold = useRef(false)

  const flyOff = (dir: number) => {
    const flyX = dir * 500
    const flyRotate = dir * 20
    return Promise.all([
      animate(x, flyX, { duration: 0.25, ease: 'easeIn' }),
      animate(rotate, flyRotate, { duration: 0.25, ease: 'easeIn' }),
    ])
  }

  // Use onDrag (direct pointer event context) so navigator.vibrate is allowed
  const handleDrag = (_: unknown, info: PanInfo) => {
    const crossed = Math.abs(info.offset.x) > SWIPE_THRESHOLD
    if (crossed && !pastThreshold.current) {
      trigger([{ duration: 20, intensity: 0.7 }])
      pastThreshold.current = true
    } else if (!crossed) {
      pastThreshold.current = false
    }
  }

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (disabled) return
    const swipe = info.offset.x
    const velocity = info.velocity.x
    if (Math.abs(swipe) > SWIPE_THRESHOLD || Math.abs(velocity) > 500) {
      const dir = swipe > 0 ? 1 : -1
      flyOff(dir)
      onVote(swipe > 0)
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 })
    }
  }

  return (
    <motion.div
      key={candidate.captionId}
      drag="x"
      dragElastic={0.9}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      style={{ x, rotate, cursor: 'grab', touchAction: 'pan-y' }}
      initial={{ scale: 0.95, opacity: 0, y: 30 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="meme-frame meme-frame--tall"
      whileDrag={{ cursor: 'grabbing' }}
    >
      <img
        src={imageUrl}
        alt="Meme template"
        draggable={false}
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
        <h2 className="impact-text">{candidate.text}</h2>
      </div>

      {/* Approve overlay */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 255, 0, 0.2)',
          opacity: approveOpacity,
          pointerEvents: 'none',
          borderRadius: 'inherit',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 96,
            color: '#00ff00',
            fontVariationSettings: "'FILL' 1",
            filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.5))',
          }}
        >
          favorite
        </span>
      </motion.div>

      {/* Reject overlay */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 0, 0, 0.2)',
          opacity: rejectOpacity,
          pointerEvents: 'none',
          borderRadius: 'inherit',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 96,
            color: '#ef4444',
            filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.5))',
          }}
        >
          close
        </span>
      </motion.div>
    </motion.div>
  )
}

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
  const { error, clearError, reject } = useActionFeedback()
  const { trigger } = useWebHaptics()
  const current = candidates?.[0]

  const handleVote = async (value: boolean) => {
    if (!current || submitting) return
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

      <AnimatePresence mode="popLayout">
        {current ? (
          <motion.div
            key={current.captionId}
            style={{ width: '100%', marginBottom: 24 }}
            layout
          >
            {/* Swipeable Meme Card */}
            <SwipeableCard
              candidate={current}
              imageUrl={round.imageUrl}
              onVote={handleVote}
              disabled={submitting}
              trigger={trigger}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {current ? (
        error && (
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
        )
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
