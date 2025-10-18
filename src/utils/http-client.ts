import type {
  HonoApp,
  HttpClientOptions,
  TestRequestOptions,
  TestResponse,
} from '../types.js'

// Re-export types for direct import
export type { HttpClientOptions, TestRequestOptions, TestResponse } from '../types.js'

/**
 * Enhanced HTTP test client with session management and advanced features
 */
export class HttpTestClient {
  private app: HonoApp
  private options: HttpClientOptions
  private cookieJars = new Map<string, string>()
  private requestHistory: Array<{ request: TestRequestOptions, response: TestResponse, timestamp: Date }> = []
  private defaultTimeout = 5000

  constructor(app: HonoApp, options: HttpClientOptions = {}) {
    this.app = app
    this.options = {
      baseUrl: '',
      defaultHeaders: {},
      timeout: 5000,
      retries: 0,
      cookieJar: 'default',
      ...options,
    }
  }

  /**
   * Make app request with environment detection
   */
  private async makeAppRequest(path: string, init: RequestInit): Promise<Response> {
    try {
      // Try Cloudflare Workers test environment
      // @ts-ignore - Dynamic import may not be available
      const { env } = await import('cloudflare:test')
      return await this.app.request(path, init, env)
    }
    catch {
      // Fallback to standard Hono request
      return await this.app.request(path, init)
    }
  }

  /**
   * Build full URL
   */
  private buildUrl(path: string): string {
    if (path.startsWith('http')) {
      return path
    }

    const baseUrl = this.options.baseUrl || ''
    if (baseUrl && !path.startsWith('/')) {
      path = `/${path}`
    }

    return baseUrl + path
  }

