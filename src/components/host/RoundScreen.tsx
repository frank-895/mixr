import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'
import { useCountdown } from '../../lib/useCountdown'
import { Leaderboard } from './Leaderboard'

export function RoundScreen({ game }: { game: Doc<'games'> }) {
  const round = useQuery(api.rounds.getCurrent, { gameId: game._id })
  const skipPhase = useMutation(api.games.skipPhase)

  if (!round) {
    return (
      <div className="host-shell">
        <main className="screen center">
          <span
            className="material-symbols-outlined animate-spin"
            style={{ fontSize: 48 }}
          >
            hourglass_empty
          </span>
          <h2>LOADING ROUND...</h2>
        </main>
      </div>
    )
  }

  const targetTime =
    round.state === 'caption' ? round.captionEndsAt : round.voteEndsAt

  return (
    <div className="host-shell">
      {/* Header */}
      <header className="brutal-header">
        <div className="badge badge--primary">
          ROUND {game.currentRound} / {game.totalRounds}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 20,
            fontWeight: 800,
            textTransform: 'uppercase',
            color: round.state === 'caption' ? '#000' : 'var(--pink)',
          }}
        >
          {round.state === 'caption'
            ? 'CAPTIONING...'
            : round.state === 'open'
              ? 'CAPTION + VOTE'
              : 'ROUND COMPLETE'}
        </div>
        {round.state !== 'finished' && <Timer targetTime={targetTime} />}
        {round.state !== 'finished' && (
          <button
            type="button"
            className="brutal-btn brutal-btn--pink brutal-btn--small"
            onClick={() => skipPhase({ gameId: game._id })}
          >
            <span>SKIP</span>
            <span className="material-symbols-outlined" aria-hidden="true">
              skip_next
            </span>
          </button>
        )}
      </header>

      {/* Main Layout */}
      <div className="host-round-layout">
        <div className="host-round-main">
          <div className="meme-frame">
            <img src={round.imageUrl} alt="Meme template" />
          </div>
        </div>
        <div className="host-round-sidebar">
          <Leaderboard gameId={game._id} />
        </div>
      </div>
    </div>
  )
}

function Timer({ targetTime }: { targetTime: number }) {
  const seconds = useCountdown(targetTime)
  const formatted = String(seconds).padStart(2, '0')
  return (
    <div className="timer-badge">
      <span className="material-symbols-outlined">timer</span>
      <span>00:{formatted}</span>
    </div>
  )
}
