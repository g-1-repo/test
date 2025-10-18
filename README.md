# @go-corp/test-framework

🧪 **The Ultimate Hybrid Test Framework for Modern Web Applications**

A comprehensive, multi-runtime test framework designed for Cloudflare Workers, Node.js, and Bun applications with Hono, featuring smart data factories, automatic database management, and interactive test running.

## 🎯 What We've Built

### 🏗️ Hybrid Test Framework (@go-corp/test-framework)
•  **Multi-Runtime Support**: Works seamlessly with Cloudflare Workers, Node.js, and Bun  
•  **Environment-Agnostic**: Adapters for D1, SQLite, in-memory, and Drizzle databases  
•  **NPM Ready**: Complete package structure for publishing and reuse across projects  

### ✨ Key Features

1. **Interactive Test Runner** 🎮 - CLI with selectable test categories and runtime detection
2. **Smart Data Factory** 🏭 - Seeded random generation for consistent, realistic test data
3. **Test Store Management** 🗄️ - Automatic cleanup and state isolation
4. **HTTP Test Client** 🌐 - Full-featured API testing with session management
5. **Vitest Integration** ⚡ - Built-in helpers for automatic test isolation
6. **Database Adapters** 💾 - Support for multiple database providers with automatic detection
7. **Environment Detection** 🔍 - Automatic runtime and capability detection

### 💡 Hybrid Approach Benefits

•  **Fast Unit Tests**: Memory database for rapid development  
•  **Integration Tests**: SQLite for realistic database interactions  
•  **E2E Tests**: Full Cloudflare Workers environment for production-like testing  
•  **Flexible Runtime Detection**: Automatically adapts to your environment

## Installation

```bash
bun add --dev @go-corp/test-framework
```

## Quick Start

### Basic Setup

```typescript
// test/setup.ts
import { setupCloudflareWorkerTests } from '@go-corp/test-framework'

// Sets up console mocking and required environment variables
setupCloudflareWorkerTests()
```

### Simple Request Testing

```typescript
import { requestWithCookies, postJSON } from '@go-corp/test-framework'
import app from '../src/app'

test('user authentication flow', async () => {
  // All requests automatically persist cookies
  const { json: user } = await postJSON(app, '/api/auth/sign-in', {
    body: { email: 'test@example.com', password: 'password' }
  })
  
  // Session cookie is automatically included in subsequent requests
  const { json: profile } = await requestJSON(app, '/api/profile', {
    method: 'GET'
  }, { expected: 200 })
  
  expect(profile.email).toBe('test@example.com')
})
```

## Core Testing Utilities

### Request Helpers

#### `requestWithCookies(app, path, init?, jarKey?)`

Makes a request with automatic cookie persistence across test requests.

```typescript
import { requestWithCookies, resetCookies } from '@go-corp/test-framework'

// Start with clean session
resetCookies()

// Login request sets session cookie
const loginRes = await requestWithCookies(app, '/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'test', password: 'pass' })
})

// Subsequent requests automatically include session cookie
const profileRes = await requestWithCookies(app, '/api/profile')
```

#### `requestJSON(app, path, init, options?)`

Request helper that automatically parses JSON and validates status codes.

```typescript
// Expect 200 status (default)
const { res, json } = await requestJSON(app, '/api/users', {
  method: 'GET'
})

// Expect specific status
const { json: error } = await requestJSON(app, '/api/invalid', {
  method: 'GET'
}, { expected: 404 })

// Accept multiple status codes
const { json } = await requestJSON(app, '/api/endpoint', {
  method: 'POST',
  body: JSON.stringify(data)
}, { expected: [200, 201] })
```

#### `postJSON(app, path, options?)`

Convenience wrapper for POST requests with JSON body.

```typescript
// Simple POST
const { json } = await postJSON(app, '/api/users', {
  body: { name: 'John', email: 'john@example.com' }
})

// With status validation
const { json } = await postJSON(app, '/api/users', {
  body: { name: 'John' },
  expected: 201
})
```

### Session Management

#### Multiple Test Sessions

Use different `jarKey` values to isolate test sessions:

```typescript
import { requestWithCookies, resetCookies } from '@go-corp/test-framework'

test('concurrent user sessions', async () => {
  // User A login
  await postJSON(app, '/api/auth/login', {
    body: { username: 'userA' },
    jarKey: 'sessionA'
  })
  
  // User B login  
  await postJSON(app, '/api/auth/login', {
    body: { username: 'userB' },
    jarKey: 'sessionB'
  })
  
  // Each user sees their own profile
  const { json: profileA } = await requestJSON(app, '/api/profile', {}, {
    jarKey: 'sessionA'
  })
  const { json: profileB } = await requestJSON(app, '/api/profile', {}, {
    jarKey: 'sessionB'
  })
  
  expect(profileA.username).toBe('userA')
  expect(profileB.username).toBe('userB')
})
```

