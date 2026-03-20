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
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`

  return (
    <div className="host-shell">
      <header className="brutal-header" style={{ justifyContent: 'center' }}>
        <h2 style={{ fontSize: 24, margin: 0 }}>GAME LOBBY</h2>
      </header>

      <main className="screen center" style={{ paddingBottom: 24 }}>
        <div className="game-code">
          CODE
          <strong>{gameCode}</strong>
        </div>

        <div className="qr-section">
          <img
            src={qrUrl}
            alt="QR code to join game"
            width={200}
            height={200}
          />
          <p className="join-url">{joinUrl}</p>
        </div>

        <div className="player-list" style={{ maxWidth: 400 }}>
          <h3 style={{ marginBottom: 8 }}>PLAYERS ({players?.length ?? 0})</h3>
          {players?.map((p: Doc<'players'>) => (
            <div key={p._id} className="player-list-item">
              {p.name}
            </div>
          ))}
        </div>

        <button
          type="button"
          className="brutal-btn brutal-btn--green"
          style={{ maxWidth: 400 }}
          onClick={() => startGame({ gameId: game._id })}
          disabled={!players || players.length < 2}
        >
          <span>START GAME</span>
          <span className="material-symbols-outlined" aria-hidden="true">
            play_arrow
          </span>
        </button>

        {players && players.length < 2 && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            NEED AT LEAST 2 PLAYERS TO START
          </p>
        )}
      </main>
    </div>
  )
}
