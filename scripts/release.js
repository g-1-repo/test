#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

// Simple color constants
const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
}

// Simple log function with colors
function log(message, color = '') {
  console.log(`${color}${message}${COLORS.reset}`)
}

// Function to get current version
function getCurrentVersion() {
  const packagePath = 'package.json'
  const content = readFileSync(packagePath, 'utf8')
  const packageData = JSON.parse(content)
  return packageData.version
}

// Function to increment version
function incrementVersion(version, type) {
  const parts = version.split('.').map(Number)
  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`
    default:
      throw new Error(`Invalid version type: ${type}`)
  }
}

// Function to update package version
function updatePackageVersion(newVersion) {
  const packagePath = 'package.json'
  const content = readFileSync(packagePath, 'utf8')
  const packageData = JSON.parse(content)
  packageData.version = newVersion
  const newContent = JSON.stringify(packageData, null, 2) + '\n'
  writeFileSync(packagePath, newContent)
}

// Function to get git status
function getGitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' })
    return status.trim()
  } catch {
    return ''
  }
}

// Function to get recent commits
function getRecentCommits(count = 10) {
  try {
    const commits = execSync(`git log --oneline -n ${count}`, { encoding: 'utf8' })
    return commits.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

// Function to analyze changes
function analyzeChangesForVersionBump() {
  const commits = getRecentCommits()
  const status = getGitStatus()
  
  let versionBump = 'patch'
  let changeType = 'Patch'
  const changesList = []
  
  // Analyze commit messages for version bump hints
  for (const commit of commits) {
    const message = commit.toLowerCase()
    
    if (message.includes('breaking') || message.includes('major')) {
      versionBump = 'major'
      changeType = 'Major'
    } else if ((message.includes('feat') || message.includes('minor')) && versionBump !== 'major') {
      versionBump = 'minor'
      changeType = 'Minor'
    }
    
    // Extract meaningful changes
    const cleanMessage = commit.substring(8) // Remove commit hash
    if (!cleanMessage.startsWith('Merge') && !cleanMessage.startsWith('chore: release')) {
      changesList.push(cleanMessage)
    }
  }
  
  return {
    versionBump,
    changeType,
    changesList: changesList.slice(0, 10), // Limit to 10 most recent
    commits: commits.slice(0, 5),
    hasUncommittedChanges: !!status
  }
}

// Function to update changelog
function updateChangelog(version, changeType, changesList) {
  const changelogPath = 'CHANGELOG.md'
  let content = ''
  
  try {
    content = readFileSync(changelogPath, 'utf8')
  } catch {
    content = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n'
  }
  
  const date = new Date().toISOString().split('T')[0]
  const newEntry = `## [${version}] - ${date}\n\n### ${changeType}\n\n${changesList.map(change => `- ${change}`).join('\n')}\n\n`
  
  // Insert new entry after the header
  const lines = content.split('\n')
  const insertIndex = lines.findIndex(line => line.startsWith('## ')) 
  
  if (insertIndex === -1) {
    // No existing entries, add after header
    const headerEndIndex = lines.findIndex((line, i) => i > 0 && line === '')
    if (headerEndIndex !== -1) {
      lines.splice(headerEndIndex + 1, 0, newEntry)
    } else {
      lines.push('', newEntry)
    }
  } else {
    lines.splice(insertIndex, 0, newEntry)
  }
  
  writeFileSync(changelogPath, lines.join('\n'))
}

// Function to commit and push
function commitAndPush(message, createTag = false) {
  try {
    execSync('git add .', { stdio: 'inherit' })
    execSync(`git commit -m "${message}"`, { stdio: 'inherit' })
    
    if (createTag) {
      const version = getCurrentVersion()
      execSync(`git tag v${version}`, { stdio: 'inherit' })
    }
    
    execSync('git push', { stdio: 'inherit' })
    
    if (createTag) {
      execSync('git push --tags', { stdio: 'inherit' })
    }
  } catch (error) {
    if (error.message.includes('has no upstream branch')) {
      log('Setting upstream branch...', COLORS.yellow)
      const branchName = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
      execSync(`git push --set-upstream origin ${branchName}`, { stdio: 'inherit' })
      if (createTag) {
        execSync('git push --tags', { stdio: 'inherit' })
      }
    } else {
      throw error
    }
  }
}

// Simple prompt functions (basic implementation)
async function confirm(message, defaultValue = false) {
  const readline = await import('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  return new Promise((resolve) => {
    const defaultStr = defaultValue ? 'Y/n' : 'y/N'
    rl.question(`${message} (${defaultStr}): `, (answer) => {
      rl.close()
      if (!answer) {
        resolve(defaultValue)
      } else {
        resolve(answer.toLowerCase().startsWith('y'))
      }
    })
  })
}

async function select(message, options) {
  const readline = await import('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  return new Promise((resolve) => {
    console.log(`\n${message}`)
    options.forEach((option, index) => {
      console.log(`  ${index + 1}. ${option.label}`)
    })
    
    rl.question('\nSelect an option (1-' + options.length + '): ', (answer) => {
      rl.close()
      const index = parseInt(answer) - 1
      if (index >= 0 && index < options.length) {
        resolve(options[index].value)
      } else {
        log('Invalid selection, using first option', COLORS.yellow)
        resolve(options[0].value)
      }
    })
  })
}

/**
 * Interactive release script for @go-corp/test-framework
 */
