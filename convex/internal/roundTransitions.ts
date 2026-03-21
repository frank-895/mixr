import { v } from 'convex/values'
import { internal } from '../_generated/api'
import { internalMutation } from '../_generated/server'
import { MEME_IMAGES } from '../seed'
import { GAME_RETENTION_MS } from './gameCleanup'

export const endCaptionPhase = internalMutation({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId)
    if (!round || round.state !== 'caption') return

    if (round.scheduledEndCaptionJobId) {
      await ctx.scheduler.cancel(round.scheduledEndCaptionJobId)
    }

    const now = Date.now()
    await ctx.db.patch(args.roundId, {
      state: 'open',
      voteEndsAt: now + 90_000,
      scheduledEndCaptionJobId: undefined,
    })

    const scheduledEndOpenJobId = await ctx.scheduler.runAfter(
      90_000,
      internal.internal.roundTransitions.endOpenPhase,
      { roundId: args.roundId }
    )

    await ctx.db.patch(args.roundId, {
      scheduledEndOpenJobId,
    })
  },
})

export const endOpenPhase = internalMutation({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId)
    if (!round || round.state !== 'open') return

    if (round.scheduledEndOpenJobId) {
      await ctx.scheduler.cancel(round.scheduledEndOpenJobId)
    }

    await ctx.db.patch(args.roundId, {
      state: 'finished',
      scheduledEndOpenJobId: undefined,
    })

    const game = await ctx.db.get(round.gameId)
    if (!game) return

    if (game.currentRound < game.totalRounds) {
      const nextRoundNumber = game.currentRound + 1
      await ctx.db.patch(game._id, { currentRound: nextRoundNumber })

      const imageUrl = MEME_IMAGES[(nextRoundNumber - 1) % MEME_IMAGES.length]
      const now = Date.now()

      const nextRoundId = await ctx.db.insert('rounds', {
        gameId: game._id,
        roundNumber: nextRoundNumber,
        imageUrl,
        state: 'caption',
        captionEndsAt: now + 30_000,
        voteEndsAt: 0,
      })

      const scheduledEndCaptionJobId = await ctx.scheduler.runAfter(
        30_000,
        internal.internal.roundTransitions.endCaptionPhase,
        { roundId: nextRoundId }
      )

      await ctx.db.patch(nextRoundId, {
        scheduledEndCaptionJobId,
      })
    } else {
      const finishedAt = Date.now()
      await ctx.db.patch(game._id, {
        state: 'finished',
        finishedAt,
      })

      await ctx.scheduler.runAfter(
        GAME_RETENTION_MS,
        internal.internal.gameCleanup.cleanupFinishedGame,
        { gameId: game._id }
      )
    }
  },
})
