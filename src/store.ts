import type { TestStore, IsolationLevel } from './types.js'

// Re-export types for direct import
export type { TestStore, IsolationLevel } from './types.js'

/**
 * Test store implementation with automatic cleanup and state isolation
 */
export class TestDataStore implements TestStore {
  private data = new Map<string, any>()
  private isolationLevel: IsolationLevel
  private cleanupHandlers: Array<() => void | Promise<void>> = []

  constructor(isolationLevel: IsolationLevel = 'test') {
    this.isolationLevel = isolationLevel
  }

  /**
   * Store test data by key
   */
  set<T>(key: string, value: T): void {
    this.data.set(key, value)
  }

  /**
   * Get test data by key
   */
  get<T>(key: string): T | undefined {
    return this.data.get(key)
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.data.has(key)
  }

  /**
   * Delete test data by key
   */
  delete(key: string): boolean {
    return this.data.delete(key)
  }

  /**
   * Clear all test data
   */
  clear(): void {
    this.data.clear()
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.data.keys())
  }

  /**
   * Get store size
   */
  size(): number {
    return this.data.size
  }

  /**
   * Set isolation level
   */
  setIsolationLevel(level: IsolationLevel): void {
    this.isolationLevel = level
  }

  /**
   * Get isolation level
   */
  getIsolationLevel(): IsolationLevel {
    return this.isolationLevel
  }

  /**
   * Add cleanup handler
   */
  onCleanup(handler: () => void | Promise<void>): void {
    this.cleanupHandlers.push(handler)
  }

  /**
   * Run cleanup handlers
   */
  async runCleanup(): Promise<void> {
    for (const handler of this.cleanupHandlers) {
      try {
        await handler()
      } catch (error) {
        console.warn('Cleanup handler failed:', error)
      }
    }
  }

  /**
   * Create a snapshot of current state
   */
  snapshot(): Map<string, any> {
    return new Map(this.data)
  }

  /**
   * Restore from snapshot
   */
  restore(snapshot: Map<string, any>): void {
    this.data.clear()
    snapshot.forEach((value, key) => {
      this.data.set(key, value)
    })
  }

  /**
   * Get data as object
   */
  toObject(): Record<string, any> {
    return Object.fromEntries(this.data.entries())
  }

  /**
   * Set data from object
   */
  fromObject(obj: Record<string, any>): void {
    this.data.clear()
    Object.entries(obj).forEach(([key, value]) => {
      this.data.set(key, value)
    })
  }
}

/**
 * Global test stores by isolation level
 */
const stores = new Map<string, TestDataStore>()

/**
 * Get or create test store for specific isolation level
 */
export function getTestStore(isolationLevel: IsolationLevel = 'test'): TestDataStore {
  const key = isolationLevel
  if (!stores.has(key)) {
    stores.set(key, new TestDataStore(isolationLevel))
  }
  return stores.get(key)!
}

/**
 * Clear test store for specific isolation level
 */
export function clearTestStore(isolationLevel: IsolationLevel = 'test'): void {
  const store = stores.get(isolationLevel)
  if (store) {
    store.clear()
  }
}

/**
 * Clean up all test stores
 */
export async function cleanupAllTestStores(): Promise<void> {
  const cleanupPromises = Array.from(stores.values()).map(store => store.runCleanup())
  await Promise.allSettled(cleanupPromises)
  
  stores.forEach(store => store.clear())
}

/**
 * Scoped test data management
 */
export class ScopedTestData {
  private store: TestDataStore
  private scope: string
  private snapshots = new Map<string, Map<string, any>>()

  constructor(scope: string, isolationLevel: IsolationLevel = 'test') {
    this.scope = scope
    this.store = getTestStore(isolationLevel)
  }

  /**
   * Get scoped key
   */
  private getScopedKey(key: string): string {
    return `${this.scope}:${key}`
  }

  /**
   * Set scoped data
   */
  set<T>(key: string, value: T): void {
    this.store.set(this.getScopedKey(key), value)
  }

  /**
   * Get scoped data
   */
  get<T>(key: string): T | undefined {
    return this.store.get<T>(this.getScopedKey(key))
  }

  /**
   * Delete scoped data
   */
  delete(key: string): boolean {
    return this.store.delete(this.getScopedKey(key))
  }

  /**
   * Clear all data for this scope
   */
  clear(): void {
    const prefix = `${this.scope}:`
    const keysToDelete = this.store.keys().filter(key => key.startsWith(prefix))
    keysToDelete.forEach(key => this.store.delete(key))
  }

