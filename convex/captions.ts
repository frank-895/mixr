import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { MAX_CAPTION_LENGTH, normalizeCaptionText } from './input'

const COOLDOWN_MS = 5_000

export const submit = mutation({
  args: {
    playerId: v.id('players'),
    roundId: v.id('rounds'),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId)
    if (!round) throw new Error('CAPTION REJECTED')
    const player = await ctx.db.get(args.playerId)
    if (!player) throw new Error('CAPTION REJECTED')
    if (player.gameId !== round.gameId) {
      throw new Error('CAPTION REJECTED')
    }

    const now = Date.now()

    // Allow captioning during "caption" and "open" phases
    if (round.state === 'caption') {
      if (now > round.captionEndsAt) throw new Error('TOO LATE FOR THIS ROUND')
    } else if (round.state === 'open') {
      if (now > round.voteEndsAt) throw new Error('TOO LATE FOR THIS ROUND')
    } else {
      throw new Error('CAPTION REJECTED')
    }

    const normalized = normalizeCaptionText(args.text)
    if (!normalized) throw new Error('WRITE A CAPTION')
    if (normalized.length > MAX_CAPTION_LENGTH) {
      throw new Error(`KEEP IT UNDER ${MAX_CAPTION_LENGTH}`)
    }

    // Enforce 5s cooldown between submissions
    const playerCaptions = await ctx.db
      .query('captions')
      .withIndex('by_userId_and_roundId', (q) =>
        q.eq('userId', args.playerId).eq('roundId', args.roundId)
      )
      .take(50)

    if (playerCaptions.some((caption) => caption.text === normalized)) {
      throw new Error('THAT ONE IS ALREADY IN')
    }

    if (playerCaptions.length > 0) {
      const latest = playerCaptions.reduce((a, b) =>
        (a.createdAt ?? a._creationTime) > (b.createdAt ?? b._creationTime)
          ? a
          : b
      )
      if (now - (latest.createdAt ?? latest._creationTime) < COOLDOWN_MS) {
        throw new Error('SLOW DOWN A SEC')
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
      .take(50)
  },
})
