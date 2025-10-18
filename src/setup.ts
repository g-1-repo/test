import { afterEach, beforeAll, vi, type MockInstance } from 'vitest'

export interface TestSetupOptions {
  /** Mock console methods to reduce noise during tests */
  mockConsole?: boolean
  /** Specific console methods to mock */
  consoleMethods?: ('log' | 'info' | 'debug' | 'warn' | 'error')[]
  /** Environment variables to set for tests */
  env?: Record<string, string>
  /** Custom cleanup functions to run after each test */
  cleanup?: (() => void | Promise<void>)[]
}

/**
 * Set up test environment with common configurations
 */
export function setupTestEnvironment(options: TestSetupOptions = {}): void {
  const {
    mockConsole = true,
    consoleMethods = ['info', 'debug'],
    env = {},
    cleanup = []
  } = options

  // Store original console methods and environment variables
  const originalConsole: Record<string, any> = {}
  const originalEnv: Record<string, string | undefined> = {}
  const mockInstances: MockInstance[] = []

  beforeAll(() => {
    // Set up environment variables
    Object.entries(env).forEach(([key, value]) => {
      originalEnv[key] = process.env[key]
      process.env[key] = value
    })

    // Set up console mocking
    if (mockConsole) {
      consoleMethods.forEach((method) => {
        if (typeof console[method] === 'function') {
          originalConsole[method] = console[method]
          const mockInstance = vi.spyOn(console, method).mockImplementation(() => {})
          mockInstances.push(mockInstance)
        }
      })
    }
  })

  afterEach(async () => {
    // Restore mocks
    vi.restoreAllMocks()

    // Run custom cleanup functions
    for (const cleanupFn of cleanup) {
      await cleanupFn()
    }
  })

  // Clean up on exit
  process.on('exit', () => {
    // Restore environment variables
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    })

    // Restore console methods
    Object.entries(originalConsole).forEach(([method, originalFn]) => {
      ;(console as any)[method] = originalFn
    })
  })
}

/**
 * Ensure required environment variables exist for testing
 */
export function ensureTestEnv(requiredVars: Record<string, string>): void {
  Object.entries(requiredVars).forEach(([key, defaultValue]) => {
    if (!process.env[key]) {
      process.env[key] = defaultValue
    }
  })
}

/**
 * Create a test-specific environment variable setup
 */
export function withTestEnv<T>(
  env: Record<string, string>,
  fn: () => T | Promise<T>
): () => Promise<T> {
  return async () => {
    const originalEnv: Record<string, string | undefined> = {}
    
    // Set test environment variables
    Object.entries(env).forEach(([key, value]) => {
      originalEnv[key] = process.env[key]
      process.env[key] = value
    })

    try {
      return await fn()
    } finally {
      // Restore original environment variables
      Object.entries(originalEnv).forEach(([key, value]) => {
        if (value === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = value
        }
      })
    }
  }
}

/**
 * Mock time for testing time-sensitive features
 */
export class MockTime {
  private originalNow: typeof Date.now
  private originalDate: typeof Date
  private mockDate: Date

  constructor(mockDate: Date = new Date()) {
    this.originalNow = Date.now
    this.originalDate = Date
    this.mockDate = mockDate
  }

  /**
   * Start mocking time
   */
  start(): void {
    const mockTime = this.mockDate.getTime()
    
    Date.now = vi.fn(() => mockTime)
    
    // Mock Date constructor
    const originalDate = this.originalDate
    global.Date = class MockDate extends originalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(mockTime)
        } else {
          // @ts-ignore - We need to spread args here
          super(...args)
        }
      }
      
      static now(): number {
        return mockTime
      }
    } as any
  }

  /**
   * Advance time by specified milliseconds
   */
  advance(ms: number): void {
    this.mockDate = new Date(this.mockDate.getTime() + ms)
    const newMockTime = this.mockDate.getTime()
    
    Date.now = vi.fn(() => newMockTime)
    ;(global.Date as any).now = () => newMockTime
  }

  /**
   * Set time to a specific date
   */
  setTime(date: Date): void {
    this.mockDate = date
    const mockTime = date.getTime()
    
    Date.now = vi.fn(() => mockTime)
    ;(global.Date as any).now = () => mockTime
  }

  /**
   * Restore original time functions
   */
  restore(): void {
    Date.now = this.originalNow
    global.Date = this.originalDate
  }
}

/**
 * Create a time mock for testing
 */
export function createTimeMock(initialDate?: Date): MockTime {
  return new MockTime(initialDate)
}

/**
 * Default test setup for Cloudflare Workers + Hono applications
 */
export function setupCloudflareWorkerTests(): void {
  setupTestEnvironment({
    mockConsole: true,
    consoleMethods: ['info', 'debug'],
    env: {
      // Ensure dummy environment variables for services that require them
      RESEND_API_KEY: 're_test_mock_api_key_for_testing',
      NODE_ENV: 'test'
    }
  })
}