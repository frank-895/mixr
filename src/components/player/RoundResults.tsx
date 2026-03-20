import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export function RoundResults({
  round,
  playerId,
  game,
}: {
  round: Doc<'rounds'>
  playerId: Id<'players'>
  game: { currentRound: number; totalRounds: number }
}) {
  const captions = useQuery(api.captions.getPlayerCaptions, {
    playerId,
    roundId: round._id,
  })

  const totalScore = (captions ?? []).reduce(
    (sum: number, c: Doc<'captions'>) => sum + c.score,
    0
  )

  return (
    <main className="screen center">
      <h2>
        ROUND {game.currentRound} / {game.totalRounds}
      </h2>
      <h1 style={{ fontSize: 36 }}>COMPLETE</h1>

      {captions && captions.length > 0 ? (
        <div className="brutal-card" style={{ padding: 24, width: '100%' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            YOUR CAPTIONS ({captions.length}):
          </p>
          {captions.map((c: Doc<'captions'>) => (
            <p
              key={c._id}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 500,
                textTransform: 'uppercase',
                marginBottom: 8,
                border: '2px solid var(--black)',
                padding: '8px 12px',
              }}
            >
              "{c.text}" — {c.score} PTS
            </p>
          ))}
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 20,
              fontWeight: 700,
              border: '2px solid #000',
              background: 'var(--primary)',
              padding: '4px 12px',
              display: 'inline-block',
              boxShadow: '2px 2px 0px #000',
              marginTop: 8,
            }}
          >
            TOTAL: {totalScore} PTS
          </div>
        </div>
      ) : (
        <div className="brutal-card" style={{ padding: 24, width: '100%' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            YOU DIDN'T SUBMIT A CAPTION THIS ROUND.
          </p>
        </div>
      )}

      <p
        className="animate-pulse"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 700,
          textTransform: 'uppercase',
        }}
      >
        NEXT ROUND STARTING SOON...
      </p>
    </main>
  )
}
