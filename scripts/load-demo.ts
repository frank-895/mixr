import { readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api.js'
import { MAX_PLAYER_NAME_LENGTH } from '../convex/constants.ts'

export type LoadDemoConfig = {
  convexUrl: string
  gameCode: string
  botCount: number
  waitForHumanPlayer: boolean
  joinJitterMs: number
  captionJitterMs: number
  voteJitterMs: number
  maxErrorRate: number
  summaryPath?: string
}

export type RunSummary = {
  gameCode: string
  totalBotsRequested: number
  totalBotsJoined: number
  humanPlayersObserved: number
  roundsCompleted: number
  totalCaptions: number
  totalVotes: number
  startTime: string
  endTime: string
  durationMs: number
  errorCounts: Record<string, number>
  includesExternalEmbeddingLatency: true
  success: boolean
}

const clientPrototype = new ConvexHttpClient('https://example.convex.cloud', {
  logger: false,
})

type GameDoc = Awaited<
  ReturnType<typeof clientPrototype.query<typeof api.games.getByCode>>
>
type Game = NonNullable<GameDoc>
type Round = NonNullable<
  Awaited<
    ReturnType<typeof clientPrototype.query<typeof api.rounds.getCurrent>>
  >
>
type Player = Awaited<
  ReturnType<typeof clientPrototype.query<typeof api.players.listByGame>>
>[number]
type BotPlayer = {
  index: number
  name: string
  playerId: Player['_id']
  captionIntervalMs: number
  voteIntervalMs: number
}
type RuntimeStatus = {
  phase: string
  gameCode: string
  expectedRounds: number
  currentRound: number
  gameState: string
  botsJoined: number
  humanPlayersObserved: number
  captionsThisRound: number
  votesThisRound: number
  totalCaptions: number
  totalVotes: number
  lastMessage: string
}
type Attempts = {
  joins: number
  captions: number
  votes: number
}

const BOT_NAME_PREFIX = 'BOT'
const BOT_NAME_MIN_TOTAL_LENGTH = 6
const BOT_NAME_MAX_TOTAL_LENGTH = MAX_PLAYER_NAME_LENGTH
const BOT_NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const DEFAULT_SUMMARY_PREFIX = 'mixr-load-demo'
const GAME_LOOKUP_TIMEOUT_MS = 10 * 60 * 1000
const GAME_START_TIMEOUT_MS = 15 * 60 * 1000
const POLL_INTERVAL_MS = 750
const CAPTION_SUBMISSION_GUARD_MS = 1500
const VOTE_SUBMISSION_GUARD_MS = 1000

const SUBJECTS = [
  'meetings',
  'monday',
  'deploys',
  'debugging',
  'coffee',
  'deadlines',
  'roadmaps',
  'airdrop',
  'memes',
  'incidents',
]
const VERBS = [
  'hit different',
  'need backup',
  'got promoted',
  'went sideways',
  'feel expensive',
  'need a nap',
  'look cursed',
  'need a rollback',
  'got approved',
  'escaped prod',
]
const ENDINGS = [
  'again',
  'for real',
  'before lunch',
  'at standup',
  'under pressure',
  'with witnesses',
  'on camera',
  'without context',
  'after coffee',
  'at round end',
]

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeGameCode(value: string): string {
  return value.trim().toUpperCase()
}

function toNumber(
  value: string | undefined,
  fallback: number,
  label: string
): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number`)
  return parsed
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  throw new Error(`Invalid boolean value: ${value}`)
}

async function readEnvLocal(): Promise<Record<string, string>> {
  try {
    const raw = await readFile('.env.local', 'utf8')
    const entries: Record<string, string> = {}

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex === -1) continue

      const key = trimmed.slice(0, separatorIndex).trim()
      const value = trimmed
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^(['"])(.*)\1$/, '$2')

      if (key) {
        entries[key] = value
      }
    }

    return entries
  } catch {
    return {}
  }
}

async function parseConfig(): Promise<LoadDemoConfig> {
  const args = process.argv.slice(2)
  const normalizedArgs = args[0] === '--' ? args.slice(1) : args

  const parsed = parseArgs({
    args: normalizedArgs,
    options: {
      gameCode: { type: 'string' },
      botCount: { type: 'string' },
      playerCount: { type: 'string' },
      waitForHumanPlayer: { type: 'string', default: 'false' },
      joinJitterMs: { type: 'string', default: '15000' },
      captionJitterMs: { type: 'string', default: '8000' },
      voteJitterMs: { type: 'string', default: '4000' },
      maxErrorRate: { type: 'string', default: '0.15' },
      summaryPath: { type: 'string' },
    },
    allowPositionals: false,
  })

  const envLocal = await readEnvLocal()

  const convexUrl = envLocal.VITE_CONVEX_URL

  if (!convexUrl) {
    throw new Error('Set VITE_CONVEX_URL in .env.local')
  }

  const gameCode = normalizeGameCode(parsed.values.gameCode ?? '')
  if (!gameCode) throw new Error('--gameCode is required')
  const botCountValue = parsed.values.botCount ?? parsed.values.playerCount

  const config: LoadDemoConfig = {
    convexUrl,
    gameCode,
    botCount: toNumber(botCountValue, 200, 'botCount'),
    waitForHumanPlayer: toBoolean(parsed.values.waitForHumanPlayer, false),
    joinJitterMs: toNumber(parsed.values.joinJitterMs, 30000, 'joinJitterMs'),
    captionJitterMs: toNumber(
      parsed.values.captionJitterMs,
      8000,
      'captionJitterMs'
    ),
    voteJitterMs: toNumber(parsed.values.voteJitterMs, 4000, 'voteJitterMs'),
    maxErrorRate: toNumber(parsed.values.maxErrorRate, 0.15, 'maxErrorRate'),
    summaryPath: parsed.values.summaryPath,
  }

  if (config.botCount < 1 || config.botCount > 200) {
    throw new Error('botCount must be between 1 and 200')
  }

  return config
}

function randomDelay(maxMs: number): number {
  if (maxMs <= 0) return 0
  return Math.floor(Math.random() * maxMs)
}

function randomInt(min: number, max: number): number {
  if (max <= min) return min
  return min + Math.floor(Math.random() * (max - min + 1))
}

function joinDelayForBot(
  index: number,
  totalBots: number,
  maxMs: number
): number {
  if (maxMs <= 0 || totalBots <= 1) return randomDelay(maxMs)

  const baseDelay = Math.floor((index * maxMs) / totalBots)
  const slotSize = Math.max(250, Math.floor(maxMs / totalBots))
  return baseDelay + randomDelay(slotSize)
}

function stableHash(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function randomString(length: number): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += BOT_NAME_CHARS[randomInt(0, BOT_NAME_CHARS.length - 1)]
  }
  return result
}

function botNameFor(index: number, attempt = 0): string {
  const suffix = attempt === 0 ? '' : String.fromCharCode(65 + attempt - 1)
  const uniqueToken = (index + 1).toString(36).toUpperCase()
  const minRandomLength = Math.max(
    0,
    BOT_NAME_MIN_TOTAL_LENGTH -
      BOT_NAME_PREFIX.length -
      uniqueToken.length -
      suffix.length
  )
  const maxRandomLength = Math.max(
    minRandomLength,
    BOT_NAME_MAX_TOTAL_LENGTH -
      BOT_NAME_PREFIX.length -
      uniqueToken.length -
      suffix.length
  )
  const randomLength = randomInt(minRandomLength, maxRandomLength)
  return `${BOT_NAME_PREFIX}${randomString(randomLength)}${uniqueToken}${suffix}`
}

function intervalFromDistribution(
  index: number,
  limitMs: number,
  distribution: Array<{ weight: number; minMs: number; maxMs: number }>
): number {
  const normalizedLimit = Math.max(1000, limitMs)
  const scaled = distribution.map((bucket) => ({
    weight: bucket.weight,
    minMs: Math.min(bucket.minMs, normalizedLimit),
    maxMs: Math.min(bucket.maxMs, normalizedLimit),
  }))

  const totalWeight = scaled.reduce((sum, bucket) => sum + bucket.weight, 0)
  const pick =
    stableHash(`${index}:${normalizedLimit}:${Math.random()}`) % totalWeight

  let cumulative = 0
  for (const bucket of scaled) {
    cumulative += bucket.weight
    if (pick < cumulative) {
      return randomInt(bucket.minMs, Math.max(bucket.minMs, bucket.maxMs))
    }
  }

  const fallback = scaled.at(-1)
  if (!fallback) return normalizedLimit
  return randomInt(fallback.minMs, Math.max(fallback.minMs, fallback.maxMs))
}

function captionIntervalForBot(index: number, limitMs: number): number {
  return intervalFromDistribution(index, limitMs, [
    { weight: 25, minMs: 5000, maxMs: 5000 },
    { weight: 35, minMs: 6000, maxMs: 8000 },
    { weight: 25, minMs: 9000, maxMs: 12000 },
    { weight: 15, minMs: 13000, maxMs: 18000 },
  ])
}

function voteIntervalForBot(index: number, limitMs: number): number {
  return intervalFromDistribution(index, limitMs, [
    { weight: 20, minMs: 1000, maxMs: 1000 },
    { weight: 40, minMs: 1200, maxMs: 1800 },
    { weight: 25, minMs: 2000, maxMs: 3000 },
    { weight: 15, minMs: 3500, maxMs: 5000 },
  ])
}

function pickWord(words: string[], hash: number): string {
  return words[hash % words.length] ?? words[0] ?? ''
}

function buildCaptionText(botIndex: number, roundNumber: number): string {
  const salt = stableHash(
    `${botIndex}:${roundNumber}:${Date.now()}:${Math.random()}`
  )
  const subject = pickWord(SUBJECTS, salt)
  const verb = pickWord(VERBS, salt >>> 4)
  const ending = pickWord(ENDINGS, salt >>> 8)
  return `${subject} ${verb} ${ending}`.slice(0, 60)
}

function classifyError(
  operation: 'join' | 'caption' | 'vote',
  error: unknown
): string {
  const message =
    error instanceof Error ? error.message.toUpperCase() : String(error)

  if (operation === 'join') {
    if (message.includes('NAME ALREADY TAKEN')) return 'join_name_taken'
    if (message.includes('THIS GAME IS FULL')) return 'join_game_full'
    if (message.includes('GAME ALREADY STARTED')) return 'join_game_started'
  }
  if (operation === 'caption') {
    if (message.includes('SLOW DOWN')) return 'caption_cooldown'
    if (message.includes('TOO LATE')) return 'caption_late'
    if (
      message.includes('ROUND NOT IN CAPTION STATE') ||
      message.includes('CAPTION REJECTED')
    ) {
      return 'caption_closed'
    }
    if (message.includes('REJECTED')) return 'caption_rejected'
  }
  if (operation === 'vote') {
    if (message.includes('ONE AT A TIME')) return 'vote_cooldown'
    if (message.includes('VOTING IS CLOSED')) return 'vote_closed'
    if (message.includes('REJECTED')) return 'vote_rejected'
  }
  return `${operation}_error`
}

function totalAttempts(attempts: Attempts): number {
  return attempts.joins + attempts.captions + attempts.votes
}

function errorRate(attempts: Attempts, errors: Record<string, number>): number {
  const totalErrors = Object.values(errors).reduce(
    (sum, value) => sum + value,
    0
  )
  const attemptCount = totalAttempts(attempts)
  if (attemptCount === 0) return 0
  return totalErrors / attemptCount
}

function createStatus(gameCode: string): RuntimeStatus {
  return {
    phase: 'initializing',
    gameCode,
    expectedRounds: 0,
    currentRound: 0,
    gameState: 'unknown',
    botsJoined: 0,
    humanPlayersObserved: 0,
    captionsThisRound: 0,
    votesThisRound: 0,
    totalCaptions: 0,
    totalVotes: 0,
    lastMessage: 'Starting up',
  }
}

async function recordWrite(path: string, summary: RunSummary): Promise<void> {
  await writeFile(path, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
}

async function waitForGame(
  client: ConvexHttpClient,
  gameCode: string,
  status: RuntimeStatus
): Promise<Game> {
  const start = Date.now()
  while (Date.now() - start < GAME_LOOKUP_TIMEOUT_MS) {
    const game = await client.query(api.games.getByCode, { code: gameCode })
    if (game) {
      status.gameState = game.state
      status.expectedRounds = game.totalRounds
      status.lastMessage = `Attached to game ${gameCode}`
      return game
    }
    status.lastMessage = `Waiting for game ${gameCode} to exist`
    await sleep(POLL_INTERVAL_MS)
  }
  throw new Error(`Timed out waiting for game ${gameCode}`)
}

async function joinOneBot(args: {
  client: ConvexHttpClient
  gameId: Game['_id']
  botIndex: number
  config: LoadDemoConfig
  status: RuntimeStatus
  attempts: Attempts
  errors: Record<string, number>
}): Promise<BotPlayer | null> {
  await sleep(
    joinDelayForBot(
      args.botIndex,
      args.config.botCount,
      args.config.joinJitterMs
    )
  )

  for (let attempt = 0; attempt < 4; attempt++) {
    const name = botNameFor(args.botIndex, attempt)
    args.attempts.joins += 1

    try {
      const playerId = await args.client.mutation(
        api.players.join,
        { gameId: args.gameId, name },
        { skipQueue: true }
      )
      args.status.botsJoined += 1
      args.status.lastMessage = `Joined ${name}`
      return {
        index: args.botIndex,
        name,
        playerId,
        captionIntervalMs: captionIntervalForBot(
          args.botIndex,
          args.config.captionJitterMs
        ),
        voteIntervalMs: voteIntervalForBot(
          args.botIndex,
          args.config.voteJitterMs
        ),
      }
    } catch (error) {
      const key = classifyError('join', error)
      args.errors[key] = (args.errors[key] ?? 0) + 1
      if (key !== 'join_name_taken') {
        args.status.lastMessage = `Join failed for ${name}: ${key}`
        return null
      }
    }
  }

  return null
}

async function joinBots(args: {
  client: ConvexHttpClient
  gameId: Game['_id']
  config: LoadDemoConfig
  status: RuntimeStatus
  attempts: Attempts
  errors: Record<string, number>
}): Promise<BotPlayer[]> {
  args.status.phase = 'joining'
  args.status.lastMessage = `Joining ${args.config.botCount} bots`

  const tasks = Array.from({ length: args.config.botCount }, (_, index) =>
    joinOneBot({ ...args, botIndex: index })
  )
  const bots = await Promise.all(tasks)
  return bots.filter((bot): bot is BotPlayer => bot !== null)
}

function updateHumanPlayersObserved(args: {
  status: RuntimeStatus
  botCount: number
  activePlayerCount: number | undefined
}): void {
  const activePlayerCount = args.activePlayerCount ?? 0
  const humanPlayersObserved = Math.max(0, activePlayerCount - args.botCount)
  args.status.humanPlayersObserved = Math.max(
    args.status.humanPlayersObserved,
    humanPlayersObserved
  )
}

async function waitForGameStart(args: {
  client: ConvexHttpClient
  gameCode: string
  gameId: Game['_id']
  config: LoadDemoConfig
  status: RuntimeStatus
  botIds: Set<Player['_id']>
}): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < GAME_START_TIMEOUT_MS) {
    const game = await args.client.query(api.games.getByCode, {
      code: args.gameCode,
    })
    if (!game) throw new Error('Game disappeared before start')

    args.status.gameState = game.state
    args.status.currentRound = game.currentRound
    args.status.expectedRounds = game.totalRounds
    updateHumanPlayersObserved({
      status: args.status,
      botCount: args.botIds.size,
      activePlayerCount: game.activePlayerCount,
    })

    if (game.state === 'playing' || game.state === 'finished') {
      args.status.phase = 'running'
      args.status.lastMessage = 'Game started'
      return
    }

    args.status.phase = 'waiting-for-start'
    args.status.lastMessage = 'Waiting for manual host to start the game'
    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error('Timed out waiting for the game to start')
}

async function runCaptionPhase(args: {
  client: ConvexHttpClient
  gameId: Game['_id']
  round: Round
  bots: BotPlayer[]
  status: RuntimeStatus
  attempts: Attempts
  errors: Record<string, number>
}): Promise<void> {
  args.status.phase = `caption-round-${args.round.roundNumber}`
  args.status.captionsThisRound = 0
  args.status.lastMessage = `Submitting captions for round ${args.round.roundNumber}`

  await Promise.all(
    args.bots.map(async (bot) => {
      await sleep(randomDelay(bot.captionIntervalMs))
      if (
        Date.now() >=
        args.round.captionEndsAt - CAPTION_SUBMISSION_GUARD_MS
      ) {
        return
      }

      args.attempts.captions += 1

      try {
        await args.client.mutation(
          api.captions.submit,
          {
            playerId: bot.playerId,
            roundId: args.round._id,
            text: buildCaptionText(bot.index, args.round.roundNumber),
          },
          { skipQueue: true }
        )
        args.status.captionsThisRound += 1
        args.status.totalCaptions += 1
      } catch (error) {
        const key = classifyError('caption', error)
        args.errors[key] = (args.errors[key] ?? 0) + 1
      }
    })
  )
}

async function waitForVotePhaseReadiness(args: {
  client: ConvexHttpClient
  gameId: Game['_id']
  roundId: Round['_id']
  voteEndsAt: number
}): Promise<boolean> {
  while (Date.now() < args.voteEndsAt - VOTE_SUBMISSION_GUARD_MS) {
    const round = await args.client.query(api.rounds.getCurrent, {
      gameId: args.gameId,
    })

    if (!round || round._id !== args.roundId || round.state !== 'vote') {
      return false
    }

    if (round.voteSnapshotReady === true) {
      return true
    }

    await sleep(POLL_INTERVAL_MS)
  }

  return false
}

async function runVotePhase(args: {
  client: ConvexHttpClient
  gameId: Game['_id']
  round: Round
  bots: BotPlayer[]
  status: RuntimeStatus
  attempts: Attempts
  errors: Record<string, number>
}): Promise<void> {
  args.status.phase = `vote-round-${args.round.roundNumber}`
  args.status.votesThisRound = 0
  args.status.lastMessage = `Casting votes for round ${args.round.roundNumber}`

  const ready = await waitForVotePhaseReadiness({
    client: args.client,
    gameId: args.gameId,
    roundId: args.round._id,
    voteEndsAt: args.round.voteEndsAt,
  })
  if (!ready) return

  await Promise.all(
    args.bots.map(async (bot) => {
      await sleep(randomDelay(bot.voteIntervalMs))
      const snapshot = await args.client.query(api.votes.getVoteSnapshot, {
        playerId: bot.playerId,
        roundId: args.round._id,
      })
      if (!snapshot.ready) return
      const remainingCandidates = [...snapshot.candidates]

      while (Date.now() < args.round.voteEndsAt - VOTE_SUBMISSION_GUARD_MS) {
        if (remainingCandidates.length === 0) return

        const candidateIndex = randomInt(0, remainingCandidates.length - 1)
        const candidate = remainingCandidates.splice(candidateIndex, 1)[0]
        if (!candidate) return

        const value = Math.random() >= 0.5
        args.attempts.votes += 1

        try {
          await args.client.mutation(
            api.votes.castVote,
            {
              playerId: bot.playerId,
              captionId: candidate.captionId,
              value,
            },
            { skipQueue: true }
          )
          args.status.votesThisRound += 1
          args.status.totalVotes += 1
        } catch (error) {
          const key = classifyError('vote', error)
          args.errors[key] = (args.errors[key] ?? 0) + 1
          if (key === 'vote_closed') return
        }

        await sleep(bot.voteIntervalMs)
      }
    })
  )
}

async function orchestrateGame(args: {
  client: ConvexHttpClient
  gameCode: string
  gameId: Game['_id']
  config: LoadDemoConfig
  status: RuntimeStatus
  bots: BotPlayer[]
  attempts: Attempts
  errors: Record<string, number>
  botIds: Set<Player['_id']>
}): Promise<number> {
  let roundsCompleted = 0
  const captionRounds = new Set<Round['_id']>()
  const voteRounds = new Set<Round['_id']>()

  while (true) {
    const game = await args.client.query(api.games.getByCode, {
      code: args.gameCode,
    })
    if (!game) throw new Error('Game disappeared during run')

    args.status.gameState = game.state
    args.status.currentRound = game.currentRound
    args.status.expectedRounds = game.totalRounds
    updateHumanPlayersObserved({
      status: args.status,
      botCount: args.botIds.size,
      activePlayerCount: game.activePlayerCount,
    })

    if (game.state === 'finished') {
      args.status.phase = 'finished'
      args.status.lastMessage = 'Game finished'
      return roundsCompleted
    }

    const round = await args.client.query(api.rounds.getCurrent, {
      gameId: args.gameId,
    })
    if (!round) {
      await sleep(POLL_INTERVAL_MS)
      continue
    }

    if (round.state === 'caption' && !captionRounds.has(round._id)) {
      captionRounds.add(round._id)
      await runCaptionPhase({
        client: args.client,
        gameId: args.gameId,
        round,
        bots: args.bots,
        status: args.status,
        attempts: args.attempts,
        errors: args.errors,
      })
    }

    if (round.state === 'vote' && !voteRounds.has(round._id)) {
      voteRounds.add(round._id)
      await runVotePhase({
        client: args.client,
        gameId: args.gameId,
        round,
        bots: args.bots,
        status: args.status,
        attempts: args.attempts,
        errors: args.errors,
      })
    }

    if (round.state === 'finished') {
      roundsCompleted = Math.max(roundsCompleted, round.roundNumber)
      args.status.lastMessage = `Round ${round.roundNumber} finished`
    }

    await sleep(POLL_INTERVAL_MS)
  }
}

async function main() {
  const config = await parseConfig()
  const client = new ConvexHttpClient(config.convexUrl, { logger: false })
  const attempts: Attempts = { joins: 0, captions: 0, votes: 0 }
  const errors: Record<string, number> = {}
  const startedAt = Date.now()
  const status = createStatus(config.gameCode)
  const initialGame = await waitForGame(client, config.gameCode, status)

  status.gameCode = initialGame.code
  status.expectedRounds = initialGame.totalRounds

  if (initialGame.state !== 'lobby') {
    throw new Error('Game must still be in lobby before adding bots')
  }

  const bots = await joinBots({
    client,
    gameId: initialGame._id,
    config,
    status,
    attempts,
    errors,
  })
  const botIds = new Set(bots.map((bot) => bot.playerId))
  status.lastMessage = `Joined ${bots.length}/${config.botCount} bots`

  await waitForGameStart({
    client,
    gameCode: initialGame.code,
    gameId: initialGame._id,
    config,
    status,
    botIds,
  })

  const roundsCompleted = await orchestrateGame({
    client,
    gameCode: initialGame.code,
    gameId: initialGame._id,
    config,
    status,
    bots,
    attempts,
    errors,
    botIds,
  })

  const summary: RunSummary = {
    gameCode: initialGame.code,
    totalBotsRequested: config.botCount,
    totalBotsJoined: bots.length,
    humanPlayersObserved: status.humanPlayersObserved,
    roundsCompleted,
    totalCaptions: status.totalCaptions,
    totalVotes: status.totalVotes,
    startTime: new Date(startedAt).toISOString(),
    endTime: nowIso(),
    durationMs: Date.now() - startedAt,
    errorCounts: errors,
    includesExternalEmbeddingLatency: true,
    success:
      bots.length === config.botCount &&
      roundsCompleted >= status.expectedRounds &&
      errorRate(attempts, errors) <= config.maxErrorRate &&
      (!config.waitForHumanPlayer || status.humanPlayersObserved > 0),
  }

  const summaryPath =
    config.summaryPath ?? `${DEFAULT_SUMMARY_PREFIX}-${Date.now()}.json`
  await recordWrite(summaryPath, summary)
  status.lastMessage = `Summary written to ${summaryPath}`
}

await main()
