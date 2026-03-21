import { useMutation, useQuery } from 'convex/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'

// Steps: -1=intro, 0=3rd, 1=2nd, 2=1st, 3=leaderboard
type RevealStep = -1 | 0 | 1 | 2 | 3

const CAPTION_DELAYS = [2000, 5000, 5000, 6000] // intro, 3rd, 2nd, 1st

const PLACE_CONFIG = [
  { label: '3RD PLACE', color: '#cd7f32', emoji: '🥉' },
  { label: '2ND PLACE', color: '#c0c0c0', emoji: '🥈' },
  { label: '1ST PLACE', color: '#ffd700', emoji: '🥇' },
] as const

type ScoreEntry = { playerId: string; name: string; totalScore: number }

export function RevealScreen({
  round,
  game,
}: {
  round: Doc<'rounds'>
  game: Doc<'games'>
}) {
  const topCaptions = useQuery(api.captions.getTopCaptions, {
    roundId: round._id,
    limit: 3,
  })
  const scores = useQuery(api.players.getScores, { gameId: game._id })
  const skipPhase = useMutation(api.games.skipPhase)
  const [step, setStep] = useState<RevealStep>(-1)

  const count = topCaptions?.length ?? 0

  useEffect(() => {
    if (count === 0) return

    const maxCaptionStep = count - 1

    const timers: ReturnType<typeof setTimeout>[] = []

    // Intro → caption reveals
    let elapsed = CAPTION_DELAYS[0]
    timers.push(
      setTimeout(() => {
        setStep(0)
      }, elapsed)
    )

    for (let i = 1; i <= maxCaptionStep; i++) {
      elapsed += CAPTION_DELAYS[i]
      const s = i as RevealStep
      timers.push(
        setTimeout(() => {
          setStep(s)
        }, elapsed)
      )
    }

    // Leaderboard step after 1st place
    elapsed +=
      CAPTION_DELAYS[Math.min(maxCaptionStep + 1, CAPTION_DELAYS.length - 1)]
    timers.push(
      setTimeout(() => {
        setStep(3)
      }, elapsed)
    )

    return () => timers.forEach(clearTimeout)
  }, [count])

  if (!topCaptions) {
    return (
      <div className="host-shell">
        <main className="screen center">
          <span
            className="material-symbols-outlined animate-spin"
            style={{ fontSize: 48 }}
          >
            hourglass_empty
          </span>
        </main>
      </div>
    )
  }

  // Reverse so index 0 = 3rd place, 1 = 2nd, 2 = 1st
  const ordered = [...topCaptions].reverse()
  const configOffset = 3 - count

  return (
    <div className="host-shell">
      <header className="brutal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div className="badge badge--primary">
            {game.currentRound} / {game.totalRounds}
          </div>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 20,
            fontWeight: 800,
            textTransform: 'uppercase',
            color: 'var(--pink)',
          }}
        >
          {step === 3 ? 'STANDINGS' : 'TOP MEMES'}
        </div>
        <button
          type="button"
          className="brutal-header-btn"
          onClick={() => skipPhase({ gameId: game._id })}
          aria-label="Skip reveal"
        >
          <span className="material-symbols-outlined">skip_next</span>
        </button>
      </header>

      <main className="reveal-stage">
        <AnimatePresence mode="wait">
          {step === -1 && (
            <motion.div
              key="intro"
              className="reveal-intro"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="reveal-intro-title">AND THE TOP MEMES ARE...</h1>
            </motion.div>
          )}

          {step >= 0 && step <= 2 && ordered[step] && (
            <MemeRevealCard
              key={`place-${step}`}
              caption={ordered[step]}
              config={PLACE_CONFIG[step + configOffset]}
            />
          )}

          {step === 3 && scores && (
            <RevealLeaderboard scores={scores.slice(0, 5)} />
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

function MemeRevealCard({
  caption,
  config,
}: {
  caption: {
    text: string
    score: number
    playerName: string
    imageUrl: string
  }
  config: (typeof PLACE_CONFIG)[number]
}) {
  return (
    <motion.div
      className="reveal-card"
      initial={{ opacity: 0, y: 60, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -40, scale: 0.95 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 25,
      }}
    >
      {/* Place badge */}
      <motion.div
        className="reveal-place-badge"
        style={{ background: config.color }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 20,
          delay: 0.2,
        }}
      >
        <span className="reveal-place-emoji">{config.emoji}</span>
        <span className="reveal-place-label">{config.label}</span>
      </motion.div>

      {/* Meme with caption overlay */}
      <div className="meme-frame">
        <img src={caption.imageUrl} alt="Meme template" />
        <div className="reveal-caption-overlay">
          <span className="impact-text">{caption.text}</span>
        </div>
      </div>

      {/* Author + score */}
      <motion.div
        className="reveal-author"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4 }}
      >
        <span className="reveal-author-name">{caption.playerName}</span>
        <span className="reveal-author-score">{caption.score} PTS</span>
      </motion.div>
    </motion.div>
  )
}

