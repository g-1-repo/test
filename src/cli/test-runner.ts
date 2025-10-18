#!/usr/bin/env node

import type { DatabaseProvider, Runtime } from '../types.js'
import type { TestRunnerConfig } from './config.js'
import { readdir, stat } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import chalk from 'chalk'
import enquirer from 'enquirer'
import { execa } from 'execa'
import { Listr } from 'listr2'
import { detectRuntime, getEnvironmentInfo } from '../utils/environment.js'
import { configLoader, ConfigValidationError, getDefaultConfig, mergeConfig } from './config.js'
import { ExitCode, formatError, Logger, setupErrorHandlers } from './logger.js'
// @ts-ignore - enquirer doesn't export types properly
const { MultiSelect, Select } = enquirer

interface TestFile {
  name: string
  path: string
  category: string
  size: number
  lastModified: Date
}

interface TestCategory {
  name: string
  files: TestFile[]
  count: number
}

/**
 * Enterprise Interactive test runner for @go-corp/test-suite
 */
export class TestRunner {
  private testFiles: TestFile[] = []
  private categories: Map<string, TestCategory> = new Map()
  private config: TestRunnerConfig
  private logger: Logger
  private startTime: number = Date.now()

  constructor(config?: Partial<TestRunnerConfig>) {
    this.config = this.loadConfig(config)
    this.logger = new Logger(this.config)
    setupErrorHandlers(this.logger as any)
  }

  /**
   * Load configuration from file system and CLI arguments
   */
  private loadConfig(overrides?: Partial<TestRunnerConfig>): TestRunnerConfig {
    try {
      // For now, just use defaults and CLI args - async config loading will be done in tasks
      const cliConfig = this.parseCLIArgs()

      // Merge: defaults < CLI < overrides
      return mergeConfig(
        mergeConfig(getDefaultConfig(), cliConfig),
        overrides || {},
      )
    }
    catch (error) {
      if (error instanceof ConfigValidationError) {
        console.error(chalk.red('❌ Configuration Error:'))
        console.error(error.getFormattedError())
        process.exit(ExitCode.CONFIG_ERROR)
      }
      throw error
    }
  }

  /**
   * Parse CLI arguments
   */
  private parseCLIArgs(): Partial<TestRunnerConfig> {
    const args = process.argv.slice(2)
    const config: Partial<TestRunnerConfig> = {}

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      const nextArg = args[i + 1]

      switch (arg) {
        case '--runtime':
          if (nextArg && ['cloudflare-workers', 'node', 'bun'].includes(nextArg)) {
            config.runtime = nextArg as 'cloudflare-workers' | 'node' | 'bun'
          }
          i++
          break
        case '--database':
          config.database = nextArg as DatabaseProvider
          i++
          break
        case '--verbose':
        case '-v':
          config.verbose = true
          break
        case '--watch':
        case '-w':
          config.watch = true
          break
        case '--parallel':
          config.parallel = true
          break
        case '--no-parallel':
          config.parallel = false
          break
        case '--coverage':
          config.coverage = true
          break
        case '--bail':
          config.bail = true
          break
        case '--silent':
          config.silent = true
          break
        case '--help':
        case '-h':
          this.showHelp()
          process.exit(ExitCode.SUCCESS)
          break
        case '--categories':
        case '-c':
          config.categories = nextArg?.split(',') || []
          i++
          break
        case '--reporter':
          config.reporter = nextArg as any
          i++
          break
        case '--timeout':
          config.timeout = Number.parseInt(nextArg, 10)
          i++
          break
        case '--max-workers':
          config.maxWorkers = Number.parseInt(nextArg, 10)
          i++
          break
        default:
          if (arg.startsWith('--')) {
            console.warn(chalk.yellow(`⚠️  Unknown option: ${arg}`))
          }
          break
      }
    }

