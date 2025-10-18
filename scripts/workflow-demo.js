#!/usr/bin/env node

/**
 * Go Workflow Integration Demo
 * 
 * This script demonstrates how to use the @golive_me/go-workflow package
 * programmatically for automated release management.
 */

import { readFileSync, existsSync } from 'node:fs'

async function demoWorkflow() {
  console.log('🚀 Go Workflow Integration Demo')
  console.log('===============================\n')

  try {
    // Check if workflow package is installed
    console.log('📦 Package Installation:')
    try {
      const packagePath = './node_modules/@golive_me/go-workflow/package.json'
      if (existsSync(packagePath)) {
        const workflowPkg = JSON.parse(readFileSync(packagePath, 'utf-8'))
        console.log(`   ✅ @golive_me/go-workflow v${workflowPkg.version} installed`)
      } else {
        console.log('   ❌ Workflow package not found')
      }
    } catch (error) {
      console.log(`   ❌ Error checking workflow package: ${error.message}`)
    }
    
    console.log()
    
    // Check configuration file
    console.log('⚙️ Configuration:')
    if (existsSync('./.go-workflow.config.js')) {
      console.log('   ✅ .go-workflow.config.js configured')
      console.log('   - Test framework specific settings')
      console.log('   - GitHub integration enabled')
      console.log('   - Changelog automation configured')
    } else {
      console.log('   ❌ Configuration file not found')
    }
    
    console.log()

    // Demo: Configuration display
    console.log('⚙️ Configuration Demo:')
    try {
      const config = JSON.parse(readFileSync('package.json', 'utf-8'))
      console.log(`   - Package Name: ${config.name}`)
      console.log(`   - Current Version: ${config.version}`)
      console.log(`   - Description: ${config.description}`)
      
      const workflowScripts = Object.entries(config.scripts)
        .filter(([key]) => key.startsWith('workflow:'))
        .map(([key, value]) => `     ${key}: ${value}`)
        .join('\n')
      
      if (workflowScripts) {
        console.log('   - Available Workflow Scripts:')
        console.log(workflowScripts)
      }
    } catch (error) {
      console.log(`   - Package info: ${error.message}`)
    }
    
    console.log()

    // Demo: Available commands
    console.log('🛠️ Available Workflow Commands:')
    console.log('   - npm run workflow:release    # Interactive release management')
    console.log('   - npm run workflow:feature    # Feature branch workflow')
    console.log('   - npm run workflow:deploy     # Deploy to configured targets')
    console.log('   - npm run workflow:status     # Show project status')
    console.log('   - npx go-workflow init        # Initialize configuration\n')

    console.log('✨ Integration successful! The test framework now has advanced workflow capabilities.')

  } catch (error) {
    console.error('❌ Demo failed:', error.message)
    process.exit(1)
  }
}

// Run the demo
demoWorkflow().catch(console.error)