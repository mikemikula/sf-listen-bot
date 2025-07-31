/**
 * Database-backed Salesforce Session Store
 * Replaces in-memory storage with persistent database storage
 * 
 * Features:
 * - Persistent session storage across server restarts
 * - Encrypted token storage for security
 * - Automatic session cleanup and expiration
 * - Transaction support for data consistency
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { db } from './db'
import { logger } from './logger'
import crypto from 'crypto'
import type {
  SalesforceTokenResponse,
  SalesforceUserInfo
} from '@/types'

/**
 * Encryption configuration
 */
const ENCRYPTION_KEY = process.env.SALESFORCE_ENCRYPTION_KEY || 'development-key-change-in-production-32'
const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16

/**
 * Session data interface
 */
export interface SalesforceSessionData {
  tokenResponse: SalesforceTokenResponse
  userInfo: SalesforceUserInfo
  createdAt: Date
}

/**
 * Encrypt sensitive data for database storage
 * Using modern crypto API to avoid deprecation warnings
 */
function encrypt(text: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(IV_LENGTH)
  // Create a proper 32-byte key for AES-256
  const keyBuffer = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return {
    encrypted,
    iv: iv.toString('hex')
  }
}

/**
 * Decrypt sensitive data from database storage
 * Using modern crypto API to avoid deprecation warnings
 */
function decrypt(encryptedData: { encrypted: string; iv: string }): string {
  // Create a proper 32-byte key for AES-256
  const keyBuffer = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
  const iv = Buffer.from(encryptedData.iv, 'hex')
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv)
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Store Salesforce session in database
 */
export async function storeSalesforceSession(
  sessionId: string,
  tokenResponse: SalesforceTokenResponse,
  userInfo: SalesforceUserInfo
): Promise<void> {
  try {
    logger.info('Storing Salesforce session in database', {
      sessionId: sessionId.substring(0, 10) + '...',
      userId: userInfo.user_id,
      orgId: userInfo.organization_id
    })

    // Encrypt sensitive token data
    const encryptedAccessToken = encrypt(tokenResponse.access_token)
    const encryptedRefreshToken = tokenResponse.refresh_token ? 
      encrypt(tokenResponse.refresh_token) : null

    // Calculate token expiration (typically 2 hours from now)
    const tokenExpiresAt = tokenResponse.issued_at ? 
      new Date(parseInt(tokenResponse.issued_at) + (2 * 60 * 60 * 1000)) : 
      new Date(Date.now() + (2 * 60 * 60 * 1000))

    // Store in database with upsert to handle reconnections
    await db.salesforceConnection.upsert({
      where: { sessionId },
      update: {
        // Update existing connection
        accessToken: JSON.stringify(encryptedAccessToken),
        refreshToken: encryptedRefreshToken ? JSON.stringify(encryptedRefreshToken) : null,
        tokenType: tokenResponse.token_type || 'Bearer',
        tokenExpiresAt,
        status: 'ACTIVE',
        lastActivityAt: new Date(),
        lastUsedAt: new Date(),
        updatedAt: new Date()
      },
      create: {
        // Create new connection
        sessionId,
        organizationId: userInfo.organization_id,
        salesforceUserId: userInfo.user_id,
        username: userInfo.username,
        displayName: userInfo.display_name || userInfo.username,
        instanceUrl: tokenResponse.instance_url,
        accessToken: JSON.stringify(encryptedAccessToken),
        refreshToken: encryptedRefreshToken ? JSON.stringify(encryptedRefreshToken) : null,
        tokenType: tokenResponse.token_type || 'Bearer',
        tokenExpiresAt,
        status: 'ACTIVE',
        lastActivityAt: new Date(),
        lastUsedAt: new Date(),
        apiCallCount: 0
      }
    })

    logger.info('Successfully stored Salesforce session', {
      sessionId: sessionId.substring(0, 10) + '...',
      userId: userInfo.user_id
    })

  } catch (error) {
    logger.error('Failed to store Salesforce session', {
      sessionId: sessionId.substring(0, 10) + '...',
      error: error instanceof Error ? error.message : error
    })
    throw error
  }
}

