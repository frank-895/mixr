import { useCallback, useState } from 'react'
import type { Id } from '../../convex/_generated/dataModel'

export function usePlayerId(
  gameCode: string
): [Id<'players'> | null, (id: Id<'players'> | null) => void] {
  const key = `mixr_player_${gameCode}`

  const [playerId, setPlayerIdState] = useState<Id<'players'> | null>(() => {
    const stored = sessionStorage.getItem(key)
    return stored ? (stored as Id<'players'>) : null
  })

  const setPlayerId = useCallback(
    (id: Id<'players'> | null) => {
      if (id === null) {
        sessionStorage.removeItem(key)
        setPlayerIdState(null)
        return
      }

      sessionStorage.setItem(key, id)
      setPlayerIdState(id)
    },
    [key]
  )

  return [playerId, setPlayerId]
}
