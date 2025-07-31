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
import { createSchemaValidator } from '@/lib/salesforceSchemaValidator'
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
        return await handleDeploySchema(req, res, schemaManager, sessionData)
      case 'DELETE':
        return await handleRemoveSchema(req, res, schemaManager)
      case 'GET':
        return await handleGetSchemaStatus(req, res, schemaManager, sessionData)
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
  schemaManager: any,
  sessionData: any
): Promise<void> {
  try {
    logger.info('Starting intelligent schema deployment via API')

    // First, validate what already exists
    const validator = createSchemaValidator(sessionData.tokenResponse)
    const validationResult = await validator.validateSchema()
    
    logger.info('Pre-deployment validation completed', {
      success: validationResult.success,
      recommendedAction: validationResult.recommendedAction,
      documentsExists: validationResult.documentsObject.exists,
      faqsExists: validationResult.faqsObject.exists
    })

    // If schema is already complete, return success
    if (validationResult.success) {
      logger.info('Schema already fully deployed - no action needed')
      
      return res.status(200).json({
        success: true,
        data: {
          message: '✅ Schema already fully deployed! All objects and fields are present.',
          results: {
            documents: { success: true, message: 'Already exists and valid' },
            faqs: { success: true, message: 'Already exists and valid' }
          },
          deployed: {
            documents: true,
            faqs: true
          },
          validationResult
        }
      })
    }

    // If objects exist but have missing fields, check for enhanced deployment option
    if (validationResult.recommendedAction === 'add_fields') {
      const useEnhancedDeployment = req.body?.useEnhancedDeployment === true
      
      if (useEnhancedDeployment) {
        logger.info('Using enhanced Metadata API deployment for missing fields', {
          documentsMissingFields: validationResult.documentsObject.missingFields.length,
          faqsMissingFields: validationResult.faqsObject.missingFields.length
        })

        // Redirect to enhanced field deployment logic
        const { createMetadataDeployer } = await import('@/lib/salesforceMetadataDeployer')
        const deployer = createMetadataDeployer(sessionData.tokenResponse, sessionData.userInfo)

        const deploymentResults = {
          documents: { success: true, fieldsDeployed: 0, error: undefined as string | undefined },
          faqs: { success: true, fieldsDeployed: 0, error: undefined as string | undefined }
        }

        // Deploy document fields if needed
        if (validationResult.documentsObject.missingFields.length > 0) {
          const documentFields = deployer.getDocumentFieldDefinitions()
          const missingDocumentFields = documentFields.filter(field => 
            validationResult.documentsObject.missingFields.includes(field.fullName)
          )
          const documentResult = await deployer.deployFields('Slack_Document__c', missingDocumentFields)
          deploymentResults.documents = {
            success: documentResult.success,
            fieldsDeployed: missingDocumentFields.length,
            error: documentResult.error
          }
        }

        // Deploy FAQ fields if needed
        if (validationResult.faqsObject.missingFields.length > 0) {
          const faqFields = deployer.getFaqFieldDefinitions()
          const missingFaqFields = faqFields.filter(field => 
            validationResult.faqsObject.missingFields.includes(field.fullName)
          )
          const faqResult = await deployer.deployFields('Slack_FAQ__c', missingFaqFields)
          deploymentResults.faqs = {
            success: faqResult.success,
            fieldsDeployed: missingFaqFields.length,
            error: faqResult.error
          }
        }

        const overallSuccess = deploymentResults.documents.success && deploymentResults.faqs.success
        const totalFieldsDeployed = deploymentResults.documents.fieldsDeployed + deploymentResults.faqs.fieldsDeployed

        if (overallSuccess) {
          // Add a delay to allow Salesforce metadata to propagate
          logger.info('Waiting for Salesforce metadata to propagate before final validation...')
          await new Promise(resolve => setTimeout(resolve, 5000)) // 5 second delay
          
          // Re-validate to get accurate field counts
          const finalValidation = await validator.validateSchema()
          
          return res.status(200).json({
            success: true,
            data: {
              message: `🎉 Enhanced deployment successful! Deployed ${totalFieldsDeployed} fields via Metadata API.`,
              results: {
                documents: { success: true, message: `${deploymentResults.documents.fieldsDeployed} fields deployed` },
                faqs: { success: true, message: `${deploymentResults.faqs.fieldsDeployed} fields deployed` }
              },
              deployed: {
                documents: true,
                faqs: true
              },
              deploymentMethod: 'Enhanced Metadata API',
              fieldsDeployed: totalFieldsDeployed,
              validationResult: finalValidation
            }
          })
        } else {
          return res.status(400).json({
            success: false,
            error: 'Enhanced field deployment partially failed',
            data: {
              deploymentResults,
              validationResult
            }
          })
        }
      } else {
        logger.warn('Objects exist but missing fields - requires manual field creation', {
          documentsMissingFields: validationResult.documentsObject.missingFields,
          faqsMissingFields: validationResult.faqsObject.missingFields
        })
        
        return res.status(400).json({
          success: false,
          error: '⚠️ Objects exist but missing required fields.',
          data: {
            message: validationResult.message,
            recommendedActions: [
              'Use Enhanced Metadata API deployment (add "useEnhancedDeployment": true to request)',
              'Use manual deployment files (/api/salesforce/deployment-files)',
              'Use dedicated field deployment endpoint (/api/salesforce/deploy-fields)',
              'Add fields manually via Salesforce UI'
            ],
            missingFields: {
              documents: validationResult.documentsObject.missingFields,
              faqs: validationResult.faqsObject.missingFields
            },
            validationResult
          }
        })
      }
    }

    // Deploy only what's actually missing based on validation
    logger.info('Deploying missing components based on validation', {
      documentsExists: validationResult.documentsObject.exists,
      faqsExists: validationResult.faqsObject.exists,
      documentsMissingFields: validationResult.documentsObject.missingFields.length,
      faqsMissingFields: validationResult.faqsObject.missingFields.length
    })

    // For objects that exist but are missing fields, we need manual deployment
    if (validationResult.documentsObject.exists && validationResult.documentsObject.missingFields.length > 0) {
      logger.warn('Document object exists but missing all fields - requires manual field addition', {
        missingFields: validationResult.documentsObject.missingFields
      })
    }

    // Deploy the schema with selective object creation
    const result = await schemaManager.deploySchemaSelective({
      createDocuments: !validationResult.documentsObject.exists,
      createFaqs: !validationResult.faqsObject.exists,
      validationResult
    })

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
  schemaManager: any,
  sessionData: any
): Promise<void> {
  try {
    logger.info('Checking schema status via comprehensive validation')

    // Use validator for accurate status checking
    const validator = createSchemaValidator(sessionData.tokenResponse)
    const validationResult = await validator.validateSchema()
    
    logger.info('Schema validation completed', {
      success: validationResult.success,
      recommendedAction: validationResult.recommendedAction,
      message: validationResult.message
    })
    
    return res.status(200).json({
      success: true,
      data: {
        schemaDeployed: validationResult.success,
        message: validationResult.message,
        recommendedAction: validationResult.recommendedAction,
        objects: {
          documents: {
            exists: validationResult.documentsObject.exists,
            valid: validationResult.documentsObject.valid,
            missingFields: validationResult.documentsObject.missingFields,
            errors: validationResult.documentsObject.errors,
            fieldCount: validationResult.documentsObject.missingFields.length,
            totalFields: 12,
            deployedFields: 12 - validationResult.documentsObject.missingFields.length
          },
          faqs: {
            exists: validationResult.faqsObject.exists,
            valid: validationResult.faqsObject.valid,
            missingFields: validationResult.faqsObject.missingFields,
            errors: validationResult.faqsObject.errors,
            fieldCount: validationResult.faqsObject.missingFields.length,
            totalFields: 9,
            deployedFields: 9 - validationResult.faqsObject.missingFields.length
          }
        },
        summary: {
          totalObjects: (validationResult.documentsObject.exists ? 1 : 0) + (validationResult.faqsObject.exists ? 1 : 0),
          totalExpected: 2,
          percentComplete: Math.round(((validationResult.documentsObject.exists ? 1 : 0) + (validationResult.faqsObject.exists ? 1 : 0)) / 2 * 100),
          status: validationResult.success ? 'Complete' : 
                 (validationResult.documentsObject.exists || validationResult.faqsObject.exists) ? 'Partial' : 'Not Deployed',
          totalMissingFields: validationResult.documentsObject.missingFields.length + validationResult.faqsObject.missingFields.length
        }
      }
    })

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