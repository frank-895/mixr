import type { FunctionReference } from 'convex/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

const LIVE_STATS_REFRESH_DELAY_MS = 1_000
const MAX_VOTES_PER_ROUND = 20_000
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
) {
  const existingCandidates = await ctx.db
    .query('roundVoteCandidates')
    .withIndex('by_roundId', (q) => q.eq('roundId', round._id))
    .take(1)
  if (existingCandidates.length > 0) {
    return
  }

  const captions = await ctx.db
    .query('captions')
    .withIndex('by_roundId', (q) => q.eq('roundId', round._id))
    .take(MAX_CAPTIONS_PER_ROUND)
  if (captions.length === 0) {
    return
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
      imageUrl: round.imageUrl,
      score: 0,
      upvoteCount: 0,
      downvoteCount: 0,
      exposureCount: 0,
    })
  }
}

export async function scheduleRoundStatsRefresh(
  ctx: DbCtx,
  roundId: Id<'rounds'>,
  refreshFn: FunctionReference<
    'mutation',
    'internal',
    { roundId: Id<'rounds'> },
    unknown
  >,
  delayMs = LIVE_STATS_REFRESH_DELAY_MS
) {
  const round = await ctx.db.get(roundId)
  if (!round || round.state !== 'vote' || round.scheduledRefreshStatsJobId) {
    return
  }

  const scheduledRefreshStatsJobId = await ctx.scheduler.runAfter(
    delayMs,
    refreshFn,
    { roundId }
  )

  await ctx.db.patch(roundId, { scheduledRefreshStatsJobId })
}

export async function recomputeRoundAggregates(
  ctx: DbCtx,
  roundId: Id<'rounds'>
) {
  const round = await ctx.db.get(roundId)
  if (!round) return

  const [statsRows, votes, playerGameStats] = await Promise.all([
    ctx.db
      .query('captionRoundStats')
      .withIndex('by_roundId', (q) => q.eq('roundId', roundId))
      .take(MAX_CAPTIONS_PER_ROUND),
    ctx.db
      .query('votes')
      .withIndex('by_roundId', (q) => q.eq('roundId', roundId))
      .take(MAX_VOTES_PER_ROUND),
    ctx.db
      .query('playerGameStats')
      .withIndex('by_gameId_and_playerId', (q) => q.eq('gameId', round.gameId))
      .take(200),
  ])

  const nextByCaptionId = new Map<
    Id<'captions'>,
    {
      score: number
      upvoteCount: number
      downvoteCount: number
      exposureCount: number
    }
  >()

  for (const stat of statsRows) {
    nextByCaptionId.set(stat.captionId, {
      score: 0,
      upvoteCount: 0,
      downvoteCount: 0,
      exposureCount: 0,
    })
  }

  for (const vote of votes) {
    const next = nextByCaptionId.get(vote.captionId)
    if (!next) continue
    next.exposureCount += 1
    if (vote.value) {
      next.upvoteCount += 1
      next.score += 1
    } else {
      next.downvoteCount += 1
    }
  }

  const scoreDeltaByAuthorId = new Map<Id<'players'>, number>()

  for (const stat of statsRows) {
    const next = nextByCaptionId.get(stat.captionId)
    if (!next) continue

    const scoreDelta = next.score - stat.score
    if (scoreDelta !== 0) {
      scoreDeltaByAuthorId.set(
        stat.authorId,
        (scoreDeltaByAuthorId.get(stat.authorId) ?? 0) + scoreDelta
      )
    }

    if (
      stat.score !== next.score ||
      stat.upvoteCount !== next.upvoteCount ||
      stat.downvoteCount !== next.downvoteCount ||
      stat.exposureCount !== next.exposureCount
    ) {
      await ctx.db.patch(stat._id, next)
    }
  }

  const playerGameStatsByPlayerId = new Map(
    playerGameStats.map((stat) => [stat.playerId, stat])
  )

  for (const [playerId, delta] of scoreDeltaByAuthorId.entries()) {
    if (delta === 0) continue
    const stat = playerGameStatsByPlayerId.get(playerId)
    if (!stat) continue
    await ctx.db.patch(stat._id, {
      totalScore: stat.totalScore + delta,
    })
  }
}
