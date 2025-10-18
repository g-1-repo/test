# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

- Install dependencies
  - Bun: `bun install`
  - npm: `npm ci`
- Dev build (watch bundling via tsup): `bun run dev`
- Type check: `bun run typecheck`
- Lint: `bun run lint`
- Lint (auto-fix): `bun run lint:fix`

## Testing

- Interactive test runner (category/runtime selection, runs Vitest under the hood):
  - `bun run test-runner`
  - Help and options: `bun run test-runner --help`
- Run all tests with Vitest directly: `npx vitest run`
- Run a single test file: `npx vitest run path/to/file.test.ts`
- Run a single test by name: `npx vitest run -t "exact test name"`
- Watch mode: `npx vitest --watch`

## Release workflow

- Interactive release (quality gates, git, npm): `bun run release`
- Full release workflow: `bun run workflow:release`
- Check workflow status: `bun run workflow:status`
- Dry run (show what would happen): `bun run release --dry-run`
- Skip specific deployments: `bun run release --skip-npm --skip-cloudflare`
- Force specific version: `bun run release --type minor`

## Development workflow

- Build: `bun run build`
- Build (watch): `bun run dev`
- Clean: `bun run clean`
- Prepare for publishing: `bun run prepublishOnly`

## High-level architecture

- Bundling
  - tsup bundles two entry points: `src/index.ts` (framework exports) and `src/cli/test-runner.ts` (interactive runner). Output is ESM with type definitions.
- Core framework (exported from `src/index.ts`)
  - Adapters: `./adapters` with database adapters (memory, SQLite, D1, Drizzle variants) and helpers to create/detect providers.
  - Data factory: `./factory` for seeded, deterministic test data (factory, sequences, generators).
  - Test store: `./store` for per-test isolation, scoped data, and auto-cleanup lifecycles.
  - Environment utils: `./utils/environment` detect runtime (Cloudflare Workers/Node/Bun), capabilities, env var helpers, optimized test config, perf monitor.
  - HTTP client: `./utils/http-client` enhanced fetch client with cookies, retries, JSON helpers.
  - Vitest integration: `./vitest` provides higher-level test builders and helpers (suite/context/db/http/time/snapshot/perf/retry/concurrent utilities) and configuration helpers.
  - Legacy/compat exports: `./core`, `./email`, `./setup` expose request helpers, cookie/session utilities, email outbox/testing utilities, test environment setup (including Cloudflare Workers setup).
- CLI test runner (`src/cli/test-runner.ts`)
  - Node/Bun-only interactive runner that discovers test files, groups by category (unit/integration/e2e/etc.), selects runtime/database, then shells out to `npx vitest` with the selected files and flags.
  - Not exported from the main index to maintain Cloudflare Workers compatibility (avoids Node-only APIs; see CHANGELOG note).

## Notes for Warp

- Prefer Bun for local development; all commands use bun.
- In Workers contexts, import from the main package index only; avoid importing the CLI runner.
- Use `bun run release` for interactive releases with quality gates (linting, type checking, tests).
- The workflow supports npm publishing, Cloudflare deployment, and GitHub releases.
