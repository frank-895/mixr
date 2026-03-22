import { useAuthActions } from '@convex-dev/auth/react'
import { useConvex, useConvexAuth, useMutation } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../convex/_generated/api'
import { HostApp } from './components/host/HostApp'
import { Loader } from './components/Loader'
import { PlayerApp } from './components/player/PlayerApp'
import { useActionFeedback } from './lib/useActionFeedback'
import { useRoute } from './lib/useRoute'

function App() {
  const { mode, gameCode, navigate } = useRoute()

  if (mode === 'host' && gameCode) {
    return <HostRoute gameCode={gameCode} navigate={navigate} />
  }

  if (mode === 'player' && gameCode) {
    return (
      <div className="app-shell">
        <PlayerApp gameCode={gameCode} />
      </div>
    )
  }

  if (mode === 'host-landing') {
    return (
      <div className="app-shell">
        <HostRoute navigate={navigate} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <JoinPage navigate={navigate} />
    </div>
  )
}

function HostRoute({
  gameCode,
  navigate,
}: {
  gameCode?: string
  navigate: (path: string, params?: Record<string, string>) => void
}) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { signIn } = useAuthActions()
  const [error, setError] = useState<string | null>(null)
  const attemptedRef = useRef(false)

  useEffect(() => {
    if (isLoading || isAuthenticated || attemptedRef.current) return

    attemptedRef.current = true
    setError(null)

    void signIn('anonymous').catch((err) => {
      attemptedRef.current = false
      setError(err instanceof Error ? err.message.toUpperCase() : 'AUTH FAILED')
    })
  }, [isAuthenticated, isLoading, signIn])

  if (isLoading || !isAuthenticated) {
    return (
      <main className="screen center">
        <Loader />
        <h2>{error ? "CAN'T SIGN IN HOST" : 'PREPARING HOST SESSION...'}</h2>
        {error && <p style={{ margin: 0 }}>{error}</p>}
      </main>
    )
  }

  if (gameCode) {
    return <HostApp gameCode={gameCode} />
  }

  return <HostLanding navigate={navigate} />
}