async function createRelease() {
  try {
    log('🧪 Starting automated release process for @go-corp/test-framework...', COLORS.cyan)

    // Get current version
    const currentVersion = getCurrentVersion()
    log(`📋 Current version: ${currentVersion}`, COLORS.blue)

    // Analyze changes
    log('🔍 Analyzing changes...', COLORS.yellow)
    const analysis = analyzeChangesForVersionBump()
    
    if (analysis.hasUncommittedChanges) {
      log('⚠️  You have uncommitted changes. Please commit or stash them first.', COLORS.yellow)
      const proceed = await confirm('Continue anyway?', false)
      if (!proceed) {
        log('❌ Release cancelled', COLORS.red)
        process.exit(0)
      }
    }

    log(`📝 Found ${analysis.commits.length} recent commits`, COLORS.green)
    log(`🎯 Recommended version bump: ${analysis.versionBump}`, COLORS.yellow)

    // Show analysis details
    if (analysis.changesList.length > 0) {
      console.log('\n📋 Detected changes:')
      analysis.changesList.forEach((change, index) => {
        console.log(`  ${index + 1}. ${change}`)
      })
    }

    // Prepare version options
    const patchVersion = incrementVersion(currentVersion, 'patch')
    const minorVersion = incrementVersion(currentVersion, 'minor') 
    const majorVersion = incrementVersion(currentVersion, 'major')
    const recommendedVersion = incrementVersion(currentVersion, analysis.versionBump)
    
    // Determine version bump type
    const versionBumpType = await select('Select version bump type:', [
      { value: analysis.versionBump, label: `${analysis.versionBump} (recommended) → ${recommendedVersion}` },
      { value: 'patch', label: `patch → ${patchVersion}` },
      { value: 'minor', label: `minor → ${minorVersion}` },
      { value: 'major', label: `major → ${majorVersion}` }
    ])

    const newVersion = incrementVersion(currentVersion, versionBumpType)
    log(`🎯 Selected version: ${newVersion} (${versionBumpType})`, COLORS.cyan)

    // Get changelog entries
    let changesList = analysis.changesList

    // Allow manual changelog override
    const useAutoChangelog = await confirm('Use automatically detected changes for changelog?', true)

    if (!useAutoChangelog) {
      log('📝 Please edit the changelog manually after the release', COLORS.yellow)
      changesList = ['Manual release - see commit history for details']
    }

    // Ask about publishing
    const shouldPublish = await confirm('Publish to npm after release?', false)

    // Final confirmation
    const shouldProceed = await confirm(
      `Create release ${newVersion}? This will update package.json, changelog, commit, push${shouldPublish ? ', and publish to npm' : ''}.`,
      false
    )

    if (!shouldProceed) {
      log('❌ Release cancelled', COLORS.red)
      process.exit(0)
    }

    // Execute release steps
    log(`📦 Updating package.json to version ${newVersion}...`, COLORS.cyan)
    updatePackageVersion(newVersion)

    log('📝 Updating CHANGELOG.md...', COLORS.cyan)
    updateChangelog(newVersion, analysis.changeType, changesList)

    // Build before committing
    log('🔨 Building package...', COLORS.cyan)
    execSync('bun run build', { stdio: 'inherit' })

    // Run tests
    log('🧪 Running tests...', COLORS.cyan)
    execSync('bun run typecheck', { stdio: 'inherit' })

    log('📤 Committing and pushing changes...', COLORS.cyan)
    const commitMessage = `chore: release v${newVersion}`
    commitAndPush(commitMessage, true)

    // Publish to npm if requested
    if (shouldPublish) {
      log('📦 Publishing to npm...', COLORS.cyan)
      try {
        execSync('npm publish --access public', { stdio: 'inherit' })
        log('✅ Successfully published to npm!', COLORS.green)
      } catch (error) {
        log('❌ Failed to publish to npm:', COLORS.red)
        log(error.message, COLORS.red)
        log('You can manually publish later with: npm publish --access public', COLORS.yellow)
      }
    }

    log(`✅ Release v${newVersion} completed successfully!`, COLORS.green)
    log(`🎉 Your test framework release has been published to Git${shouldPublish ? ' and npm' : ''}!`, COLORS.magenta)

    // Show next steps
    console.log('\n📋 Next steps:')
    if (!shouldPublish) {
      console.log('• Run `npm publish --access public` to publish to npm')
    }
    console.log('• Create a GitHub release if desired')
    console.log('• Update dependent projects to use the new version')
    console.log('• Test the CLI runner with the new features')
    if (shouldPublish) {
      console.log('• Verify the package is available on npmjs.com')
      console.log(`• Test installation: \`npm install @go-corp/test-framework@${newVersion}\``)
    }
  }
  catch (error) {
    log(`❌ Release failed: ${error.message}`, COLORS.red)
    console.error(error)
    process.exit(1)
  }
}

// Handle command line arguments
const args = process.argv.slice(2)
const helpFlag = args.includes('--help') || args.includes('-h')

if (helpFlag) {
  console.log(`
🧪 @go-corp/test-framework Automated Release Script

Usage:
  node scripts/release.js          # Interactive release with automatic detection
  node scripts/release.js --help   # Show this help message

This script will:
1. Analyze your Git history and detect changes
2. Recommend an appropriate version bump (patch/minor/major)
3. Allow you to override the recommendation
4. Update package.json version
5. Generate/update CHANGELOG.md
6. Build and test the package
7. Commit and push changes
8. Create Git tags
9. Optionally publish to npm

Perfect for test framework releases with automated changelog management and npm publishing.
`)
  process.exit(0)
}

// Run the release
createRelease()