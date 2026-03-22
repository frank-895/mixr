import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

const MAX_CAPTIONS_PER_ROUND = 500

function stableHash(input: string): number {
  let hash = 2166136261

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

type DbCtx = Pick<MutationCtx, 'db' | 'scheduler'>

export async function initializeRoundVoteArtifacts(
  ctx: DbCtx,
  round: Doc<'rounds'>
): Promise<number> {
  const existingCandidates = await ctx.db
    .query('roundVoteCandidates')
    .withIndex('by_roundId', (q) => q.eq('roundId', round._id))
    .take(1)
  if (existingCandidates.length > 0) {
    return existingCandidates.length
  }

  const captions = await ctx.db
    .query('captions')
    .withIndex('by_roundId', (q) => q.eq('roundId', round._id))
    .take(MAX_CAPTIONS_PER_ROUND)
  if (captions.length === 0) {
    return 0
  }

  const playerIds = [...new Set(captions.map((caption) => caption.userId))]
  const players = await Promise.all(
    playerIds.map((playerId) => ctx.db.get(playerId))
  )
  const playerNameById = new Map(
    players
      .filter((player): player is NonNullable<typeof player> => Boolean(player))
      .map((player) => [player._id, player.name])
  )

  for (const caption of captions) {
    const orderKey = `${stableHash(`${round._id}:${caption._id}`)}:${caption._id}`
    await ctx.db.insert('roundVoteCandidates', {
      gameId: round.gameId,
      roundId: round._id,
      captionId: caption._id,
      authorId: caption.userId,
      text: caption.text,
      orderKey,
    })

    await ctx.db.insert('captionRoundStats', {
      gameId: round.gameId,
      roundId: round._id,
      roundNumber: round.roundNumber,
      captionId: caption._id,
      authorId: caption.userId,
      authorName: playerNameById.get(caption.userId) ?? 'Unknown',
      text: caption.text,
      score: 0,
      upvoteCount: 0,
      downvoteCount: 0,
      exposureCount: 0,
    })
  }

  return captions.length
}
