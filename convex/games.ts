import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { MEME_IMAGES } from './seed'

export const skipPhase = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game || game.state !== 'playing') return

    const round = await ctx.db
      .query('rounds')
      .withIndex('by_gameId_and_roundNumber', (q) =>
        q.eq('gameId', args.gameId).eq('roundNumber', game.currentRound)
      )
      .unique()
    if (!round) return

    if (round.state === 'caption') {
      await ctx.runMutation(
        internal.internal.roundTransitions.endCaptionPhase,
        { roundId: round._id }
      )
    } else if (round.state === 'open') {
      await ctx.runMutation(internal.internal.roundTransitions.endOpenPhase, {
        roundId: round._id,
      })
    } else if (round.state === 'finished') {
      // Round finished but game still playing — means we're between rounds.
      // The endOpenPhase already handles advancing, so nothing extra needed.
    }
  },
})

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode(): string {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export const createGame = mutation({
  args: { totalRounds: v.number() },
  handler: async (ctx, args) => {
    if (args.totalRounds < 1 || args.totalRounds > 10) {
      throw new Error('totalRounds must be between 1 and 10')
    }

    let code = generateCode()
    let existing = await ctx.db
      .query('games')
      .withIndex('by_code', (q) => q.eq('code', code))
      .unique()
    while (existing) {
      code = generateCode()
      existing = await ctx.db
        .query('games')
        .withIndex('by_code', (q) => q.eq('code', code))
        .unique()
    }

    const gameId = await ctx.db.insert('games', {
      code,
      state: 'lobby',
      totalRounds: args.totalRounds,
      currentRound: 1,
    })

    return { gameId, code }
  },
})

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('games')
      .withIndex('by_code', (q) => q.eq('code', args.code.toUpperCase()))
      .unique()
  },
})

export const get = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.gameId)
  },
})

export const startGame = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Game not found')
    if (game.state !== 'lobby') throw new Error('Game already started')

    await ctx.db.patch(args.gameId, { state: 'playing' })

    const now = Date.now()
    const imageUrl = MEME_IMAGES[0 % MEME_IMAGES.length]

    const roundId = await ctx.db.insert('rounds', {
      gameId: args.gameId,
      roundNumber: 1,
      imageUrl,
      state: 'caption',
      captionEndsAt: now + 30_000,
      voteEndsAt: 0,
    })

    await ctx.scheduler.runAfter(
      30_000,
      internal.internal.roundTransitions.endCaptionPhase,
      { roundId }
    )
  },
})
