# Mixr

This app uses Vite, React, TypeScript, and Convex.

## Development

```bash
pnpm install   # install packages
pnpm build     # creates a production build
```

- You also need to set environment variables for convex following the .env-example file.
- Convex needs `AI_GATEWAY_API_KEY` as an environment variable for Vercel AI Gateway. 

## Local checks

```bash
pre-commit install  # install pre-commit hook
pnpm format         # formats the repo with Biome
pnpm lint           # runs Biome's linter
pnpm check          # runs Biome's formatter and linter checks together
pnpm typecheck      # runs TypeScript project checks
pnpm build          # creates a production build
```

## CI

```bash
pnpm install --frozen-lockfile   # install dependencies in CI
pnpm typecheck                   # run TypeScript checks
pnpm check                       # run Biome checks
pnpm build                       # verify the production build
```

## Load / demo harness

Run bots against a manually hosted game:

```bash
pnpm load-demo -- --gameCode ABCD
```

Example with a custom bot count and slower join pacing:

```bash
pnpm load-demo -- --gameCode ABCD --botCount 150 --joinJitterMs 45000
```

Arguments:

- `--gameCode`
  Required. The 4-character game code from the host screen.
- `--botCount`
  Optional. Number of bots to add. Default: `200`. Maximum: `200`.
- `--playerCount`
  Optional legacy alias for `--botCount`.
- `--waitForHumanPlayer`
  Optional. `true` or `false`. When `true`, the final success result requires at least one non-bot player to have joined.
- `--joinJitterMs`
  Optional. Total join spread window in milliseconds. Higher values make bots appear more slowly. Default: `15000`.
- `--captionJitterMs`
  Optional. Upper bound input for per-bot caption cadence assignment. Default: `8000`.
- `--voteJitterMs`
  Optional. Upper bound input for per-bot vote cadence assignment. Default: `4000`.
- `--maxErrorRate`
  Optional. Maximum tolerated soft-failure rate before the run is marked unsuccessful. Default: `0.15`.
- `--summaryPath`
  Optional. Output path for the JSON run summary.

Notes:

- The runner reads `VITE_CONVEX_URL` from `.env.local`.
- Bots now caption and vote on per-bot time intervals for a worst-case load pattern, rather than a fixed number of actions per round.
- Start the game manually from the host UI after the bots have joined.
- Use `pnpm load-demo -- --gameCode <CODE>` from the repo root.
