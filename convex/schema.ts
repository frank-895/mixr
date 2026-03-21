import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  games: defineTable({
    code: v.string(),
    state: v.string(),
    totalRounds: v.number(),
    currentRound: v.number(),
    finishedAt: v.optional(v.number()),
  }).index('by_code', ['code']),

  players: defineTable({
    gameId: v.id('games'),
    name: v.string(),
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
    scheduledEndOpenJobId: v.optional(v.id('_scheduled_functions')),
  }).index('by_gameId_and_roundNumber', ['gameId', 'roundNumber']),

  captions: defineTable({
    userId: v.id('players'),
    roundId: v.id('rounds'),
    text: v.string(),
    score: v.number(),
    exposureCount: v.number(),
    createdAt: v.optional(v.number()),
    dedupeStatus: v.optional(
      v.union(v.literal('pending'), v.literal('ready'), v.literal('failed'))
    ),
    semanticKeyCaptionId: v.optional(v.id('captions')),
    nextSemanticSiblingId: v.optional(v.id('captions')),
    embedding: v.optional(v.array(v.number())),
  })
    .index('by_roundId', ['roundId'])
    .index('by_roundId_and_text', ['roundId', 'text'])
    .index('by_userId_and_roundId', ['userId', 'roundId']),

  votes: defineTable({
    userId: v.id('players'),
    roundId: v.optional(v.id('rounds')),
    captionId: v.id('captions'),
    semanticKeyCaptionId: v.optional(v.id('captions')),
    value: v.boolean(),
  })
    .index('by_userId_and_captionId', ['userId', 'captionId'])
    .index('by_captionId', ['captionId'])
    .index('by_userId_and_roundId', ['userId', 'roundId'])
    .index('by_userId_and_semanticKeyCaptionId', [
      'userId',
      'semanticKeyCaptionId',
    ]),
})
