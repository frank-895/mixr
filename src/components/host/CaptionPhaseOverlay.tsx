import { useQuery } from 'convex/react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

type CaptionEntry = { _id: Id<'captions'>; text: string }

type VisibleCard = {
  key: number
  captionId: Id<'captions'>
  captionText: string
  top: number
  left: number
  rotate: number
}

const MAX_VISIBLE = 6
const MIN_INTERVAL_MS = 800

function randomPosition() {
  return {
    top: Math.random() * 50 + 2,
    left: Math.random() * 60 + 2,
    rotate: (Math.random() - 0.5) * 24,
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
  const shownIds = useRef(new Set<Id<'captions'>>())
  const queue = useRef<CaptionEntry[]>([])
  const drainTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addCard = useCallback((caption: CaptionEntry) => {
    setVisibleCards((prev) => {
      const next = prev.length >= MAX_VISIBLE ? prev.slice(1) : [...prev]
      next.push({
        key: nextKey.current++,
        captionId: caption._id,
        captionText: caption.text,
        ...randomPosition(),
      })
      return next
    })
  }, [])

  const drainQueue = useCallback(() => {
    const next = queue.current.shift()
    if (!next) {
      drainTimer.current = null
      return
    }
    addCard(next)
    drainTimer.current = setTimeout(drainQueue, MIN_INTERVAL_MS)
  }, [addCard])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (drainTimer.current) clearTimeout(drainTimer.current)
    }
  }, [])

  // React to new captions arriving — enqueue and drain at 800ms intervals
  useEffect(() => {
    if (!captions || captions.length === 0) return

    const newCaptions = captions.filter((c) => !shownIds.current.has(c._id))
    if (newCaptions.length === 0) return

    for (const c of newCaptions) {
      shownIds.current.add(c._id)
      queue.current.push(c)
    }

    // Start draining if not already running
    if (!drainTimer.current) {
      drainQueue()
    }
  }, [captions, drainQueue])

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
