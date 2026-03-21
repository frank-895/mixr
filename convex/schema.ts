import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  games: defineTable({
    code: v.string(),
    state: v.string(),
    totalRounds: v.number(),
    currentRound: v.number(),
    captionPhaseDurationMs: v.number(),
    votePhaseDurationMs: v.number(),
    activePlayerCount: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  }).index('by_code', ['code']),

  players: defineTable({
    gameId: v.id('games'),
    name: v.string(),
    kickedAt: v.optional(v.number()),
    kickReason: v.optional(v.literal('blacklist')),
  })
    .index('by_gameId', ['gameId'])
    .index('by_gameId_and_name', ['gameId', 'name']),

  rounds: defineTable({
    gameId: v.id('games'),
    roundNumber: v.number(),
    imageUrl: v.string(),
    state: v.string(),
    captionEndsAt: v.number(),
    voteEndsAt: v.number(),
    scheduledEndCaptionJobId: v.optional(v.id('_scheduled_functions')),
    scheduledEndVoteJobId: v.optional(v.id('_scheduled_functions')),
    revealEndsAt: v.optional(v.number()),
    scheduledEndRevealJobId: v.optional(v.id('_scheduled_functions')),
    scheduledRefreshStatsJobId: v.optional(v.id('_scheduled_functions')),
  }).index('by_gameId_and_roundNumber', ['gameId', 'roundNumber']),

  captions: defineTable({
    userId: v.id('players'),
    roundId: v.id('rounds'),
    text: v.string(),
    createdAt: v.optional(v.number()),
  })
    .index('by_roundId', ['roundId'])
    .index('by_roundId_and_text', ['roundId', 'text'])
    .index('by_userId_and_roundId', ['userId', 'roundId']),

  votes: defineTable({
    userId: v.id('players'),
    roundId: v.optional(v.id('rounds')),
    captionId: v.id('captions'),
    value: v.boolean(),
  })
    .index('by_userId_and_captionId', ['userId', 'captionId'])
    .index('by_captionId', ['captionId'])
    .index('by_userId_and_roundId', ['userId', 'roundId'])
    .index('by_roundId', ['roundId']),

  roundVoteCandidates: defineTable({
    gameId: v.id('games'),
    roundId: v.id('rounds'),
    captionId: v.id('captions'),
    authorId: v.id('players'),
    text: v.string(),
    orderKey: v.string(),
  })
    .index('by_roundId', ['roundId'])
    .index('by_roundId_and_orderKey', ['roundId', 'orderKey'])
    .index('by_roundId_and_captionId', ['roundId', 'captionId']),

  playerRoundState: defineTable({
    gameId: v.id('games'),
    roundId: v.id('rounds'),
    playerId: v.id('players'),
    snapshotServedAt: v.optional(v.number()),
    votesCast: v.number(),
  })
    .index('by_playerId_and_roundId', ['playerId', 'roundId'])
    .index('by_roundId', ['roundId']),

  captionRoundStats: defineTable({
    gameId: v.id('games'),
    roundId: v.id('rounds'),
    roundNumber: v.number(),
    captionId: v.id('captions'),
    authorId: v.id('players'),
    authorName: v.string(),
    text: v.string(),
    imageUrl: v.string(),
    score: v.number(),
    upvoteCount: v.number(),
    downvoteCount: v.number(),
    exposureCount: v.number(),
  })
    .index('by_roundId', ['roundId'])
    .index('by_roundId_and_score', ['roundId', 'score'])
    .index('by_gameId_and_score', ['gameId', 'score'])
    .index('by_roundId_and_captionId', ['roundId', 'captionId'])
    .index('by_authorId_and_roundId', ['authorId', 'roundId']),

  playerGameStats: defineTable({
    gameId: v.id('games'),
    playerId: v.id('players'),
    playerName: v.string(),
    totalScore: v.number(),
  })
    .index('by_gameId_and_totalScore', ['gameId', 'totalScore'])
    .index('by_gameId_and_playerId', ['gameId', 'playerId']),
})
