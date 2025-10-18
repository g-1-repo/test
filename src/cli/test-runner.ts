#!/usr/bin/env node

import { readdir, stat } from 'fs/promises'
import { join, extname, relative } from 'path'
import { spawn } from 'child_process'
// @ts-ignore - enquirer doesn't have proper types
import { Select, MultiSelect } from 'enquirer'
import type { Runtime, DatabaseProvider, TestRunnerConfig } from '../types.js'
import { detectRuntime, getEnvironmentInfo } from '../utils/environment.js'

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
 * Interactive test runner for @go-corp/test-framework
 */
class TestRunner {
  private testFiles: TestFile[] = []
  private categories: Map<string, TestCategory> = new Map()
  private config: TestRunnerConfig = {}

  constructor() {
    this.loadConfig()
  }

  /**
   * Load configuration from command line arguments
   */
  private loadConfig(): void {
    const args = process.argv.slice(2)
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      
      switch (arg) {
        case '--runtime':
          this.config.runtime = args[++i] as Runtime
          break
        case '--database':
          this.config.database = args[++i] as DatabaseProvider
          break
        case '--verbose':
        case '-v':
          this.config.verbose = true
          break
        case '--watch':
        case '-w':
          this.config.watch = true
          break
        case '--help':
        case '-h':
          this.showHelp()
          process.exit(0)
        case '--categories':
        case '-c':
          this.config.categories = args[++i].split(',')
          break
        default:
          if (arg.startsWith('--')) {
            console.warn(`Unknown option: ${arg}`)
          }
          break
      }
    }
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    console.log(`
@go-corp/test-framework Interactive Test Runner

Usage:
  test-runner [options]

Options:
  --runtime <runtime>      Runtime to use (cloudflare-workers, node, bun)
  --database <provider>    Database provider (memory, sqlite, d1, drizzle-sqlite, drizzle-d1)
  --categories, -c <cats>  Comma-separated list of categories to run
  --verbose, -v           Enable verbose output
  --watch, -w             Run in watch mode
  --help, -h              Show this help message

Examples:
  test-runner --runtime node --database sqlite
  test-runner -c unit,integration -v
  test-runner --watch
    `)
  }

  /**
   * Discover test files in the current directory
   */
  async discoverTests(dir: string = process.cwd()): Promise<void> {
    console.log('🔍 Discovering test files...')
    
    await this.scanDirectory(dir)
    this.categorizeTests()
    
    if (this.testFiles.length === 0) {
      console.log('❌ No test files found')
      process.exit(1)
    }
    
    console.log(`✅ Found ${this.testFiles.length} test files in ${this.categories.size} categories`)
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
        } else if (this.isTestFile(entry)) {
          this.testFiles.push({
            name: entry,
            path: fullPath,
            category: this.categorizeFile(entry, fullPath),
            size: stats.size,
            lastModified: stats.mtime
          })
        }
      }
    } catch (error) {
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
      /spec\.(js|ts|jsx|tsx)$/
    ]
    
    return (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx') &&
           testPatterns.some(pattern => pattern.test(filename))
  }

  /**
   * Categorize a test file based on its path and name
   */
  private categorizeFile(filename: string, fullPath: string): string {
    const relativePath = relative(process.cwd(), fullPath).toLowerCase()
    
    // Category detection rules
    if (relativePath.includes('unit') || filename.includes('unit')) return 'unit'
    if (relativePath.includes('integration') || filename.includes('integration')) return 'integration'
    if (relativePath.includes('e2e') || filename.includes('e2e')) return 'e2e'
    if (relativePath.includes('api') || filename.includes('api')) return 'api'
    if (relativePath.includes('auth') || filename.includes('auth')) return 'auth'
    if (relativePath.includes('database') || filename.includes('db')) return 'database'
    if (relativePath.includes('performance') || filename.includes('perf')) return 'performance'
    if (relativePath.includes('smoke')) return 'smoke'
    if (relativePath.includes('regression')) return 'regression'
    
    // Default categorization
    if (relativePath.includes('test')) return 'functional'
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
          count: 0
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
      value: name
    }))
    
    const prompt = new MultiSelect({
      name: 'categories',
      message: 'Select test categories to run:',
      choices: [
        { name: 'All categories', value: 'all' },
        ...categoryChoices
      ],
      initial: ['all']
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
        { name: 'bun', value: 'bun' }
      ].filter((choice, index, arr) => 
        index === 0 || !arr.slice(0, index).some(c => c.value === choice.value)
      ),
      initial: 0
    })
    
    return await prompt.run()
  }

  /**
   * Run selected tests
   */
  private async runTests(categories: string[], runtime: Runtime): Promise<void> {
    const selectedFiles = this.testFiles.filter(file => 
      categories.includes(file.category)
    )
    
    if (selectedFiles.length === 0) {
      console.log('❌ No test files found for selected categories')
      return
    }
    
    console.log(`\\n🚀 Running ${selectedFiles.length} test files...`)
    console.log(`   Runtime: ${runtime}`)
    console.log(`   Categories: ${categories.join(', ')}`)
    console.log(`   Watch mode: ${this.config.watch ? 'enabled' : 'disabled'}`)
    
    // Prepare environment variables
    const env: Record<string, string> = {
      ...process.env,
      TEST_RUNNER: 'go-corp-test-framework',
      TEST_RUNTIME: runtime,
      TEST_CATEGORIES: categories.join(',')
    }
    
    if (this.config.verbose) {
      env.VERBOSE = 'true'
    }
    
    // Run tests using vitest
    const vitestArgs = [
      'vitest',
      this.config.watch ? '--watch' : 'run',
      ...selectedFiles.map(f => relative(process.cwd(), f.path))
    ]
    
    if (this.config.verbose) {
      vitestArgs.push('--reporter=verbose')
    }
    
    const child = spawn('npx', vitestArgs, {
      stdio: 'inherit',
      env,
      cwd: process.cwd()
    })
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log('\\n✅ All tests passed!')
      } else {
        console.log(`\\n❌ Tests failed with exit code ${code}`)
        process.exit(code)
      }
    })
    
    child.on('error', (error) => {
      console.error('❌ Failed to run tests:', error)
      process.exit(1)
    })
  }

  /**
   * Run the interactive test runner
   */
  async run(): Promise<void> {
    console.log('🧪 @go-corp/test-framework Interactive Test Runner\\n')
    
    // Show environment information
    this.showEnvironmentInfo()
    
    // Discover test files
    await this.discoverTests()
    
    // Show categories summary
    console.log('\\n📂 Test Categories:')
    for (const [name, category] of this.categories) {
      const emoji = this.getCategoryEmoji(name)
      console.log(`   ${emoji} ${name}: ${category.count} files`)
    }
    
    try {
      // Interactive selection
      const selectedCategories = await this.selectCategories()
      const selectedRuntime = await this.selectRuntime()
      
      // Run tests
      await this.runTests(selectedCategories, selectedRuntime)
      
    } catch (error) {
      if (error instanceof Error && error.message === 'cancelled') {
        console.log('\\n👋 Test runner cancelled')
        process.exit(0)
      } else {
        console.error('❌ Error:', error)
        process.exit(1)
      }
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
      other: '📝'
    }
    
    return emojiMap[category] || '📝'
  }
}

// Run the test runner if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new TestRunner()
  runner.run().catch(console.error)
}

export { TestRunner }
export default TestRunner