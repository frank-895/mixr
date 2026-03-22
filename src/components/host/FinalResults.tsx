import { useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'
import { useRoute } from '../../lib/useRoute'
import { Crown } from '../Crown'
import { Loader } from '../Loader'
import { GameRevealScreen } from './RevealScreen'

type ScoreEntry = { playerId: string; name: string; totalScore: number }

export function FinalResults({ game }: { game: Doc<'games'> }) {
  const scores = useQuery(api.players.getScores, { gameId: game._id })
  const topMemes = useQuery(
    api.captions.getGameTopCaptions,
    game.totalRounds > 1 ? { gameId: game._id, limit: 3 } : 'skip'
  )
  const [showingReveal, setShowingReveal] = useState(game.totalRounds > 1)
  const { navigate } = useRoute()

  if (showingReveal && topMemes && topMemes.length > 0) {
    return (
      <GameRevealScreen
        topMemes={topMemes}
        onComplete={() => setShowingReveal(false)}
      />
    )
  }

  if (!scores) {
    return (
      <div className="host-shell">
        <main className="screen center">
          <Loader />
          <h2>LOADING RESULTS...</h2>
        </main>
      </div>
    )
  }

  const winner = scores[0]

  return (
    <div className="host-shell">
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
          maxWidth: 500,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Winner */}
        {winner && (
          <div>
            <h2 style={{ textAlign: 'center', fontSize: 36, marginBottom: 16 }}>
              MEME
              <br />
              CHAMPION
            </h2>
            <div
              className="winner-card"
              style={{ position: 'relative', overflow: 'visible' }}
            >
              <Crown size={52} />
              <div className="winner-info">
                <div className="winner-name">
                  <span>{winner.name}</span>
                </div>
                <div className="winner-pts">{winner.totalScore} PTS</div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        {scores.length > 1 && (
          <div className="leaderboard">
            <div className="leaderboard-title">LOSERS BRACKET</div>
            <ol className="leaderboard-list">
              {scores.slice(1).map((entry: ScoreEntry, i: number) => (
                <li key={entry.playerId} className="leaderboard-row">
                  <div className="leaderboard-left">
                    <span className="leaderboard-rank">{i + 2}</span>
                    <span className="leaderboard-name">{entry.name}</span>
                  </div>
                  <span className="leaderboard-score">
                    {entry.totalScore} PTS
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <button
          type="button"
          className="brutal-btn"
          onClick={() => navigate('/host')}
          style={{ marginTop: 'auto' }}
        >
          <span>NEW GAME</span>
          <span className="material-symbols-outlined" aria-hidden="true">
            restart_alt
          </span>
        </button>
      </main>
    </div>
  )
}
