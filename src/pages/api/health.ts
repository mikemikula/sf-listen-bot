/**
 * Health check endpoint
 * Verifies database connectivity and application status
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { checkDbHealth } from '@/lib/db'
import type { ApiResponse } from '@/types'

interface HealthStatus {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  database: 'connected' | 'disconnected'
  uptime: number
  environment: string
}

/**
 * Health check handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<HealthStatus>>
): Promise<void> {
  
  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    // Check database connectivity
    const isDatabaseHealthy = await checkDbHealth()
    
    // Calculate uptime (process start time)
    const uptime = process.uptime()
    
    const healthStatus: HealthStatus = {
      status: isDatabaseHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: isDatabaseHealthy ? 'connected' : 'disconnected',
      uptime: Math.floor(uptime),
      environment: process.env.NODE_ENV || 'development'
    }

    const statusCode = isDatabaseHealthy ? 200 : 503

    return res.status(statusCode).json({
      success: isDatabaseHealthy,
      data: healthStatus,
      message: isDatabaseHealthy ? 'Service healthy' : 'Service unhealthy'
    })

  } catch (error) {
    console.error('❌ Health check error:', error)
    
    return res.status(503).json({
      success: false,
      error: 'Health check failed',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        uptime: 0,
        environment: process.env.NODE_ENV || 'development'
      }
    })
  }
} 