function JoinPage({
  navigate,
}: {
  navigate: (path: string, params?: Record<string, string>) => void
}) {
  const convex = useConvex()
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const { error, isRejected, clearError, reject } = useActionFeedback()

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    if (trimmed.length !== 4) {
      reject('ENTER 4 VALID CHARACTERS')
      return
    }

    clearError()
    setChecking(true)
    try {
      const game = await convex.query(api.games.getByCode, { code: trimmed })
      if (game) {
        navigate('/', { game: trimmed })
      } else {
        reject('GAME NOT FOUND')
      }
    } catch (e) {
      reject(e, 'TRY A REAL CODE')
    } finally {
      setChecking(false)
    }
  }

  return (
    <main className="screen center">
      <div className="text-center mb-8">
        <img src="/MIXR_logo.jpg" alt="MIXR" className="brand-logo" />
      </div>

      <div className="form-stack">
        <input
          type="text"
          className={`brutal-input ${isRejected ? 'ui-rejected' : ''}`}
          placeholder="ENTER GAME CODE"
          value={code}
          onChange={(e) => {
            setCode(
              e.target.value
                .toUpperCase()
                .replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, '')
                .slice(0, 4)
            )
            clearError()
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          maxLength={4}
          style={{ textAlign: 'center', letterSpacing: 4, fontSize: 24 }}
        />
        {error && (
          <p
            style={{
              color: '#ef4444',
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {error}
          </p>
        )}
      </div>

      <button
        type="button"
        className="brutal-btn"
        onClick={handleJoin}
        disabled={!code.trim() || checking}
      >
        <span>{checking ? 'CHECKING...' : 'JOIN GAME'}</span>
        <span className="material-symbols-outlined" aria-hidden="true">
          login
        </span>
      </button>

      {import.meta.env.DEV && (
        <a
          href="/host"
          style={{
            fontSize: 12,
            color: '#888',
            textDecoration: 'underline',
            marginTop: 8,
          }}
        >
          Host a game ↗
        </a>
      )}
    </main>
  )
}

function HostLanding({
  navigate,
}: {
  navigate: (path: string, params?: Record<string, string>) => void
}) {
  const createGame = useMutation(api.games.createGame)
  const [rounds, setRounds] = useState(3)
  const [captionSeconds, setCaptionSeconds] = useState(60)
  const [voteSeconds, setVoteSeconds] = useState(60)
  const [maxCaptions, setMaxCaptions] = useState(1)
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    setCreating(true)
    try {
      const { code } = await createGame({
        totalRounds: rounds,
        captionPhaseDurationMs: captionSeconds * 1000,
        votePhaseDurationMs: voteSeconds * 1000,
        maxCaptionsPerPlayer: maxCaptions,
      })
      navigate('/host', { game: code })
    } catch {
      setCreating(false)
    }
  }

  return (
    <main className="screen center">
      <div className="text-center mb-8">
        <img src="/MIXR_logo.jpg" alt="MIXR" className="brand-logo" />
      </div>

      <div className="form-stack">
        <RoundsPicker value={rounds} onChange={setRounds} />
        <DurationPicker
          label="CAPTION TIME"
          value={captionSeconds}
          onChange={setCaptionSeconds}
        />
        <DurationPicker
          label="VOTE TIME"
          value={voteSeconds}
          onChange={setVoteSeconds}
        />
        <CaptionLimitPicker value={maxCaptions} onChange={setMaxCaptions} />
      </div>

      <button
        type="button"
        className="brutal-btn"
        onClick={handleCreate}
        disabled={creating}
      >
        <span>{creating ? 'CREATING...' : 'HOST A GAME'}</span>
        <span className="material-symbols-outlined" aria-hidden="true">
          videogame_asset
        </span>
      </button>
    </main>
  )
}

function RoundsPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const options = Array.from({ length: 10 }, (_, i) => i + 1)

  return (
    <div className="rounds-picker" ref={ref}>
      <button
        type="button"
        className="rounds-picker__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>
          {value} {value === 1 ? 'ROUND' : 'ROUNDS'}
        </span>
        <span
          className={`material-symbols-outlined rounds-picker__chevron ${open ? 'rounds-picker__chevron--open' : ''}`}
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="rounds-picker__menu" role="listbox">
          {options.map((n) => (
            <button
              key={n}
              type="button"
              role="option"
              aria-selected={n === value}
              className={`rounds-picker__option ${n === value ? 'rounds-picker__option--active' : ''}`}
              onClick={() => {
                onChange(n)
                setOpen(false)
              }}
            >
              {n} {n === 1 ? 'ROUND' : 'ROUNDS'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]

function DurationPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const formatSeconds = (s: number) => `${s}s`

  return (
    <div className="rounds-picker" ref={ref}>
      <button
        type="button"
        className="rounds-picker__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>
          {label}: {formatSeconds(value)}
        </span>
        <span
          className={`material-symbols-outlined rounds-picker__chevron ${open ? 'rounds-picker__chevron--open' : ''}`}
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="rounds-picker__menu" role="listbox">
          {DURATION_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={s === value}
              className={`rounds-picker__option ${s === value ? 'rounds-picker__option--active' : ''}`}
              onClick={() => {
                onChange(s)
                setOpen(false)
              }}
            >
              {formatSeconds(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const CAPTION_LIMIT_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

function CaptionLimitPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="rounds-picker" ref={ref}>
      <button
        type="button"
        className="rounds-picker__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>
          {value} {value === 1 ? 'CAPTION' : 'CAPTIONS'} PER PLAYER
        </span>
        <span
          className={`material-symbols-outlined rounds-picker__chevron ${open ? 'rounds-picker__chevron--open' : ''}`}
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="rounds-picker__menu" role="listbox">
          {CAPTION_LIMIT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              role="option"
              aria-selected={n === value}
              className={`rounds-picker__option ${n === value ? 'rounds-picker__option--active' : ''}`}
              onClick={() => {
                onChange(n)
                setOpen(false)
              }}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default App
