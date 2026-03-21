import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'

const TABLES = [
  'users',
  'authSessions',
  'authAccounts',
  'authRefreshTokens',
  'authVerificationCodes',
  'authVerifiers',
  'authRateLimits',
  'games',
  'players',
  'rounds',
  'captions',
  'votes',
  'roundVoteCandidates',
  'playerRoundState',
  'captionRoundStats',
  'playerGameStats',
] as const

type Options = {
  prod: boolean
}

async function parseOptions(): Promise<Options> {
  const parsed = parseArgs({
    args: process.argv.slice(2),
    options: {
      prod: { type: 'boolean', default: false },
    },
    strict: true,
    allowPositionals: false,
  })

  return {
    prod: parsed.values.prod,
  }
}

function printSummary(options: Options): void {
  const target = options.prod ? 'production' : 'development'
  const confirmation = options.prod ? 'WIPE PROD' : 'WIPE DEV'

  console.log('Convex wipe')
  console.log('')
  console.log(`Target deployment: ${target}`)
  console.log(
    'Mechanism: npx convex import --replace --table <table> <empty.jsonl>'
  )
  console.log('Tables:')
  for (const table of TABLES) {
    console.log(`- ${table}`)
  }
  console.log('')
  console.log('This will permanently delete all documents in the tables above.')
  console.log(`To continue, type exactly: ${confirmation}`)
  console.log('')
}

async function promptForApproval(options: Options): Promise<void> {
  if (!input.isTTY || !output.isTTY) {
    throw new Error(
      'Interactive approval requires a TTY. Run this command from a terminal.'
    )
  }

  printSummary(options)

  const rl = createInterface({ input, output })
  const expected = options.prod ? 'WIPE PROD' : 'WIPE DEV'

  try {
    const answer = await rl.question('Approval: ')
    if (answer.trim() !== expected) {
      throw new Error('Wipe cancelled: approval text did not match.')
    }
  } finally {
    rl.close()
  }
}

async function makeEmptyImportFile(): Promise<{
  dir: string
  path: string
}> {
  const dir = await mkdtemp(join(tmpdir(), 'mixr-convex-wipe-'))
  const path = join(dir, 'empty.jsonl')
  await writeFile(path, '', 'utf8')
  return { dir, path }
}

async function runImport(table: string, emptyFilePath: string, prod: boolean) {
  const args = [
    'convex',
    'import',
    '--replace',
    '--table',
    table,
    emptyFilePath,
  ]
  if (prod) {
    args.push('--prod')
  }

  console.log(`Clearing ${table}...`)

  await new Promise<void>((resolve, reject) => {
    const child = spawn('npx', args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      const command = ['npx', ...args].join(' ')
      if (signal) {
        reject(
          new Error(
            `Failed while clearing ${table}: command terminated by signal ${signal}. Command: ${command}`
          )
        )
        return
      }

      reject(
        new Error(
          `Failed while clearing ${table}: exit code ${code}. Command: ${command}`
        )
      )
    })
  })
}

async function main() {
  const options = await parseOptions()
  await promptForApproval(options)

  const temp = await makeEmptyImportFile()

  try {
    for (const table of TABLES) {
      await runImport(table, temp.path, options.prod)
    }

    console.log('')
    console.log('Convex wipe completed.')
  } finally {
    await rm(temp.dir, { recursive: true, force: true })
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
