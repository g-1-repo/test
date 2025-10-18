import type { DatabaseProvider, Runtime } from '@go-corp/utils/env'
import type { TestEnvironmentConfig } from '../types.js'
import {

  detectDatabaseProvider,
  detectRuntime,
  getEnv,
  getEnvironmentInfo,
  getRuntimeCapabilities,

  setupTestEnvironment,
  isCIEnvironment as utilsIsCIEnvironment,
  isTestEnvironment as utilsIsTestEnvironment,
} from '@go-corp/utils/env'

/**
 * Set environment variable (test-suite specific)
 */
export function setEnv(key: string, value: string): void {
  if (typeof process !== 'undefined' && process.env) {
    process.env[key] = value
  }
}

/**
 * Check if environment variable exists (test-suite specific)
 */
export function hasEnv(key: string): boolean {
  return getEnv(key) !== undefined
}

// Re-export for backward compatibility
export {
  type DatabaseProvider,
  detectDatabaseProvider,
  detectRuntime,
  getEnv,
  getEnvironmentInfo,
  getRuntimeCapabilities,
  type Runtime,
  setupTestEnvironment,
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
 * Ensure required environment variables exist (test-suite specific)
 */
export function ensureEnv(required: Record<string, string>): void {
  Object.entries(required).forEach(([key, defaultValue]) => {
    if (!hasEnv(key)) {
      setEnv(key, defaultValue)
    }
  })
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
 * Check if we're in a test environment (test-suite specific override)
 */
export function isTestEnvironment(): boolean {
  return utilsIsTestEnvironment()
    || getEnv('NODE_ENV') === 'test'
    || getEnv('VITEST') === 'true'
    || getEnv('JEST_WORKER_ID') !== undefined
}

/**
 * Check if we're in CI environment (test-suite specific override)
 */
export function isCIEnvironment(): boolean {
  return utilsIsCIEnvironment()
    || getEnv('CI') === 'true'
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
