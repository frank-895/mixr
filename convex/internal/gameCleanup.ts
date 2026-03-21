import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { internalMutation, type MutationCtx } from '../_generated/server'

export const GAME_RETENTION_MS = 10 * 60 * 1000
const CAPTION_BATCH_SIZE = 200
const VOTE_BATCH_SIZE = 200
const PLAYER_BATCH_SIZE = 100

async function deleteCaptionVotes(
  ctx: MutationCtx,
  captionId: Id<'captions'>
): Promise<'done' | 'needs_more_work'> {
  const votes = await ctx.db
    .query('votes')
    .withIndex('by_captionId', (q) => q.eq('captionId', captionId))
    .take(VOTE_BATCH_SIZE)

  for (const vote of votes) {
    await ctx.db.delete(vote._id)
  }

  return votes.length === VOTE_BATCH_SIZE ? 'needs_more_work' : 'done'
}

async function cleanupGame(
  ctx: MutationCtx,
  gameId: Id<'games'>
): Promise<'done' | 'needs_more_work'> {
  const rounds = await ctx.db
    .query('rounds')
    .withIndex('by_gameId_and_roundNumber', (q) => q.eq('gameId', gameId))
    .take(20)

  for (const round of rounds) {
    const captions = await ctx.db
      .query('captions')
      .withIndex('by_roundId', (q) => q.eq('roundId', round._id))
      .take(CAPTION_BATCH_SIZE)

    for (const caption of captions) {
      const voteCleanupResult = await deleteCaptionVotes(ctx, caption._id)
      if (voteCleanupResult === 'needs_more_work') {
        return 'needs_more_work'
      }

      await ctx.db.delete(caption._id)
    }

    if (captions.length > 0) {
      return 'needs_more_work'
    }
  }

  for (const round of rounds) {
    await ctx.db.delete(round._id)
  }

  const players = await ctx.db
    .query('players')
    .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
    .take(PLAYER_BATCH_SIZE)

  for (const player of players) {
    await ctx.db.delete(player._id)
  }

  if (players.length === PLAYER_BATCH_SIZE) {
    return 'needs_more_work'
  }

  const game = await ctx.db.get(gameId)
  if (game) {
    await ctx.db.delete(gameId)
  }

  return 'done'
}

export const cleanupFinishedGame = internalMutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<null> => {
    const game = await ctx.db.get(args.gameId)
    if (!game || game.state !== 'finished') {
      return null
    }

    if (
      game.finishedAt !== undefined &&
      Date.now() < game.finishedAt + GAME_RETENTION_MS
    ) {
      return null
    }

    const result = await cleanupGame(ctx, args.gameId)
    if (result === 'needs_more_work') {
      await ctx.scheduler.runAfter(
        0,
        internal.internal.gameCleanup.cleanupFinishedGame,
        { gameId: args.gameId }
      )
    }

    return null
  },
})
