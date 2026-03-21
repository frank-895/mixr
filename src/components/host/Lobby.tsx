import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'
import { useActionFeedback } from '../../lib/useActionFeedback'

export function Lobby({
  game,
  gameCode,
}: {
  game: Doc<'games'>
  gameCode: string
}) {
  const players = useQuery(api.players.listByGame, { gameId: game._id })
  const startGame = useMutation(api.games.startGame)
  const removePlayer = useMutation(api.players.remove)
  const { error, isRejected, clearError, reject } = useActionFeedback()

  const joinUrl = `${window.location.origin}?code=${gameCode}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}`

  const playerCount = players?.length ?? 0
  const canStart = playerCount >= 3

  const handleStart = async () => {
    clearError()
    try {
      await startGame({ gameId: game._id })
    } catch (e) {
      reject(e, "CAN'T START YET")
    }
  }

  const handleRemovePlayer = async (playerId: Doc<'players'>['_id']) => {
    clearError()
    try {
      await removePlayer({ gameId: game._id, playerId })
    } catch (e) {
      reject(e, "CAN'T REMOVE PLAYER")
    }
  }

  return (
    <div className="host-shell">
      <header
        className="brutal-header"
        style={{ justifyContent: 'center', gap: 12 }}
      >
        <span className="brand-label brand-label--inline">MIXR</span>
      </header>

      <main className="lobby">
        <div className="qr-section">
          <span className="qr-section__label">SCAN TO JOIN</span>
          <div className="qr-section__card">
            <img
              src={qrUrl}
              alt="QR code to join game"
              width={160}
              height={160}
            />
            <div className="qr-section__divider" />
            <span className="qr-section__code-display">{gameCode}</span>
          </div>
          {import.meta.env.DEV && (
            <a
              href={joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="qr-section__dev-link"
            >
              Open player view ↗
            </a>
          )}
        </div>

        <div className="lobby__players">
          <h3 className="lobby__players-heading">
            PLAYERS
            <span className="lobby__player-count">{playerCount}</span>
          </h3>

          {playerCount === 0 ? (
            <p className="lobby__empty animate-pulse">
              WAITING FOR PLAYERS TO JOIN...
            </p>
          ) : (
            <div className="player-chips">
              {players?.map((p) => (
                <div key={p._id} className="player-chip">
                  <span>{p.name}</span>
                  <button
                    type="button"
                    className="player-chip__remove"
                    onClick={() => void handleRemovePlayer(p._id)}
                    aria-label={`Remove ${p.name}`}
                  >
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                    >
                      close
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lobby__actions">
          <button
            type="button"
            className={`brutal-btn brutal-btn--green ${isRejected ? 'ui-rejected' : ''}`}
            onClick={handleStart}
            disabled={!canStart}
          >
            <span>START GAME</span>
            <span className="material-symbols-outlined" aria-hidden="true">
              play_arrow
            </span>
          </button>

          {!canStart && (
            <p className="lobby__hint">
              You'll need at least 3 players to start
            </p>
          )}

          {error && <p className="lobby__hint">{error}</p>}
        </div>
      </main>
    </div>
  )
}
