import { faker } from '@faker-js/faker'
import type { FactoryConfig, FactoryFunction, TestDataGenerators } from './types.js'

// Re-export types for direct import
export type { FactoryConfig, FactoryFunction, TestDataGenerators } from './types.js'

/**
 * Test data factory with seeded random generation for consistent test data
 */
export class TestDataFactory {
  private seed: number
  private locale: string

  constructor(seed: number = 12345, locale: string = 'en') {
    this.seed = seed
    this.locale = locale
    this.initialize()
  }

  private initialize(): void {
    faker.seed(this.seed)
    // Note: faker locale setting is version-dependent
  }

  /**
   * Reset faker with new seed
   */
  setSeed(seed: number): void {
    this.seed = seed
    faker.seed(seed)
  }

  /**
   * Set faker locale (note: locale setting is version-dependent)
   */
  setLocale(locale: string): void {
    this.locale = locale
    // faker locale setting varies by version
  }

  /**
   * Create a factory function with optional configuration
   */
  private createFactory<T>(generator: (config?: FactoryConfig) => T): FactoryFunction<T> {
    return (config?: FactoryConfig) => {
      // Temporarily set seed/locale if provided
      const originalSeed = this.seed
      const originalLocale = this.locale

      if (config?.seed !== undefined) {
        faker.seed(config.seed)
      }
      if (config?.locale !== undefined) {
        // Store locale for reference (faker locale setting is version-dependent)
      }

      try {
        const result = generator(config)
        return result
      } finally {
        // Restore original settings
        if (config?.seed !== undefined) {
          faker.seed(originalSeed)
        }
        if (config?.locale !== undefined) {
          // Restore original locale (faker locale setting is version-dependent)
        }
      }
    }
  }

  /**
   * Generate multiple instances of test data
   */
  createMany<T>(factory: FactoryFunction<T>, count: number, config?: FactoryConfig): T[] {
    return Array.from({ length: count }, () => factory(config))
  }

  /**
   * User factory
   */
  user = this.createFactory((config?: FactoryConfig) => {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    const username = faker.internet.userName({ firstName, lastName }).toLowerCase()

    return {
      id: faker.string.uuid(),
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      username,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      avatar: faker.image.avatar(),
      bio: faker.lorem.sentence(),
      website: faker.internet.url(),
      location: faker.location.city(),
      birthDate: faker.date.birthdate({ min: 18, max: 65, mode: 'age' }),
      phone: faker.phone.number(),
      isActive: faker.datatype.boolean(0.9), // 90% chance of being active
      isVerified: faker.datatype.boolean(0.8), // 80% chance of being verified
      role: faker.helpers.arrayElement(['user', 'admin', 'moderator']),
      createdAt: faker.date.recent({ days: 365 }),
      updatedAt: faker.date.recent({ days: 30 })
    }
  })

  /**
   * Organization factory
   */
  organization = this.createFactory((config?: FactoryConfig) => {
    const name = faker.company.name()
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    return {
      id: faker.string.uuid(),
      name,
      slug,
      description: faker.company.catchPhrase(),
      website: faker.internet.url(),
      logo: faker.image.urlLoremFlickr({ category: 'business' }),
      industry: faker.company.buzzNoun(),
      size: faker.helpers.arrayElement(['startup', 'small', 'medium', 'large', 'enterprise']),
      location: `${faker.location.city()}, ${faker.location.state()}`,
      founded: faker.date.past({ years: 20 }),
      isActive: faker.datatype.boolean(0.95),
      settings: {
        allowPublicSignup: faker.datatype.boolean(0.7),
        requireApproval: faker.datatype.boolean(0.3),
        maxMembers: faker.number.int({ min: 10, max: 1000 })
      },
      createdAt: faker.date.recent({ days: 365 }),
      updatedAt: faker.date.recent({ days: 30 })
    }
  })

