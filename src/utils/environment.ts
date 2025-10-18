import type { DatabaseProvider, Runtime, TestEnvironmentConfig } from '../types.js'

/**
 * Detect the current runtime environment
 */
export function detectRuntime(): Runtime {
  // Cloudflare Workers
  if (typeof globalThis !== 'undefined') {
    if ('CloudflareWorkerGlobalScope' in globalThis || 'caches' in globalThis) {
      return 'cloudflare-workers'
    }
  }

  // Bun
  if (typeof (globalThis as any).Bun !== 'undefined') {
    return 'bun'
  }

  // Node.js
  if (typeof process !== 'undefined' && process.versions?.node) {
    return 'node'
  }

  return 'unknown'
}

/**
 * Detect the best database provider for the current environment
 */
export function detectDatabaseProvider(): DatabaseProvider {
  const runtime = detectRuntime()

  switch (runtime) {
    case 'cloudflare-workers':
      return 'd1'

    case 'node':
    case 'bun':
      // Check if better-sqlite3 is available
      try {
        require.resolve('better-sqlite3')
        return 'sqlite'
      }
      catch {
        return 'memory'
      }

    default:
      return 'memory'
  }
}

/**
 * Get environment variable with fallback
 */
export function getEnv(key: string, fallback?: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || fallback
  }
  return fallback
}

/**
 * Set environment variable
 */
export function setEnv(key: string, value: string): void {
  if (typeof process !== 'undefined' && process.env) {
    process.env[key] = value
  }
}

/**
 * Check if environment variable exists
 */
export function hasEnv(key: string): boolean {
  return getEnv(key) !== undefined
}

/**
 * Ensure required environment variables exist
 */
export function ensureEnv(required: Record<string, string>): void {
  Object.entries(required).forEach(([key, defaultValue]) => {
    if (!hasEnv(key)) {
      setEnv(key, defaultValue)
    }
  })
}

/**
 * Get runtime capabilities
 */
export function getRuntimeCapabilities(): {
  hasFileSystem: boolean
  hasNetworking: boolean
  hasDatabase: boolean
  hasSQLite: boolean
  hasD1: boolean
  supportsWorkers: boolean
} {
  const runtime = detectRuntime()

  switch (runtime) {
    case 'cloudflare-workers':
      return {
        hasFileSystem: false,
        hasNetworking: true,
        hasDatabase: true,
        hasSQLite: false,
        hasD1: true,
        supportsWorkers: true,
      }

    case 'node':
      return {
        hasFileSystem: true,
        hasNetworking: true,
        hasDatabase: true,
        hasSQLite: true,
        hasD1: false,
        supportsWorkers: false,
      }

    case 'bun':
      return {
        hasFileSystem: true,
        hasNetworking: true,
        hasDatabase: true,
        hasSQLite: true,
        hasD1: false,
        supportsWorkers: false,
      }

    default:
      return {
        hasFileSystem: false,
        hasNetworking: false,
        hasDatabase: false,
        hasSQLite: false,
        hasD1: false,
        supportsWorkers: false,
      }
  }
}

/**
 * Create optimized test environment configuration
 */
export function createOptimizedTestConfig(): TestEnvironmentConfig {
  const runtime = detectRuntime()
  const database = detectDatabaseProvider()
  const _capabilities = getRuntimeCapabilities()

  return {
    runtime,
    database,
    cleanup: true,
    seeded: true,
    verbose: getEnv('NODE_ENV') === 'test' && getEnv('VERBOSE') === 'true',
  }
}

/**
 * Environment info for debugging
 */
