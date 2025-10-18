import type { HonoApp, IsolationLevel, VitestConfig } from '../types.js'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createDatabaseAdapter, detectBestDatabaseProvider } from '../adapters/database.js'
import { TestDataFactory } from '../factory.js'
import { cleanupAllTestStores, getTestStore } from '../store.js'
import { setupRuntimeSpecificTests, setupTestEnvironment } from '../utils/environment.js'
import { createHttpTestClient } from '../utils/http-client.js'

/**
 * Vitest integration configuration
 */
const defaultVitestConfig: VitestConfig = {
  isolation: 'test',
  autoCleanup: true,
  seededData: true,
  mockTime: false,
}

let currentConfig: VitestConfig = defaultVitestConfig
let dbAdapter: any = null
let httpClient: any = null
let dataFactory: TestDataFactory | null = null

/**
 * Configure Vitest integration
 */
export function configureVitest(config: Partial<VitestConfig> = {}): void {
  currentConfig = { ...defaultVitestConfig, ...config }
}

/**
 * Setup test environment for Vitest
 */
export function setupTestFramework(app?: HonoApp, options: Partial<VitestConfig> = {}): void {
  const config = { ...currentConfig, ...options }

  beforeAll(async () => {
    // Setup environment variables
    setupTestEnvironment()
    setupRuntimeSpecificTests()

    // Initialize database adapter if needed
    if (config.autoCleanup) {
      try {
        const provider = detectBestDatabaseProvider()
        dbAdapter = createDatabaseAdapter(provider)
        await dbAdapter.initialize()
      }
      catch (error) {
        console.warn('Failed to initialize database adapter:', error)
      }
    }

    // Setup HTTP client if app provided
    if (app) {
      httpClient = createHttpTestClient(app)
    }

    // Setup data factory if seeded data enabled
    if (config.seededData) {
      dataFactory = new TestDataFactory()
    }

    // Mock console methods for cleaner test output
    if (!config.verbose) {
      vi.spyOn(console, 'info').mockImplementation(() => {})
      vi.spyOn(console, 'debug').mockImplementation(() => {})
      vi.spyOn(console, 'log').mockImplementation(() => {})
    }
  })

  beforeEach(async () => {
    // Reset test stores based on isolation level
    if (config.isolation === 'test' || config.isolation === 'suite') {
      const store = getTestStore(config.isolation)
      store.clear()
    }

    // Clear HTTP client cookies and history if available
    if (httpClient) {
      httpClient.clearCookies()
      httpClient.clearHistory()
    }

    // Reset data factory seed if available
    if (dataFactory) {
      dataFactory.setSeed(12345) // Reset to default seed
    }
  })

  afterEach(async () => {
    if (config.autoCleanup) {
      // Clean up database
      if (dbAdapter) {
        try {
          await dbAdapter.cleanup()
        }
        catch (error) {
          console.warn('Database cleanup failed:', error)
        }
      }

      // Clean up test stores
      await cleanupAllTestStores()
    }

    // Restore mocks
    vi.restoreAllMocks()
  })
}

/**
 * Create isolated test context
 */
export function createTestContext(isolationLevel: IsolationLevel = 'test') {
  const store = getTestStore(isolationLevel)
  const contextId = `context-${Date.now()}-${Math.random()}`

  return {
    store,
    contextId,
    http: httpClient?.session(contextId),
    factory: dataFactory,
    cleanup: async () => {
      store.clear()
      if (httpClient) {
        httpClient.clearCookies(contextId)
      }
    },
  }
}

/**
 * Test suite helper with automatic setup
 */
export function testSuite(name: string, fn: () => void, config?: Partial<VitestConfig>): void {
  const suiteConfig = { ...currentConfig, ...config }

  describe(name, () => {
    beforeAll(async () => {
      if (suiteConfig.isolation === 'suite') {
        const store = getTestStore('suite')
        store.clear()
      }
    })

    fn()
  })
}

/**
 * Enhanced test function with context
 */
export function testWithContext(
  name: string,
  fn: (ctx: ReturnType<typeof createTestContext>) => void | Promise<void>,
  isolationLevel?: IsolationLevel,
): void {
  test(name, async () => {
    const ctx = createTestContext(isolationLevel)
    try {
      await fn(ctx)
    }
    finally {
      await ctx.cleanup()
    }
  })
}

/**
 * Database test helper
 */
export function dbTest(
  name: string,
  fn: (db: any) => void | Promise<void>,
): void {
  test(name, async () => {
    if (!dbAdapter) {
      throw new Error('Database adapter not initialized. Call setupTestFramework first.')
    }

    // Create snapshot before test
    const _initialState = dbAdapter.db

    try {
      await fn(dbAdapter.db)
    }
    finally {
      // Reset database state
      await dbAdapter.reset()
    }
  })
}

