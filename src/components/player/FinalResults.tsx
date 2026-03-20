import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

type ScoreEntry = { playerId: string; name: string; totalScore: number }

export function FinalResults({
  gameId,
  playerId,
}: {
  gameId: Id<'games'>
  playerId: Id<'players'>
}) {
  const scores = useQuery(api.players.getScores, { gameId })

  if (!scores) {
    return (
      <main className="screen center">
        <span
          className="material-symbols-outlined animate-spin"
          style={{ fontSize: 48 }}
        >
          hourglass_empty
        </span>
        <h2>LOADING...</h2>
      </main>
    )
  }

  const winner = scores[0]
  const rank = scores.findIndex((s: ScoreEntry) => s.playerId === playerId) + 1
  const myScore = scores.find((s: ScoreEntry) => s.playerId === playerId)

  return (
    <>
      {/* Header */}
      <header className="brutal-header" style={{ justifyContent: 'center' }}>
        <h2 style={{ fontSize: 24, margin: 0 }}>RESULTS</h2>
      </header>

      <main
        style={{
          flex: 1,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
          paddingBottom: 120,
        }}
      >
        {/* Your Rank */}
        {myScore && (
          <div className="text-center">
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>YOUR RANK</h2>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 64,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              #{rank}
            </div>
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
              {myScore.totalScore} PTS
            </div>
          </div>
        )}

        {/* Winner */}
        {winner && (
          <div>
            <h2 style={{ textAlign: 'center', fontSize: 32, marginBottom: 16 }}>
              MEME
              <br />
              CHAMPION
            </h2>
            <div className="winner-card">
              <div className="winner-info">
                <div className="winner-name">
                  <span>👑</span>
                  <span>{winner.name}</span>
                </div>
                <div className="winner-pts">{winner.totalScore} PTS</div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="leaderboard">
          <div className="leaderboard-title">LOSERS BRACKET</div>
          <ol className="leaderboard-list">
            {scores.slice(1).map((entry: ScoreEntry, i: number) => (
              <li
                key={entry.playerId}
                className={`leaderboard-row ${entry.playerId === playerId ? 'you' : ''}`}
              >
                <div className="leaderboard-left">
                  <span className="leaderboard-rank">{i + 2}</span>
                  <span className="leaderboard-name">
                    {entry.name}
                    {entry.playerId === playerId ? ' (YOU)' : ''}
                  </span>
                </div>
                <span className="leaderboard-score">
                  {entry.totalScore} PTS
                </span>
              </li>
            ))}
          </ol>
        </div>
      </main>
    </>
  )
}