/**
 * Retrieve Salesforce session from database
 */
export async function getSalesforceSession(sessionId: string): Promise<SalesforceSessionData | null> {
  try {
    logger.info('Retrieving Salesforce session from database', {
      sessionId: sessionId.substring(0, 10) + '...'
    })

    const connection = await db.salesforceConnection.findUnique({
      where: { 
        sessionId,
        status: 'ACTIVE'
      }
    })

    if (!connection) {
      logger.warn('Salesforce session not found in database', {
        sessionId: sessionId.substring(0, 10) + '...'
      })
      return null
    }

    // Check if token is expired
    if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
      logger.warn('Salesforce session token expired', {
        sessionId: sessionId.substring(0, 10) + '...',
        expiredAt: connection.tokenExpiresAt
      })
      
      // Mark as expired
      await db.salesforceConnection.update({
        where: { id: connection.id },
        data: { status: 'EXPIRED' }
      })
      
      return null
    }

    // Decrypt token data
    const encryptedAccessToken = JSON.parse(connection.accessToken)
    const accessToken = decrypt(encryptedAccessToken)
    
    let refreshToken: string | undefined
    if (connection.refreshToken) {
      const encryptedRefreshToken = JSON.parse(connection.refreshToken)
      refreshToken = decrypt(encryptedRefreshToken)
    }

    // Build token response
    const tokenResponse: SalesforceTokenResponse = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: connection.tokenType,
      instance_url: connection.instanceUrl,
      id: `${connection.instanceUrl}/id/${connection.organizationId}/${connection.salesforceUserId}`,
      issued_at: connection.createdAt.getTime().toString(),
      signature: 'database-stored'
    }

    // Build user info
    const userInfo: SalesforceUserInfo = {
      user_id: connection.salesforceUserId,
      organization_id: connection.organizationId,
      username: connection.username,
      display_name: connection.displayName || connection.username,
      nick_name: connection.displayName || connection.username,
      first_name: connection.displayName?.split(' ')[0] || '',
      last_name: connection.displayName?.split(' ').slice(1).join(' ') || '',
      email: connection.username, // Username is typically email in Salesforce
      email_verified: true,
      mobile_phone_verified: false,
      status: {
        created_date: connection.createdAt.toISOString(),
        body: 'Active'
      },
      photos: {
        picture: '',
        thumbnail: ''
      },
      timezone: 'America/Los_Angeles',
      language: 'en_US',
      locale: 'en_US',
      utcOffset: -28800000,
      last_modified_date: connection.updatedAt.toISOString(),
      is_lightning_login_user: false
    }

    // Update last used timestamp
    await db.salesforceConnection.update({
      where: { id: connection.id },
      data: { 
        lastUsedAt: new Date(),
        lastActivityAt: new Date()
      }
    })

    logger.info('Successfully retrieved Salesforce session', {
      sessionId: sessionId.substring(0, 10) + '...',
      userId: connection.salesforceUserId
    })

    return {
      tokenResponse,
      userInfo,
      createdAt: connection.createdAt
    }

  } catch (error) {
    logger.error('Failed to retrieve Salesforce session', {
      sessionId: sessionId.substring(0, 10) + '...',
      error: error instanceof Error ? error.message : error
    })
    return null
  }
}

/**
 * Remove Salesforce session from database
 */
export async function removeSalesforceSession(sessionId: string): Promise<boolean> {
  try {
    logger.info('Removing Salesforce session from database', {
      sessionId: sessionId.substring(0, 10) + '...'
    })

    const result = await db.salesforceConnection.updateMany({
      where: { sessionId },
      data: { 
        status: 'DISCONNECTED',
        disconnectedAt: new Date()
      }
    })

    const success = result.count > 0

    logger.info('Salesforce session removal result', {
      sessionId: sessionId.substring(0, 10) + '...',
      success,
      updatedCount: result.count
    })

    return success

  } catch (error) {
    logger.error('Failed to remove Salesforce session', {
      sessionId: sessionId.substring(0, 10) + '...',
      error: error instanceof Error ? error.message : error
    })
    return false
  }
}

/**
 * Update tokens in existing session
 */
