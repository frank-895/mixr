import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { Crown } from './Crown'

interface PitchDeckProps {
  navigate: (path: string, params?: Record<string, string>) => void
}

const SLIDE_KEYS = [
  'title',
  'problem',
  'how',
  'scale',
  'built',
  'demo',
] as const

const SLIDES = [
  // 0 — Title
  () => (
    <div className="pitch-slide">
      <img src="/MIXR_logo.jpg" alt="MIXR" className="brand-logo" />
      <h1>FREE PARTY GAMES FOR CROWDS OF ANY SIZE</h1>
      <div className="pitch-hosted-by">
        <img
          src="/encode_logo.png"
          alt="Encode Club"
          className="pitch-hosted-by__logo"
        />
        <p style={{ margin: 0, opacity: 0.6 }}>AI LONDON HACKATHON 2026</p>
      </div>
    </div>
  ),

  // 1 — Problem & Solution combined
  () => (
    <div className="pitch-slide">
      <div className="pitch-split">
        <div className="pitch-split__side">
          <h2>OTHERS</h2>
          <div className="pitch-cards">
            <div className="pitch-card">
              <span className="material-symbols-outlined pitch-card__icon">
                payments
              </span>
              <div>
                <h3>PAID</h3>
                <p>$25+ PER GAME PACK</p>
              </div>
            </div>
            <div className="pitch-card">
              <span className="material-symbols-outlined pitch-card__icon">
                person
              </span>
              <div>
                <h3>ACCOUNT REQUIRED</h3>
                <p>SIGN-UP BEFORE YOU PLAY</p>
              </div>
            </div>
            <div className="pitch-card">
              <span className="material-symbols-outlined pitch-card__icon">
                group_off
              </span>
              <div>
                <h3>CAPPED</h3>
                <p>8 PLAYERS MAX</p>
              </div>
            </div>
            <div className="pitch-card">
              <span className="material-symbols-outlined pitch-card__icon">
                lock
              </span>
              <div>
                <h3>CLOSED</h3>
                <p>NO CUSTOM GAME CREATION</p>
              </div>
            </div>
          </div>
        </div>
        <div className="pitch-split__divider" />
        <div className="pitch-split__side">
          <h2>MIXR</h2>
          <div className="pitch-cards">
            <div className="pitch-card pitch-card--highlight">
              <span className="material-symbols-outlined pitch-card__icon pitch-card__icon--primary">
                money_off
              </span>
              <div>
                <h3>FREE FOREVER</h3>
                <p>NO PAYMENT, NO CATCH</p>
              </div>
            </div>
            <div className="pitch-card pitch-card--highlight">
              <span className="material-symbols-outlined pitch-card__icon pitch-card__icon--primary">
                person_off
              </span>
              <div>
                <h3>NO ACCOUNT NEEDED</h3>
                <p>SCAN QR AND YOU'RE IN</p>
              </div>
            </div>
            <div className="pitch-card pitch-card--highlight">
              <span className="material-symbols-outlined pitch-card__icon pitch-card__icon--primary">
                groups
              </span>
              <div>
                <h3>SCALES TO 500+</h3>
                <p>REAL-TIME FOR EVERYONE</p>
              </div>
            </div>
            <div className="pitch-card pitch-card--highlight">
              <span className="material-symbols-outlined pitch-card__icon pitch-card__icon--primary">
                extension
              </span>
              <div>
                <h3>OPEN PLATFORM</h3>
                <p>BUILD YOUR OWN GAMES</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),

  // 2 — How It Works
  () => (
    <div className="pitch-slide">
      <h2>HOW IT WORKS</h2>
      <div className="pitch-steps">
        <div className="pitch-step">
          <div className="pitch-step__number">1</div>
          <span className="material-symbols-outlined pitch-step__icon">
            videogame_asset
          </span>
          <h3>HOST CREATES GAME</h3>
        </div>
        <span className="material-symbols-outlined pitch-arrow">
          arrow_forward
        </span>
        <div className="pitch-step">
          <div className="pitch-step__number">2</div>
          <span className="material-symbols-outlined pitch-step__icon">
            qr_code_2
          </span>
          <h3>PLAYERS SCAN QR</h3>
        </div>
        <span className="material-symbols-outlined pitch-arrow">
          arrow_forward
        </span>
        <div className="pitch-step">
          <div className="pitch-step__number">3</div>
          <span className="material-symbols-outlined pitch-step__icon">
            bolt
          </span>
          <h3>PLAY IN REAL-TIME</h3>
        </div>
      </div>
    </div>
  ),

  // 4 — Built for Scale
  () => (
    <div className="pitch-slide">
      <h2>BUILT FOR SCALE</h2>
      <div className="pitch-grid">
        <div className="pitch-card">
          <span className="material-symbols-outlined pitch-card__icon pitch-card__icon--pink">
            sync
          </span>
          <div>
            <h3>CONVEX REALTIME BACKEND</h3>
            <p>LIVE STATE SYNC FOR 500 PLAYERS</p>
          </div>
        </div>
        <div className="pitch-card">
          <span className="material-symbols-outlined pitch-card__icon pitch-card__icon--pink">
            database
          </span>
          <div>
            <h3>DENORMALISED SCORES + COUNTS</h3>
            <p>INCREMENT ON WRITE, NOT RECOMPUTE</p>
          </div>
        </div>
        <div className="pitch-card">
          <span className="material-symbols-outlined pitch-card__icon pitch-card__icon--pink">
            photo_camera
          </span>
          <div>
            <h3>VOTE SNAPSHOTS</h3>
            <p>PRECOMPUTED CANDIDATES, CONSISTENT VOTING</p>
          </div>
        </div>
        <div className="pitch-card">
          <span className="material-symbols-outlined pitch-card__icon pitch-card__icon--pink">
            shield
          </span>
          <div>
            <h3>RATE LIMITED INPUT</h3>
            <p>CLIENT + SERVER PROTECTION AGAINST SPAM</p>
          </div>
        </div>
      </div>
    </div>
  ),

  // 5 — What We Built
  () => (
    <div className="pitch-slide">
      <h2>WHAT WE BUILT</h2>
      <p style={{ margin: 0, opacity: 0.6 }}>MEME IT</p>
      <div className="pitch-phases">
        <div className="pitch-phase pitch-phase--yellow">
          <span className="material-symbols-outlined pitch-phase__icon">
            edit
          </span>
          <h3>CAPTION</h3>
          <p>PLAYERS WRITE CAPTIONS FOR MEME IMAGES</p>
        </div>
        <div className="pitch-phase pitch-phase--pink">
          <span className="material-symbols-outlined pitch-phase__icon">
            swipe
          </span>
          <h3>VOTE</h3>
          <p>SWIPE TO VOTE ON THE FUNNIEST</p>
        </div>
        <div
          className="pitch-phase pitch-phase--green"
          style={{ position: 'relative' }}
        >
          <Crown size={44} />
          <span className="material-symbols-outlined pitch-phase__icon">
            emoji_events
          </span>
          <h3>REVEAL</h3>
          <p>WINNER CROWNED WITH POINTS</p>
        </div>
      </div>
    </div>
  ),

  // 6 — Demo (rendered separately to get navigate prop)
  null,
]

