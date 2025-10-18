import type { DatabaseAdapter, DatabaseProvider } from '../types.js'

/**
 * Memory database adapter for fast unit tests
 */
export class MemoryDatabaseAdapter implements DatabaseAdapter<Map<string, any>> {
  db: Map<string, any>
  type: DatabaseProvider = 'memory'
  private initialData: Map<string, any>

  constructor() {
    this.db = new Map()
    this.initialData = new Map()
  }

  async initialize(): Promise<void> {
    // Store initial state for reset
    this.initialData = new Map(this.db)
  }

  async cleanup(): Promise<void> {
    // Clear all test data but keep schema
    this.db.clear()
  }

  async reset(): Promise<void> {
    // Reset to initial state
    this.db.clear()
    this.initialData.forEach((value, key) => {
      this.db.set(key, value)
    })
  }

  async isReady(): Promise<boolean> {
    return true
  }

  async close(): Promise<void> {
    this.db.clear()
    this.initialData.clear()
  }
}

/**
 * SQLite database adapter for integration tests
 */
export class SqliteDatabaseAdapter implements DatabaseAdapter {
  db: any
  type: DatabaseProvider = 'sqlite'
  private filePath: string

  constructor(filePath: string = ':memory:') {
    this.filePath = filePath
  }

  async initialize(): Promise<void> {
    try {
      // Dynamic import for better-sqlite3
      const Database = (await import('better-sqlite3')).default
      this.db = new Database(this.filePath)

      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('synchronous = NORMAL')
      this.db.pragma('foreign_keys = ON')
    }
    catch (error) {
      throw new Error(`Failed to initialize SQLite database: ${error}`)
    }
  }

  async cleanup(): Promise<void> {
    if (!this.db)
      return

    try {
      // Get all table names
      const tables = this.db
        .prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\'')
        .all()

      // Disable foreign keys temporarily
      this.db.pragma('foreign_keys = OFF')

      // Clear all tables
      for (const table of tables) {
        this.db.prepare(`DELETE FROM "${table.name}"`).run()
      }

      // Re-enable foreign keys
      this.db.pragma('foreign_keys = ON')
    }
    catch (error) {
      console.warn('SQLite cleanup failed:', error)
    }
  }

  async reset(): Promise<void> {
    await this.cleanup()
  }

  async isReady(): Promise<boolean> {
    try {
      return !!this.db && this.db.open
    }
    catch {
      return false
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

/**
 * Cloudflare D1 database adapter
 */
export class D1DatabaseAdapter implements DatabaseAdapter {
  db: any
  type: DatabaseProvider = 'd1'

  constructor(d1Database: any) {
    this.db = d1Database
  }

  async initialize(): Promise<void> {
    // D1 is already initialized by Cloudflare Workers
    if (!this.db) {
      throw new Error('D1 database instance is required')
    }
  }

  async cleanup(): Promise<void> {
    if (!this.db)
      return

    try {
      // Get all table names (excluding system tables)
      const result = await this.db
        .prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\' AND name NOT LIKE \'__d1_%\'')
        .all()

      // Clear all tables
      for (const table of result.results || []) {
        await this.db.prepare(`DELETE FROM "${table.name}"`).run()
      }
    }
    catch (error) {
      console.warn('D1 cleanup failed:', error)
    }
  }

  async reset(): Promise<void> {
    await this.cleanup()
  }

  async isReady(): Promise<boolean> {
    try {
      await this.db.prepare('SELECT 1').first()
      return true
    }
    catch {
      return false
    }
  }

  async close(): Promise<void> {
    // D1 connections are managed by Cloudflare Workers runtime
    // No explicit close needed
  }
}

/**
 * Drizzle SQLite adapter
 */
export class DrizzleSqliteAdapter implements DatabaseAdapter {
  db: any
  type: DatabaseProvider = 'drizzle-sqlite'
  private sqliteAdapter: SqliteDatabaseAdapter

  constructor(drizzleDb: any, sqliteFilePath?: string) {
    this.db = drizzleDb
    this.sqliteAdapter = new SqliteDatabaseAdapter(sqliteFilePath)
  }

  async initialize(): Promise<void> {
    await this.sqliteAdapter.initialize()
    // The drizzle instance should use the same SQLite connection
  }

  async cleanup(): Promise<void> {
    await this.sqliteAdapter.cleanup()
  }

  async reset(): Promise<void> {
    await this.sqliteAdapter.reset()
  }

  async isReady(): Promise<boolean> {
    return await this.sqliteAdapter.isReady()
  }

  async close(): Promise<void> {
    await this.sqliteAdapter.close()
  }
}

/**
 * Drizzle D1 adapter
 */
export class DrizzleD1Adapter implements DatabaseAdapter {
  db: any
  type: DatabaseProvider = 'drizzle-d1'
  private d1Adapter: D1DatabaseAdapter

  constructor(drizzleDb: any, d1Database: any) {
    this.db = drizzleDb
    this.d1Adapter = new D1DatabaseAdapter(d1Database)
  }

  async initialize(): Promise<void> {
    await this.d1Adapter.initialize()
  }

  async cleanup(): Promise<void> {
    await this.d1Adapter.cleanup()
  }

  async reset(): Promise<void> {
    await this.d1Adapter.reset()
  }

  async isReady(): Promise<boolean> {
    return await this.d1Adapter.isReady()
  }

  async close(): Promise<void> {
    await this.d1Adapter.close()
  }
}

/**
 * Create database adapter based on provider type
 */
export function createDatabaseAdapter(
  provider: DatabaseProvider,
  options?: {
    sqliteFilePath?: string
    d1Database?: any
    drizzleDb?: any
  },
): DatabaseAdapter {
  switch (provider) {
    case 'memory':
      return new MemoryDatabaseAdapter()

    case 'sqlite':
      return new SqliteDatabaseAdapter(options?.sqliteFilePath)

    case 'd1':
      if (!options?.d1Database) {
        throw new Error('D1 database instance is required for D1 adapter')
      }
      return new D1DatabaseAdapter(options.d1Database)

    case 'drizzle-sqlite':
      if (!options?.drizzleDb) {
        throw new Error('Drizzle database instance is required for Drizzle SQLite adapter')
      }
      return new DrizzleSqliteAdapter(options.drizzleDb, options.sqliteFilePath)

    case 'drizzle-d1':
      if (!options?.drizzleDb || !options?.d1Database) {
        throw new Error('Both Drizzle and D1 database instances are required for Drizzle D1 adapter')
      }
      return new DrizzleD1Adapter(options.drizzleDb, options.d1Database)

    default:
      throw new Error(`Unsupported database provider: ${provider}`)
  }
}

/**
 * Auto-detect best database provider for current environment
 */
export function detectBestDatabaseProvider(): DatabaseProvider {
  // Check for Cloudflare Workers environment
  if (typeof globalThis !== 'undefined' && 'CloudflareWorkerGlobalScope' in globalThis) {
    return 'd1'
  }

  // Check for Node.js/Bun with SQLite support
  try {
    require.resolve('better-sqlite3')
    return 'sqlite'
  }
  catch {
    // Fall back to memory for environments without SQLite
    return 'memory'
  }
}
