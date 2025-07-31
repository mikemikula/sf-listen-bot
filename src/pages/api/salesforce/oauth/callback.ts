/**
 * Salesforce OAuth Callback API Endpoint
 * Handles the OAuth callback from Salesforce after user authorization
 * 
 * Route: GET /api/salesforce/oauth/callback
 * 
 * Features:
 * - Validates OAuth state parameter for CSRF protection
 * - Exchanges authorization code for access token
 * - Retrieves user information from Salesforce
 * - Stores authentication credentials securely
 * - Redirects user to appropriate destination
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { exchangeCodeForToken, getUserInfo } from '@/lib/salesforce'
import { validateOAuthState } from './connect'
import { logger } from '@/lib/logger'
import { 
  storeSalesforceSession,
  getSalesforceSession as getSessionFromDB,
  removeSalesforceSession as removeSessionFromDB,
  updateSalesforceSession as updateSessionInDB,
  getSalesforceSessionStats as getSessionStatsFromDB,
  type SalesforceSessionData
} from '@/lib/salesforceSessionStore'
import type {
  SalesforceCallbackRequest,
  SalesforceCallbackResponse,
  SalesforceTokenResponse,
  SalesforceUserInfo,
  ApiResponse
} from '@/types'
import {
  SalesforceAuthError
} from '@/types'

/**
 * Database-backed session storage
 * Tokens are now stored securely in the database with encryption
 * Replaces the previous in-memory storage that was lost on server restarts
 */

/**
 * GET /api/salesforce/oauth/callback
 * Handles OAuth callback from Salesforce
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<SalesforceCallbackResponse>>
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    const {
      code,
      state,
      error: oauthError,
      error_description
    } = req.query as SalesforceCallbackRequest & { [key: string]: string }

    logger.info('Received Salesforce OAuth callback', {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!oauthError
    })

    // Handle OAuth errors from Salesforce
    if (oauthError) {
      logger.error('OAuth error from Salesforce', {
        error: oauthError,
        description: error_description
      })

      return res.status(400).json({
        success: false,
        error: `OAuth error: ${error_description || oauthError}`
      })
    }

    // Validate required parameters
    if (!code || !state) {
      logger.error('Missing required OAuth parameters', { hasCode: !!code, hasState: !!state })
      
      return res.status(400).json({
        success: false,
        error: 'Missing authorization code or state parameter'
      })
    }

    // Validate state parameter (CSRF protection)
    const stateData = await validateOAuthState(state)
    if (!stateData) {
      logger.error('Invalid or expired OAuth state', { 
        state,
        serverUptime: process.uptime ? `${Math.floor(process.uptime())} seconds` : 'unknown',
        storage: 'database'
      })
      
      // In development, provide helpful error page for server restarts
      if (process.env.NODE_ENV === 'development') {
        const errorUrl = new URL('/salesforce', req.headers.origin || 'http://localhost:3000')
        errorUrl.searchParams.set('error', 'oauth_state_invalid')
        errorUrl.searchParams.set('message', 'OAuth state validation failed. This can happen if the state expired or was already used. Please try connecting again.')
        
        res.redirect(302, errorUrl.toString())
        return
      }
      
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired OAuth state'
      })
    }

    logger.info('OAuth state validated successfully', {
      userId: stateData.userId,
      redirectTo: stateData.redirectTo
    })

    // Exchange authorization code for access token
    let tokenResponse: SalesforceTokenResponse
    try {
      tokenResponse = await exchangeCodeForToken(code, stateData.codeVerifier)
    } catch (error) {
      logger.error('Failed to exchange authorization code', { 
        error: error instanceof Error ? error.message : error,
        hasPKCE: !!stateData.codeVerifier
      })

      return res.status(400).json({
        success: false,
        error: error instanceof SalesforceAuthError ? 
          error.message : 
          'Failed to obtain access token'
      })
    }

    // Get user information from Salesforce
    let userInfo: SalesforceUserInfo
    try {
      userInfo = await getUserInfo(tokenResponse.access_token, tokenResponse.id)
    } catch (error) {
      logger.error('Failed to retrieve user information', { 
        error: error instanceof Error ? error.message : error 
      })

      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve user information'
      })
    }

    // Store authentication credentials in database
    const sessionId = generateSessionId()
    
    await storeSalesforceSession(sessionId, tokenResponse, userInfo)

    logger.info('Successfully completed OAuth flow', {
      userId: userInfo.user_id,
      username: userInfo.username,
      orgId: userInfo.organization_id,
      sessionId: sessionId.substring(0, 10) + '...'
    })

    // Set HTTP-only cookie for session persistence
    res.setHeader('Set-Cookie', [
      `sf_session=${sessionId}; HttpOnly; Path=/; Max-Age=${2 * 60 * 60}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    ])

    // Determine redirect destination  
    const redirectTo = stateData.redirectTo || '/salesforce'
    const redirectUrl = new URL(redirectTo, req.headers.origin || 'http://localhost:3000')
    
    // Add success flag to URL (no need for session ID since it's in cookie)
    redirectUrl.searchParams.set('sf_success', 'true')

    // Redirect to the final destination
    res.redirect(302, redirectUrl.toString())

  } catch (error) {
    logger.error('OAuth callback handler failed', { 
      error: error instanceof Error ? error.message : error 
    })

    // Redirect to error page with error information
    const errorUrl = new URL('/salesforce/error', req.headers.origin || 'http://localhost:3000')
    errorUrl.searchParams.set('error', 'oauth_callback_failed')
    errorUrl.searchParams.set('message', 'Failed to complete OAuth flow')
    
    res.redirect(302, errorUrl.toString())
  }
}

/**
 * Generate secure session ID
 * 
 * @returns Cryptographically secure session identifier
 */
function generateSessionId(): string {
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
 * Retrieve authentication credentials by session ID
 * Used by other API endpoints to get user's Salesforce credentials
 * Now uses database-backed storage for persistence
 * 
 * @param sessionId - Session identifier
 * @returns Authentication data if valid, null if invalid/expired
 */
export async function getSalesforceSession(sessionId: string): Promise<SalesforceSessionData | null> {
  // The actual implementation is now in the salesforceSessionStore module
  return await getSessionFromDB(sessionId)
}

/**
 * Remove authentication session
 * Used for logout functionality
 * 
 * @param sessionId - Session identifier to remove
 * @returns True if session was found and removed
 */
export async function removeSalesforceSession(sessionId: string): Promise<boolean> {
  return await removeSessionFromDB(sessionId)
}

/**
 * Update tokens in existing session
 * Used when refreshing access tokens
 * 
 * @param sessionId - Session identifier
 * @param tokenResponse - New token response
 * @returns Success status
 */
export async function updateSalesforceSession(
  sessionId: string, 
  tokenResponse: SalesforceTokenResponse
): Promise<boolean> {
  return await updateSessionInDB(sessionId, tokenResponse)
}

/**
 * Clean up expired sessions
 * Now handled automatically by the database session store
 */
// This function is no longer needed as cleanup is handled by the database session store

/**
 * Get session store statistics
 * Useful for monitoring and debugging
 * 
 * @returns Current session store statistics
 */
export async function getSalesforceSessionStats(): Promise<{
  totalSessions: number
  activeSessions: number
  expiredSessions: number
  disconnectedSessions: number
}> {
  return await getSessionStatsFromDB()
} 