function RevealLeaderboard({ scores }: { scores: ScoreEntry[] }) {
  return (
    <motion.div
      className="reveal-leaderboard"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <ol className="reveal-leaderboard-list">
        {scores.map((entry, i) => (
          <motion.li
            key={entry.playerId}
            className={`reveal-leaderboard-row${i === 0 ? ' first-place' : ''}`}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="leaderboard-left">
              <span className="leaderboard-rank">{i === 0 ? '👑' : i + 1}</span>
              <span className="leaderboard-name">{entry.name}</span>
            </div>
            <span className="leaderboard-score">{entry.totalScore} PTS</span>
          </motion.li>
        ))}
      </ol>
    </motion.div>
  )
}

export function GameRevealScreen({
  topMemes,
  onComplete,
}: {
  topMemes: Array<{
    text: string
    score: number
    playerName: string
    imageUrl: string
    roundNumber: number
  }>
  onComplete: () => void
}) {
  const [step, setStep] = useState<RevealStep>(-1)
  const count = topMemes.length
  const configOffset = 3 - count

  useEffect(() => {
    if (count === 0) {
      onComplete()
      return
    }

    const maxCaptionStep = count - 1
    const timers: ReturnType<typeof setTimeout>[] = []

    // Intro → caption reveals
    let elapsed = CAPTION_DELAYS[0]
    timers.push(
      setTimeout(() => {
        setStep(0)
      }, elapsed)
    )

    for (let i = 1; i <= maxCaptionStep; i++) {
      elapsed += CAPTION_DELAYS[i]
      const s = i as RevealStep
      timers.push(
        setTimeout(() => {
          setStep(s)
        }, elapsed)
      )
    }

    // After all reveals, call onComplete (no leaderboard step — goes straight to winner screen)
    elapsed +=
      CAPTION_DELAYS[Math.min(maxCaptionStep + 1, CAPTION_DELAYS.length - 1)]
    timers.push(setTimeout(onComplete, elapsed))

    return () => timers.forEach(clearTimeout)
  }, [count, onComplete])

  const ordered = [...topMemes].reverse()

  return (
    <div className="host-shell">
      <header className="brutal-header" style={{ justifyContent: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 20,
            fontWeight: 800,
            textTransform: 'uppercase',
            color: 'var(--pink)',
          }}
        >
          BEST MEMES OF THE GAME
        </div>
      </header>

      <main className="reveal-stage">
        <AnimatePresence mode="wait">
          {step === -1 && (
            <motion.div
              key="intro"
              className="reveal-intro"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="reveal-intro-title">
                THE BEST MEMES OF THE GAME...
              </h1>
            </motion.div>
          )}

          {step >= 0 && step <= 2 && ordered[step] && (
            <MemeRevealCard
              key={`game-place-${step}`}
              caption={ordered[step]}
              config={PLACE_CONFIG[step + configOffset]}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
