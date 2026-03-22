import { useQuery } from 'convex/react'
import { motion } from 'motion/react'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'

export function VotePhaseGrid({
  round,
}: {
  round: Doc<'rounds'>
  game: Doc<'games'>
}) {
  const captions = useQuery(api.captions.getRoundCaptions, {
    roundId: round._id,
  })

  if (!captions) return null

  const top5 = captions.slice(0, 5)
  const maxScore = Math.max(1, ...top5.map((c) => Math.max(0, c.score)))

  return (
    <div className="vote-phase-layout">
      <div className="vote-phase-meme">
        <div className="meme-frame">
          <img src={round.imageUrl} alt="Meme template" />
        </div>
      </div>

      <div className="vote-phase-bars">
        {top5.map((entry) => {
          const clampedScore = Math.max(0, entry.score)
          const pct = (clampedScore / maxScore) * 100
          const isLeading = clampedScore === maxScore && maxScore > 0
          return (
            <div key={entry.captionId} className="vote-bar-row">
              <motion.div
                className={`vote-bar-fill${isLeading ? ' vote-bar-fill--leading' : ''}`}
                animate={{ width: `${Math.max(pct, 8)}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              />
              {clampedScore > 0 && (
                <span className="vote-bar-score">{clampedScore}</span>
              )}
              <div className="vote-bar-text">
                <span className="vote-bar-caption">{entry.text}</span>
                <span className="vote-bar-name">{entry.playerName}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