export async function updateSalesforceSession(
  sessionId: string, 
  tokenResponse: SalesforceTokenResponse
): Promise<boolean> {
  try {
    logger.info('Updating Salesforce session tokens', {
      sessionId: sessionId.substring(0, 10) + '...'
    })

    // Encrypt new token data
    const encryptedAccessToken = encrypt(tokenResponse.access_token)
    const encryptedRefreshToken = tokenResponse.refresh_token ? 
      encrypt(tokenResponse.refresh_token) : null

    // Calculate new token expiration
    const tokenExpiresAt = tokenResponse.issued_at ? 
      new Date(parseInt(tokenResponse.issued_at) + (2 * 60 * 60 * 1000)) : 
      new Date(Date.now() + (2 * 60 * 60 * 1000))

    const result = await db.salesforceConnection.updateMany({
      where: { 
        sessionId,
        status: 'ACTIVE'
      },
      data: {
        accessToken: JSON.stringify(encryptedAccessToken),
        refreshToken: encryptedRefreshToken ? JSON.stringify(encryptedRefreshToken) : null,
        tokenType: tokenResponse.token_type || 'Bearer',
        tokenExpiresAt,
        lastActivityAt: new Date(),
        updatedAt: new Date()
      }
    })

    const success = result.count > 0

    logger.info('Salesforce session token update result', {
      sessionId: sessionId.substring(0, 10) + '...',
      success,
      updatedCount: result.count
    })

    return success

  } catch (error) {
    logger.error('Failed to update Salesforce session tokens', {
      sessionId: sessionId.substring(0, 10) + '...',
      error: error instanceof Error ? error.message : error
    })
    return false
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    const now = new Date()
    
    // Mark expired sessions
    const expiredResult = await db.salesforceConnection.updateMany({
      where: {
        tokenExpiresAt: {
          lt: now
        },
        status: 'ACTIVE'
      },
      data: {
        status: 'EXPIRED',
        updatedAt: now
      }
    })

    // Clean up old disconnected sessions (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const cleanupResult = await db.salesforceConnection.deleteMany({
      where: {
        OR: [
          {
            status: 'DISCONNECTED',
            disconnectedAt: {
              lt: sevenDaysAgo
            }
          },
          {
            status: 'EXPIRED',
            updatedAt: {
              lt: sevenDaysAgo
            }
          }
        ]
      }
    })

    if (expiredResult.count > 0 || cleanupResult.count > 0) {
      logger.info('Cleaned up Salesforce sessions', {
        expiredSessions: expiredResult.count,
        deletedSessions: cleanupResult.count
      })
    }

  } catch (error) {
    logger.error('Failed to cleanup expired Salesforce sessions', {
      error: error instanceof Error ? error.message : error
    })
  }
}

/**
 * Get session store statistics
 */
export async function getSalesforceSessionStats(): Promise<{
  totalSessions: number
  activeSessions: number
  expiredSessions: number
  disconnectedSessions: number
}> {
  try {
    const [total, active, expired, disconnected] = await Promise.all([
      db.salesforceConnection.count(),
      db.salesforceConnection.count({ where: { status: 'ACTIVE' } }),
      db.salesforceConnection.count({ where: { status: 'EXPIRED' } }),
      db.salesforceConnection.count({ where: { status: 'DISCONNECTED' } })
    ])

    return {
      totalSessions: total,
      activeSessions: active,
      expiredSessions: expired,
      disconnectedSessions: disconnected
    }

  } catch (error) {
    logger.error('Failed to get Salesforce session stats', {
      error: error instanceof Error ? error.message : error
    })
    
    return {
      totalSessions: 0,
      activeSessions: 0,
      expiredSessions: 0,
      disconnectedSessions: 0
    }
  }
}

/**
 * Run cleanup on module load
 */
if (process.env.NODE_ENV !== 'test') {
  // Schedule cleanup every hour
  setInterval(cleanupExpiredSessions, 60 * 60 * 1000)
  
  // Run initial cleanup
  cleanupExpiredSessions().catch(error => {
    logger.error('Initial session cleanup failed', { error })
  })
} 