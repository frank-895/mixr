import { useConvex, useMutation, useQuery } from 'convex/react'
import {
  AnimatePresence,
  animate,
  motion,
  type PanInfo,
  useMotionValue,
  useTransform,
} from 'motion/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useActionFeedback } from '../../lib/useActionFeedback'
import { useCountdown } from '../../lib/useCountdown'
import { Loader } from '../Loader'

const SWIPE_THRESHOLD = 100
type VoteAttemptResult = 'accepted' | 'closed' | 'rejected'

function SwipeableCard({
  candidate,
  imageUrl,
  onVote,
  onAccepted,
  disabled,
  showSwipeHint,
}: {
  candidate: { captionId: Id<'captions'>; text: string }
  imageUrl: string
  onVote: (value: boolean) => Promise<VoteAttemptResult>
  onAccepted: () => void
  disabled: boolean
  showSwipeHint: boolean
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 0, 200], [-12, 0, 12])
  const approveOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1])
  const rejectOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0])

  const flyOff = (dir: number) => {
    const flyX = dir * 500
    const flyRotate = dir * 20
    return Promise.all([
      animate(x, flyX, { duration: 0.25, ease: 'easeIn' }),
      animate(rotate, flyRotate, { duration: 0.25, ease: 'easeIn' }),
    ])
  }

  const resetCard = () =>
    Promise.all([
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 }),
      animate(rotate, 0, { type: 'spring', stiffness: 300, damping: 25 }),
    ])

  const handleDragEnd = async (_: unknown, info: PanInfo) => {
    if (disabled) return
    const swipe = info.offset.x
    const velocity = info.velocity.x
    if (Math.abs(swipe) > SWIPE_THRESHOLD || Math.abs(velocity) > 500) {
      const dir = swipe > 0 ? 1 : -1
      const result = await onVote(swipe > 0)
      if (result === 'accepted') {
        await flyOff(dir)
        onAccepted()
        return
      }

      await resetCard()
    } else {
      await resetCard()
    }
  }

  return (
    <motion.div
      key={candidate.captionId}
      drag="x"
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      style={{ x, rotate, cursor: 'grab', touchAction: 'none' }}
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

      {showSwipeHint && (
        <motion.div
          className="vote-swipe-hint"
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, delay: 0.15 }}
        >
          <div className="vote-swipe-hint__edge vote-swipe-hint__edge--left">
            <span className="material-symbols-outlined" aria-hidden="true">
              arrow_back
            </span>
            <span
              className="material-symbols-outlined vote-swipe-hint__icon"
              aria-hidden="true"
            >
              close
            </span>
          </div>
          <div className="vote-swipe-hint__copy">
            <span className="vote-swipe-hint__title">SWIPE TO VOTE</span>
            <span className="vote-swipe-hint__subtitle">
              LEFT TO PASS, RIGHT TO LIKE
            </span>
          </div>
          <div className="vote-swipe-hint__edge vote-swipe-hint__edge--right">
            <span
              className="material-symbols-outlined vote-swipe-hint__icon"
              aria-hidden="true"
            >
              favorite
            </span>
            <span className="material-symbols-outlined" aria-hidden="true">
              arrow_forward
            </span>
          </div>
        </motion.div>
      )}

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
  game,
}: {
  round: Doc<'rounds'>
  playerId: Id<'players'>
  game: Doc<'games'>
}) {
  const convex = useConvex()
  const myStats = useQuery(api.players.getMyStats, {
    gameId: game._id,
    playerId,
  })
  const castVote = useMutation(api.votes.castVote)
  const seconds = useCountdown(round.voteEndsAt)
  const [submitting, setSubmitting] = useState(false)
  const [loadingSnapshot, setLoadingSnapshot] = useState(false)
  const swipeHintStorageKey = `mixr_vote_swipe_hint_seen_${game._id}_${playerId}`
  const [localCandidates, setLocalCandidates] = useState<
    Array<{ captionId: Id<'captions'>; text: string }>
  >([])
  const [initializedRoundId, setInitializedRoundId] = useState<string | null>(
    null
  )
  const [snapshotReady, setSnapshotReady] = useState(false)
  const [hasSeenSwipeHint, setHasSeenSwipeHint] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(swipeHintStorageKey) === 'true'
    } catch {
      return false
    }
  })
  const { error, clearError, reject } = useActionFeedback()
  const current = localCandidates[0]
  const votingClosed = seconds === 0 || !snapshotReady
  const canVote = !submitting && !votingClosed && current !== undefined
  const shouldShowSwipeHint =
    current !== undefined && canVote && !hasSeenSwipeHint && !loadingSnapshot

  useEffect(() => {
    try {
      setHasSeenSwipeHint(
        sessionStorage.getItem(swipeHintStorageKey) === 'true'
      )
    } catch {
      setHasSeenSwipeHint(false)
    }
  }, [swipeHintStorageKey])

  useEffect(() => {
    if (initializedRoundId === round._id) return
    setLocalCandidates([])
    setInitializedRoundId(null)
    setSnapshotReady(false)
    setLoadingSnapshot(false)
  }, [initializedRoundId, round._id])

  useEffect(() => {
    if (round.voteSnapshotReady !== true || initializedRoundId === round._id) {
      return
    }

    let cancelled = false

    const loadSnapshot = async () => {
      setLoadingSnapshot(true)

      try {
        const snapshot = await convex.query(api.votes.getVoteSnapshot, {
          playerId,
          roundId: round._id,
        })

        if (cancelled) return

        setSnapshotReady(snapshot.ready)
        if (!snapshot.ready) return

        setLocalCandidates(snapshot.candidates)
        setInitializedRoundId(round._id)
      } finally {
        if (!cancelled) {
          setLoadingSnapshot(false)
        }
      }
    }

    void loadSnapshot()

    return () => {
      cancelled = true
    }
  }, [convex, initializedRoundId, playerId, round._id, round.voteSnapshotReady])

  useEffect(() => {
    if (!votingClosed) return
    clearError()
  }, [clearError, votingClosed])

  const handleVote = async (value: boolean) => {
    if (!current || !snapshotReady || seconds === 0 || submitting) {
      return 'closed' satisfies VoteAttemptResult
    }
    setSubmitting(true)
    clearError()
    try {
      const result = await castVote({
        playerId,
        captionId: current.captionId,
        value,
      })
      if (result.status === 'closed') {
        return 'closed' satisfies VoteAttemptResult
      }
      return 'accepted' satisfies VoteAttemptResult
    } catch (e) {
      reject(e, 'VOTE REJECTED')
      return 'rejected' satisfies VoteAttemptResult
    } finally {
      setSubmitting(false)
    }
  }

  const handleAcceptedVote = () => {
    setLocalCandidates((existing) => existing.slice(1))

    if (hasSeenSwipeHint) return

    try {
      sessionStorage.setItem(swipeHintStorageKey, 'true')
    } catch {
      // Ignore storage failures; this only affects whether the hint persists.
    }
    setHasSeenSwipeHint(true)
  }

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
            {myStats?.totalScore ?? 0} PTS
          </span>
        </div>
        <div className="timer-badge">
          <span>{formatted}s</span>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
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
                onAccepted={handleAcceptedVote}
                disabled={!canVote}
                showSwipeHint={shouldShowSwipeHint}
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
        ) : loadingSnapshot ||
          round.voteSnapshotReady !== true ||
          !snapshotReady ? (
          <div
            className="brutal-card"
            style={{ padding: 32, textAlign: 'center' }}
          >
            <Loader />
            <h2 style={{ marginTop: 16 }}>PREPARING VOTES...</h2>
            <p style={{ marginTop: 8 }}>HOLD TIGHT</p>
          </div>
        ) : (
          <div
            className="brutal-card"
            style={{ padding: 32, textAlign: 'center' }}
          >
            <Loader />
            <h2 style={{ marginTop: 16 }}>NO MORE MEMES</h2>
            <p style={{ marginTop: 8 }}>WAITING FOR NEW CAPTIONS...</p>
          </div>
        )}
      </main>
    </>
  )
}
