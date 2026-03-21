import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  hasInvalidPlayerNameChars,
  MAX_PLAYER_NAME_LENGTH,
  MAX_PLAYERS_PER_GAME,
  normalizePlayerName,
} from './input'

export const join = mutation({
  args: { gameId: v.id('games'), name: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('GAME NOT FOUND')
    if (game.state !== 'lobby') throw new Error('GAME ALREADY STARTED')

    if (hasInvalidPlayerNameChars(args.name)) {
      throw new Error('USE LETTERS, NUMBERS OR SPACES')
    }

    const normalized = normalizePlayerName(args.name)
    if (!normalized) throw new Error('ENTER A NAME')
    if (normalized.length > MAX_PLAYER_NAME_LENGTH) {
      throw new Error(`KEEP IT UNDER ${MAX_PLAYER_NAME_LENGTH}`)
    }

    const existingPlayer = await ctx.db
      .query('players')
      .withIndex('by_gameId_and_name', (q) =>
        q.eq('gameId', args.gameId).eq('name', normalized)
      )
      .unique()

    if (existingPlayer) throw new Error('NAME ALREADY TAKEN')

    const players = await ctx.db
      .query('players')
      .withIndex('by_gameId', (q) => q.eq('gameId', args.gameId))
      .take(MAX_PLAYERS_PER_GAME)

    if (players.length >= MAX_PLAYERS_PER_GAME)
      throw new Error('THIS GAME IS FULL')

    const playerId = await ctx.db.insert('players', {
      gameId: args.gameId,
      name: normalized,
    })

    return playerId
  },
})

export const listByGame = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('players')
      .withIndex('by_gameId', (q) => q.eq('gameId', args.gameId))
      .take(MAX_PLAYERS_PER_GAME)
  },
})

export const getScores = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query('players')
      .withIndex('by_gameId', (q) => q.eq('gameId', args.gameId))
      .take(MAX_PLAYERS_PER_GAME)

    const rounds = await ctx.db
      .query('rounds')
      .withIndex('by_gameId_and_roundNumber', (q) =>
        q.eq('gameId', args.gameId)
      )
      .take(10)

    const roundIds = new Set(rounds.map((r) => r._id))

    const scores: { playerId: string; name: string; totalScore: number }[] = []

    for (const player of players) {
      let totalScore = 0
      const captions = await ctx.db
        .query('captions')
        .withIndex('by_userId_and_roundId', (q) => q.eq('userId', player._id))
        .take(50)

      for (const caption of captions) {
        if (roundIds.has(caption.roundId)) {
          totalScore += caption.score
        }
      }

      scores.push({
        playerId: player._id,
        name: player.name,
        totalScore,
      })
    }

    scores.sort((a, b) => b.totalScore - a.totalScore)
    return scores
  },
})