  /**
   * Create snapshot of scoped data
   */
  snapshot(name: string = 'default'): void {
    const prefix = `${this.scope}:`
    const scopedData = new Map<string, any>()
    
    this.store.keys()
      .filter(key => key.startsWith(prefix))
      .forEach(key => {
        const originalKey = key.substring(prefix.length)
        scopedData.set(originalKey, this.store.get(key))
      })
    
    this.snapshots.set(name, scopedData)
  }

  /**
   * Restore from snapshot
   */
  restore(name: string = 'default'): boolean {
    const snapshot = this.snapshots.get(name)
    if (!snapshot) {
      return false
    }

    // Clear current scoped data
    this.clear()

    // Restore from snapshot
    snapshot.forEach((value, key) => {
      this.set(key, value)
    })

    return true
  }

  /**
   * List all scoped keys
   */
  keys(): string[] {
    const prefix = `${this.scope}:`
    return this.store.keys()
      .filter(key => key.startsWith(prefix))
      .map(key => key.substring(prefix.length))
  }

  /**
   * Get size of scoped data
   */
  size(): number {
    return this.keys().length
  }
}

/**
 * Create scoped test data manager
 */
export function createScopedTestData(scope: string, isolationLevel?: IsolationLevel): ScopedTestData {
  return new ScopedTestData(scope, isolationLevel)
}

/**
 * Test data lifecycle manager
 */
export class TestDataLifecycle {
  private beforeEachHandlers: Array<() => void | Promise<void>> = []
  private afterEachHandlers: Array<() => void | Promise<void>> = []
  private beforeAllHandlers: Array<() => void | Promise<void>> = []
  private afterAllHandlers: Array<() => void | Promise<void>> = []

  /**
   * Register before each handler
   */
  beforeEach(handler: () => void | Promise<void>): void {
    this.beforeEachHandlers.push(handler)
  }

  /**
   * Register after each handler
   */
  afterEach(handler: () => void | Promise<void>): void {
    this.afterEachHandlers.push(handler)
  }

  /**
   * Register before all handler
   */
  beforeAll(handler: () => void | Promise<void>): void {
    this.beforeAllHandlers.push(handler)
  }

  /**
   * Register after all handler
   */
  afterAll(handler: () => void | Promise<void>): void {
    this.afterAllHandlers.push(handler)
  }

  /**
   * Run before each handlers
   */
  async runBeforeEach(): Promise<void> {
    for (const handler of this.beforeEachHandlers) {
      await handler()
    }
  }

  /**
   * Run after each handlers
   */
  async runAfterEach(): Promise<void> {
    for (const handler of this.afterEachHandlers) {
      await handler()
    }
  }

  /**
   * Run before all handlers
   */
  async runBeforeAll(): Promise<void> {
    for (const handler of this.beforeAllHandlers) {
      await handler()
    }
  }

  /**
   * Run after all handlers
   */
  async runAfterAll(): Promise<void> {
    for (const handler of this.afterAllHandlers) {
      await handler()
    }
  }

  /**
   * Clear all handlers
   */
  clearHandlers(): void {
    this.beforeEachHandlers.length = 0
    this.afterEachHandlers.length = 0
    this.beforeAllHandlers.length = 0
    this.afterAllHandlers.length = 0
  }
}

/**
 * Default test data lifecycle manager
 */
export const testLifecycle = new TestDataLifecycle()

/**
 * Auto cleanup utilities
 */
export class AutoCleanup {
  private resources: Array<() => void | Promise<void>> = []
  private timers: Set<NodeJS.Timeout> = new Set()

  /**
   * Register resource for cleanup
   */
  register(cleanup: () => void | Promise<void>): void {
    this.resources.push(cleanup)
  }

  /**
   * Register timer for cleanup
   */
  setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timer = setTimeout(callback, delay)
    this.timers.add(timer)
    return timer
  }

  /**
   * Register interval for cleanup
   */
  setInterval(callback: () => void, delay: number): NodeJS.Timeout {
    const timer = setInterval(callback, delay)
    this.timers.add(timer)
    return timer
  }

  /**
   * Clear all timers
   */
  clearTimers(): void {
    this.timers.forEach(timer => {
      clearTimeout(timer)
      clearInterval(timer)
    })
    this.timers.clear()
  }

  /**
   * Run all cleanup
   */
  async cleanup(): Promise<void> {
    // Clear timers first
    this.clearTimers()

    // Run resource cleanup
    for (const cleanup of this.resources) {
      try {
        await cleanup()
      } catch (error) {
        console.warn('Resource cleanup failed:', error)
      }
    }

    this.resources.length = 0
  }
}

/**
 * Create auto cleanup instance
 */
export function createAutoCleanup(): AutoCleanup {
  return new AutoCleanup()
}