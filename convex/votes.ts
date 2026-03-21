import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, type QueryCtx, query } from './_generated/server'
import { VOTE_COOLDOWN_MS } from './input'

type CandidateGroup = {
  semanticKeyCaptionId: Id<'captions'>
  members: Doc<'captions'>[]
}

function stableHash(input: string): number {
  let hash = 2166136261

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function compareByStableHash(aKey: string, bKey: string): number {
  const hashDiff = stableHash(aKey) - stableHash(bKey)
  if (hashDiff !== 0) return hashDiff

  return aKey.localeCompare(bKey)
}

async function getCandidateGroups(
  ctx: QueryCtx,
  args: { playerId: Id<'players'>; roundId: Id<'rounds'> }
): Promise<CandidateGroup[]> {
  return await ctx.runQuery(
    internal.internal.captionDedupe.getVoteCandidateGroups,
    {
      playerId: args.playerId,
      roundId: args.roundId,
    }
  )
}

async function getVotedSemanticKeys(
  ctx: QueryCtx,
  args: { playerId: Id<'players'>; roundId: Id<'rounds'> }
): Promise<Set<Id<'captions'> | undefined>> {
  const playerVotes = await ctx.db
    .query('votes')
    .withIndex('by_userId_and_roundId', (q) =>
      q.eq('userId', args.playerId).eq('roundId', args.roundId)
    )
    .take(200)

  return new Set(playerVotes.map((vote) => vote.semanticKeyCaptionId))
}

async function getRoundPlayers(
  ctx: QueryCtx,
  roundId: Id<'rounds'>
): Promise<Doc<'players'>[]> {
  const round = await ctx.db.get(roundId)
  if (!round) return []

  return await ctx.db
    .query('players')
    .withIndex('by_gameId', (q) => q.eq('gameId', round.gameId))
    .take(100)
}

async function isPlayerInRoundGame(
  ctx: QueryCtx,
  args: { playerId: Id<'players'>; roundId: Id<'rounds'> }
): Promise<boolean> {
  const [player, round] = await Promise.all([
    ctx.db.get(args.playerId),
    ctx.db.get(args.roundId),
  ])

  return Boolean(player && round && player.gameId === round.gameId)
}

function pickAssignedCaptionForPlayer(args: {
  roundId: Id<'rounds'>
  playerId: Id<'players'>
  semanticKeyCaptionId: Id<'captions'>
  members: Doc<'captions'>[]
  players: Doc<'players'>[]
}): Doc<'captions'> | null {
  const authorIds = new Set<Id<'players'>>(
    args.members.map((member) => member.userId)
  )
  const eligiblePlayers = [...args.players]
    .filter((player) => !authorIds.has(player._id))
    .sort((a, b) =>
      compareByStableHash(
        `${args.roundId}:${args.semanticKeyCaptionId}:${a._id}`,
        `${args.roundId}:${args.semanticKeyCaptionId}:${b._id}`
      )
    )

  const eligiblePlayerIndex = eligiblePlayers.findIndex(
    (player) => player._id === args.playerId
  )
  if (eligiblePlayerIndex === -1 || args.members.length === 0) return null

  const orderedMembers = [...args.members].sort((a, b) =>
    compareByStableHash(
      `${args.roundId}:${args.semanticKeyCaptionId}:${a._id}`,
      `${args.roundId}:${args.semanticKeyCaptionId}:${b._id}`
    )
  )

  return orderedMembers[eligiblePlayerIndex % orderedMembers.length] ?? null
}

export const getCandidates = query({
  args: {
    playerId: v.id('players'),
    roundId: v.id('rounds'),
    count: v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<Array<{ captionId: Id<'captions'>; text: string }>> => {
    if (!(await isPlayerInRoundGame(ctx, args))) {
      return []
    }

    const groups = await getCandidateGroups(ctx, args)
    const votedSemanticKeys = await getVotedSemanticKeys(ctx, args)
    const roundPlayers = await getRoundPlayers(ctx, args.roundId)

    const candidates: Doc<'captions'>[] = groups
      .filter((group) => !votedSemanticKeys.has(group.semanticKeyCaptionId))
      .sort((a, b) =>
        compareByStableHash(
          `${args.roundId}:${a.semanticKeyCaptionId}`,
          `${args.roundId}:${b.semanticKeyCaptionId}`
        )
      )
      .map((group) =>
        pickAssignedCaptionForPlayer({
          roundId: args.roundId,
          playerId: args.playerId,
          semanticKeyCaptionId: group.semanticKeyCaptionId,
          members: group.members,
          players: roundPlayers,
        })
      )
      .filter((caption): caption is Doc<'captions'> => caption !== null)

    return candidates.slice(0, args.count).map((c) => ({
      captionId: c._id,
      text: c.text,
    }))
  },
})

export const castVote = mutation({
  args: {
    playerId: v.id('players'),
    captionId: v.id('captions'),
    value: v.boolean(),
  },
  handler: async (ctx, args) => {
    const caption = await ctx.db.get(args.captionId)
    if (!caption) throw new Error('VOTE REJECTED')
    const semanticKeyCaptionId = caption.semanticKeyCaptionId ?? caption._id

    const player = await ctx.db.get(args.playerId)
    if (!player) throw new Error('VOTE REJECTED')

    const round = await ctx.db.get(caption.roundId)
    if (!round) throw new Error('VOTE REJECTED')
    if (player.gameId !== round.gameId) {
      throw new Error('VOTE REJECTED')
    }
    if (round.state !== 'open') throw new Error('VOTING IS CLOSED')
    if (Date.now() > round.voteEndsAt) throw new Error('VOTING IS CLOSED')

    const latestVote = await ctx.db
      .query('votes')
      .withIndex('by_userId_and_roundId', (q) =>
        q.eq('userId', args.playerId).eq('roundId', caption.roundId)
      )
      .order('desc')
      .take(1)

    if (
      latestVote[0] &&
      Date.now() - latestVote[0]._creationTime < VOTE_COOLDOWN_MS
    ) {
      throw new Error('ONE AT A TIME')
    }

    const existing = await ctx.db
      .query('votes')
      .withIndex('by_userId_and_semanticKeyCaptionId', (q) =>
        q
          .eq('userId', args.playerId)
          .eq('semanticKeyCaptionId', semanticKeyCaptionId)
      )
      .unique()

    if (existing) return null

    await ctx.db.insert('votes', {
      userId: args.playerId,
      roundId: caption.roundId,
      captionId: args.captionId,
      semanticKeyCaptionId,
      value: args.value,
    })

    await ctx.db.patch(args.captionId, {
      score: caption.score + (args.value ? 1 : -1),
      exposureCount: caption.exposureCount + 1,
    })
    return null
  },
})
