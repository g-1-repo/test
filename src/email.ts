import type { Hono } from 'hono'
import { requestWithCookies } from './core.js'

export interface TestEmail {
  to: string[]
  from: string
  subject: string
  html?: string
  text?: string
  [key: string]: any
}

/**
 * Get all emails from the test outbox
 */
export async function getOutbox<T extends Hono<any>>(
  app: T,
  jarKey = 'default'
): Promise<TestEmail[]> {
  const res = await requestWithCookies(app, '/__test__/emails', { method: 'GET' }, jarKey)
  
  if (res.status !== 200) {
    throw new Error(`Failed to get outbox: ${res.status}`)
  }
  
  return await res.json<TestEmail[]>()
}

/**
 * Clear all emails from the test outbox
 */
export async function clearOutbox<T extends Hono<any>>(
  app: T,
  jarKey = 'default'
): Promise<void> {
  await requestWithCookies(app, '/__test__/emails/clear', { method: 'POST' }, jarKey)
}

/**
 * Get the last email sent to a specific recipient
 */
export async function getLastEmail<T extends Hono<any>>(
  app: T,
  recipient: string,
  jarKey = 'default'
): Promise<TestEmail | null> {
  const emails = await getOutbox(app, jarKey)
  
  // Find the most recent email to the recipient
  for (let i = emails.length - 1; i >= 0; i--) {
    const email = emails[i]
    if (email.to.includes(recipient)) {
      return email
    }
  }
  
  return null
}

/**
 * Get all emails sent to a specific recipient
 */
export async function getEmailsFor<T extends Hono<any>>(
  app: T,
  recipient: string,
  jarKey = 'default'
): Promise<TestEmail[]> {
  const emails = await getOutbox(app, jarKey)
  return emails.filter(email => email.to.includes(recipient))
}

/**
 * Wait for an email to be sent to a specific recipient
 * Useful for testing async email operations
 */
export async function waitForEmail<T extends Hono<any>>(
  app: T,
  recipient: string,
  timeoutMs = 5000,
  jarKey = 'default'
): Promise<TestEmail> {
  const startTime = Date.now()
  let lastEmailCount = 0
  
  while (Date.now() - startTime < timeoutMs) {
    const emails = await getOutbox(app, jarKey)
    const recipientEmails = emails.filter(email => email.to.includes(recipient))
    
    // If we have more emails than before, return the newest one
    if (recipientEmails.length > lastEmailCount) {
      return recipientEmails[recipientEmails.length - 1]
    }
    
    lastEmailCount = recipientEmails.length
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  throw new Error(`Timeout waiting for email to ${recipient} after ${timeoutMs}ms`)
}

/**
 * Assert that an email was sent to a specific recipient
 */
export async function assertEmailSent<T extends Hono<any>>(
  app: T,
  recipient: string,
  jarKey = 'default'
): Promise<TestEmail> {
  const email = await getLastEmail(app, recipient, jarKey)
  
  if (!email) {
    const allEmails = await getOutbox(app, jarKey)
    const recipients = allEmails.map(e => e.to).flat()
    throw new Error(`No email found for ${recipient}. Found emails for: ${recipients.join(', ')}`)
  }
  
  return email
}

/**
 * Assert that no email was sent to a specific recipient
 */
export async function assertNoEmailSent<T extends Hono<any>>(
  app: T,
  recipient: string,
  jarKey = 'default'
): Promise<void> {
  const emails = await getEmailsFor(app, recipient, jarKey)
  
  if (emails.length > 0) {
    throw new Error(`Expected no emails for ${recipient}, but found ${emails.length} email(s)`)
  }
}

/**
 * Extract verification links from email content
 * Useful for testing email verification flows
 */
export function extractVerificationLink(email: TestEmail): string | null {
  const content = email.html || email.text || ''
  
  // Look for common verification link patterns
  const patterns = [
    /https?:\/\/[^\s]+\/verify[^\s]*token[=\/][^\s&]+/i,
    /https?:\/\/[^\s]+\/auth\/verify[^\s]*/i,
    /https?:\/\/[^\s]+\?.*token=[^\s&]+/i
  ]
  
  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) {
      return match[0]
    }
  }
  
  return null
}

/**
 * Extract OTP codes from email content
 */
export function extractOTPCode(email: TestEmail): string | null {
  const content = email.html || email.text || ''
  
  // Look for common OTP patterns (4-8 digit codes)
  const patterns = [
    /\b(\d{4,8})\b/g,
    /code[:\s]*(\d{4,8})/i,
    /otp[:\s]*(\d{4,8})/i
  ]
  
  for (const pattern of patterns) {
    const matches = Array.from(content.matchAll(pattern))
    if (matches.length > 0) {
      // Return the first numeric match
      for (const match of matches) {
        const code = match[1] || match[0]
        if (/^\d+$/.test(code)) {
          return code
        }
      }
    }
  }
  
  return null
}