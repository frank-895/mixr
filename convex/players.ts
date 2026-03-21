import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { MAX_PLAYER_NAME_LENGTH, MAX_PLAYERS_PER_GAME } from './constants'
import { hasInvalidPlayerNameChars, normalizePlayerName } from './input'
import { logBoundaryEvent } from './logging'

export const join = mutation({
  args: { gameId: v.id('games'), name: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) {
      logBoundaryEvent('join_rejected', {
        reason: 'game_not_found',
        gameId: args.gameId,
        requestedName: args.name,
      })
      throw new Error('GAME NOT FOUND')
    }
    if (game.state !== 'lobby') {
      logBoundaryEvent('join_rejected', {
        reason: 'game_already_started',
        gameId: args.gameId,
        requestedName: args.name,
        gameState: game.state,
      })
      throw new Error('GAME ALREADY STARTED')
    }

    if (hasInvalidPlayerNameChars(args.name)) {
      logBoundaryEvent('join_rejected', {
        reason: 'invalid_name_chars',
        gameId: args.gameId,
        requestedName: args.name,
      })
      throw new Error('USE LETTERS, NUMBERS OR SPACES')
    }

    const normalized = normalizePlayerName(args.name)
    if (!normalized) {
      logBoundaryEvent('join_rejected', {
        reason: 'empty_name',
        gameId: args.gameId,
        requestedName: args.name,
      })
      throw new Error('ENTER A NAME')
    }
    if (normalized.length > MAX_PLAYER_NAME_LENGTH) {
      logBoundaryEvent('join_rejected', {
        reason: 'name_too_long',
        gameId: args.gameId,
        requestedName: args.name,
        normalizedName: normalized,
        maxPlayerNameLength: MAX_PLAYER_NAME_LENGTH,
      })
      throw new Error(`KEEP IT UNDER ${MAX_PLAYER_NAME_LENGTH}`)
    }

    const existingPlayer = await ctx.db
      .query('players')
      .withIndex('by_gameId_and_name', (q) =>
        q.eq('gameId', args.gameId).eq('name', normalized)
      )
      .unique()

    if (existingPlayer) {
      logBoundaryEvent('join_rejected', {
        reason: 'name_already_taken',
        gameId: args.gameId,
        requestedName: args.name,
        normalizedName: normalized,
        existingPlayerId: existingPlayer._id,
      })
      throw new Error('NAME ALREADY TAKEN')
    }

    const activePlayerCount = game.activePlayerCount ?? 0
    if (activePlayerCount >= MAX_PLAYERS_PER_GAME) {
      logBoundaryEvent('join_rejected', {
        reason: 'game_full',
        gameId: args.gameId,
        requestedName: args.name,
        normalizedName: normalized,
        maxPlayersPerGame: MAX_PLAYERS_PER_GAME,
      })
      throw new Error('THIS GAME IS FULL')
    }

    const playerId = await ctx.db.insert('players', {
      gameId: args.gameId,
      name: normalized,
      kickedAt: undefined,
      kickReason: undefined,
    })

    await ctx.db.insert('playerGameStats', {
      gameId: args.gameId,
      playerId,
      playerName: normalized,
      totalScore: 0,
    })

    await ctx.db.patch(args.gameId, {
      activePlayerCount: activePlayerCount + 1,
    })

    logBoundaryEvent('player_joined', {
      gameId: args.gameId,
      playerId,
      playerName: normalized,
    })

    return playerId
  },
})

export const listByGame = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query('players')
      .withIndex('by_gameId', (q) => q.eq('gameId', args.gameId))
      .take(MAX_PLAYERS_PER_GAME)

    return players.filter((player) => player.kickedAt === undefined)
  },
})

export const get = query({
  args: { playerId: v.id('players') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.playerId)
  },
})

export const remove = mutation({
  args: { gameId: v.id('games'), playerId: v.id('players') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) {
      logBoundaryEvent('player_remove_rejected', {
        reason: 'game_not_found',
        gameId: args.gameId,
        playerId: args.playerId,
      })
      throw new Error('GAME NOT FOUND')
    }
    if (game.state !== 'lobby') {
      logBoundaryEvent('player_remove_rejected', {
        reason: 'game_already_started',
        gameId: args.gameId,
        playerId: args.playerId,
        gameState: game.state,
      })
      throw new Error('GAME ALREADY STARTED')
    }

    const player = await ctx.db.get(args.playerId)
    if (!player) {
      logBoundaryEvent('player_remove_rejected', {
        reason: 'player_not_found',
        gameId: args.gameId,
        playerId: args.playerId,
      })
      throw new Error('PLAYER NOT FOUND')
    }
    if (player.gameId !== args.gameId) {
      logBoundaryEvent('player_remove_rejected', {
        reason: 'player_game_mismatch',
        gameId: args.gameId,
        playerId: args.playerId,
        playerGameId: player.gameId,
      })
      throw new Error('PLAYER NOT FOUND')
    }

    await ctx.db.delete(args.playerId)
    const stats = await ctx.db
      .query('playerGameStats')
      .withIndex('by_gameId_and_playerId', (q) =>
        q.eq('gameId', args.gameId).eq('playerId', args.playerId)
      )
      .unique()
    if (stats) {
      await ctx.db.delete(stats._id)
    }
    const activePlayerCount = game.activePlayerCount ?? 0
    await ctx.db.patch(args.gameId, {
      activePlayerCount: Math.max(0, activePlayerCount - 1),
    })
    logBoundaryEvent('player_removed', {
      gameId: args.gameId,
      playerId: args.playerId,
      playerName: player.name,
    })
    return null
  },
})

export const getMyStats = query({
  args: { gameId: v.id('games'), playerId: v.id('players') },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId)
    const stats = await ctx.db
      .query('playerGameStats')
      .withIndex('by_gameId_and_playerId', (q) =>
        q.eq('gameId', args.gameId).eq('playerId', args.playerId)
      )
      .unique()
    return {
      name: player?.name ?? '???',
      totalScore: stats?.totalScore ?? 0,
    }
  },
})

export const getScores = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query('playerGameStats')
      .withIndex('by_gameId_and_totalScore', (q) => q.eq('gameId', args.gameId))
      .order('desc')
      .take(MAX_PLAYERS_PER_GAME)

    return stats.map((entry) => ({
      playerId: entry.playerId,
      name: entry.playerName,
      totalScore: entry.totalScore,
    }))
  },
})
