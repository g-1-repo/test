// Database adapters and types
export {
  MemoryDatabaseAdapter,
  SqliteDatabaseAdapter,
  D1DatabaseAdapter,
  DrizzleSqliteAdapter,
  DrizzleD1Adapter,
  createDatabaseAdapter,
  detectBestDatabaseProvider,
  type DatabaseAdapter
} from './adapters/index.js'

// Smart data factory
export {
  TestDataFactory,
  factory,
  createSeededFactory,
  TestDataSequence,
  type FactoryConfig,
  type FactoryFunction,
  type TestDataGenerators
} from './factory.js'

// Test store management
export {
  TestDataStore,
  getTestStore,
  clearTestStore,
  cleanupAllTestStores,
  ScopedTestData,
  createScopedTestData,
  TestDataLifecycle,
  testLifecycle,
  AutoCleanup,
  createAutoCleanup,
  type TestStore,
  type IsolationLevel
} from './store.js'

// Enhanced HTTP test client
export {
  HttpTestClient,
  createHttpTestClient,
  type HttpClientOptions
} from './utils/http-client.js'

// Environment utilities
export {
  detectRuntime,
  detectDatabaseProvider,
  getEnv,
  setEnv,
  hasEnv,
  ensureEnv,
  getRuntimeCapabilities,
  createOptimizedTestConfig,
  getEnvironmentInfo,
  setupTestEnvironment as setupEnv,
  setupRuntimeSpecificTests,
  isTestEnvironment,
  isCIEnvironment,
  getTestConfig,
  getMemoryUsage,
  PerformanceMonitor,
  performanceMonitor
} from './utils/environment.js'

// Vitest integration
export {
  configureVitest,
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
  TestBuilder,
  createTestBuilder
} from './vitest/index.js'

// CLI Test Runner (conditionally exported - only in Node.js/Bun environments)
// Note: Excluded from Workers runtime to avoid Node.js dependency issues

// Core testing utilities (legacy exports for compatibility)
export {
  requestWithCookies,
  requestJSON,
  postJSON,
  resetCookies,
  getCookieJarKeys,
  uniqueEmail,
  uniqueUsername,
  wait,
  createTestContext as createLegacyTestContext
} from './core.js'

// Email testing utilities (legacy exports)
export {
  getOutbox,
  clearOutbox,
  getLastEmail,
  getEmailsFor,
  waitForEmail,
  assertEmailSent,
  assertNoEmailSent,
  extractVerificationLink,
  extractOTPCode
} from './email.js'

// Test setup utilities (legacy exports)
export {
  setupTestEnvironment,
  ensureTestEnv,
  withTestEnv,
  MockTime,
  createTimeMock,
  setupCloudflareWorkerTests
} from './setup.js'

// Type exports
export type {
  Runtime,
  DatabaseProvider,
  TestEnvironmentConfig,
  HonoApp,
  TestRequestOptions,
  TestResponse,
  TestEmail,
  TestSetupOptions,
  TestSuiteConfig,
  TestRunnerConfig,
  VitestConfig
} from './types.js'
