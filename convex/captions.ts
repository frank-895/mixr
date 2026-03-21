import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import {
  getBlacklistRejectionMessage,
  getPlayerModerationError,
  normalizeCaptionForBlacklist,
} from './captionModeration'
import { CAPTION_SUBMISSION_COOLDOWN_MS, MAX_CAPTION_LENGTH } from './constants'
import { normalizeCaptionText } from './input'
import { logBoundaryEvent } from './logging'

function logCaptionRejection(reason: string, details: Record<string, unknown>) {
  logBoundaryEvent('caption_rejected', { reason, ...details })
}

export const submit = mutation({
  args: {
    playerId: v.id('players'),
    roundId: v.id('rounds'),
    text: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    | { status: 'ok'; captionId: Id<'captions'> }
    | { status: 'removed'; message: string }
  > => {
    const round = await ctx.db.get(args.roundId)
    if (!round) {
      logCaptionRejection('round_not_found', {
        playerId: args.playerId,
        roundId: args.roundId,
      })
      throw new Error('CAPTION REJECTED')
    }
    const player = await ctx.db.get(args.playerId)
    if (!player) {
      logCaptionRejection('player_not_found', {
        playerId: args.playerId,
        roundId: args.roundId,
      })
      throw new Error('CAPTION REJECTED')
    }
    if (player.gameId !== round.gameId) {
      logCaptionRejection('player_round_game_mismatch', {
        playerId: player._id,
        playerGameId: player.gameId,
        roundId: round._id,
        roundGameId: round.gameId,
      })
      throw new Error('CAPTION REJECTED')
    }
    const playerModerationError = getPlayerModerationError(player)
    if (playerModerationError) {
      logCaptionRejection('player_already_removed', {
        playerId: player._id,
        roundId: round._id,
        kickReason: player.kickReason ?? null,
        kickedAt: player.kickedAt ?? null,
      })
      throw new Error(playerModerationError)
    }

    const now = Date.now()

    // Only allow captioning during the caption phase
    if (round.state !== 'caption') {
      logCaptionRejection('round_not_in_caption_state', {
        playerId: player._id,
        roundId: round._id,
        roundState: round.state,
      })
      throw new Error('CAPTION REJECTED')
    }
    if (now > round.captionEndsAt) {
      logCaptionRejection('caption_deadline_passed', {
        playerId: player._id,
        roundId: round._id,
        now,
        captionEndsAt: round.captionEndsAt,
      })
      throw new Error('TOO LATE FOR THIS ROUND')
    }

    const normalized = normalizeCaptionText(args.text)
    if (!normalized) {
      logCaptionRejection('empty_caption_after_normalization', {
        playerId: player._id,
        roundId: round._id,
        originalText: args.text,
      })
      throw new Error('WRITE A CAPTION')
    }
    if (normalized.length > MAX_CAPTION_LENGTH) {
      logCaptionRejection('caption_too_long', {
        playerId: player._id,
        roundId: round._id,
        originalLength: args.text.length,
        normalizedLength: normalized.length,
        maxCaptionLength: MAX_CAPTION_LENGTH,
      })
      throw new Error(`KEEP IT UNDER ${MAX_CAPTION_LENGTH}`)
    }
    const moderationError = getBlacklistRejectionMessage(args.text)
    if (moderationError) {
      const normalizedForBlacklist = normalizeCaptionForBlacklist(args.text)
      await ctx.db.patch(player._id, {
        kickedAt: now,
        kickReason: 'blacklist',
      })
      const updatedPlayer = await ctx.db.get(player._id)
      logBoundaryEvent('caption_blacklist_kick', {
        playerId: player._id,
        playerName: player.name,
        roundId: args.roundId,
        text: args.text,
        normalizedText: normalizedForBlacklist,
        kickedAt: updatedPlayer?.kickedAt ?? null,
        kickReason: updatedPlayer?.kickReason ?? null,
      })
      return { status: 'removed', message: moderationError }
    }

    // Enforce 5s cooldown between submissions
    const playerCaptions = await ctx.db
      .query('captions')
      .withIndex('by_userId_and_roundId', (q) =>
        q.eq('userId', args.playerId).eq('roundId', args.roundId)
      )
      .take(50)

    if (playerCaptions.some((caption) => caption.text === normalized)) {
      logCaptionRejection('duplicate_caption', {
        playerId: player._id,
        roundId: round._id,
        normalizedText: normalized,
      })
      throw new Error('THAT ONE IS ALREADY IN')
    }

    if (playerCaptions.length > 0) {
      const latest = playerCaptions.reduce((a, b) =>
        (a.createdAt ?? a._creationTime) > (b.createdAt ?? b._creationTime)
          ? a
          : b
      )
      if (
        now - (latest.createdAt ?? latest._creationTime) <
        CAPTION_SUBMISSION_COOLDOWN_MS
      ) {
        logCaptionRejection('caption_cooldown_active', {
          playerId: player._id,
          roundId: round._id,
          now,
          latestCaptionCreatedAt: latest.createdAt ?? latest._creationTime,
          cooldownMs: CAPTION_SUBMISSION_COOLDOWN_MS,
        })
        throw new Error('SLOW DOWN A SEC')
      }
    }

    const captionId = await ctx.db.insert('captions', {
      userId: args.playerId,
      roundId: args.roundId,
      text: normalized,
      createdAt: now,
    })

    return { status: 'ok', captionId }
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

export const getTopCaptions = query({
  args: { roundId: v.id('rounds'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 3
    const top = await ctx.db
      .query('captionRoundStats')
      .withIndex('by_roundId_and_score', (q) => q.eq('roundId', args.roundId))
      .order('desc')
      .take(limit)

    return top.map((entry) => ({
      captionId: entry.captionId,
      text: entry.text,
      score: entry.score,
      playerName: entry.authorName,
      imageUrl: entry.imageUrl,
      roundNumber: entry.roundNumber,
    }))
  },
})

export const getGameTopCaptions = query({
  args: { gameId: v.id('games'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 3
    const top = await ctx.db
      .query('captionRoundStats')
      .withIndex('by_gameId_and_score', (q) => q.eq('gameId', args.gameId))
      .order('desc')
      .take(limit)

    return top.map((entry) => ({
      captionId: entry.captionId,
      text: entry.text,
      score: entry.score,
      playerName: entry.authorName,
      imageUrl: entry.imageUrl,
      roundNumber: entry.roundNumber,
    }))
  },
})

export const getRoundCaptions = query({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, args) => {
    const captions = await ctx.db
      .query('captionRoundStats')
      .withIndex('by_roundId_and_score', (q) => q.eq('roundId', args.roundId))
      .order('desc')
      .take(200)

    return captions.map((entry) => ({
      captionId: entry.captionId as string,
      text: entry.text,
      score: entry.score,
      playerName: entry.authorName,
      imageUrl: entry.imageUrl,
    }))
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

export const getPlayerRoundResults = query({
  args: { playerId: v.id('players'), roundId: v.id('rounds') },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query('captionRoundStats')
      .withIndex('by_authorId_and_roundId', (q) =>
        q.eq('authorId', args.playerId).eq('roundId', args.roundId)
      )
      .take(50)

    return stats.map((entry) => ({
      captionId: entry.captionId,
      text: entry.text,
      score: entry.score,
    }))
  },
})
