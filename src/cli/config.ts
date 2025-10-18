import { cosmiconfig } from 'cosmiconfig'
import { z } from 'zod'

// Zod schema for test runner configuration
const TestRunnerConfigSchema = z.object({
  // Package metadata
  packageName: z.string().optional(),
  packageType: z.enum(['api', 'library', 'cli', 'workspace']).optional(),

  // Runtime configuration
  runtime: z.enum(['cloudflare-workers', 'node', 'bun']).optional(),
  database: z.enum(['memory', 'sqlite', 'd1', 'drizzle-sqlite', 'drizzle-d1']).optional(),

  // Test selection
  categories: z.union([
    z.record(z.string(), z.string()), // category name -> pattern (config file)
    z.array(z.string()), // category names (CLI override)
  ]).optional(),
  patterns: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),

  // Execution options
  watch: z.boolean().optional(),
  verbose: z.boolean().optional(),
  parallel: z.boolean().optional(),
  maxWorkers: z.number().int().positive().optional(),
  timeout: z.number().int().positive().optional(),

  // Output configuration
  reporter: z.enum(['default', 'verbose', 'minimal', 'json', 'junit']).optional(),
  outputFile: z.string().optional(),
  coverage: z.boolean().optional(),

  // Environment
  env: z.record(z.string(), z.string()).optional(),
  envFile: z.string().optional(),

  // Test discovery
  testDir: z.string().optional(),
  testMatch: z.array(z.string()).optional(),
  testIgnore: z.array(z.string()).optional(),
  setupFiles: z.array(z.string()).optional(),
  globalSetup: z.string().optional(),
  globalTeardown: z.string().optional(),

  // Advanced options
  bail: z.boolean().optional(),
  silent: z.boolean().optional(),
  detectOpenHandles: z.boolean().optional(),
  forceExit: z.boolean().optional(),

  // Enterprise features
  telemetry: z.object({
    enabled: z.boolean().optional(),
    endpoint: z.string().url().optional(),
    apiKey: z.string().optional(),
  }).optional(),

  notifications: z.object({
    enabled: z.boolean().optional(),
    slack: z.object({
      webhook: z.string().url(),
      channel: z.string().optional(),
    }).optional(),
    email: z.object({
      smtp: z.string(),
      from: z.string().email(),
      to: z.array(z.string().email()),
    }).optional(),
  }).optional(),
})

export type TestRunnerConfig = z.infer<typeof TestRunnerConfigSchema>

export interface ConfigResult {
  config: TestRunnerConfig
  filepath?: string
  isEmpty?: boolean
}

/**
 * Configuration loader using cosmiconfig
 */
export class ConfigLoader {
  private explorer = cosmiconfig('gotestsuite', {
    searchPlaces: [
      'package.json',
      'test-suite.config.js',
      'test-suite.config.mjs',
      'test-suite.config.cjs',
      '.gotestsuiterc',
      '.gotestsuiterc.json',
      '.gotestsuiterc.yaml',
      '.gotestsuiterc.yml',
      '.gotestsuiterc.js',
      '.gotestsuiterc.mjs',
      '.gotestsuiterc.cjs',
      'gotestsuite.config.js',
      'gotestsuite.config.mjs',
      'gotestsuite.config.cjs',
    ],
  })

  /**
   * Load configuration from file system
   */
  async load(searchFrom?: string): Promise<ConfigResult> {
    try {
      const result = await this.explorer.search(searchFrom)

      if (!result) {
        return { config: {}, isEmpty: true }
      }

      const validatedConfig = TestRunnerConfigSchema.parse(result.config)

      return {
        config: validatedConfig,
        filepath: result.filepath,
        isEmpty: false,
      }
    }
    catch (error) {
      if (error instanceof z.ZodError) {
        throw new ConfigValidationError('Invalid configuration', error)
      }
      throw error
    }
  }

  /**
   * Load configuration synchronously
   */
  loadSync(_searchFrom?: string): ConfigResult {
    try {
      // cosmiconfig v9 doesn't have searchSync - use async version
      // For now, return empty config and load async later
      return { config: {}, isEmpty: true }
    }
    catch (error) {
      if (error instanceof z.ZodError) {
        throw new ConfigValidationError('Invalid configuration', error)
      }
      throw error
    }
  }

  /**
   * Validate configuration object
   */
  validate(config: unknown): TestRunnerConfig {
    return TestRunnerConfigSchema.parse(config)
  }

  /**
   * Detect package information from package.json
   */
  async detectPackage(searchFrom?: string): Promise<{ name?: string, type?: string, testScript?: string }> {
    try {
      const { readFile } = await import('node:fs/promises')
      const { join } = await import('node:path')

      const packagePath = join(searchFrom || process.cwd(), 'package.json')
      const packageJson = JSON.parse(await readFile(packagePath, 'utf-8'))

      return {
        name: packageJson.name,
        type: this.inferPackageType(packageJson),
        testScript: packageJson.scripts?.test,
      }
    }
    catch {
      return {}
    }
  }

  /**
   * Infer package type from package.json
   */
  private inferPackageType(packageJson: any): string {
    if (packageJson.main && packageJson.bin)
      return 'cli'
    if (packageJson.dependencies?.hono || packageJson.dependencies?.['@hono/zod-openapi'])
      return 'api'
    if (packageJson.type === 'module' && !packageJson.main)
      return 'library'
    return 'library'
  }
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
  constructor(message: string, public zodError: z.ZodError) {
    super(message)
    this.name = 'ConfigValidationError'
  }

  /**
   * Get formatted error message
   */
  getFormattedError(): string {
    const issues = this.zodError.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
      return `  - ${path}: ${issue.message}`
    }).join('\n')

    return `Configuration validation failed:\n${issues}`
  }
}

/**
 * Merge CLI arguments with configuration file
 */
export function mergeConfig(
  fileConfig: TestRunnerConfig,
  cliConfig: Partial<TestRunnerConfig>,
): TestRunnerConfig {
  return {
    ...fileConfig,
    ...cliConfig,
    // Deep merge nested objects
    env: { ...fileConfig.env, ...cliConfig.env },
    telemetry: { ...fileConfig.telemetry, ...cliConfig.telemetry },
    notifications: { ...fileConfig.notifications, ...cliConfig.notifications },
  }
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): TestRunnerConfig {
  return {
    verbose: false,
    watch: false,
    parallel: true,
    maxWorkers: 4,
    timeout: 30000,
    reporter: 'default',
    coverage: false,
    bail: false,
    silent: false,
    detectOpenHandles: true,
    forceExit: false,
    testDir: process.cwd(),
    testMatch: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    testIgnore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    telemetry: {
      enabled: false,
    },
    notifications: {
      enabled: false,
    },
  }
}

// Create singleton instance
export const configLoader = new ConfigLoader()
