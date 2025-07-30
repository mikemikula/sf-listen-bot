/**
 * Database connection utility using Prisma Client
 * Implements singleton pattern for optimal connection management
 */

import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

/**
 * Global Prisma client instance
 * Uses singleton pattern to prevent multiple connections in development
 */
export const db = globalThis.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  errorFormat: 'pretty',
})

// Export prisma as alias for db to maintain compatibility
export const prisma = db

// Prevent multiple instances in development hot reload
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db
}

/**
 * Graceful database disconnection
 * Should be called on application shutdown
 */
export const disconnectDb = async (): Promise<void> => {
  try {
    await db.$disconnect()
    console.log('🔌 Database disconnected successfully')
  } catch (error) {
    console.error('❌ Error disconnecting from database:', error)
  }
}

/**
 * Database health check
 * Verifies database connectivity
 */
export const checkDbHealth = async (): Promise<boolean> => {
  try {
    await db.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('❌ Database health check failed:', error)
    return false
  }
} 