const slideVariants = {
  enter: { opacity: 0, y: 24 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -24 },
}

const slideTransition = { duration: 0.3, ease: 'easeOut' }

export function PitchDeck({ navigate }: PitchDeckProps) {
  const [current, setCurrent] = useState(0)
  const total = SLIDES.length

  const goNext = useCallback(
    () => setCurrent((s) => Math.min(s + 1, SLIDES.length - 1)),
    []
  )
  const goPrev = useCallback(() => setCurrent((s) => Math.max(s - 1, 0)), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev])

  const renderSlide = () => {
    if (current === total - 1) {
      return (
        <div className="pitch-slide">
          <h1>LET'S SEE IT LIVE</h1>
          <button
            type="button"
            className="brutal-btn pitch-demo-btn"
            onClick={() => navigate('/host')}
          >
            <span>LAUNCH DEMO</span>
            <span className="material-symbols-outlined" aria-hidden="true">
              rocket_launch
            </span>
          </button>
        </div>
      )
    }
    const SlideContent = SLIDES[current]
    return SlideContent ? <SlideContent /> : null
  }

  return (
    <div className="pitch-deck">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={slideTransition}
          style={{ height: '100%' }}
        >
          {renderSlide()}
        </motion.div>
      </AnimatePresence>

      <div className="pitch-indicator">
        {SLIDES.map((_, i) => (
          <button
            key={SLIDE_KEYS[i]}
            type="button"
            className={`pitch-indicator__dot ${i === current ? 'pitch-indicator__dot--active' : ''}`}
            onClick={() => setCurrent(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
