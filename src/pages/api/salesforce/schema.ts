/**
 * Salesforce Schema Management API
 * Deploy, remove, and check status of custom objects
 * 
 * @author AI Assistant  
 * @version 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { getSalesforceSession } from '@/lib/salesforceSessionStore'
import { createSchemaManager } from '@/lib/salesforceSchema'
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
 * Schema Management API Handler
 * 
 * POST /api/salesforce/schema - Deploy custom objects
 * DELETE /api/salesforce/schema - Remove custom objects  
 * GET /api/salesforce/schema - Get schema status
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
): Promise<void> {
  try {
    // Extract session from HTTP-only cookie 
    const sessionId = extractSessionFromCookies(req.headers.cookie)
    
    if (!sessionId) {
      logger.warn('Schema API: No session cookie found')
      return res.status(401).json({
        success: false,
        error: 'No active Salesforce session'
      })
    }

    // Validate session
    const sessionData = await getSalesforceSession(sessionId)
    
    if (!sessionData) {
      logger.warn('Schema API: Invalid session', { sessionId: sessionId.substring(0, 10) + '...' })
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired Salesforce session'
      })
    }

    logger.info('Schema API request', {
      method: req.method,
      sessionId: sessionId.substring(0, 10) + '...',
      userId: sessionData.userInfo.user_id
    })

    // Create schema manager
    const schemaManager = createSchemaManager(
      sessionData.tokenResponse,
      sessionData.userInfo
    )

    // Route to appropriate handler
    switch (req.method) {
      case 'POST':
        return await handleDeploySchema(req, res, schemaManager)
      case 'DELETE':
        return await handleRemoveSchema(req, res, schemaManager)
      case 'GET':
        return await handleGetSchemaStatus(req, res, schemaManager)
      default:
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        })
    }

  } catch (error) {
    logger.error('Schema API error', {
      method: req.method,
      error: error instanceof Error ? error.message : error
    })

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Handle POST - Deploy custom objects
 */
async function handleDeploySchema(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>,
  schemaManager: any
): Promise<void> {
  try {
    logger.info('Starting schema deployment via API')

    // Deploy the schema
    const result = await schemaManager.deploySchema()

    if (result.success) {
      logger.info('Schema deployment successful', {
        documentsDeployed: result.results.documents.success,
        faqsDeployed: result.results.faqs.success
      })

      return res.status(200).json({
        success: true,
        data: {
          message: 'Schema deployed successfully',
          results: result.results,
          deployed: {
            documents: result.results.documents.success,
            faqs: result.results.faqs.success
          }
        }
      })
    } else {
      logger.error('Schema deployment failed', {
        error: result.error,
        results: result.results
      })

      return res.status(400).json({
        success: false,
        error: result.error || 'Schema deployment failed',
        data: {
          results: result.results
        }
      })
    }

  } catch (error) {
    logger.error('Schema deployment API error', {
      error: error instanceof Error ? error.message : error
    })

    return res.status(500).json({
      success: false,
      error: 'Failed to deploy schema'
    })
  }
}

/**
 * Handle DELETE - Remove custom objects
 */
async function handleRemoveSchema(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>,
  schemaManager: any
): Promise<void> {
  try {
    // Safety check - require confirmation
    const { confirm } = req.body
    
    if (!confirm || confirm !== 'DELETE_SCHEMA') {
      return res.status(400).json({
        success: false,
        error: 'Schema removal requires confirmation. Set confirm: "DELETE_SCHEMA" in request body.'
      })
    }

    logger.info('Starting schema removal via API')

    // Remove the schema
    const result = await schemaManager.removeSchema()

    if (result.success) {
      logger.info('Schema removal successful', {
        documentsRemoved: result.results.documents.success,
        faqsRemoved: result.results.faqs.success
      })

      return res.status(200).json({
        success: true,
        data: {
          message: 'Schema removed successfully',
          results: result.results,
          removed: {
            documents: result.results.documents.success,
            faqs: result.results.faqs.success
          }
        }
      })
    } else {
      logger.error('Schema removal failed', {
        error: result.error,
        results: result.results
      })

      return res.status(400).json({
        success: false,
        error: result.error || 'Schema removal failed',
        data: {
          results: result.results
        }
      })
    }

  } catch (error) {
    logger.error('Schema removal API error', {
      error: error instanceof Error ? error.message : error
    })

    return res.status(500).json({
      success: false,
      error: 'Failed to remove schema'
    })
  }
}

/**
 * Handle GET - Get schema status
 */
async function handleGetSchemaStatus(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>,
  schemaManager: any
): Promise<void> {
  try {
    logger.info('Checking schema status via API')

    // Get schema status
    const result = await schemaManager.getSchemaStatus()

    if (result.success) {
      const documentsExist = result.objects.documents.exists
      const faqsExist = result.objects.faqs.exists
      const allObjectsExist = documentsExist && faqsExist

      return res.status(200).json({
        success: true,
        data: {
          schemaDeployed: allObjectsExist,
          objects: {
            documents: {
              exists: documentsExist,
              fieldCount: result.objects.documents.fieldCount || 0,
              id: result.objects.documents.id
            },
            faqs: {
              exists: faqsExist,
              fieldCount: result.objects.faqs.fieldCount || 0,
              id: result.objects.faqs.id
            }
          },
          summary: {
            totalObjects: (documentsExist ? 1 : 0) + (faqsExist ? 1 : 0),
            totalExpected: 2,
            percentComplete: Math.round(((documentsExist ? 1 : 0) + (faqsExist ? 1 : 0)) / 2 * 100),
            status: allObjectsExist ? 'Complete' : 
                   (documentsExist || faqsExist) ? 'Partial' : 'Not Deployed'
          }
        }
      })
    } else {
      logger.error('Schema status check failed', {
        error: result.error
      })

      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to check schema status'
      })
    }

  } catch (error) {
    logger.error('Schema status API error', {
      error: error instanceof Error ? error.message : error
    })

    return res.status(500).json({
      success: false,
      error: 'Failed to get schema status'
    })
  }
} 