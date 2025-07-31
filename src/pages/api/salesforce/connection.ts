/**
 * Salesforce Connection API Endpoint
 * Handles connection testing and status checks for Salesforce integration
 * 
 * Routes:
 * - GET /api/salesforce/connection - Get connection status
 * - POST /api/salesforce/connection/test - Test connection
 * - DELETE /api/salesforce/connection - Disconnect/logout
 * 
 * Features:
 * - Connection status validation
 * - API limit monitoring
 * - User information retrieval
 * - Secure disconnection
 * - Object validation
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { SalesforceSyncService, getDefaultSyncConfig } from '@/lib/salesforceSync'
import { getSalesforceSession, removeSalesforceSession } from './oauth/callback'
import { revokeToken } from '@/lib/salesforce'
import { logger } from '@/lib/logger'
import type {
  SalesforceTestConnectionResponse,
  SalesforceDisconnectResponse,
  SalesforceConnectionStatus,
  ApiResponse
} from '@/types'

/**
 * Main connection API handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
): Promise<void> {
  try {
    // Extract session ID from HTTP-only cookie
    const cookies = req.headers.cookie
    const sessionId = extractSessionFromCookies(cookies)
    
    logger.info('Connection API authentication check', { 
      hasCookie: !!cookies,
      sessionId: sessionId ? sessionId.substring(0, 10) + '...' : 'none'
    })
    
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: 'Missing Salesforce session'
      })
    }

    const sessionData = await getSalesforceSession(sessionId)
    
    logger.info('Session validation result', {
      sessionId: sessionId.substring(0, 10) + '...',
      sessionExists: !!sessionData,
      userInfo: sessionData?.userInfo?.user_id || 'none'
    })
    
    if (!sessionData) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired Salesforce session'
      })
    }

    switch (req.method) {
      case 'GET':
        return await handleGetConnectionStatus(req, res, sessionData)
      
      case 'POST':
        return await handleTestConnection(req, res, sessionData)
      
      case 'DELETE':
        return await handleDisconnect(req, res, sessionData, sessionId)
      
      default:
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        })
    }

  } catch (error) {
    logger.error('Connection API handler failed', { 
      error: error instanceof Error ? error.message : error 
    })

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Handle GET request to get connection status
 */
async function handleGetConnectionStatus(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<SalesforceConnectionStatus>>,
  sessionData: { tokenResponse: any; userInfo: any }
): Promise<void> {
  try {
    logger.info('Getting Salesforce connection status', {
      userId: sessionData.userInfo.user_id
    })

    // Create sync service to test connection
    const syncConfig = getDefaultSyncConfig()
    const syncService = new SalesforceSyncService(sessionData.tokenResponse, syncConfig)

    // Test basic connectivity
    const connectionTest = await syncService.testConnection()
    
    // Get API usage information
    const apiUsage = syncService.getApiUsage()

    // Build connection status response
    const connectionStatus: SalesforceConnectionStatus = {
      isConnected: connectionTest.success,
      isAuthenticated: true, // If we got here, we're authenticated
      instanceUrl: sessionData.tokenResponse.instance_url,
      apiVersion: syncConfig.getConfig().documentObjectName?.includes('v') ? 
        syncConfig.getConfig().documentObjectName.split('v')[1] : 'v59.0',
      userInfo: sessionData.userInfo,
      lastConnectionTest: new Date()
    }

    if (connectionTest.error) {
      connectionStatus.connectionError = connectionTest.error
    }

    if (apiUsage.used && apiUsage.limit) {
      connectionStatus.limits = {
        dailyApiCalls: {
          used: parseInt(apiUsage.used),
          limit: parseInt(apiUsage.limit)
        }
      }
    }

    logger.info('Connection status retrieved successfully', {
      isConnected: connectionStatus.isConnected,
      hasLimits: !!connectionStatus.limits
    })

    return res.status(200).json({
      success: true,
      data: connectionStatus
    })

  } catch (error) {
    logger.error('Failed to get connection status', { 
      error: error instanceof Error ? error.message : error 
    })

    // Return partial status with error
    const errorStatus: SalesforceConnectionStatus = {
      isConnected: false,
      isAuthenticated: true, // Session is valid but connection failed
      connectionError: error instanceof Error ? error.message : 'Connection test failed',
      instanceUrl: sessionData.tokenResponse.instance_url,
      apiVersion: 'v59.0',
      userInfo: sessionData.userInfo,
      lastConnectionTest: new Date()
    }

    return res.status(200).json({
      success: true,
      data: errorStatus
    })
  }
}

/**
 * Handle POST request to test connection
 */
