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