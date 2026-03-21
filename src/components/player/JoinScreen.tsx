import { useMutation } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useActionFeedback } from '../../lib/useActionFeedback'

export function JoinScreen({
  gameId,
  gameState,
  onJoined,
  message,
}: {
  gameId: Id<'games'>
  gameState: string
  onJoined: (id: Id<'players'>) => void
  message?: string
}) {
  const joinGame = useMutation(api.players.join)
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { error, isRejected, clearError, reject } = useActionFeedback()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  if (gameState !== 'lobby') {
    return (
      <main className="screen center">
        <p className="brand-label">MIXR</p>
        <p>THIS GAME HAS ALREADY STARTED.</p>
      </main>
    )
  }

  const handleJoin = async () => {
    if (!name.trim()) return
    setJoining(true)
    clearError()
    try {
      const playerId = await joinGame({ gameId, name: name.trim() })
      onJoined(playerId)
    } catch (e) {
      reject(e, 'TRY ANOTHER NAME')
      setJoining(false)
    }
  }

  return (
    <main className="screen center">
      <div className="text-center mb-8">
        <p className="brand-label">MIXR</p>
      </div>

      {message && (
        <p
          style={{
            color: 'red',
            fontWeight: 700,
            textTransform: 'uppercase',
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          {message}
        </p>
      )}

      <div className="form-stack">
        <div>
          <label className="sr-only" htmlFor="playerName">
            Player Name
          </label>
          <input
            ref={inputRef}
            id="playerName"
            className={`brutal-input ${isRejected ? 'ui-rejected' : ''}`}
            type="text"
            placeholder="PLAYER NAME"
            value={name}
            onChange={(e) => {
              setName(e.target.value.toUpperCase())
              clearError()
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            maxLength={20}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      <button
        type="button"
        className="brutal-btn"
        onClick={handleJoin}
        disabled={joining || !name.trim()}
      >
        <span>{joining ? 'JOINING...' : 'ENTER THE CHAT'}</span>
        <span className="material-symbols-outlined" aria-hidden="true">
          login
        </span>
      </button>

      {error && (
        <p
          style={{ color: 'red', fontWeight: 700, textTransform: 'uppercase' }}
        >
          {error}
        </p>
      )}
    </main>
  )
}
