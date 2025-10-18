import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/test-runner.ts'],
  format: ['esm'],
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  external: [
    'hono',
    'vitest',
    'drizzle-orm',
    'better-sqlite3',
    'cloudflare:test'
  ],
})