async function handleTestConnection(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<SalesforceTestConnectionResponse>>,
  sessionData: { tokenResponse: any; userInfo: any }
): Promise<void> {
  try {
    logger.info('Testing Salesforce connection', {
      userId: sessionData.userInfo.user_id
    })

    // Create sync service
    const syncConfig = getDefaultSyncConfig()
    const syncService = new SalesforceSyncService(sessionData.tokenResponse, syncConfig)

    // Perform comprehensive connection test
    const connectionTest = await syncService.testConnection()
    
    if (!connectionTest.success) {
      return res.status(400).json({
        success: false,
        data: {
          success: false,
          error: connectionTest.error
        }
      })
    }

    // Test object validation (non-blocking)
    const objectValidation = await syncService.validateSalesforceObjects()
    
    // Get API usage
    const apiUsage = syncService.getApiUsage()

    // Build comprehensive test response
    const testResponse: SalesforceTestConnectionResponse = {
      success: true,
      connectionDetails: {
        instanceUrl: sessionData.tokenResponse.instance_url,
        userInfo: sessionData.userInfo,
        limits: connectionTest.details?.limits || {}
      }
    }

    // Add object validation as warnings, not errors
    if (!objectValidation.valid) {
      testResponse.warning = `Custom objects not found: ${objectValidation.issues.join(', ')}. Sync operations will be disabled until objects are created.`
      // Don't fail the connection test, just warn about missing objects
    }

    logger.info('Connection test completed', {
      success: testResponse.success,
      hasError: !!testResponse.error,
      objectsValid: objectValidation.valid
    })

    return res.status(200).json({
      success: true,
      data: testResponse
    })

  } catch (error) {
    logger.error('Connection test failed', { 
      error: error instanceof Error ? error.message : error 
    })

    return res.status(500).json({
      success: false,
      data: {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    })
  }
}

/**
 * Handle DELETE request to disconnect
 */
async function handleDisconnect(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<SalesforceDisconnectResponse>>,
  sessionData: { tokenResponse: any; userInfo: any },
  sessionId: string
): Promise<void> {
  try {
    logger.info('Disconnecting from Salesforce', {
      userId: sessionData.userInfo.user_id
    })

    // Revoke the access token from Salesforce
    const revokeSuccess = await revokeToken(sessionData.tokenResponse.access_token)
    
    if (!revokeSuccess) {
      logger.warn('Failed to revoke token from Salesforce, but continuing with local cleanup')
    }

    // Remove the local session
    const sessionRemoved = await removeSalesforceSession(sessionId)
    
    if (!sessionRemoved) {
      logger.warn('Session was not found in local store', { sessionId })
    }

    logger.info('Successfully disconnected from Salesforce', {
      tokenRevoked: revokeSuccess,
      sessionRemoved: sessionRemoved
    })

    return res.status(200).json({
      success: true,
      data: {
        success: true,
        message: 'Successfully disconnected from Salesforce'
      }
    })

  } catch (error) {
    logger.error('Failed to disconnect from Salesforce', { 
      error: error instanceof Error ? error.message : error 
    })

    // Try to clean up local session even if Salesforce revocation failed
    try {
      removeSalesforceSession(sessionId)
    } catch (cleanupError) {
      logger.error('Failed to cleanup local session', { cleanupError })
    }

    return res.status(500).json({
      success: false,
      data: {
        success: false,
        message: 'Failed to properly disconnect from Salesforce'
      }
    })
  }
}

/**
 * Utility function to check if Salesforce integration is properly configured
 * Can be called from other parts of the application
 */
export async function checkSalesforceHealth(sessionId: string): Promise<{
  healthy: boolean
  issues: string[]
}> {
  const issues: string[] = []

  try {
    // Check if session exists
    const sessionData = await getSalesforceSession(sessionId)
    if (!sessionData) {
      issues.push('No valid Salesforce session found')
      return { healthy: false, issues }
    }

    // Test connection
    const syncConfig = getDefaultSyncConfig()
    const syncService = new SalesforceSyncService(sessionData.tokenResponse, syncConfig)
    
    const connectionTest = await syncService.testConnection()
    if (!connectionTest.success) {
      issues.push(`Connection test failed: ${connectionTest.error}`)
    }

    // Validate objects
    const objectValidation = await syncService.validateSalesforceObjects()
    if (!objectValidation.valid) {
      issues.push(...objectValidation.issues)
    }

    return {
      healthy: issues.length === 0,
      issues
    }

  } catch (error) {
    issues.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return { healthy: false, issues }
  }
}

/**
 * Get quick connection status without full validation
 * Lightweight check for dashboard displays
 */
export async function getQuickConnectionStatus(sessionId: string): Promise<{
  connected: boolean
  userInfo?: any
  instanceUrl?: string
}> {
  try {
    const sessionData = await getSalesforceSession(sessionId)
    if (!sessionData) {
      return { connected: false }
    }

    return {
      connected: true,
      userInfo: sessionData.userInfo,
      instanceUrl: sessionData.tokenResponse.instance_url
    }

  } catch (error) {
    logger.warn('Failed to get quick connection status', { error })
    return { connected: false }
  }
}

/**
 * Extract session ID from cookie string
 */
function extractSessionFromCookies(cookieString?: string): string | null {
  if (!cookieString) return null

  const cookies = cookieString.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    acc[key] = value
    return acc
  }, {} as Record<string, string>)

  return cookies.sf_session || null
} 