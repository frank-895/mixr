import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'

export function Lobby({
  game,
  gameCode,
}: {
  game: Doc<'games'>
  gameCode: string
}) {
  const players = useQuery(api.players.listByGame, { gameId: game._id })
  const startGame = useMutation(api.games.startGame)

  const joinUrl = `${window.location.origin}?game=${gameCode}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}`

  const playerCount = players?.length ?? 0
  const canStart = playerCount >= 2

  return (
    <div className="host-shell">
      <header className="brutal-header" style={{ justifyContent: 'center' }}>
        <h2 style={{ fontSize: 24, margin: 0 }}>GAME LOBBY</h2>
      </header>

      <main className="lobby">
        <div className="qr-section">
          <span className="qr-section__label">SCAN TO JOIN</span>
          <div className="qr-section__frame">
            <img
              src={qrUrl}
              alt="QR code to join game"
              width={160}
              height={160}
            />
          </div>
          <span className="qr-section__code">{gameCode}</span>
          {import.meta.env.DEV && (
            <a
              href={joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                color: '#888',
                textDecoration: 'underline',
                marginTop: 4,
              }}
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
                  {p.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lobby__actions">
          <button
            type="button"
            className="brutal-btn brutal-btn--green"
            onClick={() => startGame({ gameId: game._id })}
            disabled={!canStart}
          >
            <span>START GAME</span>
            <span className="material-symbols-outlined" aria-hidden="true">
              play_arrow
            </span>
          </button>

          {!canStart && (
            <p className="lobby__hint">NEED AT LEAST 2 PLAYERS TO START</p>
          )}
        </div>
      </main>
    </div>
  )
}