#### Test Context

Create isolated test contexts with automatic cleanup:

```typescript
import { createTestContext } from '@go-corp/test-framework'

test('isolated test context', async () => {
  const ctx = createTestContext()
  
  // All requests use isolated cookie jar
  await ctx.postJSON(app, '/api/auth/login', {
    body: { username: 'test' }
  })
  
  const { json } = await ctx.requestJSON(app, '/api/profile', {})
  expect(json.username).toBe('test')
  
  // Clean up (optional, happens automatically)
  ctx.reset()
})
```

## Email Testing

Test email functionality with built-in assertion helpers.

### Basic Email Testing

```typescript
import { 
  clearOutbox, 
  assertEmailSent, 
  extractVerificationLink 
} from '@go-corp/test-framework'

test('password reset flow', async () => {
  await clearOutbox(app)
  
  // Trigger password reset
  await postJSON(app, '/api/auth/reset-password', {
    body: { email: 'user@example.com' }
  })
  
  // Assert email was sent
  const email = await assertEmailSent(app, 'user@example.com')
  expect(email.subject).toContain('Password Reset')
  
  // Extract and use verification link
  const resetLink = extractVerificationLink(email)
  expect(resetLink).toBeTruthy()
  
  // Test the verification link
  const { json } = await requestJSON(app, resetLink!)
  expect(json.message).toBe('Reset link verified')
})
```

### Advanced Email Testing

```typescript
import { 
  getOutbox,
  getLastEmail,
  waitForEmail,
  extractOTPCode
} from '@go-corp/test-framework'

test('email verification with OTP', async () => {
  await clearOutbox(app)
  
  // Trigger account creation
  await postJSON(app, '/api/auth/register', {
    body: { email: 'new@example.com' }
  })
  
  // Wait for email (useful for async operations)
  const email = await waitForEmail(app, 'new@example.com', 3000)
  
  // Extract OTP code
  const otpCode = extractOTPCode(email)
  expect(otpCode).toBeTruthy()
  
  // Verify with OTP
  const { json } = await postJSON(app, '/api/auth/verify-otp', {
    body: { email: 'new@example.com', code: otpCode }
  })
  
  expect(json.verified).toBe(true)
})
```

## Test Environment Setup

### Basic Setup

```typescript
import { setupCloudflareWorkerTests } from '@go-corp/test-framework'

// Automatic setup with sensible defaults
setupCloudflareWorkerTests()
```

### Custom Setup

```typescript
import { setupTestEnvironment } from '@go-corp/test-framework'

setupTestEnvironment({
  mockConsole: true,
  consoleMethods: ['log', 'info', 'debug'],
  env: {
    API_KEY: 'test-key',
    DATABASE_URL: 'test-db'
  },
  cleanup: [
    () => {
      // Custom cleanup logic
    }
  ]
})
```

### Environment Variables

```typescript
import { ensureTestEnv, withTestEnv } from '@go-corp/test-framework'

// Ensure variables exist with defaults
ensureTestEnv({
  RESEND_API_KEY: 'test-key',
  NODE_ENV: 'test'
})

// Run test with specific environment
const testWithEnv = withTestEnv({
  FEATURE_FLAG: 'enabled'
}, async () => {
  // Test logic here
  const { json } = await requestJSON(app, '/api/feature')
  expect(json.enabled).toBe(true)
})

await testWithEnv()
```

### Time Mocking

```typescript
import { createTimeMock } from '@go-corp/test-framework'

test('time-sensitive operations', async () => {
  const mockTime = createTimeMock(new Date('2024-01-01'))
  mockTime.start()
  
  // Create token that expires in 1 hour
  const { json: token } = await postJSON(app, '/api/auth/token')
  
  // Advance time by 2 hours
  mockTime.advance(2 * 60 * 60 * 1000)
  
  // Token should now be expired
  const { json } = await requestJSON(app, '/api/auth/verify', {
    headers: { authorization: \`Bearer \${token.access_token}\` }
  }, { expected: 401 })
  
  expect(json.error).toBe('Token expired')
  
  mockTime.restore()
})
```

## Utility Functions

### Unique Data Generation

```typescript
import { uniqueEmail, uniqueUsername } from '@go-corp/test-framework'

test('user creation', async () => {
  const email = uniqueEmail() // test+1@example.com
  const username = uniqueUsername() // user1
  
  await postJSON(app, '/api/users', {
    body: { email, username }
  })
})
```

### Wait Utility

