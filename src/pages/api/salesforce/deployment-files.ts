/**
 * Salesforce Manual Deployment Files API
 * Generates complete deployment package for manual deployment
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { getSalesforceSession } from '@/lib/salesforceSessionStore'
import { createManualDeploymentGenerator } from '@/lib/salesforceDeploymentStrategies'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/types'

/**
 * Extract session ID from cookies
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

/**
 * Manual Deployment Files Generator API Handler
 * 
 * GET /api/salesforce/deployment-files - Generate deployment package
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    // Extract session from HTTP-only cookie 
    const sessionId = extractSessionFromCookies(req.headers.cookie)
    
    if (!sessionId) {
      logger.warn('Deployment files API: No session cookie found')
      return res.status(401).json({
        success: false,
        error: 'No active Salesforce session'
      })
    }

    // Validate session
    const sessionData = await getSalesforceSession(sessionId)
    
    if (!sessionData) {
      logger.warn('Deployment files API: Invalid session', { sessionId: sessionId.substring(0, 10) + '...' })
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired Salesforce session'
      })
    }

    logger.info('Generating deployment files', {
      sessionId: sessionId.substring(0, 10) + '...',
      userId: sessionData.userInfo.user_id,
      orgId: sessionData.userInfo.organization_id
    })

    // Create deployment generator
    const generator = createManualDeploymentGenerator(
      sessionData.tokenResponse,
      sessionData.userInfo
    )

    // Generate deployment package
    const result = await generator.generateDeploymentPackage()

    if (result.success) {
      logger.info('Deployment package generated successfully', {
        fileCount: Object.keys(result.files).length,
        instructionCount: result.instructions.length,
        userId: sessionData.userInfo.user_id
      })

      return res.status(200).json({
        success: true,
        data: {
          message: 'Deployment package generated successfully',
          files: result.files,
          instructions: result.instructions,
          metadata: {
            fileCount: Object.keys(result.files).length,
            deploymentMethods: ['Salesforce CLI', 'Workbench', 'Change Sets'],
            generatedAt: new Date().toISOString(),
            orgId: sessionData.userInfo.organization_id
          }
        }
      })
    } else {
      logger.error('Failed to generate deployment package', {
        error: result.error,
        userId: sessionData.userInfo.user_id
      })

      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to generate deployment package'
      })
    }

  } catch (error) {
    logger.error('Deployment files API error', {
      error: error instanceof Error ? error.message : error
    })

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
} 