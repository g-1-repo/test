import type { Hono } from 'hono'

/**
 * Runtime environment detection
 */
export type Runtime = 'cloudflare-workers' | 'node' | 'bun' | 'unknown'

/**
 * Database providers supported by the test framework
 */
export type DatabaseProvider = 'memory' | 'sqlite' | 'd1' | 'drizzle-sqlite' | 'drizzle-d1'

/**
 * Test environment configuration
 */
export interface TestEnvironmentConfig {
  runtime: Runtime
  database: DatabaseProvider
  cleanup: boolean
  seeded: boolean
  verbose: boolean
}

/**
 * Database adapter interface
 */
export interface DatabaseAdapter<T = any> {
  /** Database connection instance */
  db: T
  /** Provider type */
  type: DatabaseProvider
  /** Initialize the database */
  initialize(): Promise<void>
  /** Clean up test data */
  cleanup(): Promise<void>
  /** Reset database to initial state */
  reset(): Promise<void>
  /** Check if database is ready */
  isReady(): Promise<boolean>
  /** Close database connection */
  close(): Promise<void>
}

/**
 * Test data factory configuration
 */
export interface FactoryConfig {
  seed?: number
  locale?: string
  count?: number
}

/**
 * Test store for managing test data
 */
export interface TestStore {
  /** Store test data by key */
  set<T>(key: string, value: T): void
  /** Get test data by key */
  get<T>(key: string): T | undefined
  /** Check if key exists */
  has(key: string): boolean
  /** Delete test data by key */
  delete(key: string): boolean
  /** Clear all test data */
  clear(): void
  /** Get all keys */
  keys(): string[]
  /** Get store size */
  size(): number
}

/**
 * HTTP test client options
 */
export interface HttpClientOptions {
  baseUrl?: string
  defaultHeaders?: Record<string, string>
  timeout?: number
  retries?: number
  cookieJar?: string
}

/**
 * Test request options
 */
export interface TestRequestOptions extends RequestInit {
  /** Custom headers to include in the request */
  headers?: HeadersInit
  /** Expected status code(s) */
  expectedStatus?: number | number[]
  /** Cookie jar key for session management */
  cookieJar?: string
  /** Timeout in milliseconds */
  timeout?: number
  /** Number of retries on failure */
  retries?: number
}

/**
 * Enhanced test response
 */
export interface TestResponse extends Response {
  /** Parse response as JSON with type safety */
  json<T = any>(): Promise<T>
  /** Get response time in milliseconds */
  responseTime: number
  /** Request that generated this response */
  request: TestRequestOptions
}

/**
 * Test suite configuration
 */
export interface TestSuiteConfig {
  /** Test suite name */
  name: string
  /** Test environment setup */
  environment: Partial<TestEnvironmentConfig>
  /** Before all hook */
  beforeAll?: () => Promise<void> | void
  /** After all hook */
  afterAll?: () => Promise<void> | void
  /** Before each hook */
  beforeEach?: () => Promise<void> | void
  /** After each hook */
  afterEach?: () => Promise<void> | void
}

/**
 * Test runner configuration
 */
export interface TestRunnerConfig {
  /** Test categories to run */
  categories?: string[]
  /** Runtime to use */
  runtime?: Runtime
  /** Database provider to use */
  database?: DatabaseProvider
  /** Enable verbose output */
  verbose?: boolean
  /** Run in watch mode */
  watch?: boolean
}

/**
 * Generic Hono app type helper
 */
export type HonoApp = Hono<any, any, any>

/**
 * Test factory function type
 */
export type FactoryFunction<T> = (config?: FactoryConfig) => T

/**
 * Test data generators
 */
export interface TestDataGenerators {
  user: FactoryFunction<{
    id: string
    email: string
    username: string
    name: string
    createdAt: Date
  }>
  organization: FactoryFunction<{
    id: string
    name: string
    slug: string
    description: string
    createdAt: Date
  }>
  post: FactoryFunction<{
    id: string
    title: string
    content: string
    authorId: string
    published: boolean
    createdAt: Date
  }>
}

/**
 * Email testing utilities
 */
export interface TestEmail {
  to: string[]
  from: string
  subject: string
  html?: string
  text?: string
  attachments?: Array<{
    filename: string
    content: string | Buffer
    contentType: string
  }>
  metadata?: Record<string, any>
}

// Legacy alias
export interface EmailTestUtil extends TestEmail {}

/**
 * Test isolation levels
 */
export type IsolationLevel = 'none' | 'test' | 'suite' | 'file'

/**
 * Test setup options
 */
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
 * Vitest integration configuration
 */
export interface VitestConfig {
  isolation: IsolationLevel
  autoCleanup: boolean
  seededData: boolean
  mockTime: boolean
  verbose?: boolean
}
