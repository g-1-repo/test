# @g-1/test

[![CI](https://github.com/g-1-repo/test/actions/workflows/ci.yml/badge.svg)](https://github.com/g-1-repo/test/actions/workflows/ci.yml)

[![CI](https://github.com/g-1-repo/test/actions/workflows/ci.yml/badge.svg)](https://github.com/g-1-repo/test/actions/workflows/ci.yml)

🧪 **Complete Testing Suite for Hono Applications**

A comprehensive testing toolkit for Hono applications across Cloudflare Workers, Node.js, and Bun runtimes. Features HTTP test utilities, smart data factories, database adapters, and environment management - everything you need to test modern web applications.

## 🎯 What We've Built

### 🛠️ Complete Testing Suite (@g-1/test)
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
bun add --dev @g-1/test
```

## Quick Start

### Basic Setup

```typescript
// test/setup.ts
import { setupCloudflareWorkerTests } from '@g-1/test'

// Sets up console mocking and required environment variables
setupCloudflareWorkerTests()
```

### Simple Request Testing

```typescript
import { requestWithCookies, postJSON } from '@g-1/test
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

### Modern API Usage

```typescript
// Modern setup with enhanced features
import { 
  setupTestFramework, 
  TestDataFactory,
  createHttpTestClient,
  dbTest,
  factoryTest 
} from '@g-1/test'
import app from '../src/app'

// Configure test framework
setupTestFramework({
  app,
  database: 'sqlite',
  isolation: 'test',
  autoCleanup: true
})

// Database test with automatic cleanup
dbTest('user creation with database', async (db) => {
  const factory = new TestDataFactory()
  const userData = factory.user()
  
  // Insert user into database
  await db.insert(users).values(userData)
  
  // Test API endpoint
  const client = createHttpTestClient(app)
  const { response, json } = await client.getJSON(`/api/users/${userData.id}`)
  
  expect(response.status).toBe(200)
  expect(json.email).toBe(userData.email)
})

// Factory test with seeded data
factoryTest('consistent test data', async (factory) => {
  const user1 = factory.user()
  const user2 = factory.user()
  
  // Same seed produces consistent data across test runs
  expect(user1.id).toBeDefined()
  expect(user2.id).toBeDefined()
  expect(user1.id).not.toBe(user2.id)
}, 12345) // Custom seed
```

## 🔧 Configuration

The test runner supports enterprise-level configuration through multiple formats:

### Configuration Files

The test runner automatically searches for configuration in:
- `.gotestsuiterc` (JSON)
- `.gotestsuiterc.json`
- `.gotestsuiterc.yaml` or `.gotestsuiterc.yml`
- `.gotestsuiterc.js`, `.gotestsuiterc.mjs`, `.gotestsuiterc.cjs`
- `gotestsuite.config.js`, `gotestsuite.config.mjs`, `gotestsuite.config.cjs`
- `package.json` under the `"gotestsuite"` key

### Example Configuration

```json
{
  "runtime": "node",
  "database": "sqlite",
  "categories": ["unit", "integration"],
  "parallel": true,
  "maxWorkers": 4,
  "timeout": 30000,
  "reporter": "default",
  "coverage": false,
  "telemetry": {
    "enabled": false
  },
  "notifications": {
    "enabled": false,
    "slack": {
      "webhook": "https://hooks.slack.com/services/...",
      "channel": "#test-results"
    }
  }
}
```

### Enterprise Features

#### Telemetry
Track test runner usage and performance metrics:

```json
{
  "telemetry": {
    "enabled": true,
    "endpoint": "https://api.yourcompany.com/telemetry",
    "apiKey": "your-api-key"
  }
}
```

#### Notifications
Get notified when tests complete:

```json
{
  "notifications": {
    "enabled": true,
    "slack": {
      "webhook": "https://hooks.slack.com/services/...",
      "channel": "#test-results"
    },
    "email": {
      "smtp": "smtp.yourcompany.com",
      "from": "tests@yourcompany.com",
      "to": ["dev-team@yourcompany.com"]
    }
  }
}
```

### CLI Options

All configuration options can be overridden via CLI flags:

```bash
# Runtime and database
bun run test-runner --runtime node --database sqlite

# Test selection
bun run test-runner --categories unit,integration --reporter verbose

# Execution control
bun run test-runner --parallel --max-workers 8 --timeout 60000

# Output control
bun run test-runner --verbose --coverage --bail

# Watch mode for development
bun run test-runner --watch --categories unit
```

### Environment Variables

Set environment variables for test execution:

```json
{
  "env": {
    "NODE_ENV": "test",
    "DEBUG": "app:*",
    "DATABASE_URL": "test.db"
  },
  "envFile": ".env.test"
}
```

## Core Testing Utilities

### Request Helpers

#### `requestWithCookies(app, path, init?, jarKey?)`

Makes a request with automatic cookie persistence across test requests.

```typescript
import { requestWithCookies, resetCookies } from '@g-1/test'

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
import { requestWithCookies, resetCookies } from '@g-1/test'

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
import { createTestContext } from '@g-1/test'

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
} from '@g-1/test'

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
} from '@g-1/test'

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
import { setupCloudflareWorkerTests } from '@g-1/test'

// Automatic setup with sensible defaults
setupCloudflareWorkerTests()
```

### Custom Setup

```typescript
import { setupTestEnvironment } from '@g-1/test'

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
import { ensureTestEnv, withTestEnv } from '@g-1/test'

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
import { createTimeMock } from '@g-1/test'

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
import { uniqueEmail, uniqueUsername } from '@g-1/test'

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
import { wait } from '@g-1/test'

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

### Modern API (Recommended)

#### Database Adapters
- `createDatabaseAdapter(type, config?)` - Create database adapter for tests
- `MemoryDatabaseAdapter`, `SqliteDatabaseAdapter`, `D1DatabaseAdapter` - Database implementations
- `DrizzleSqliteAdapter`, `DrizzleD1Adapter` - Drizzle ORM integrations

#### Test Data Factory
- `TestDataFactory` - Seeded data generation for consistent tests
- `factory.user()`, `factory.organization()`, `factory.post()` - Built-in generators
- `createSeededFactory(seed)` - Factory with custom seed

#### Enhanced HTTP Client
- `HttpTestClient` - Full-featured test client with retries and cookies
- `createHttpTestClient(app, options)` - Create HTTP client instance

#### Vitest Integration
- `setupTestFramework(config)` - Configure test environment
- `testSuite(name, fn, config)` - Enhanced test suite with setup
- `testWithContext(name, fn)` - Test with isolated context
- `dbTest(name, fn)` - Database test with cleanup
- `httpTest(name, fn)` - HTTP test with session isolation
- `factoryTest(name, fn, seed?)` - Test with seeded data factory

### Legacy API (Compatibility)

#### Core Functions
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

The package includes comprehensive TypeScript definitions for all APIs:

```typescript
// Core types
import type { 
  Runtime,
  DatabaseProvider,
  TestEnvironmentConfig,
  HonoApp
} from '@g-1/test'

// HTTP testing types
import type {
  TestRequestOptions,
  TestResponse,
  HttpClientOptions
} from '@g-1/test'

// Email testing types
import type {
  TestEmail,
  TestSetupOptions
} from '@g-1/test'

// Factory types
import type {
  FactoryConfig,
  FactoryFunction,
  TestDataGenerators
} from '@g-1/test'

// Store and lifecycle types
import type {
  TestStore,
  IsolationLevel,
  VitestConfig,
  TestSuiteConfig,
  TestRunnerConfig
} from '@go-corp/test-suite'

// Database adapter type
import type {
  DatabaseAdapter
} from '@g-1/test'
```

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

## 🚀 Release Management

This project uses [@go-corp/workflow](https://www.npmjs.com/package/@go-corp/workflow) for automated release management:

```bash
# Interactive release (quality gates, git, npm)
bun run release

# Dry run (show what would happen)
bun run release --dry-run

# Skip specific deployments
bun run release --skip-npm --skip-cloudflare

# Force specific version bump
bun run release --type minor

# Check workflow status
bun run workflow:status
```

**Release Pipeline:**
- ✅ **Quality Gates**: Auto-fix linting, type checking, tests
- 🏷️ **Version Management**: Smart semantic versioning with changelog
- 📦 **Build & Publish**: Automated npm publishing with confirmation
- 🔗 **GitHub Integration**: Automated releases and tagging

## License

MIT