  /**
   * Post/Article factory
   */
  post = this.createFactory((config?: FactoryConfig) => {
    const title = faker.lorem.sentence({ min: 3, max: 8 })
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    return {
      id: faker.string.uuid(),
      title,
      slug,
      content: faker.lorem.paragraphs({ min: 3, max: 10 }, '\n\n'),
      excerpt: faker.lorem.paragraph(),
      authorId: faker.string.uuid(),
      categoryId: faker.string.uuid(),
      tags: faker.helpers.arrayElements(
        ['javascript', 'typescript', 'react', 'node', 'database', 'api', 'testing', 'deployment'],
        { min: 1, max: 4 }
      ),
      featuredImage: faker.image.url({ width: 1200, height: 630 }),
      published: faker.datatype.boolean(0.8),
      publishedAt: faker.date.recent({ days: 30 }),
      viewCount: faker.number.int({ min: 0, max: 10000 }),
      likeCount: faker.number.int({ min: 0, max: 500 }),
      commentCount: faker.number.int({ min: 0, max: 50 }),
      metadata: {
        readingTime: faker.number.int({ min: 2, max: 15 }),
        seoTitle: title,
        seoDescription: faker.lorem.sentence(),
        canonicalUrl: faker.internet.url()
      },
      createdAt: faker.date.recent({ days: 90 }),
      updatedAt: faker.date.recent({ days: 7 })
    }
  })

  /**
   * Comment factory
   */
  comment = this.createFactory((config?: FactoryConfig) => ({
    id: faker.string.uuid(),
    postId: faker.string.uuid(),
    authorId: faker.string.uuid(),
    parentId: faker.datatype.boolean(0.2) ? faker.string.uuid() : null, // 20% chance of being a reply
    content: faker.lorem.paragraphs({ min: 1, max: 3 }),
    isApproved: faker.datatype.boolean(0.9),
    likeCount: faker.number.int({ min: 0, max: 100 }),
    createdAt: faker.date.recent({ days: 30 }),
    updatedAt: faker.date.recent({ days: 7 })
  }))

