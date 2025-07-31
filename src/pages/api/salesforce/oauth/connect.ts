/**
 * Salesforce OAuth Connect API Endpoint
 * Initiates the OAuth flow by generating authorization URL and state management
 * 
 * Route: POST /api/salesforce/oauth/connect
 * 
 * Features:
 * - Generates secure state parameter for CSRF protection
 * - Creates authorization URL for Salesforce OAuth
 * - Stores state in database for persistence across server restarts
 * - Supports custom redirect destinations
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { generateAuthUrl, getSalesforceConfig } from '@/lib/salesforce'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db'
import type { 
  SalesforceConnectRequest, 
  SalesforceConnectResponse,
  ApiResponse 
} from '@/types'

/**
 * Clean up expired OAuth states from database
 * Removes states that have passed their expiration time
 */
async function cleanupExpiredStates(): Promise<void> {
  try {
    const now = new Date()
    const deleted = await db.oAuthState.deleteMany({
      where: {
        expiresAt: {
          lt: now
        }
      }
    })
    
    if (deleted.count > 0) {
      logger.debug(`Cleaned up ${deleted.count} expired OAuth states`)
    }
  } catch (error) {
    logger.error('Failed to cleanup expired OAuth states', { error })
  }
}

/**
 * Generate secure random state parameter
 * 
 * @returns Cryptographically secure random string
 */
function generateState(): string {
  // Create a secure random state parameter
  const array = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array)
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
  }
  
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate PKCE code verifier
 * Creates a cryptographically secure random string for PKCE
 * 
 * @returns Base64url encoded random string
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array)
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
  }
  
  // Convert to base64url (base64 without padding and with URL-safe characters)
  return Buffer.from(array)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Generate PKCE code challenge from verifier
 * Creates SHA256 hash of code verifier, base64url encoded
 * 
 * @param codeVerifier - The code verifier string
 * @returns Base64url encoded SHA256 hash
 */
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(codeVerifier)
    const digest = await crypto.subtle.digest('SHA-256', data)
    
    // Convert to base64url
    return Buffer.from(digest)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  } else {
    // Fallback using Node.js crypto (if available)
    const crypto = require('crypto')
    const hash = crypto.createHash('sha256').update(codeVerifier).digest()
    return hash.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }
}

/**
 * POST /api/salesforce/oauth/connect
 * Initiates Salesforce OAuth flow
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<SalesforceConnectResponse>>
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    // Clean up expired states
    await cleanupExpiredStates()

    // Log current state store size for debugging
    const currentStates = await db.oAuthState.count()
    logger.info('OAuth state store status', {
      totalStates: currentStates,
      storage: 'database'
    })

    // Validate Salesforce configuration
    const config = getSalesforceConfig()
    
    // Parse request body
    const { userId, redirectTo }: SalesforceConnectRequest = req.body || {}

    // Generate secure state parameter
    const state = generateState()
    
    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    
    // Store state in database (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    
    await db.oAuthState.create({
      data: {
        state,
        userId,
        redirectTo,
        codeVerifier,
        expiresAt
      }
    })

    // Log state storage for debugging
    logger.info('Stored OAuth state in database', {
      state,
      userId,
      redirectTo,
      expiresAt: expiresAt.toISOString(),
      storage: 'database'
    })

    // Generate authorization URL with PKCE parameters
    const authUrl = generateAuthUrl(state, ['api', 'refresh_token', 'id'], {
      codeChallenge,
      codeChallengeMethod: 'S256'
    })

    logger.info('Generated Salesforce OAuth authorization URL with PKCE', {
      state,
      userId,
      redirectTo,
      hasAuthUrl: !!authUrl,
      hasPKCE: true,
      storage: 'database'
    })

    return res.status(200).json({
      success: true,
      data: {
        authUrl,
        state
      }
    })

  } catch (error) {
    logger.error('Failed to initiate Salesforce OAuth flow', { 
      error: error instanceof Error ? error.message : error 
    })

    return res.status(500).json({
      success: false,
      error: 'Failed to initiate OAuth flow'
    })
  }
}

/**
 * Utility function to validate and retrieve OAuth state
 * Used by the callback endpoint to validate the OAuth flow
 * 
 * @param state - State parameter from OAuth callback
 * @returns State data if valid, null if invalid/expired
 */
export async function validateOAuthState(state: string): Promise<{
  userId?: string
  redirectTo?: string
  codeVerifier: string
  createdAt: Date
} | null> {
  try {
    // Clean up expired states
    await cleanupExpiredStates()
    
    // Log validation attempt for debugging
    const totalStates = await db.oAuthState.count()
    logger.info('Validating OAuth state', {
      state,
      totalStates,
      storage: 'database'
    })
    
    // Find the state in database
    const stateData = await db.oAuthState.findUnique({
      where: { state }
    })
    
    if (!stateData) {
      logger.warn('OAuth state not found in database', {
        state,
        totalStates,
        storage: 'database'
      })
      return null
    }

    // Check if state has expired (additional safety check)
    const now = new Date()
    if (stateData.expiresAt < now) {
      logger.warn('OAuth state has expired', {
        state,
        expiresAt: stateData.expiresAt.toISOString(),
        now: now.toISOString()
      })
      
      // Clean up expired state
      await db.oAuthState.delete({
        where: { state }
      })
      
      return null
    }

    // Remove state after validation (one-time use)
    await db.oAuthState.delete({
      where: { state }
    })
    
    logger.info('OAuth state validated successfully', {
      state,
      userId: stateData.userId,
      redirectTo: stateData.redirectTo,
      createdAt: stateData.createdAt.toISOString(),
      storage: 'database'
    })
    
    return {
      userId: stateData.userId || undefined,
      redirectTo: stateData.redirectTo || undefined,
      codeVerifier: stateData.codeVerifier,
      createdAt: stateData.createdAt
    }
    
  } catch (error) {
    logger.error('Failed to validate OAuth state', { 
      state, 
      error: error instanceof Error ? error.message : error 
    })
    return null
  }
}

/**
 * Get OAuth state store stats (for debugging/monitoring)
 * 
 * @returns Current state store statistics
 */
export async function getOAuthStateStats(): Promise<{
  totalStates: number
  oldestState?: Date
  newestState?: Date
}> {
  try {
    await cleanupExpiredStates()
    
    const [totalStates, oldestState, newestState] = await Promise.all([
      db.oAuthState.count(),
      db.oAuthState.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true }
      }),
      db.oAuthState.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      })
    ])
    
    return {
      totalStates,
      oldestState: oldestState?.createdAt,
      newestState: newestState?.createdAt
    }
    
  } catch (error) {
    logger.error('Failed to get OAuth state stats', { error })
    return { totalStates: 0 }
  }
} 