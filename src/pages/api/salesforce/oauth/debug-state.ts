/**
 * Salesforce OAuth State Debug API Endpoint
 * Development helper to inspect OAuth state store
 * 
 * Route: GET /api/salesforce/oauth/debug-state
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { getOAuthStateStats } from './connect'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/types'

interface DebugStateResponse {
  stateStoreStats: {
    totalStates: number
    oldestState?: Date
    newestState?: Date
  }
  environment: string
  serverUptime: string
  timestamp: string
}

/**
 * GET /api/salesforce/oauth/debug-state
 * Returns debug information about OAuth state store
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<DebugStateResponse>>
): Promise<void> {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({
      success: false,
      error: 'Not found'
    })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    const stateStoreStats = await getOAuthStateStats()
    
    const debugInfo: DebugStateResponse = {
      stateStoreStats,
      environment: process.env.NODE_ENV || 'unknown',
      serverUptime: process.uptime ? `${Math.floor(process.uptime())} seconds` : 'unknown',
      timestamp: new Date().toISOString()
    }

    logger.info('OAuth state debug request', debugInfo)

    return res.status(200).json({
      success: true,
      data: debugInfo
    })

  } catch (error) {
    logger.error('Failed to get OAuth state debug info', { 
      error: error instanceof Error ? error.message : error 
    })

    return res.status(500).json({
      success: false,
      error: 'Failed to get debug information'
    })
  }
} 