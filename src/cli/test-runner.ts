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
        case '-c': {
          // For CLI, categories are provided as comma-separated strings
          // This will override any record-based categories from config
          const categoryList = nextArg?.split(',') || []
          config.categories = categoryList as any // Type assertion needed for CLI override
          i++
          break
        }
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
      this.logger.warn('No test files found in current directory')
      this.logger.info('This is normal for library projects - test files will be discovered from consuming projects')
      // Don't exit with error - this is not necessarily a failure condition
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
   * Interactive test mode selection
   */
  private async selectTestMode(): Promise<{ mode: string, options: Partial<TestRunnerConfig> }> {
    // If specific flags are provided, don't show mode selection
    if (this.config.watch || this.config.coverage || this.config.silent || this.config.bail) {
      return {
        mode: 'direct',
        options: {},
      }
    }

    // Check TTY for prompt compatibility
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      this.logger.warn('Non-TTY environment detected, using quick mode')
      return {
        mode: 'quick',
        options: { coverage: false, watch: false, silent: false, bail: false },
      }
    }

    // Clear any existing output and ensure clean terminal state
    console.log('\n🎯 Test Mode Selection')
    console.log('───────────────────────')

    const prompt = new Select({
      name: 'testMode',
      message: 'Select test mode:',
      choices: [
        {
          name: 'Quick Tests (default)',
          value: 'quick',
          description: 'Run all tests without coverage',
        },
        {
          name: 'Coverage Report',
          value: 'coverage',
          description: 'Run tests with full coverage reporting',
        },
        {
          name: 'Watch Mode',
          value: 'watch',
          description: 'Run tests in watch mode for active development',
        },
        {
          name: 'CI Mode',
          value: 'ci',
          description: 'Silent mode with bail on first failure',
        },
        {
          name: 'Custom Options',
          value: 'custom',
          description: 'Select specific categories and options',
        },
      ],
      initial: 0,
      // Ensure proper terminal handling
      format: (value: any) => value,
      validate: (value: any) => value ? true : 'Please select an option',
    })

    let selectedMode: string
    try {
      // Ensure terminal is in proper state for prompts
      process.stdout.write('\x1B[?25h') // Show cursor
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay

      selectedMode = await prompt.run()

      // Clear any residual prompt output
      console.log()
    }
    catch (error) {
      // Fallback if prompt fails
      this.logger.warn('Prompt failed, using quick mode', { error: error instanceof Error ? error.message : error })
      selectedMode = 'quick'
    }

    // Map display text back to value if needed
    const displayToValue: Record<string, string> = {
      'Quick Tests (default)': 'quick',
      'Coverage Report': 'coverage',
      'Watch Mode': 'watch',
      'CI Mode': 'ci',
      'Custom Options': 'custom',
    }

    const modeValue = displayToValue[selectedMode] || selectedMode

    const modeConfigs = {
      quick: {
        coverage: false,
        watch: false,
        silent: false,
        bail: false,
      },
      coverage: {
        coverage: true,
        watch: false,
        silent: false,
        bail: false,
      },
      watch: {
        coverage: false,
        watch: true,
        silent: false,
        bail: false,
      },
      ci: {
        coverage: false,
        watch: false,
        silent: true,
        bail: true,
      },
      custom: {}, // Will be handled by existing interactive flows
      direct: {}, // CLI flags already set
    }

    return {
      mode: modeValue,
      options: modeConfigs[modeValue as keyof typeof modeConfigs] || {},
    }
  }

  /**
   * Interactive category selection
   */
  private async selectCategories(): Promise<string[]> {
    // If categories are provided as CLI args, use them
    if (Array.isArray(this.config.categories)) {
      return this.config.categories
    }

    // Load config to get category patterns
    let configCategories: string[] = []
    try {
      const { config: fileConfig } = await configLoader.load()
      if (fileConfig.categories && typeof fileConfig.categories === 'object' && !Array.isArray(fileConfig.categories)) {
        configCategories = Object.keys(fileConfig.categories)
      }
    }
    catch (error) {
      this.logger.debug('Could not load config for category selection', { error })
    }

    // For Custom Options mode, if we have configured categories, use them directly
    // This avoids prompt issues while still giving users control
    if (configCategories.length > 0) {
      console.log('\n📂 Category Selection')
      console.log('─────────────────────')
      console.log('Using configured categories from test-suite.config.js:')
      configCategories.forEach((cat) => {
        console.log(`  ${this.getCategoryEmoji(cat)} ${cat}`)
      })
      console.log()

      this.logger.info(`Running configured categories: ${configCategories.join(', ')}`)
      return configCategories
    }

    // TTY check for interactive prompts
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      this.logger.warn('Non-TTY environment, running all categories')
      return ['all']
    }

    // Fallback to interactive selection from discovered categories
    const categoryChoices = Array.from(this.categories.entries()).map(([name, category]) => ({
      name: `${this.getCategoryEmoji(name)} ${name} (${category.count} files)`,
      value: name,
    }))

    if (categoryChoices.length === 0) {
      this.logger.warn('No categories found, running all tests')
      return ['all']
    }

    // Clear terminal and add space before prompt
    console.log('\n📂 Category Selection')
    console.log('─────────────────────')

    const prompt = new MultiSelect({
      name: 'categories',
      message: 'Select test categories to run:',
      choices: [
        { name: '🎯 All categories', value: 'all' },
        ...categoryChoices,
      ],
      initial: ['all'],
      // Ensure proper terminal handling
      validate: (value: any[]) => value.length > 0 ? true : 'Please select at least one category',
    })

    let selected: string[]
    try {
      // Ensure terminal is in proper state for prompts
      process.stdout.write('\x1B[?25h') // Show cursor
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay

      selected = await prompt.run()

      // Clear any residual prompt output
      console.log()
    }
    catch (error) {
      // Fallback if prompt fails
      this.logger.warn('Category selection failed, using all categories', { error: error instanceof Error ? error.message : error })
      selected = ['all']
    }

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

    // TTY check for interactive prompts
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      this.logger.info(`Non-TTY environment, using detected runtime: ${detectedRuntime}`)
      return detectedRuntime
    }

    // Clear terminal and add space before prompt
    console.log('\n⚙️  Runtime Selection')
    console.log('─────────────────────')

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
      // Ensure proper terminal handling
      validate: (value: any) => value ? true : 'Please select a runtime',
    })

    try {
      // Ensure terminal is in proper state for prompts
      process.stdout.write('\x1B[?25h') // Show cursor
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay

      const result = await prompt.run()

      // Clear any residual prompt output
      console.log()
      return result
    }
    catch (error) {
      // Fallback if prompt fails
      this.logger.warn('Runtime selection failed, using detected runtime', {
        error: error instanceof Error ? error.message : error,
        detectedRuntime,
      })
      return detectedRuntime
    }
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
      // Pre-select test mode BEFORE Listr2 tasks to avoid rendering conflicts
      const { mode, options } = await this.selectTestMode()

      // Pre-discover tests for category selection
      await this.discoverTests()

      // Pre-select categories and runtime if needed (outside of Listr2)
      let selectedCategories: string[] = []
      let selectedRuntime: string = this.config.runtime || ''

      if (mode === 'custom') {
        selectedCategories = await this.selectCategories()
        selectedRuntime = await this.selectRuntime()
      }
      else {
        // Use config or auto-detect for non-custom modes
        const hasCliCategories = Array.isArray(this.config.categories)
        const hasConfigCategories = this.config.categories && typeof this.config.categories === 'object' && !Array.isArray(this.config.categories)

        if (hasCliCategories) {
          selectedCategories = this.config.categories as string[]
        }
        else if (hasConfigCategories) {
          selectedCategories = Object.keys(this.config.categories!)
        }
        else {
          selectedCategories = ['all']
        }

        selectedRuntime = this.config.runtime || detectRuntime()
      }

      const initialContext: any = {
        testMode: mode,
        modeOptions: options,
        selectedCategories,
        selectedRuntime,
        testFiles: this.testFiles,
        categories: Array.from(this.categories.entries()),
      }

      this.logger.info('Pre-flight selections completed', {
        mode,
        categories: selectedCategories,
        runtime: selectedRuntime,
      })

      // Use simple renderer for maximum prompt compatibility
      // Simple renderer is specifically designed to work with interactive prompts
      const listrOptions: any = {
        concurrent: false,
        exitOnError: true,
        // Force simple renderer - it's the most compatible with prompts
        renderer: 'simple',
        rendererOptions: {
          // Minimal options for simple renderer
          showSubtasks: false,
        },
      }

      this.logger.debug('Listr2 configuration', {
        renderer: listrOptions.renderer,
        isInteractive: process.stdin.isTTY && process.stdout.isTTY,
        options: listrOptions,
      })

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
          title: 'Preparing test execution',
          task: ctx => this.prepareTestExecution(ctx),
        },
        {
          title: 'Running tests',
          task: ctx => this.executeTests(ctx),
        },
      ], listrOptions)

      const ctx = await tasks.run(initialContext)

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

    // Detect package information
    const packageInfo = await configLoader.detectPackage()
    ctx.packageInfo = packageInfo

    this.logger.info('Package detected', {
      name: packageInfo.name || 'unknown',
      type: packageInfo.type || 'unknown',
      hasTestScript: !!packageInfo.testScript,
    })

    // Load config file asynchronously
    try {
      const { config: fileConfig, filepath } = await configLoader.load()

      if (!fileConfig || Object.keys(fileConfig).length === 0) {
        this.logger.debug('No configuration file found, using defaults and CLI args')
        // Auto-configure based on package type
        let finalConfig = mergeConfig(this.config, this.getPackageDefaults(packageInfo))
        // Apply mode options to ensure they're preserved
        if (ctx.modeOptions) {
          finalConfig = mergeConfig(finalConfig, ctx.modeOptions)
        }
        this.config = finalConfig
      }
      else {
        this.logger.debug('Loaded configuration from file', { filepath })

        // Merge: defaults < package defaults < file config < CLI args < mode options
        const cliConfig = this.parseCLIArgs()
        let finalConfig = mergeConfig(
          mergeConfig(
            mergeConfig(
              mergeConfig(getDefaultConfig(), this.getPackageDefaults(packageInfo)),
              fileConfig,
            ),
            cliConfig,
          ),
          {}, // no overrides at this stage
        )
        // Apply mode options last to ensure they take highest precedence
        if (ctx.modeOptions) {
          finalConfig = mergeConfig(finalConfig, ctx.modeOptions)
        }
        this.config = finalConfig
      }
    }
    catch (error) {
      this.logger.warn('Failed to load configuration file', { error: error instanceof Error ? error.message : error })
    }

    // Re-apply mode options after config loading to ensure they take precedence
    if (ctx.modeOptions) {
      this.config = mergeConfig(this.config, ctx.modeOptions)
      this.logger.debug('Re-applied mode options after config loading', { modeOptions: ctx.modeOptions })
    }

    this.logger.debug('Runtime configuration loaded', {
      config: {
        runtime: this.config.runtime,
        database: this.config.database,
        parallel: this.config.parallel,
        maxWorkers: this.config.maxWorkers,
        timeout: this.config.timeout,
        coverage: this.config.coverage,
        watch: this.config.watch,
        silent: this.config.silent,
        bail: this.config.bail,
      },
    })
  }

  /**
   * Prepare test execution
   */
  private async prepareTestExecution(ctx: any): Promise<void> {
    const selectedCategories = ctx.selectedCategories || []
    let selectedFiles: TestFile[] = []

    // Apply mode-specific configuration overrides to ensure they stick
    if (ctx.modeOptions) {
      this.config = mergeConfig(this.config, ctx.modeOptions)
      this.logger.debug('Applied mode options', { modeOptions: ctx.modeOptions })
    }

    // If we have category patterns defined in config, use them
    if (this.config.categories && typeof this.config.categories === 'object' && !Array.isArray(this.config.categories)) {
      const { glob } = await import('glob')

      for (const categoryName of selectedCategories) {
        if (categoryName === 'all') {
          // Run all categories
          for (const [, pattern] of Object.entries(this.config.categories)) {
            const matchedFiles = await glob(pattern, { cwd: process.cwd() })
            selectedFiles.push(...matchedFiles.map(path => ({
              name: path.split('/').pop() || path,
              path,
              category: categoryName,
              size: 0,
              lastModified: new Date(),
            })))
          }
          break
        }
        else if (this.config.categories[categoryName]) {
          // Use specific category pattern
          const pattern = this.config.categories[categoryName]
          const matchedFiles = await glob(pattern, { cwd: process.cwd() })
          selectedFiles.push(...matchedFiles.map(path => ({
            name: path.split('/').pop() || path,
            path,
            category: categoryName,
            size: 0,
            lastModified: new Date(),
          })))
        }
      }
    }
    else {
      // Use discovered test files by category
      selectedFiles = this.testFiles.filter(file =>
        selectedCategories.includes('all') || selectedCategories.includes(file.category),
      )
    }

    // Remove duplicates by path
    const uniqueFiles = selectedFiles.filter((file, index, self) =>
      index === self.findIndex(f => f.path === file.path),
    )

    if (uniqueFiles.length === 0) {
      this.logger.warn('No test files found matching selected categories', {
        categories: selectedCategories,
        searchedDirectory: process.cwd(),
      })
      this.logger.info('Skipping test execution - no test files to run')

      // Set empty results but don't fail
      ctx.selectedFiles = []
      ctx.runtime = ctx.selectedRuntime || this.config.runtime || detectRuntime()
      ctx.testResults = {
        totalTests: 0,
        passed: 0,
        failed: 0,
        exitCode: 0,
      }

      return // Skip test execution
    }

    ctx.selectedFiles = uniqueFiles
    ctx.runtime = ctx.selectedRuntime || this.config.runtime || detectRuntime()

    this.logger.info('Test execution prepared', {
      filesCount: uniqueFiles.length,
      runtime: ctx.runtime,
      categories: selectedCategories.join(', '),
      config: {
        coverage: this.config.coverage,
        watch: this.config.watch,
        silent: this.config.silent,
        bail: this.config.bail,
      },
    })
  }

  /**
   * Execute tests with execa
   */
  private async executeTests(ctx: any): Promise<void> {
    const timer = this.logger.timer('test-execution')
    const selectedFiles = ctx.selectedFiles
    const runtime = ctx.runtime

    // If no files to test, skip execution
    if (!selectedFiles || selectedFiles.length === 0) {
      this.logger.info('No test files to execute, skipping test run')
      timer()
      ctx.testResults = {
        totalTests: 0,
        passed: 0,
        failed: 0,
        exitCode: 0,
      }
      ctx.duration = Date.now() - ctx.startTime
      return
    }

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
      vitestArgs.push('--bail', '1') // Vitest expects a number
    }

    if (this.config.timeout) {
      vitestArgs.push('--testTimeout', this.config.timeout.toString())
    }

    if (this.config.maxWorkers) {
      vitestArgs.push('--pool-options.threads.maxThreads', this.config.maxWorkers.toString())
    }

    this.logger.info('Executing tests', {
      command: `npx ${vitestArgs.join(' ')}`,
      filesCount: selectedFiles.length,
      config: {
        coverage: this.config.coverage,
        watch: this.config.watch,
        silent: this.config.silent,
        bail: this.config.bail,
        reporter: this.config.reporter,
      },
      vitestArgs,
    })

    // Show watch mode instructions
    if (this.config.watch) {
      console.log('')
      console.log('Running tests in watch mode...')
      console.log('Press q to quit, or Ctrl+C to exit')
      console.log('')
    }

    try {
      const execaOptions: any = {
        stdio: this.config.silent ? 'pipe' : 'inherit',
        env,
        cwd: process.cwd(),
        timeout: this.config.watch ? 0 : (this.config.timeout || 30000) * selectedFiles.length, // No timeout for watch mode
        reject: false, // Don't throw on non-zero exit codes
      }

      // For watch mode, ensure proper terminal control
      if (this.config.watch) {
        execaOptions.stdio = 'inherit'
        execaOptions.detached = false
        // Forward signals to vitest
        const child = execa('npx', vitestArgs, execaOptions)

        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
          console.log('\nShutting down watch mode...')
          child.kill('SIGINT')
          process.exit(0)
        })

        const result = await child

        timer()
        ctx.testResults = this.parseTestResults(result)
        ctx.duration = Date.now() - ctx.startTime
        return
      }

      const result = await execa('npx', vitestArgs, execaOptions)

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
    const exitCode = result.exitCode || 0
    const success = exitCode === 0

    // Basic parsing - could be enhanced with actual vitest JSON reporter
    return {
      totalTests: 1, // Placeholder - should parse from output
      passed: success ? 1 : 0,
      failed: success ? 0 : 1,
      exitCode,
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
   * Get package-specific default configuration
   */
  private getPackageDefaults(packageInfo: { name?: string, type?: string }): Partial<TestRunnerConfig> {
    const defaults: Partial<TestRunnerConfig> = {}

    // Set package metadata
    if (packageInfo.name) {
      defaults.packageName = packageInfo.name
    }
    if (packageInfo.type) {
      defaults.packageType = packageInfo.type as any
    }

    // API-specific defaults
    if (packageInfo.type === 'api') {
      defaults.runtime = 'bun' // Prefer bun for API packages
      defaults.database = 'drizzle-d1'
      defaults.categories = {
        auth: 'test/auth*.test.ts',
        api: 'test/*routes*.test.ts',
        health: 'test/health*.test.ts',
        permissions: 'test/permissions*.test.ts',
        email: 'test/email*.test.ts',
        database: 'test/*repository*.test.ts',
      }
      defaults.setupFiles = ['test/setup.ts']
    }

    // Library-specific defaults
    if (packageInfo.type === 'library') {
      defaults.runtime = 'node'
      defaults.categories = {
        unit: 'test/unit/*.test.ts',
        integration: 'test/integration/*.test.ts',
      }
    }

    return defaults
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
      health: '💚',
      permissions: '🔒',
      email: '📧',
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
