import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export function WaitingScreen({ gameId }: { gameId: Id<'games'> }) {
  const players = useQuery(api.players.listByGame, { gameId })

  return (
    <main className="screen center">
      <div
        className="waiting-overlay-box"
        style={{ border: '4px solid #000', padding: 32 }}
      >
        <span
          className="material-symbols-outlined animate-spin"
          aria-hidden="true"
          style={{ fontSize: 64, marginBottom: 24, display: 'block' }}
        >
          hourglass_empty
        </span>
        <h2 style={{ marginBottom: 16 }}>
          WAITING
          <br />
          FOR HOST...
        </h2>
      </div>

      <div className="player-list" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 8 }}>PLAYERS ({players?.length ?? 0})</h3>
        {players?.map((p: Doc<'players'>) => (
          <div key={p._id} className="player-list-item">
            {p.name}
          </div>
        ))}
      </div>
    </main>
  )
}
