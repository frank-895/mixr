import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { normalizeCaptionText } from './captionText'

const COOLDOWN_MS = 5_000

export const submit = mutation({
  args: {
    playerId: v.id('players'),
    roundId: v.id('rounds'),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId)
    if (!round) throw new Error('Round not found')

    const now = Date.now()

    // Allow captioning during "caption" and "open" phases
    if (round.state === 'caption') {
      if (now > round.captionEndsAt) throw new Error('Caption phase ended')
    } else if (round.state === 'open') {
      if (now > round.voteEndsAt) throw new Error('Round ended')
    } else {
      throw new Error('Not in a captioning phase')
    }

    const normalized = normalizeCaptionText(args.text)
    if (!normalized) throw new Error('Caption cannot be empty')

    // Enforce 5s cooldown between submissions
    const playerCaptions = await ctx.db
      .query('captions')
      .withIndex('by_userId_and_roundId', (q) =>
        q.eq('userId', args.playerId).eq('roundId', args.roundId)
      )
      .collect()

    if (playerCaptions.length > 0) {
      const latest = playerCaptions.reduce((a, b) =>
        (a.createdAt ?? a._creationTime) > (b.createdAt ?? b._creationTime)
          ? a
          : b
      )
      if (now - (latest.createdAt ?? latest._creationTime) < COOLDOWN_MS) {
        throw new Error('Please wait before submitting another caption')
      }
    }

    const captionId = await ctx.db.insert('captions', {
      userId: args.playerId,
      roundId: args.roundId,
      text: normalized,
      score: 0,
      exposureCount: 0,
      createdAt: now,
      dedupeStatus: 'pending',
    })

    await ctx.scheduler.runAfter(
      0,
      internal.internal.captionEmbedding.processCaption,
      { captionId }
    )

    return captionId
  },
})

export const listByRound = query({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, args) => {
    const captions = await ctx.db
      .query('captions')
      .withIndex('by_roundId', (q) => q.eq('roundId', args.roundId))
      .take(200)

    return captions
  },
})

export const getPlayerCaptions = query({
  args: { playerId: v.id('players'), roundId: v.id('rounds') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('captions')
      .withIndex('by_userId_and_roundId', (q) =>
        q.eq('userId', args.playerId).eq('roundId', args.roundId)
      )
      .collect()
  },
})
