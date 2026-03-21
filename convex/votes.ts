import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, type QueryCtx, query } from './_generated/server'

function pickCaptionToShow(members: Doc<'captions'>[]): Doc<'captions'> | null {
  if (members.length === 0) return null

  return [...members].sort((a, b) => {
    if (a.exposureCount !== b.exposureCount) {
      return a.exposureCount - b.exposureCount
    }

    return (a.createdAt ?? a._creationTime) - (b.createdAt ?? b._creationTime)
  })[0]
}

type CandidateGroup = {
  semanticKeyCaptionId: Id<'captions'>
  members: Doc<'captions'>[]
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
    const round = await ctx.db.get(args.roundId)
    if (!round) return []

    const groups = await getCandidateGroups(ctx, args)
    const votedSemanticKeys = await getVotedSemanticKeys(ctx, args)

    const candidates: Doc<'captions'>[] = groups
      .filter((group) => !votedSemanticKeys.has(group.semanticKeyCaptionId))
      .map((group) => pickCaptionToShow(group.members))
      .filter((caption): caption is Doc<'captions'> => caption !== null)

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }

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
    if (!caption) throw new Error('Caption not found')
    const semanticKeyCaptionId = caption.semanticKeyCaptionId ?? caption._id

    const round = await ctx.db.get(caption.roundId)
    if (!round) throw new Error('Round not found')
    if (round.state !== 'open') throw new Error('Not in voting phase')
    if (Date.now() > round.voteEndsAt) throw new Error('Vote phase ended')

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
