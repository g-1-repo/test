import type { Hono } from 'hono'

/**
 * Helper to make app requests with environment-specific handling
 * Tries Cloudflare Workers env if available, falls back to standard
 */
async function makeAppRequest<T extends Hono<any>>(
  app: T,
  path: string, 
  init: RequestInit
): Promise<Response> {
  try {
    // Try to use Cloudflare Workers test environment
    // @ts-ignore - Dynamic import may not be available
    const { env } = await import('cloudflare:test')
    return await app.request(path, init, env)
  } catch {
    // Fallback to standard Hono request
    return await app.request(path, init)
  }
}

export interface TestRequestOptions extends RequestInit {
  /** Custom headers to include in the request */
  headers?: HeadersInit
}

export interface TestResponse extends Response {
  /** Parse response as JSON with type safety */
  json<T = any>(): Promise<T>
}

export interface RequestJSONOptions {
  /** Expected status code(s) for the request */
  expected?: number | number[]
  /** Cookie jar key for session management */
  jarKey?: string
}

export interface PostJSONOptions extends RequestJSONOptions {
  /** Request body to send */
  body?: any
}

/**
 * Simple cookie jar for tests to persist session across requests
 * Maps jar keys to cookie strings for isolated test sessions
 */
class CookieJar {
  private cookies = new Map<string, string>()

  /**
   * Get cookies for a specific jar key
   */
  get(jarKey: string): string | undefined {
    return this.cookies.get(jarKey)
  }

  /**
   * Set cookies for a specific jar key
   */
  set(jarKey: string, cookie: string): void {
    this.cookies.set(jarKey, cookie)
  }

  /**
   * Delete cookies for a specific jar key
   */
  delete(jarKey: string): void {
    this.cookies.delete(jarKey)
  }

  /**
   * Clear all cookies
   */
  clear(): void {
    this.cookies.clear()
  }

  /**
   * Get all active jar keys
   */
  getJarKeys(): string[] {
    return Array.from(this.cookies.keys())
  }
}

// Global cookie jar instance
const cookieJar = new CookieJar()

/**
 * Make a request with automatic cookie persistence
 * Automatically sends stored cookies and captures Set-Cookie headers
 */
export async function requestWithCookies<T extends Hono<any>>(
  app: T,
  path: string,
  init: TestRequestOptions = {},
  jarKey = 'default'
): Promise<TestResponse> {
  const headers = new Headers(init.headers as any)
  
  // Add stored cookies if they exist and no cookie header is set
  const storedCookie = cookieJar.get(jarKey)
  if (storedCookie && !headers.has('cookie')) {
    headers.set('cookie', storedCookie)
  }

  // Make the request with environment-specific handling
  const response = await makeAppRequest(app, path, {
    ...init,
    headers: Object.fromEntries(headers.entries())
  })

  // Capture Set-Cookie headers for future requests
  const setCookie = response.headers.get('set-cookie')
  if (setCookie) {
    cookieJar.set(jarKey, setCookie)
  }

  return response as TestResponse
}

/**
 * Make a request and automatically parse JSON response
 * Throws if the status code doesn't match expected values
 */
export async function requestJSON<T extends Hono<any>, R = any>(
  app: T,
  path: string,
  init: TestRequestOptions,
  options: RequestJSONOptions = {}
): Promise<{ res: TestResponse; json: R }> {
  const { expected = 200, jarKey = 'default' } = options
  
  const res = await requestWithCookies(app, path, init, jarKey)
  
  // Check if status matches expected value(s)
  const isExpectedStatus = Array.isArray(expected) 
    ? expected.includes(res.status) 
    : res.status === expected
    
  if (!isExpectedStatus) {
    const text = await res.text()
    throw new Error(`Request failed with status ${res.status}, expected ${Array.isArray(expected) ? expected.join(' or ') : expected}: ${text}`)
  }
  
  const json = await res.json<R>()
  return { res, json }
}

/**
 * Convenience wrapper for POST requests with JSON body
 */
export async function postJSON<T extends Hono<any>, R = any>(
  app: T,
  path: string,
  options: PostJSONOptions = {}
): Promise<{ res: TestResponse; json: R }> {
  const { body, expected = 200, jarKey = 'default' } = options
  
  return requestJSON<T, R>(app, path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {})
  }, { expected, jarKey })
}

/**
 * Reset cookies for a specific jar key or all cookies
 */
export function resetCookies(jarKey?: string): void {
  if (jarKey) {
    cookieJar.delete(jarKey)
  } else {
    cookieJar.clear()
  }
}

/**
 * Get all active cookie jar keys
 */
export function getCookieJarKeys(): string[] {
  return cookieJar.getJarKeys()
}

/**
 * Generate unique email addresses for testing
 */
let emailCounter = 0
export function uniqueEmail(prefix = 'test'): string {
  emailCounter += 1
  return `${prefix}+${emailCounter}@example.com`
}

/**
 * Generate unique usernames for testing
 */
let usernameCounter = 0
export function uniqueUsername(prefix = 'user'): string {
  usernameCounter += 1
  return `${prefix}${usernameCounter}`
}

/**
 * Wait for a specified amount of time (useful for testing time-sensitive features)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create a test context with isolated cookie jar
 */
export function createTestContext(jarKey?: string) {
  const contextJarKey = jarKey || `test-context-${Date.now()}-${Math.random()}`
  
  return {
    jarKey: contextJarKey,
    request: (app: Hono<any>, path: string, init?: TestRequestOptions) =>
      requestWithCookies(app, path, init, contextJarKey),
    requestJSON: <R = any>(app: Hono<any>, path: string, init: TestRequestOptions, options?: Omit<RequestJSONOptions, 'jarKey'>) =>
      requestJSON<typeof app, R>(app, path, init, { ...options, jarKey: contextJarKey }),
    postJSON: <R = any>(app: Hono<any>, path: string, options?: Omit<PostJSONOptions, 'jarKey'>) =>
      postJSON<typeof app, R>(app, path, { ...options, jarKey: contextJarKey }),
    reset: () => resetCookies(contextJarKey)
  }
}