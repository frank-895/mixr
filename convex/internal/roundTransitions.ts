import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../_generated/server'
import { GAME_RETENTION_MS, REVEAL_PHASE_DURATION_MS } from '../constants'
import { MEME_IMAGES } from '../seed'
import {
  initializeRoundVoteArtifacts,
  recomputeRoundAggregates,
} from './roundStats'

export const endCaptionPhase = internalMutation({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId)
    if (!round || round.state !== 'caption') return

    if (round.scheduledEndCaptionJobId) {
      await ctx.scheduler.cancel(round.scheduledEndCaptionJobId)
    }

    const game = await ctx.db.get(round.gameId)
    if (!game) return

    const now = Date.now()
    await initializeRoundVoteArtifacts(ctx, round)

    await ctx.db.patch(args.roundId, {
      state: 'vote',
      voteEndsAt: now + game.votePhaseDurationMs,
      scheduledEndCaptionJobId: undefined,
    })

    const scheduledEndVoteJobId = await ctx.scheduler.runAfter(
      game.votePhaseDurationMs,
      internal.internal.roundTransitions.endVotePhase,
      { roundId: args.roundId }
    )

    await ctx.db.patch(args.roundId, {
      scheduledEndVoteJobId,
    })
  },
})

export const endVotePhase = internalMutation({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId)
    if (!round || round.state !== 'vote') return

    if (round.scheduledEndVoteJobId) {
      await ctx.scheduler.cancel(round.scheduledEndVoteJobId)
    }
    if (round.scheduledRefreshStatsJobId) {
      await ctx.scheduler.cancel(round.scheduledRefreshStatsJobId)
    }

    await recomputeRoundAggregates(ctx, args.roundId)

    // Check if there are any captions to reveal
    const captions = await ctx.db
      .query('captionRoundStats')
      .withIndex('by_roundId', (q) => q.eq('roundId', args.roundId))
      .take(1)

    if (captions.length === 0) {
      // No captions — skip reveal, go straight to finished
      await ctx.db.patch(args.roundId, {
        state: 'finished',
        scheduledEndVoteJobId: undefined,
        scheduledRefreshStatsJobId: undefined,
      })
      await advanceGame(ctx, round.gameId)
      return
    }

    const now = Date.now()
    await ctx.db.patch(args.roundId, {
      state: 'reveal',
      scheduledEndVoteJobId: undefined,
      scheduledRefreshStatsJobId: undefined,
      revealEndsAt: now + REVEAL_PHASE_DURATION_MS,
    })

    const scheduledEndRevealJobId = await ctx.scheduler.runAfter(
      REVEAL_PHASE_DURATION_MS,
      internal.internal.roundTransitions.endRevealPhase,
      { roundId: args.roundId }
    )

    await ctx.db.patch(args.roundId, { scheduledEndRevealJobId })
  },
})

export const endRevealPhase = internalMutation({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId)
    if (!round || round.state !== 'reveal') return

    if (round.scheduledEndRevealJobId) {
      await ctx.scheduler.cancel(round.scheduledEndRevealJobId)
    }

    await ctx.db.patch(args.roundId, {
      state: 'finished',
      scheduledEndRevealJobId: undefined,
    })

    await advanceGame(ctx, round.gameId)
  },
})

export const refreshRoundStats = internalMutation({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId)
    if (!round) return

    await ctx.db.patch(args.roundId, {
      scheduledRefreshStatsJobId: undefined,
    })

    await recomputeRoundAggregates(ctx, args.roundId)
  },
})

async function advanceGame(
  ctx: { db: MutationCtx['db']; scheduler: MutationCtx['scheduler'] },
  gameId: Id<'games'>
) {
  const game = await ctx.db.get(gameId)
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
      captionEndsAt: now + game.captionPhaseDurationMs,
      voteEndsAt: 0,
    })

    const scheduledEndCaptionJobId = await ctx.scheduler.runAfter(
      game.captionPhaseDurationMs,
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
}