    return config
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    console.log(chalk.cyan(`
🧪 @go-corp/test-suite Enterprise Test Runner

`)
+ chalk.white(`Usage:
  test-runner [options]

`)
+ chalk.yellow(`Runtime Options:
`)
+ chalk.gray(`  --runtime <runtime>      Runtime (cloudflare-workers, node, bun)
`)
+ chalk.gray(`  --database <provider>    Database (memory, sqlite, d1, drizzle-sqlite, drizzle-d1)

`)
+ chalk.yellow(`Test Selection:
`)
+ chalk.gray(`  --categories, -c <cats>  Comma-separated categories to run
`)
+ chalk.gray(`  --reporter <reporter>    Test reporter (default, verbose, minimal, json, junit)

`)
+ chalk.yellow(`Execution Options:
`)
+ chalk.gray(`  --watch, -w             Run in watch mode
`)
+ chalk.gray(`  --parallel              Enable parallel execution (default)
`)
+ chalk.gray(`  --no-parallel           Disable parallel execution
`)
+ chalk.gray(`  --max-workers <n>       Maximum worker threads
`)
+ chalk.gray(`  --timeout <ms>          Test timeout in milliseconds
`)
+ chalk.gray(`  --coverage              Enable coverage reporting
`)
+ chalk.gray(`  --bail                  Stop on first failure

`)
+ chalk.yellow(`Output Options:
`)
+ chalk.gray(`  --verbose, -v           Enable verbose output
`)
+ chalk.gray(`  --silent                Silent mode (no output)
`)
+ chalk.gray(`  --help, -h              Show this help message

`)
+ chalk.yellow(`Configuration:
`)
+ chalk.gray(`  Configuration is loaded from .gotestsuiterc, package.json, or gotestsuite.config.js

`)
+ chalk.green(`Examples:
`)
+ chalk.white(`  test-runner --runtime node --database sqlite --verbose
`)
+ chalk.white(`  test-runner -c unit,integration --coverage
`)
+ chalk.white(`  test-runner --watch --max-workers 2
`)
+ chalk.white(`  test-runner --reporter json --bail
`))
  }

  /**
   * Discover test files in the current directory
   */
  async discoverTests(dir: string = process.cwd()): Promise<void> {
    this.logger.info('Discovering test files...', { directory: dir })

    await this.scanDirectory(dir)
    this.categorizeTests()

    if (this.testFiles.length === 0) {
      this.logger.error('No test files found')
      formatError(new Error('No test files found'), ExitCode.NO_TESTS_FOUND)
    }

    this.logger.success(`Found ${this.testFiles.length} test files in ${this.categories.size} categories`)
  }

  /**
   * Recursively scan directory for test files
   */
  private async scanDirectory(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir)

      for (const entry of entries) {
        const fullPath = join(dir, entry)
        const stats = await stat(fullPath)

        if (stats.isDirectory()) {
          // Skip node_modules and hidden directories
          if (!entry.startsWith('.') && entry !== 'node_modules' && entry !== 'dist') {
            await this.scanDirectory(fullPath)
          }
        }
        else if (this.isTestFile(entry)) {
          this.testFiles.push({
            name: entry,
            path: fullPath,
            category: this.categorizeFile(entry, fullPath),
            size: stats.size,
            lastModified: stats.mtime,
          })
        }
      }
    }
    catch (error) {
      console.warn(`Warning: Could not scan directory ${dir}:`, error)
    }
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(filename: string): boolean {
    const ext = extname(filename)
    const testPatterns = [
      /\.test\.(js|ts|jsx|tsx)$/,
      /\.spec\.(js|ts|jsx|tsx)$/,
      /test\.(js|ts|jsx|tsx)$/,
      /spec\.(js|ts|jsx|tsx)$/,
    ]

    return (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx')
      && testPatterns.some(pattern => pattern.test(filename))
  }

  /**
   * Categorize a test file based on its path and name
   */
  private categorizeFile(filename: string, fullPath: string): string {
    const relativePath = relative(process.cwd(), fullPath).toLowerCase()

    // Category detection rules
    if (relativePath.includes('unit') || filename.includes('unit'))
      return 'unit'
    if (relativePath.includes('integration') || filename.includes('integration'))
      return 'integration'
    if (relativePath.includes('e2e') || filename.includes('e2e'))
      return 'e2e'
    if (relativePath.includes('api') || filename.includes('api'))
      return 'api'
    if (relativePath.includes('auth') || filename.includes('auth'))
      return 'auth'
    if (relativePath.includes('database') || filename.includes('db'))
      return 'database'
    if (relativePath.includes('performance') || filename.includes('perf'))
      return 'performance'
    if (relativePath.includes('smoke'))
      return 'smoke'
    if (relativePath.includes('regression'))
      return 'regression'

    // Default categorization
    if (relativePath.includes('test'))
      return 'functional'
    return 'other'
  }

  /**
   * Organize tests into categories
   */
  private categorizeTests(): void {
    this.categories.clear()

    for (const testFile of this.testFiles) {
      const categoryName = testFile.category

      if (!this.categories.has(categoryName)) {
        this.categories.set(categoryName, {
          name: categoryName,
          files: [],
          count: 0,
        })
      }

      const category = this.categories.get(categoryName)!
      category.files.push(testFile)
      category.count = category.files.length
    }
  }

  /**
   * Show environment information
   */
  private showEnvironmentInfo(): void {
    const envInfo = getEnvironmentInfo()

    console.log('\n📊 Environment Information:')
    console.log(`   Runtime: ${envInfo.runtime}`)
    console.log(`   Database Provider: ${envInfo.databaseProvider}`)

    if (envInfo.nodeVersion) {
      console.log(`   Node.js: ${envInfo.nodeVersion}`)
    }

    if (envInfo.bunVersion) {
      console.log(`   Bun: ${envInfo.bunVersion}`)
    }

    if (envInfo.platform) {
      console.log(`   Platform: ${envInfo.platform} (${envInfo.arch})`)
    }

    console.log(`   Capabilities:`)
    console.log(`     File System: ${envInfo.capabilities.hasFileSystem ? '✅' : '❌'}`)
    console.log(`     Networking: ${envInfo.capabilities.hasNetworking ? '✅' : '❌'}`)
    console.log(`     Database: ${envInfo.capabilities.hasDatabase ? '✅' : '❌'}`)
    console.log(`     SQLite: ${envInfo.capabilities.hasSQLite ? '✅' : '❌'}`)
    console.log(`     D1: ${envInfo.capabilities.hasD1 ? '✅' : '❌'}`)
  }

  /**
   * Interactive category selection
   */
  private async selectCategories(): Promise<string[]> {
    if (this.config.categories) {
      return this.config.categories
    }

    const categoryChoices = Array.from(this.categories.entries()).map(([name, category]) => ({
      name: `${name} (${category.count} files)`,
      value: name,
    }))

    const prompt = new MultiSelect({
      name: 'categories',
      message: 'Select test categories to run:',
      choices: [
        { name: 'All categories', value: 'all' },
        ...categoryChoices,
      ],
      initial: ['all'],
    })

    const selected = await prompt.run()

    if (selected.includes('all')) {
      return Array.from(this.categories.keys())
    }

    return selected
  }

  /**
   * Interactive runtime selection
   */
  private async selectRuntime(): Promise<Runtime> {
    if (this.config.runtime) {
      return this.config.runtime
    }

    const detectedRuntime = detectRuntime()

    const prompt = new Select({
      name: 'runtime',
      message: `Select runtime (detected: ${detectedRuntime}):`,
      choices: [
        { name: `${detectedRuntime} (detected)`, value: detectedRuntime },
        { name: 'cloudflare-workers', value: 'cloudflare-workers' },
        { name: 'node', value: 'node' },
        { name: 'bun', value: 'bun' },
      ].filter((choice, index, arr) =>
        index === 0 || !arr.slice(0, index).some(c => c.value === choice.value),
      ),
      initial: 0,
    })

    return await prompt.run()
  }

  /**
   * Run the enterprise test runner with listr2
   */
  async run(): Promise<void> {
    const sessionTimer = this.logger.timer('test-runner-session')

    this.logger.info('Starting @go-corp/test-suite Interactive Test Runner', {
      version: process.env.npm_package_version,
      runtime: this.config.runtime,
      database: this.config.database,
    })

    this.logger.trackTelemetry('test_runner_start', {
      config: {
        runtime: this.config.runtime,
        database: this.config.database,
        verbose: this.config.verbose,
        parallel: this.config.parallel,
        coverage: this.config.coverage,
      },
    })

    try {
      const tasks = new Listr([
        {
          title: 'Validating environment',
          task: () => this.validateEnvironment(),
        },
        {
          title: 'Loading configuration',
          task: ctx => this.loadRuntimeConfig(ctx),
        },
        {
          title: 'Discovering test files',
          task: ctx => this.discoverTestsTask(ctx),
        },
        {
          title: 'Categorizing tests',
          task: ctx => this.categorizeTestsTask(ctx),
        },
        {
          title: 'Interactive selection',
          task: ctx => this.interactiveSelection(ctx),
          skip: () => this.config.categories && this.config.runtime ? 'Using predefined configuration' : false,
        },
        {
          title: 'Preparing test execution',
          task: ctx => this.prepareTestExecution(ctx),
        },
        {
          title: 'Running tests',
          task: ctx => this.executeTests(ctx),
        },
      ], {
        concurrent: false,
        exitOnError: true,
        rendererOptions: {
          showSubtasks: true,
        },
      })

      const ctx = await tasks.run()

      sessionTimer()
      this.logger.success('Test runner completed successfully', {
        testsRun: ctx.testResults?.totalTests || 0,
        passed: ctx.testResults?.passed || 0,
        failed: ctx.testResults?.failed || 0,
        duration: ctx.duration,
      })

      this.logger.trackTelemetry('test_runner_complete', {
        success: true,
        testsRun: ctx.testResults?.totalTests || 0,
        duration: ctx.duration,
      })

      // Send notifications if configured
      if (this.config.notifications?.enabled) {
        await this.sendNotifications(ctx.testResults)
      }

      await this.logger.flush()

      process.exit(ctx.testResults?.failed ? ExitCode.TEST_FAILURE : ExitCode.SUCCESS)
    }
    catch (error) {
      sessionTimer()

      if (error instanceof Error && error.message === 'cancelled') {
        this.logger.info('Test runner cancelled by user')
        this.logger.trackTelemetry('test_runner_cancelled')
        await this.logger.flush()
        process.exit(ExitCode.INTERRUPTED)
      }
      else {
        const err = error instanceof Error ? error : new Error(String(error))
        this.logger.error('Test runner failed', err)
        this.logger.trackTelemetry('test_runner_error', {
          error: err.message,
          stack: err.stack,
        })
        await this.logger.flush()
        formatError(err, ExitCode.GENERAL_ERROR)
      }
    }
  }

  /**
   * Validate environment for test execution
   */
  private async validateEnvironment(): Promise<void> {
    const envInfo = getEnvironmentInfo()

    // Check Node.js version
    const nodeVersion = process.version
    const majorVersion = Number.parseInt(nodeVersion.slice(1).split('.')[0])

    if (majorVersion < 18) {
      throw new Error(`Node.js 18 or higher required, found ${nodeVersion}`)
    }

    // Check for required binaries
    try {
      await execa('npx', ['--version'], { timeout: 5000 })
    }
    catch {
      throw new Error('npx not found - please ensure npm is properly installed')
    }

    this.logger.debug('Environment validated', {
      nodeVersion,
      runtime: envInfo.runtime,
      capabilities: envInfo.capabilities,
    })
  }

  /**
   * Load runtime configuration
   */
  private async loadRuntimeConfig(ctx: any): Promise<void> {
    ctx.envInfo = getEnvironmentInfo()
    ctx.startTime = Date.now()

    // Load config file asynchronously
    try {
      const { config: fileConfig, filepath } = await configLoader.load()

      if (!fileConfig || Object.keys(fileConfig).length === 0) {
        this.logger.debug('No configuration file found, using defaults and CLI args')
      }
      else {
        this.logger.debug('Loaded configuration from file', { filepath })

        // Merge file config with existing config
        const cliConfig = this.parseCLIArgs()
        this.config = mergeConfig(
          mergeConfig(
            mergeConfig(getDefaultConfig(), fileConfig),
            cliConfig,
          ),
          {}, // no overrides at this stage
        )
      }
    }
    catch (error) {
      this.logger.warn('Failed to load configuration file', { error: error instanceof Error ? error.message : error })
    }

    this.logger.debug('Runtime configuration loaded', {
      config: {
        runtime: this.config.runtime,
        database: this.config.database,
        parallel: this.config.parallel,
        maxWorkers: this.config.maxWorkers,
        timeout: this.config.timeout,
      },
    })
  }

  /**
   * Discover tests task for listr2
   */
  private async discoverTestsTask(ctx: any): Promise<void> {
    const timer = this.logger.timer('test-discovery')

    await this.scanDirectory(this.config.testDir || process.cwd())

    if (this.testFiles.length === 0) {
      throw new Error('No test files found')
    }

    ctx.testFiles = this.testFiles
    timer()

    this.logger.debug('Test files discovered', {
      totalFiles: this.testFiles.length,
      testDir: this.config.testDir,
    })
  }

  /**
   * Categorize tests task for listr2
   */
  private async categorizeTestsTask(ctx: any): Promise<void> {
    this.categorizeTests()
    ctx.categories = Array.from(this.categories.entries())

    this.logger.debug('Tests categorized', {
      categories: Object.fromEntries(
        Array.from(this.categories.entries()).map(([name, cat]) => [name, cat.count]),
      ),
    })
  }

  /**
   * Interactive selection task
   */
  private async interactiveSelection(ctx: any): Promise<void> {
    ctx.selectedCategories = await this.selectCategories()
    ctx.selectedRuntime = await this.selectRuntime()

    this.logger.info('User selections completed', {
      categories: ctx.selectedCategories,
      runtime: ctx.selectedRuntime,
    })
  }

  /**
   * Prepare test execution
   */
  private async prepareTestExecution(ctx: any): Promise<void> {
    const categories = ctx.selectedCategories || this.config.categories || []
    const selectedFiles = this.testFiles.filter(file =>
      categories.includes(file.category),
    )

    if (selectedFiles.length === 0) {
      throw new Error('No test files match the selected categories')
    }

    ctx.selectedFiles = selectedFiles
    ctx.runtime = ctx.selectedRuntime || this.config.runtime || detectRuntime()

    this.logger.info('Test execution prepared', {
      filesCount: selectedFiles.length,
      runtime: ctx.runtime,
      categories: categories.join(', '),
    })
  }

  /**
   * Execute tests with execa
   */
  private async executeTests(ctx: any): Promise<void> {
    const timer = this.logger.timer('test-execution')
    const selectedFiles = ctx.selectedFiles
    const runtime = ctx.runtime

    // Prepare environment variables
    const env: Record<string, string> = {
      ...process.env,
      ...this.config.env,
      TEST_RUNNER: 'go-corp-test-suite',
      TEST_RUNTIME: runtime,
      TEST_CATEGORIES: ctx.selectedCategories?.join(',') || '',
    }

    if (this.config.verbose) {
      env.VERBOSE = 'true'
    }

    // Build vitest command
    const vitestArgs = [
      'vitest',
      this.config.watch ? '--watch' : 'run',
      ...selectedFiles.map((f: TestFile) => relative(process.cwd(), f.path)),
    ]

    if (this.config.reporter && this.config.reporter !== 'default') {
      vitestArgs.push('--reporter', this.config.reporter)
    }

    if (this.config.coverage) {
      vitestArgs.push('--coverage')
    }

    if (this.config.bail) {
      vitestArgs.push('--bail')
    }

    if (this.config.timeout) {
      vitestArgs.push('--testTimeout', this.config.timeout.toString())
    }

    if (this.config.maxWorkers) {
      vitestArgs.push('--threads', this.config.maxWorkers.toString())
    }

    this.logger.info('Executing tests', {
      command: `npx ${vitestArgs.join(' ')}`,
      filesCount: selectedFiles.length,
    })

    try {
      const result = await execa('npx', vitestArgs, {
        stdio: this.config.silent ? 'pipe' : 'inherit',
        env,
        cwd: process.cwd(),
        timeout: (this.config.timeout || 30000) * selectedFiles.length,
      })

      timer()

      ctx.testResults = this.parseTestResults(result)
      ctx.duration = Date.now() - ctx.startTime

      this.logger.trackTelemetry('tests_executed', {
        filesCount: selectedFiles.length,
        success: result.exitCode === 0,
        duration: ctx.duration,
      })
    }
    catch (error: any) {
      timer()

      // Parse test results even from failed execution
      ctx.testResults = this.parseTestResults(error)
      ctx.duration = Date.now() - ctx.startTime

      if (error.exitCode !== 0) {
        this.logger.warn('Tests completed with failures', {
          exitCode: error.exitCode,
          filesCount: selectedFiles.length,
        })
      }
      else {
        throw error
      }
    }
  }

  /**
   * Parse test results from execa output
   */
  private parseTestResults(result: any): any {
    // Basic parsing - could be enhanced with actual vitest JSON reporter
    return {
      totalTests: 0,
      passed: result.exitCode === 0 ? 1 : 0,
      failed: result.exitCode === 0 ? 0 : 1,
      exitCode: result.exitCode,
    }
  }

  /**
   * Send notifications about test results
   */
  private async sendNotifications(testResults: any): Promise<void> {
    const config = this.config.notifications
    if (!config?.enabled)
      return

    const message = testResults.failed > 0
      ? `❌ Tests failed: ${testResults.failed} failed, ${testResults.passed} passed`
      : `✅ All tests passed: ${testResults.passed} tests`

    // Slack notification
    if (config.slack?.webhook) {
      try {
        await fetch(config.slack.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: message,
            channel: config.slack.channel,
          }),
        })
        this.logger.debug('Slack notification sent')
      }
      catch (error) {
        this.logger.warn('Failed to send Slack notification', { error })
      }
    }

    // Email notification would go here
    if (config.email) {
      this.logger.debug('Email notifications not yet implemented')
    }
  }

  /**
   * Get emoji for category
   */
  private getCategoryEmoji(category: string): string {
    const emojiMap: Record<string, string> = {
      unit: '🔧',
      integration: '🔗',
      e2e: '🌐',
      api: '📡',
      auth: '🔐',
      database: '💾',
      performance: '⚡',
      smoke: '🔥',
      regression: '🔄',
      functional: '⚙️',
      other: '📝',
    }

    return emojiMap[category] || '📝'
  }
}

// Run the test runner if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new TestRunner()
  runner.run().catch((error) => {
    console.error(chalk.red('❌ Fatal error:'), error.message)
    if (process.env.DEBUG) {
      console.error(error.stack)
    }
    process.exit(ExitCode.GENERAL_ERROR)
  })
}

export default TestRunner
