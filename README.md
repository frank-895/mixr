# Mixr

This app uses Vite, React, TypeScript, and Convex.

## Development

```bash
pnpm install   # install packages
pnpm build     # creates a production build
```

## Local checks

```bash
pnpm format      # formats the repo with Biome
pnpm lint        # runs Biome's linter
pnpm check       # runs Biome's formatter and linter checks together
pnpm typecheck   # runs TypeScript project checks
pnpm build       # creates a production build
```

## CI

```bash
pnpm install --frozen-lockfile   # install dependencies in CI
pnpm typecheck                   # run TypeScript checks
pnpm check                       # run Biome checks
pnpm build                       # verify the production build
```
