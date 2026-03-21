import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { mutation, type QueryCtx, query } from './_generated/server'
import { getPlayerModerationError, isPlayerKicked } from './captionModeration'
import { VOTE_COOLDOWN_MS } from './constants'
import { scheduleRoundStatsRefresh } from './internal/roundStats'
import { logBoundaryEvent } from './logging'

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

async function getEligibleCandidates(
  ctx: QueryCtx,
  args: { playerId: Id<'players'>; roundId: Id<'rounds'> }
) {
  const [player, candidates, playerVotes] = await Promise.all([
    ctx.db.get(args.playerId),
    ctx.db
      .query('roundVoteCandidates')
      .withIndex('by_roundId_and_orderKey', (q) =>
        q.eq('roundId', args.roundId)
      )
      .take(500),
    ctx.db
      .query('votes')
      .withIndex('by_userId_and_roundId', (q) =>
        q.eq('userId', args.playerId).eq('roundId', args.roundId)
      )
      .take(500),
  ])

  if (!player || isPlayerKicked(player)) {
    return []
  }

  const votedCaptionIds = new Set(playerVotes.map((vote) => vote.captionId))

  return candidates
    .filter((candidate) => candidate.authorId !== args.playerId)
    .filter((candidate) => !votedCaptionIds.has(candidate.captionId))
}

export const getVoteSnapshot = query({
  args: {
    playerId: v.id('players'),
    roundId: v.id('rounds'),
  },
  handler: async (
    ctx,
    args
  ): Promise<Array<{ captionId: Id<'captions'>; text: string }>> => {
    if (!(await isPlayerInRoundGame(ctx, args))) {
      return []
    }

    const candidates = await getEligibleCandidates(ctx, args)
    return candidates.map((candidate) => ({
      captionId: candidate.captionId,
      text: candidate.text,
    }))
  },
})

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

    const candidates = await getEligibleCandidates(ctx, args)
    return candidates.slice(0, args.count).map((candidate) => ({
      captionId: candidate.captionId,
      text: candidate.text,
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
    if (!caption) {
      logBoundaryEvent('vote_rejected', {
        reason: 'caption_not_found',
        playerId: args.playerId,
        captionId: args.captionId,
      })
      throw new Error('VOTE REJECTED')
    }

    const player = await ctx.db.get(args.playerId)
    if (!player) {
      logBoundaryEvent('vote_rejected', {
        reason: 'player_not_found',
        playerId: args.playerId,
        captionId: args.captionId,
      })
      throw new Error('VOTE REJECTED')
    }
    const playerModerationError = getPlayerModerationError(player)
    if (playerModerationError) {
      logBoundaryEvent('vote_rejected', {
        reason: 'player_removed',
        playerId: player._id,
        playerName: player.name,
        captionId: args.captionId,
        kickedAt: player.kickedAt ?? null,
        kickReason: player.kickReason ?? null,
      })
      throw new Error(playerModerationError)
    }

    const round = await ctx.db.get(caption.roundId)
    if (!round) {
      logBoundaryEvent('vote_rejected', {
        reason: 'round_not_found',
        playerId: player._id,
        playerName: player.name,
        captionId: args.captionId,
        roundId: caption.roundId,
      })
      throw new Error('VOTE REJECTED')
    }
    if (player.gameId !== round.gameId) {
      logBoundaryEvent('vote_rejected', {
        reason: 'player_round_game_mismatch',
        playerId: player._id,
        playerName: player.name,
        captionId: args.captionId,
        roundId: round._id,
        playerGameId: player.gameId,
        roundGameId: round.gameId,
      })
      throw new Error('VOTE REJECTED')
    }
    if (caption.userId === args.playerId) {
      logBoundaryEvent('vote_rejected', {
        reason: 'self_vote_rejected',
        playerId: player._id,
        playerName: player.name,
        captionId: args.captionId,
        roundId: round._id,
      })
      throw new Error('VOTE REJECTED')
    }

    const candidate = await ctx.db
      .query('roundVoteCandidates')
      .withIndex('by_roundId_and_captionId', (q) =>
        q.eq('roundId', round._id).eq('captionId', args.captionId)
      )
      .unique()
    if (!candidate) {
      logBoundaryEvent('vote_rejected', {
        reason: 'caption_not_in_vote_snapshot',
        playerId: player._id,
        playerName: player.name,
        captionId: args.captionId,
        roundId: round._id,
      })
      throw new Error('VOTE REJECTED')
    }

    if (round.state !== 'vote') {
      logBoundaryEvent('vote_rejected', {
        reason: 'round_not_in_vote_state',
        playerId: player._id,
        playerName: player.name,
        captionId: args.captionId,
        roundId: round._id,
        roundState: round.state,
      })
      throw new Error('VOTING IS CLOSED')
    }
    const now = Date.now()
    if (now > round.voteEndsAt) {
      logBoundaryEvent('vote_rejected', {
        reason: 'vote_deadline_passed',
        playerId: player._id,
        playerName: player.name,
        captionId: args.captionId,
        roundId: round._id,
        now,
        voteEndsAt: round.voteEndsAt,
      })
      throw new Error('VOTING IS CLOSED')
    }

    const latestVote = await ctx.db
      .query('votes')
      .withIndex('by_userId_and_roundId', (q) =>
        q.eq('userId', args.playerId).eq('roundId', caption.roundId)
      )
      .order('desc')
      .take(1)

    if (latestVote[0] && now - latestVote[0]._creationTime < VOTE_COOLDOWN_MS) {
      logBoundaryEvent('vote_rejected', {
        reason: 'vote_cooldown_active',
        playerId: player._id,
        playerName: player.name,
        captionId: args.captionId,
        roundId: round._id,
        now,
        latestVoteCreatedAt: latestVote[0]._creationTime,
        cooldownMs: VOTE_COOLDOWN_MS,
      })
      throw new Error('ONE AT A TIME')
    }

    const existing = await ctx.db
      .query('votes')
      .withIndex('by_userId_and_captionId', (q) =>
        q.eq('userId', args.playerId).eq('captionId', args.captionId)
      )
      .unique()

    if (existing) {
      logBoundaryEvent('vote_rejected', {
        reason: 'duplicate_vote_for_caption',
        playerId: player._id,
        playerName: player.name,
        captionId: args.captionId,
        roundId: round._id,
      })
      return null
    }

    await ctx.db.insert('votes', {
      userId: args.playerId,
      roundId: caption.roundId,
      captionId: args.captionId,
      value: args.value,
    })

    const playerRoundState = await ctx.db
      .query('playerRoundState')
      .withIndex('by_playerId_and_roundId', (q) =>
        q.eq('playerId', args.playerId).eq('roundId', round._id)
      )
      .unique()
    if (playerRoundState) {
      await ctx.db.patch(playerRoundState._id, {
        votesCast: playerRoundState.votesCast + 1,
      })
    } else {
      await ctx.db.insert('playerRoundState', {
        gameId: round.gameId,
        roundId: round._id,
        playerId: args.playerId,
        votesCast: 1,
      })
    }

    await scheduleRoundStatsRefresh(
      ctx,
      round._id,
      internal.internal.roundTransitions.refreshRoundStats
    )
    return null
  },
})