```typescript
import { wait } from '@go-corp/test-framework'

test('async operations', async () => {
  // Trigger async operation
  await postJSON(app, '/api/process')
  
  // Wait for processing
  await wait(1000)
  
  // Check result
  const { json } = await requestJSON(app, '/api/status')
  expect(json.status).toBe('completed')
})
```

## API Reference

### Core Functions

- `requestWithCookies(app, path, init?, jarKey?)` - Make request with cookie persistence
- `requestJSON(app, path, init, options?)` - Request with JSON parsing and status validation
- `postJSON(app, path, options?)` - POST request convenience wrapper
- `resetCookies(jarKey?)` - Clear cookies for jar key or all jars
- `createTestContext(jarKey?)` - Create isolated test context

### Email Functions

- `getOutbox(app, jarKey?)` - Get all emails from test outbox
- `clearOutbox(app, jarKey?)` - Clear test email outbox
- `getLastEmail(app, recipient, jarKey?)` - Get most recent email to recipient
- `waitForEmail(app, recipient, timeout?, jarKey?)` - Wait for email to be sent
- `assertEmailSent(app, recipient, jarKey?)` - Assert email was sent
- `extractVerificationLink(email)` - Extract verification URL from email
- `extractOTPCode(email)` - Extract OTP code from email

### Setup Functions

- `setupCloudflareWorkerTests()` - Default setup for Cloudflare Workers
- `setupTestEnvironment(options?)` - Custom test environment setup
- `ensureTestEnv(vars)` - Ensure environment variables exist
- `withTestEnv(env, fn)` - Run function with specific environment

### Utility Functions

- `uniqueEmail(prefix?)` - Generate unique email address
- `uniqueUsername(prefix?)` - Generate unique username
- `wait(ms)` - Wait for specified milliseconds
- `createTimeMock(date?)` - Create time mock for testing

## TypeScript Support

The package includes comprehensive TypeScript definitions:

```typescript
import type { 
  TestRequestOptions,
  TestResponse,
  TestEmail,
  TestSetupOptions 
} from '@go-corp/test-framework'
```

## 🚀 Release Workflow

We've implemented a sophisticated release workflow inspired by the @go-corp/utils package:

### Interactive Release Script

```bash
# Start interactive release process
bun run release

# See help for options
bun run release:help
```

The release script will:
1. 🔍 **Analyze Git History** - Automatically detect changes and recommend version bump
2. 📝 **Smart Changelog** - Generate changelog entries from commit messages
3. 🎯 **Version Selection** - Choose patch/minor/major with recommendations
4. 🏗️ **Build & Test** - Ensure package builds and passes type checking
5. 📤 **Git Operations** - Commit, tag, and push changes automatically
6. 📦 **NPM Publishing** - Optionally publish to npm with confirmation

### Changesets Workflow

Alternatively, use changesets for more structured releases:

```bash
# Add a changeset (describes your changes)
bun run changeset

# Preview version updates
bun run changeset:status

# Apply version updates
bun run changeset:version

# Publish to npm
bun run changeset:publish
```

### CI/CD Pipeline

Automatic releases are triggered by git tags:

1. **Push tag**: `git tag v1.1.0 && git push --tags`
2. **GitHub Actions**: Automatically builds, tests, and publishes
3. **NPM Release**: Package appears on npm registry
4. **GitHub Release**: Creates release notes automatically

### Manual Publishing

```bash
# Build and publish manually
bun run publish:public
```

### 🌟 Enhanced Workflow with go-workflow

We've integrated [@golive_me/go-workflow](https://www.npmjs.com/package/@golive_me/go-workflow) for advanced release automation:

```bash
# Interactive release with GitHub integration
npm run workflow:release

# Feature branch workflow with PR automation  
npm run workflow:feature

# View project and workflow status
npm run workflow:status

# Deploy to configured targets (if any)
npm run workflow:deploy
```

**Key Benefits:**
- 🤖 **Automated PR Creation** - Feature branches automatically create GitHub PRs
- 📝 **Smart Changelog Generation** - Parses conventional commits for automated changelog entries
- 🏷️ **GitHub Releases** - Automatically creates GitHub releases with detailed notes
- 🚀 **Multi-target Deployment** - Deploy to multiple environments with confirmation prompts
- ⚙️ **Flexible Configuration** - Customizable workflow via `.go-workflow.config.js`

**Configuration** is handled via `.go-workflow.config.js` with sensible defaults for this test framework project.

## 🛠️ Development

```bash
# Install dependencies
bun install

# Build for development
bun run dev

# Type check
bun run typecheck

# Lint code
bun run lint
bun run lint:fix

# Test the CLI
bun run test-runner --help
```

## License

MIT
