import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

type ScoreEntry = { playerId: string; name: string; totalScore: number }

export function Leaderboard({ gameId }: { gameId: Id<'games'> }) {
  const scores = useQuery(api.players.getScores, { gameId })

  if (!scores) return null

  return (
    <div className="leaderboard">
      <div className="leaderboard-title">LEADERBOARD</div>
      <ol className="leaderboard-list">
        {scores.map((entry: ScoreEntry, i: number) => (
          <li key={entry.playerId} className="leaderboard-row">
            <div className="leaderboard-left">
              <span className="leaderboard-rank">{i + 1}</span>
              <span className="leaderboard-name">{entry.name}</span>
            </div>
            <span className="leaderboard-score">{entry.totalScore} PTS</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
