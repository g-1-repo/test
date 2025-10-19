# Changelog

## [1.3.3] - 2025-10-19

### Bug Fixes

- remove bundle size check from test package workflow


## [1.3.2] - 2025-10-19

### Bug Fixes

- correct workflow script names to match package.json


## [1.3.1] - 2025-10-19

### Bug Fixes

- update lockfile after dependency change to @g-1/util


## [1.3.0] - 2025-10-19

### Features

- add NPM publish workflow and update package config (#4)

### Other Changes

- chore: commit changes before release
- docs: rebrand to G1 and update npm path to @g-1/test (#3)
- chore: add Dependabot and CI badge (#2)
- chore(ci): add GitHub Actions (CI and Release) and PR template; update repository URL (#1)


## [1.2.4] - 2025-10-18

### Other Changes

- chore: commit changes before release


## [1.2.3] - 2025-10-18

### Other Changes

- chore: commit changes before release
- chore: commit changes before release


## [1.2.2] - 2025-10-18

### Other Changes

- chore: commit changes before release


## [1.2.1] - 2025-10-18

### Other Changes

- chore: commit changes before release


## [1.2.0] - 2025-10-18

### Features

- integrate with consolidated go-utils package


## [1.1.0] - 2025-10-18

### Features

- rename package to @go-corp/test-suite


## [1.0.5] - 2025-10-18

### Other Changes

- chore: commit changes before release


## [1.0.4] - 2025-10-18

### Other Changes

- chore: commit changes before release


## [1.0.3] - 2025-10-18

### Other Changes

- chore: commit changes before release
- chore: commit changes before release
- chore: commit changes before release


## [Unreleased]

## [1.0.2] - 2025-10-18

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2024-10-18

### Fixed

- **Cloudflare Workers Compatibility**: Removed CLI test runner exports from main package entry point
  - Fixes "No such module 'node:child_process'" error in Cloudflare Workers environment
  - CLI functionality still available as separate entry point for Node.js/Bun environments
  - Ensures test framework works correctly in edge runtime environments

### Changed

- CLI `TestRunner` no longer exported from main package index to prevent Node.js dependency conflicts
- Improved package structure for better runtime environment compatibility

## [1.0.0] - 2024-10-17

### Added

- **Core Testing Utilities**
  - `requestWithCookies()` - Automatic cookie persistence across test requests
  - `requestJSON()` - Request helper with JSON parsing and status validation
  - `postJSON()` - Convenience wrapper for POST requests with JSON body
  - `resetCookies()` - Cookie jar management for test isolation
  - `createTestContext()` - Isolated test contexts with automatic cleanup

- **Email Testing Utilities**
  - `getOutbox()` - Retrieve all emails from test outbox
  - `clearOutbox()` - Clear test email outbox
  - `getLastEmail()` - Get most recent email to specific recipient
  - `waitForEmail()` - Wait for email delivery with timeout
  - `assertEmailSent()` - Assert email was sent to recipient
  - `extractVerificationLink()` - Extract verification URLs from emails
  - `extractOTPCode()` - Extract OTP codes from email content

- **Test Environment Setup**
  - `setupTestEnvironment()` - Configurable test environment setup
  - `setupCloudflareWorkerTests()` - Default setup for Cloudflare Workers
  - `ensureTestEnv()` - Ensure required environment variables exist
  - `withTestEnv()` - Run tests with specific environment variables
  - `MockTime` class - Time mocking for time-sensitive testing

- **Utility Functions**
  - `uniqueEmail()` - Generate unique email addresses for testing
  - `uniqueUsername()` - Generate unique usernames for testing
  - `wait()` - Promise-based delay utility

- **TypeScript Support**
  - Comprehensive type definitions for all utilities
  - Generic type support for request/response handling
  - Proper inference for Hono applications

### Features

- **Automatic Cookie Management**: Sessions persist across test requests automatically
- **Multi-Session Support**: Isolate multiple user sessions within single test
- **Email Flow Testing**: Complete email testing workflow with assertions
- **Cloudflare Workers Optimized**: Built specifically for edge runtime testing
- **Hono Integration**: Deep integration with Hono application patterns
- **Time Control**: Mock time for testing time-sensitive features
- **Environment Management**: Streamlined test environment configuration