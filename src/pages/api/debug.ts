/**
 * Debug endpoint for Vercel deployment troubleshooting
 * Provides environment and configuration information
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import type { ApiResponse } from '@/types'

interface DebugInfo {
  environment: string
  nodeVersion: string
  timestamp: string
  environmentVariables: {
    databaseUrl: boolean
    directUrl: boolean
    nodeEnv: string
    vercelUrl?: string
  }
  prisma: {
    clientAvailable: boolean
    connectionTest?: boolean
    error?: string
  }
}

/**
 * Debug information handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<DebugInfo>>
): Promise<void> {

  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    // Test Prisma client availability
    let prismaInfo = {
      clientAvailable: false,
      connectionTest: false,
      error: undefined as string | undefined
    }

    try {
      const { db } = await import('@/lib/db')
      prismaInfo.clientAvailable = true
      
      // Test database connection
      await db.$queryRaw`SELECT 1`
      prismaInfo.connectionTest = true
    } catch (error) {
      prismaInfo.error = error instanceof Error ? error.message : 'Unknown error'
    }

    const debugInfo: DebugInfo = {
      environment: process.env.NODE_ENV || 'unknown',
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      environmentVariables: {
        databaseUrl: !!process.env.DATABASE_URL,
        directUrl: !!process.env.DIRECT_URL,
        nodeEnv: process.env.NODE_ENV || 'not-set',
        vercelUrl: process.env.VERCEL_URL
      },
      prisma: prismaInfo
    }

    return res.status(200).json({
      success: true,
      data: debugInfo
    })

  } catch (error) {
    console.error('❌ Debug endpoint error:', error)

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Debug endpoint failed'
    })
  }
} 