/**
 * HTTP test helper
 */
export function httpTest(
  name: string,
  fn: (client: ReturnType<typeof createHttpTestClient>) => void | Promise<void>,
): void {
  test(name, async () => {
    if (!httpClient) {
      throw new Error('HTTP client not initialized. Provide app to setupTestFramework.')
    }

    const testClient = httpClient.session()

    try {
      await fn(testClient)
    }
    finally {
      testClient.clearCookies()
      testClient.clearHistory()
    }
  })
}

/**
 * Factory test helper with seeded data
 */
export function factoryTest(
  name: string,
  fn: (factory: TestDataFactory) => void | Promise<void>,
  seed?: number,
): void {
  test(name, async () => {
    const factory = new TestDataFactory(seed)
    await fn(factory)
  })
}

/**
 * Time-controlled test helper
 */
export function timeTest(
  name: string,
  fn: (timeMock: { advance: (ms: number) => void, setTime: (date: Date) => void }) => void | Promise<void>,
  initialTime?: Date,
): void {
  test(name, async () => {
    const originalNow = Date.now
    const originalDateConstructor = Date

    let mockTime = initialTime ? initialTime.getTime() : Date.now()

    // Mock Date.now
    Date.now = vi.fn(() => mockTime)

    // Mock Date constructor
    global.Date = class MockDate extends originalDateConstructor {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(mockTime)
        }
        else {
          // @ts-ignore
          super(...args)
        }
      }

      static now(): number {
        return mockTime
      }
    } as any

    const timeMock = {
      advance: (ms: number) => {
        mockTime += ms
      },
      setTime: (date: Date) => {
        mockTime = date.getTime()
      },
    }

    try {
      await fn(timeMock)
    }
    finally {
      // Restore original time functions
      Date.now = originalNow
      global.Date = originalDateConstructor
    }
  })
}

/**
 * Snapshot testing helper
 */
export function snapshotTest<T>(
  name: string,
  fn: () => T | Promise<T>,
): void {
  test(name, async () => {
    const result = await fn()
    expect(result).toMatchSnapshot()
  })
}

/**
 * Performance test helper
 */
export function perfTest(
  name: string,
  fn: () => void | Promise<void>,
  maxDuration?: number,
): void {
  test(name, async () => {
    const start = Date.now()
    await fn()
    const duration = Date.now() - start

    if (maxDuration && duration > maxDuration) {
      throw new Error(`Performance test exceeded ${maxDuration}ms, took ${duration}ms`)
    }

    // Log performance info in verbose mode
    if (currentConfig.verbose || process.env.PERF_LOG === 'true') {
      console.log(`Performance: ${name} completed in ${duration}ms`)
    }
  })
}

/**
 * Retry test helper
 */
export function retryTest(
  name: string,
  fn: () => void | Promise<void>,
  maxRetries: number = 3,
): void {
  test(name, async () => {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await fn()
        return // Success
      }
      catch (error) {
        lastError = error as Error

        if (attempt < maxRetries - 1) {
          // Wait before retry (exponential backoff)
          const delay = 2 ** attempt * 100
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError
  })
}

/**
 * Concurrent test helper
 */
export function concurrentTest(
  name: string,
  fns: Array<() => void | Promise<void>>,
): void {
  test(name, async () => {
    await Promise.all(fns.map(fn => fn()))
  })
}

/**
 * Test data builder pattern
 */
export class TestBuilder<T> {
  private data: Partial<T> = {}
  private factory?: TestDataFactory

  constructor(factory?: TestDataFactory) {
    this.factory = factory
  }

  /**
   * Set field value
   */
  set<K extends keyof T>(key: K, value: T[K]): TestBuilder<T> {
    this.data[key] = value
    return this
  }

  /**
   * Set multiple fields
   */
  merge(data: Partial<T>): TestBuilder<T> {
    Object.assign(this.data, data)
    return this
  }

  /**
   * Build the test data
   */
  build(): T {
    return { ...this.data } as T
  }

  /**
   * Build multiple instances
   */
  buildMany(count: number): T[] {
    return Array.from({ length: count }, () => this.build())
  }
}

/**
 * Create test builder
 */
export function createTestBuilder<T>(factory?: TestDataFactory): TestBuilder<T> {
  return new TestBuilder<T>(factory)
}

// Export test helpers as default
export default {
  setupTestFramework,
  createTestContext,
  testSuite,
  testWithContext,
  dbTest,
  httpTest,
  factoryTest,
  timeTest,
  snapshotTest,
  perfTest,
  retryTest,
  concurrentTest,
  createTestBuilder,
}
