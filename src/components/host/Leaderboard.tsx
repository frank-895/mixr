import { useQuery } from 'convex/react'
import { AnimatePresence, motion } from 'motion/react'
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
        <AnimatePresence initial={false}>
          {scores.map((entry: ScoreEntry, i: number) => (
            <motion.li
              key={entry.playerId}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`leaderboard-row${i === 0 ? ' first-place' : ''}`}
            >
              <div className="leaderboard-left">
                <span className="leaderboard-rank">
                  {i === 0 ? '👑' : i + 1}
                </span>
                <span className="leaderboard-name">{entry.name}</span>
              </div>
              <span className="leaderboard-score">{entry.totalScore} PTS</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  )
}