  /**
   * Prepare request headers with cookies and defaults
   */
  private prepareHeaders(options: TestRequestOptions): Headers {
    const headers = new Headers()

    // Add default headers
    Object.entries(this.options.defaultHeaders || {}).forEach(([key, value]) => {
      headers.set(key, value)
    })

    // Add request-specific headers
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers.set(key, value)
        })
      }
      else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers.set(key, value)
        })
      }
      else {
        Object.entries(options.headers).forEach(([key, value]) => {
          headers.set(key, value)
        })
      }
    }

    // Add cookies from jar
    const cookieJar = options.cookieJar || this.options.cookieJar || 'default'
    const existingCookies = this.cookieJars.get(cookieJar)
    if (existingCookies && !headers.has('cookie')) {
      headers.set('cookie', existingCookies)
    }

    return headers
  }

  /**
   * Handle response and extract cookies
   */
  private handleResponse(response: Response, cookieJar: string, startTime: number, requestOptions: TestRequestOptions): TestResponse {
    // Extract and store cookies
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      this.cookieJars.set(cookieJar, setCookie)
    }

    const responseTime = Date.now() - startTime

    // Create enhanced response
    const enhancedResponse = response as TestResponse
    enhancedResponse.responseTime = responseTime
    enhancedResponse.request = requestOptions

    return enhancedResponse
  }

  /**
   * Make request with retries and timeout
   */
  async request(path: string, options: TestRequestOptions = {}): Promise<TestResponse> {
    const fullUrl = this.buildUrl(path)
    const timeout = options.timeout || this.options.timeout || this.defaultTimeout
    const retries = options.retries ?? this.options.retries ?? 0
    const cookieJar = options.cookieJar || this.options.cookieJar || 'default'

    const headers = this.prepareHeaders(options)

    const requestInit: RequestInit = {
      ...options,
      headers: Object.fromEntries(headers.entries()),
    }

    let lastError: Error | null = null

    // Attempt request with retries
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const startTime = Date.now()

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)
        })

        // Make request with timeout
        const response = await Promise.race([
          this.makeAppRequest(fullUrl, requestInit),
          timeoutPromise,
        ])

        const enhancedResponse = this.handleResponse(response, cookieJar, startTime, options)

        // Validate status if expectedStatus provided
        if (options.expectedStatus !== undefined) {
          const expected = Array.isArray(options.expectedStatus)
            ? options.expectedStatus
            : [options.expectedStatus]

          if (!expected.includes(response.status)) {
            const body = await response.text()
            throw new Error(`Expected status ${expected.join(' or ')}, got ${response.status}: ${body}`)
          }
        }

        // Add to history
        this.requestHistory.push({
          request: options,
          response: enhancedResponse,
          timestamp: new Date(),
        })

        return enhancedResponse
      }
      catch (error) {
        lastError = error as Error

        // Don't retry on expected status errors
        if (error instanceof Error && error.message.includes('Expected status')) {
          break
        }

        // Don't retry on last attempt
        if (attempt === retries) {
          break
        }

        // Wait before retry (exponential backoff)
        const delay = 2 ** attempt * 100
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError || new Error('Request failed')
  }

  /**
   * Convenience method for GET requests
   */
  async get(path: string, options: Omit<TestRequestOptions, 'method'> = {}): Promise<TestResponse> {
    return this.request(path, { ...options, method: 'GET' })
  }

  /**
   * Convenience method for POST requests
   */
  async post(path: string, options: Omit<TestRequestOptions, 'method'> = {}): Promise<TestResponse> {
    return this.request(path, { ...options, method: 'POST' })
  }

  /**
   * Convenience method for PUT requests
   */
  async put(path: string, options: Omit<TestRequestOptions, 'method'> = {}): Promise<TestResponse> {
    return this.request(path, { ...options, method: 'PUT' })
  }

  /**
   * Convenience method for DELETE requests
   */
  async delete(path: string, options: Omit<TestRequestOptions, 'method'> = {}): Promise<TestResponse> {
    return this.request(path, { ...options, method: 'DELETE' })
  }

  /**
   * Convenience method for PATCH requests
   */
  async patch(path: string, options: Omit<TestRequestOptions, 'method'> = {}): Promise<TestResponse> {
    return this.request(path, { ...options, method: 'PATCH' })
  }

  /**
   * POST request with JSON body
   */
  async postJSON<_T = any>(path: string, body: any, options: Omit<TestRequestOptions, 'method' | 'body' | 'headers'> & { headers?: Record<string, string> } = {}): Promise<TestResponse> {
    return this.post(path, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(body),
    })
  }

  /**
   * PUT request with JSON body
   */
  async putJSON<_T = any>(path: string, body: any, options: Omit<TestRequestOptions, 'method' | 'body' | 'headers'> & { headers?: Record<string, string> } = {}): Promise<TestResponse> {
    return this.put(path, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(body),
    })
  }

  /**
   * GET request with automatic JSON parsing
   */
  async getJSON<T = any>(path: string, options: Omit<TestRequestOptions, 'method'> = {}): Promise<{ response: TestResponse, json: T }> {
    const response = await this.get(path, options)
    const json = await response.json<T>()
    return { response, json }
  }

  /**
   * Request with automatic JSON parsing
   */
  async requestJSON<T = any>(path: string, options: TestRequestOptions = {}): Promise<{ response: TestResponse, json: T }> {
    const response = await this.request(path, options)
    const json = await response.json<T>()
    return { response, json }
  }

  /**
   * Clear cookies for specific jar or all jars
   */
  clearCookies(jarKey?: string): void {
    if (jarKey) {
      this.cookieJars.delete(jarKey)
    }
    else {
      this.cookieJars.clear()
    }
  }

  /**
   * Get cookies for specific jar
   */
  getCookies(jarKey: string = 'default'): string | undefined {
    return this.cookieJars.get(jarKey)
  }

  /**
   * Set cookies for specific jar
   */
  setCookies(jarKey: string, cookies: string): void {
    this.cookieJars.set(jarKey, cookies)
  }

  /**
   * Get request history
   */
  getHistory(): Array<{ request: TestRequestOptions, response: TestResponse, timestamp: Date }> {
    return [...this.requestHistory]
  }

  /**
   * Clear request history
   */
  clearHistory(): void {
    this.requestHistory.length = 0
  }

  /**
   * Get last request
   */
  getLastRequest(): { request: TestRequestOptions, response: TestResponse, timestamp: Date } | undefined {
    return this.requestHistory[this.requestHistory.length - 1]
  }

  /**
   * Create session context
   */
  session(jarKey?: string): HttpTestClient {
    const sessionKey = jarKey || `session-${Date.now()}-${Math.random()}`
    return new HttpTestClient(this.app, {
      ...this.options,
      cookieJar: sessionKey,
    })
  }

  /**
   * Set default headers
   */
  setDefaultHeaders(headers: Record<string, string>): void {
    this.options.defaultHeaders = { ...this.options.defaultHeaders, ...headers }
  }

  /**
   * Set base URL
   */
  setBaseUrl(baseUrl: string): void {
    this.options.baseUrl = baseUrl
  }

  /**
   * Set timeout
   */
  setTimeout(timeout: number): void {
    this.options.timeout = timeout
  }

  /**
   * Set retry count
   */
  setRetries(retries: number): void {
    this.options.retries = retries
  }
}

/**
 * Create HTTP test client for Hono app
 */
export function createHttpTestClient(app: HonoApp, options?: HttpClientOptions): HttpTestClient {
  return new HttpTestClient(app, options)
}