  /**
   * Order/Transaction factory
   */
  order = this.createFactory((config?: FactoryConfig) => {
    const items = Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => ({
      id: faker.string.uuid(),
      name: faker.commerce.productName(),
      price: parseFloat(faker.commerce.price()),
      quantity: faker.number.int({ min: 1, max: 3 })
    }))

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const tax = subtotal * 0.08 // 8% tax
    const shipping = faker.number.float({ min: 5.99, max: 15.99, fractionDigits: 2 })
    const total = subtotal + tax + shipping

    return {
      id: faker.string.uuid(),
      orderNumber: `ORD-${faker.number.int({ min: 100000, max: 999999 })}`,
      customerId: faker.string.uuid(),
      status: faker.helpers.arrayElement(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
      items,
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      shipping,
      total: parseFloat(total.toFixed(2)),
      currency: 'USD',
      paymentMethod: faker.helpers.arrayElement(['credit_card', 'paypal', 'stripe', 'bank_transfer']),
      shippingAddress: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zipCode: faker.location.zipCode(),
        country: faker.location.country()
      },
      trackingNumber: faker.datatype.boolean(0.7) ? `TRK${faker.number.int({ min: 1000000000, max: 9999999999 })}` : null,
      createdAt: faker.date.recent({ days: 60 }),
      updatedAt: faker.date.recent({ days: 10 })
    }
  })

  /**
   * Event factory
   */
  event = this.createFactory((config?: FactoryConfig) => {
    const startDate = faker.date.future({ years: 1 })
    const endDate = new Date(startDate.getTime() + (faker.number.int({ min: 1, max: 8 }) * 60 * 60 * 1000)) // 1-8 hours later

    return {
      id: faker.string.uuid(),
      title: faker.lorem.words({ min: 2, max: 6 }),
      description: faker.lorem.paragraph(),
      type: faker.helpers.arrayElement(['conference', 'workshop', 'meetup', 'webinar', 'course']),
      category: faker.helpers.arrayElement(['technology', 'business', 'design', 'marketing', 'education']),
      startDate,
      endDate,
      timezone: faker.location.timeZone(),
      location: faker.datatype.boolean(0.6) ? {
        venue: faker.company.name(),
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        country: faker.location.country()
      } : null, // 60% in-person, 40% online
      isOnline: faker.datatype.boolean(0.4),
      maxAttendees: faker.number.int({ min: 10, max: 500 }),
      currentAttendees: faker.number.int({ min: 0, max: 450 }),
      price: faker.datatype.boolean(0.7) ? parseFloat(faker.commerce.price({ min: 10, max: 500 })) : 0, // 70% paid events
      organizer: {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        company: faker.company.name()
      },
      tags: faker.helpers.arrayElements(
        ['networking', 'learning', 'career', 'startup', 'innovation', 'leadership'],
        { min: 1, max: 3 }
      ),
      isPublished: faker.datatype.boolean(0.9),
      createdAt: faker.date.recent({ days: 30 }),
      updatedAt: faker.date.recent({ days: 7 })
    }
  })

  /**
   * API Key factory
   */
  apiKey = this.createFactory((config?: FactoryConfig) => ({
    id: faker.string.uuid(),
    key: `ak_${faker.string.alphanumeric({ length: 32 })}`,
    name: faker.lorem.words({ min: 2, max: 4 }),
    description: faker.lorem.sentence(),
    userId: faker.string.uuid(),
    permissions: faker.helpers.arrayElements(
      ['read', 'write', 'delete', 'admin'],
      { min: 1, max: 3 }
    ),
    rateLimit: faker.number.int({ min: 100, max: 10000 }),
    lastUsed: faker.date.recent({ days: 30 }),
    isActive: faker.datatype.boolean(0.9),
    expiresAt: faker.date.future({ years: 1 }),
    createdAt: faker.date.recent({ days: 90 }),
    updatedAt: faker.date.recent({ days: 7 })
  }))

  /**
   * Get all available generators
   */
  get generators(): TestDataGenerators {
    return {
      user: this.user,
      organization: this.organization,
      post: this.post
    }
  }
}

/**
 * Default factory instance with standard seed
 */
export const factory = new TestDataFactory()

/**
 * Create a seeded factory for consistent test data
 */
export function createSeededFactory(seed: number, locale?: string): TestDataFactory {
  return new TestDataFactory(seed, locale)
}

/**
 * Generate sequences of related test data
 */
export class TestDataSequence {
  private factory: TestDataFactory

  constructor(factory: TestDataFactory = new TestDataFactory()) {
    this.factory = factory
  }

  /**
   * Generate a user with related posts
   */
  userWithPosts(postCount: number = 3): { user: any; posts: any[] } {
    const user = this.factory.user()
    const posts = Array.from({ length: postCount }, () => ({
      ...this.factory.post(),
      authorId: user.id
    }))

    return { user, posts }
  }

  /**
   * Generate an organization with members
   */
  organizationWithMembers(memberCount: number = 5): { organization: any; members: any[] } {
    const organization = this.factory.organization()
    const members = Array.from({ length: memberCount }, () => this.factory.user())

    return { organization, members }
  }

  /**
   * Generate a post with comments
   */
  postWithComments(commentCount: number = 5): { post: any; comments: any[] } {
    const post = this.factory.post()
    const comments = Array.from({ length: commentCount }, () => ({
      ...this.factory.comment(),
      postId: post.id
    }))

    return { post, comments }
  }

  /**
   * Generate a customer with orders
   */
  customerWithOrders(orderCount: number = 3): { customer: any; orders: any[] } {
    const customer = this.factory.user()
    const orders = Array.from({ length: orderCount }, () => ({
      ...this.factory.order(),
      customerId: customer.id
    }))

    return { customer, orders }
  }
}