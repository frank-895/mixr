import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../_generated/server'
import { REVEAL_PHASE_DURATION_MS } from '../constants'
import { MEME_IMAGES } from '../seed'
import {
  getCaptionPhaseExpiresAt,
  getFinishedExpiresAt,
  getRevealPhaseExpiresAt,
  getVotePhaseExpiresAt,
} from './gameExpiry'
import { initializeRoundVoteArtifacts } from './roundStats'

export const endCaptionPhase = internalMutation({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId)
    if (!round || round.state !== 'caption') return

    const game = await ctx.db.get(round.gameId)
    if (!game) return

    const now = Date.now()
    const voteEndsAt = now + game.votePhaseDurationMs
    const scheduledPrepareVoteArtifactsJobId = await ctx.scheduler.runAfter(
      0,
      internal.internal.roundTransitions.prepareVotePhaseArtifacts,
      { roundId: args.roundId }
    )

    const scheduledEndVoteJobId = await ctx.scheduler.runAfter(
      game.votePhaseDurationMs,
      internal.internal.roundTransitions.endVotePhase,
      { roundId: args.roundId }
    )

    await ctx.db.patch(args.roundId, {
      state: 'vote',
      voteEndsAt,
      voteSnapshotReady: false,
      scheduledEndCaptionJobId: undefined,
      scheduledPrepareVoteArtifactsJobId,
      scheduledEndVoteJobId,
    })
    await ctx.db.patch(game._id, {
      expiresAt: getVotePhaseExpiresAt(now, game.votePhaseDurationMs),
    })
  },
})

export const prepareVotePhaseArtifacts = internalMutation({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId)
    if (!round || round.state !== 'vote') return
    if (round.voteSnapshotReady === true) {
      if (round.scheduledPrepareVoteArtifactsJobId) {
        await ctx.db.patch(args.roundId, {
          scheduledPrepareVoteArtifactsJobId: undefined,
        })
      }
      return
    }

    await initializeRoundVoteArtifacts(ctx, round)

    await ctx.db.patch(args.roundId, {
      voteSnapshotReady: true,
      scheduledPrepareVoteArtifactsJobId: undefined,
    })
  },
})

export const endVotePhase = internalMutation({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId)
    if (!round || round.state !== 'vote') return

    if (round.scheduledPrepareVoteArtifactsJobId) {
      await ctx.scheduler.cancel(round.scheduledPrepareVoteArtifactsJobId)
    }
    if (round.scheduledRefreshStatsJobId) {
      await ctx.scheduler.cancel(round.scheduledRefreshStatsJobId)
    }

    let captionCount: number
    if (round.voteSnapshotReady !== true) {
      captionCount = await initializeRoundVoteArtifacts(ctx, round)
    } else {
      const captions = await ctx.db
        .query('captionRoundStats')
        .withIndex('by_roundId', (q) => q.eq('roundId', args.roundId))
        .take(1)
      captionCount = captions.length
    }

    if (captionCount === 0) {
      // No captions — skip reveal, go straight to finished
      await ctx.db.patch(args.roundId, {
        state: 'finished',
        voteSnapshotReady: true,
        scheduledPrepareVoteArtifactsJobId: undefined,
        scheduledEndVoteJobId: undefined,
        scheduledRefreshStatsJobId: undefined,
      })
      await advanceGame(ctx, round.gameId)
      return
    }

    const now = Date.now()
    const revealEndsAt = now + REVEAL_PHASE_DURATION_MS

    const scheduledEndRevealJobId = await ctx.scheduler.runAfter(
      REVEAL_PHASE_DURATION_MS,
      internal.internal.roundTransitions.endRevealPhase,
      { roundId: args.roundId }
    )

    await ctx.db.patch(args.roundId, {
      state: 'reveal',
      voteSnapshotReady: true,
      scheduledPrepareVoteArtifactsJobId: undefined,
      scheduledEndVoteJobId: undefined,
      scheduledRefreshStatsJobId: undefined,
      revealEndsAt,
      scheduledEndRevealJobId,
    })
    await ctx.db.patch(round.gameId, {
      expiresAt: getRevealPhaseExpiresAt(now),
    })
  },
})

export const endRevealPhase = internalMutation({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId)
    if (!round || round.state !== 'reveal') return

    await ctx.db.patch(args.roundId, {
      state: 'finished',
      scheduledEndRevealJobId: undefined,
    })

    await advanceGame(ctx, round.gameId)
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
    const imageUrl = MEME_IMAGES[(nextRoundNumber - 1) % MEME_IMAGES.length]
    const now = Date.now()
    await ctx.db.patch(game._id, {
      currentRound: nextRoundNumber,
      expiresAt: getCaptionPhaseExpiresAt(now, game.captionPhaseDurationMs),
    })

    const nextRoundId = await ctx.db.insert('rounds', {
      gameId: game._id,
      roundNumber: nextRoundNumber,
      imageUrl,
      state: 'caption',
      captionEndsAt: now + game.captionPhaseDurationMs,
      voteEndsAt: 0,
      voteSnapshotReady: false,
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
      expiresAt: getFinishedExpiresAt(finishedAt),
    })
  }
}
