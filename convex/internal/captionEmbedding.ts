'use node'

import { v } from 'convex/values'
import { internal } from '../_generated/api'
import { internalAction } from '../_generated/server'
import { cosineSimilarity } from '../captionText'

declare const process: {
  env: Record<string, string | undefined>
}

const EMBEDDING_MODEL = 'openai/text-embedding-3-small'
const EMBEDDING_SIMILARITY_THRESHOLD = 0.9

function getEmbeddingConfig() {
  const apiKey = process.env.AI_GATEWAY_API_KEY

  if (!apiKey) {
    throw new Error('AI_GATEWAY_API_KEY is not set')
  }

  return { apiKey }
}

async function embedText(text: string): Promise<number[]> {
  const { apiKey } = getEmbeddingConfig()
  const response = await fetch('https://ai-gateway.vercel.sh/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  })

  if (!response.ok) {
    throw new Error(`Embedding request failed with status ${response.status}`)
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>
  }
  const embedding = payload.data?.[0]?.embedding

  if (!embedding) {
    throw new Error('Embedding response did not include an embedding vector')
  }

  return embedding
}

export const processCaption = internalAction({
  args: { captionId: v.id('captions') },
  handler: async (ctx, args) => {
    const caption = await ctx.runQuery(
      internal.internal.captionDedupe.getCaption,
      {
        captionId: args.captionId,
      }
    )
    if (!caption || caption.dedupeStatus !== 'pending') {
      return
    }

    try {
      const exactMatch = await ctx.runQuery(
        internal.internal.captionDedupe.findExactMatch,
        {
          captionId: args.captionId,
          roundId: caption.roundId,
          text: caption.text,
        }
      )

      if (exactMatch) {
        const leaderCaptionId =
          exactMatch.semanticKeyCaptionId ?? exactMatch._id
        const groupTexts = await ctx.runQuery(
          internal.internal.captionDedupe.getGroupTexts,
          {
            roundId: caption.roundId,
            semanticKeyCaptionId: leaderCaptionId,
          }
        )

        await ctx.runMutation(internal.internal.captionDedupe.attachToLeader, {
          captionId: args.captionId,
          leaderCaptionId,
        })

        console.log('caption.embedding grouped', {
          caption: caption.text,
          similarTo: groupTexts,
          matchType: 'exact',
        })
        return
      }

      const embedding = await embedText(caption.text)
      const leaders = await ctx.runQuery(
        internal.internal.captionDedupe.getRoundLeaders,
        {
          roundId: caption.roundId,
        }
      )

      let bestLeaderId: typeof args.captionId | null = null
      let bestSimilarity = -1

      for (const leader of leaders) {
        if (!leader.embedding) continue

        const similarity = cosineSimilarity(embedding, leader.embedding)
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity
          bestLeaderId = leader._id
        }
      }

      if (
        bestLeaderId !== null &&
        bestSimilarity >= EMBEDDING_SIMILARITY_THRESHOLD
      ) {
        const groupTexts = await ctx.runQuery(
          internal.internal.captionDedupe.getGroupTexts,
          {
            roundId: caption.roundId,
            semanticKeyCaptionId: bestLeaderId,
          }
        )

        await ctx.runMutation(internal.internal.captionDedupe.attachToLeader, {
          captionId: args.captionId,
          leaderCaptionId: bestLeaderId,
        })

        console.log('caption.embedding grouped', {
          caption: caption.text,
          similarTo: groupTexts,
          matchType: 'semantic',
          similarity: bestSimilarity,
        })
        return
      }

      await ctx.runMutation(internal.internal.captionDedupe.markAsLeader, {
        captionId: args.captionId,
        embedding,
      })

      console.log('caption.embedding grouped', {
        caption: caption.text,
        similarTo: [caption.text],
        matchType: 'new_group',
      })
    } catch (error) {
      console.error('caption.embedding failed', {
        caption: caption.text,
        error,
      })
      await ctx.runMutation(internal.internal.captionDedupe.markFailed, {
        captionId: args.captionId,
      })
    }
  },
})
