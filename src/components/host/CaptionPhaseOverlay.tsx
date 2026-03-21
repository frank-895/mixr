import { useQuery } from 'convex/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'

type VisibleCard = {
  key: number
  captionText: string
  top: number
  left: number
  rotate: number
}

const MAX_VISIBLE = 6
const CYCLE_INTERVAL_MS = 1800

function randomPosition() {
  return {
    top: Math.random() * 60 + 5, // 5%–65% so cards stay in view
    left: Math.random() * 55 + 5, // 5%–60%
    rotate: (Math.random() - 0.5) * 12, // -6° to 6°
  }
}

export function CaptionPhaseOverlay({
  round,
}: {
  round: Doc<'rounds'>
  game: Doc<'games'>
}) {
  const captions = useQuery(api.captions.listByRound, {
    roundId: round._id,
  })
  const [visibleCards, setVisibleCards] = useState<VisibleCard[]>([])
  const nextKey = useRef(0)
  const lastAddedIndex = useRef(-1)

  useEffect(() => {
    if (!captions || captions.length === 0) return

    const interval = setInterval(() => {
      setVisibleCards((prev) => {
        const next = prev.length >= MAX_VISIBLE ? prev.slice(1) : [...prev]

        lastAddedIndex.current = (lastAddedIndex.current + 1) % captions.length
        const caption = captions[lastAddedIndex.current]
        const pos = randomPosition()

        next.push({
          key: nextKey.current++,
          captionText: caption.text,
          ...pos,
        })

        return next
      })
    }, CYCLE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [captions])

  const count = captions?.length ?? 0

  return (
    <div className="caption-phase-overlay">
      {count === 0 && (
        <div className="caption-phase-waiting animate-pulse">
          WAITING FOR CAPTIONS...
        </div>
      )}

      <AnimatePresence>
        {visibleCards.map((card) => (
          <motion.div
            key={card.key}
            className="caption-card"
            style={{
              top: `${card.top}%`,
              left: `${card.left}%`,
              zIndex: card.key,
              rotate: card.rotate,
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <img src={round.imageUrl} alt="" />
            <div className="caption-card-overlay">
              <span className="caption-card-text">{card.captionText}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
