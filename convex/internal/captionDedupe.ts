import { v } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import { internalMutation, internalQuery } from '../_generated/server'

export const getCaption = internalQuery({
  args: { captionId: v.id('captions') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.captionId)
  },
})

export const findExactMatch = internalQuery({
  args: {
    captionId: v.id('captions'),
    roundId: v.id('rounds'),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query('captions')
      .withIndex('by_roundId_and_text', (q) =>
        q.eq('roundId', args.roundId).eq('text', args.text)
      )
      .take(20)

    return (
      matches.find(
        (caption) =>
          caption._id !== args.captionId && caption.dedupeStatus === 'ready'
      ) ?? null
    )
  },
})

export const getRoundLeaders = internalQuery({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, args) => {
    const captions = await ctx.db
      .query('captions')
      .withIndex('by_roundId', (q) => q.eq('roundId', args.roundId))
      .take(500)

    return captions.filter(
      (caption) =>
        caption.dedupeStatus === 'ready' &&
        caption.semanticKeyCaptionId === caption._id &&
        caption.embedding !== undefined
    )
  },
})

export const getGroupTexts = internalQuery({
  args: {
    roundId: v.id('rounds'),
    semanticKeyCaptionId: v.id('captions'),
  },
  handler: async (ctx, args) => {
    const captions = await ctx.db
      .query('captions')
      .withIndex('by_roundId', (q) => q.eq('roundId', args.roundId))
      .take(500)

    return captions
      .filter(
        (caption) => caption.semanticKeyCaptionId === args.semanticKeyCaptionId
      )
      .map((caption) => caption.text)
  },
})

export const markAsLeader = internalMutation({
  args: {
    captionId: v.id('captions'),
    embedding: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const caption = await ctx.db.get(args.captionId)
    if (!caption || caption.dedupeStatus === 'ready') return

    await ctx.db.patch(args.captionId, {
      dedupeStatus: 'ready',
      semanticKeyCaptionId: args.captionId,
      nextSemanticSiblingId: args.captionId,
      embedding: args.embedding,
    })
  },
})

export const attachToLeader = internalMutation({
  args: {
    captionId: v.id('captions'),
    leaderCaptionId: v.id('captions'),
  },
  handler: async (ctx, args) => {
    const caption = await ctx.db.get(args.captionId)
    const leader = await ctx.db.get(args.leaderCaptionId)
    if (!caption || !leader || caption.dedupeStatus === 'ready') return

    const nextSiblingId = leader.nextSemanticSiblingId ?? leader._id

    await ctx.db.patch(args.captionId, {
      dedupeStatus: 'ready',
      semanticKeyCaptionId: args.leaderCaptionId,
      nextSemanticSiblingId: nextSiblingId,
    })

    await ctx.db.patch(args.leaderCaptionId, {
      nextSemanticSiblingId: args.captionId,
    })
  },
})

export const markFailed = internalMutation({
  args: { captionId: v.id('captions') },
  handler: async (ctx, args) => {
    const caption = await ctx.db.get(args.captionId)
    if (!caption || caption.dedupeStatus === 'ready') return

    await ctx.db.patch(args.captionId, {
      dedupeStatus: 'failed',
    })
  },
})

export const getVoteCandidateGroups = internalQuery({
  args: {
    playerId: v.id('players'),
    roundId: v.id('rounds'),
  },
  handler: async (ctx, args) => {
    const captions = await ctx.db
      .query('captions')
      .withIndex('by_roundId', (q) => q.eq('roundId', args.roundId))
      .take(500)

    const readyCaptions = captions.filter(
      (caption) =>
        caption.dedupeStatus === 'ready' &&
        caption.semanticKeyCaptionId !== undefined &&
        caption.userId !== args.playerId
    )

    const groups = new Map<Id<'captions'>, Doc<'captions'>[]>()
    for (const caption of readyCaptions) {
      const key = caption.semanticKeyCaptionId as Id<'captions'>
      const group = groups.get(key)
      if (group) {
        group.push(caption)
      } else {
        groups.set(key, [caption])
      }
    }

    return Array.from(groups.entries()).map(
      ([semanticKeyCaptionId, members]) => ({
        semanticKeyCaptionId,
        members,
      })
    )
  },
})