export function getEnvironmentInfo(): {
  runtime: Runtime
  databaseProvider: DatabaseProvider
  capabilities: ReturnType<typeof getRuntimeCapabilities>
  nodeVersion?: string
  bunVersion?: string
  platform?: string
  arch?: string
} {
  const runtime = detectRuntime()
  const info: ReturnType<typeof getEnvironmentInfo> = {
    runtime,
    databaseProvider: detectDatabaseProvider(),
    capabilities: getRuntimeCapabilities(),
  }

  // Add Node.js specific info
  if (typeof process !== 'undefined') {
    info.nodeVersion = process.versions?.node
    info.bunVersion = process.versions?.bun
    info.platform = process.platform
    info.arch = process.arch
  }

  // Add Bun specific info
  if (typeof (globalThis as any).Bun !== 'undefined') {
    info.bunVersion = (globalThis as any).Bun.version
  }

  return info
}

/**
 * Setup test environment variables
 */
export function setupTestEnvironment(): void {
  const defaultEnv = {
    NODE_ENV: 'test',
    // Common test variables
    RESEND_API_KEY: 'test_key_mock',
    DATABASE_URL: ':memory:',
    // Disable external services in tests
    DISABLE_ANALYTICS: 'true',
    DISABLE_MONITORING: 'true',
  }

  ensureEnv(defaultEnv)
}

/**
 * Runtime-specific test setup
 */
export function setupRuntimeSpecificTests(): void {
  const runtime = detectRuntime()

  switch (runtime) {
    case 'cloudflare-workers':
      // Cloudflare Workers specific setup
      ensureEnv({
        CLOUDFLARE_ACCOUNT_ID: 'test_account_id',
        CLOUDFLARE_DATABASE_ID: 'test_database_id',
      })
      break

    case 'node':
      // Node.js specific setup
      ensureEnv({
        NODE_OPTIONS: '--experimental-vm-modules',
      })
      break

    case 'bun':
      // Bun specific setup - usually minimal
      break
  }
}

/**
 * Check if we're in a test environment
 */
export function isTestEnvironment(): boolean {
  return getEnv('NODE_ENV') === 'test'
    || getEnv('VITEST') === 'true'
    || getEnv('JEST_WORKER_ID') !== undefined
}

/**
 * Check if we're in CI environment
 */
export function isCIEnvironment(): boolean {
  return getEnv('CI') === 'true'
    || getEnv('GITHUB_ACTIONS') === 'true'
    || getEnv('GITLAB_CI') === 'true'
    || getEnv('TRAVIS') === 'true'
    || getEnv('CIRCLECI') === 'true'
}

/**
 * Get test configuration based on environment
 */
export function getTestConfig(): {
  timeout: number
  retries: number
  verbose: boolean
  parallel: boolean
  bail: boolean
} {
  const isCI = isCIEnvironment()

  return {
    timeout: isCI ? 30000 : 10000,
    retries: isCI ? 2 : 0,
    verbose: getEnv('VERBOSE') === 'true' || (!isCI && isTestEnvironment()),
    parallel: !isCI || getEnv('TEST_PARALLEL') === 'true',
    bail: isCI && getEnv('TEST_BAIL') !== 'false',
  }
}

/**
 * Memory usage monitoring (Node.js/Bun only)
 */
export function getMemoryUsage(): { used: number, total: number, percentage: number } | null {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage()
    const used = usage.heapUsed
    const total = usage.heapTotal
    const percentage = Math.round((used / total) * 100)

    return { used, total, percentage }
  }

  return null
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private marks = new Map<string, number>()
  private measures = new Map<string, number>()

  /**
   * Start timing
   */
  mark(name: string): void {
    this.marks.set(name, Date.now())
  }

  /**
   * End timing and get duration
   */
  measure(name: string, startMark?: string): number {
    const now = Date.now()
    const start = startMark ? this.marks.get(startMark) : this.marks.get(name)

    if (start === undefined) {
      throw new Error(`Mark '${startMark || name}' not found`)
    }

    const duration = now - start
    this.measures.set(name, duration)

    return duration
  }

  /**
   * Get all measures
   */
  getAllMeasures(): Record<string, number> {
    return Object.fromEntries(this.measures.entries())
  }

  /**
   * Clear all marks and measures
   */
  clear(): void {
    this.marks.clear()
    this.measures.clear()
  }
}

/**
 * Global performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor()
