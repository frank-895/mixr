import { useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { usePlayerId } from '../../lib/usePlayerId'
import { CaptionScreen } from './CaptionScreen'
import { FinalResults } from './FinalResults'
import { JoinScreen } from './JoinScreen'
import { RemovedScreen } from './RemovedScreen'
import { RoundResults } from './RoundResults'
import { VoteScreen } from './VoteScreen'
import { WaitingScreen } from './WaitingScreen'

export function PlayerApp({ gameCode }: { gameCode: string }) {
  const game = useQuery(api.games.getByCode, { code: gameCode })
  const [playerId, setPlayerId] = usePlayerId(gameCode)
  const [kickedMessage, setKickedMessage] = useState<string | null>(null)
  const player = useQuery(api.players.get, playerId ? { playerId } : 'skip')

  useEffect(() => {
    if (!playerId || player !== null) return

    console.info('[mixr-moderation] player-session-missing', {
      gameCode,
      playerId,
    })
    setPlayerId(null)
    setKickedMessage('YOU WERE REMOVED BY THE HOST')
  }, [gameCode, player, playerId, setPlayerId])

  useEffect(() => {
    if (!playerId || player === undefined) return

    console.info('[mixr-moderation] player-query-state', {
      gameCode,
      playerId,
      playerExists: player !== null,
      kickedAt:
        player && 'kickedAt' in player ? (player.kickedAt ?? null) : null,
      kickReason:
        player && 'kickReason' in player ? (player.kickReason ?? null) : null,
    })
  }, [gameCode, player, playerId])

  if (game === undefined) {
    return <div className="screen center">Loading...</div>
  }

  if (game === null) {
    return <div className="screen center">Game not found</div>
  }

  if (!playerId) {
    return (
      <JoinScreen
        gameId={game._id}
        gameState={game.state}
        message={kickedMessage ?? undefined}
        onJoined={(id) => {
          setKickedMessage(null)
          setPlayerId(id)
        }}
      />
    )
  }

  if (player === undefined) {
    return <div className="screen center">Loading...</div>
  }

  if (player?.kickedAt !== undefined) {
    return <RemovedScreen />
  }

  if (game.state === 'lobby') {
    return <WaitingScreen />
  }

  if (game.state === 'finished') {
    return <FinalResults gameId={game._id} playerId={playerId} />
  }

  return <ActiveRound game={game} playerId={playerId} />
}

function ActiveRound({
  game,
  playerId,
}: {
  game: Doc<'games'>
  playerId: Id<'players'>
}) {
  const round = useQuery(api.rounds.getCurrent, { gameId: game._id })

  if (!round) {
    return <div className="screen center">Loading round...</div>
  }

  if (round.state === 'caption') {
    return <CaptionScreen round={round} playerId={playerId} game={game} />
  }

  if (round.state === 'vote') {
    return <VoteScreen round={round} playerId={playerId} game={game} />
  }

  return <RoundResults round={round} playerId={playerId} game={game} />
}
