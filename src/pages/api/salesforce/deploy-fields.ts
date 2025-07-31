/**
 * Salesforce Automated Field Deployment API
 * Uses enhanced Metadata API with ZIP packaging for field deployment
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { getSalesforceSession } from '@/lib/salesforceSessionStore'
import { createMetadataDeployer } from '@/lib/salesforceMetadataDeployer'
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
 * Automated Field Deployment API Handler
 * 
 * POST /api/salesforce/deploy-fields - Deploy missing fields automatically
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    // Extract session from HTTP-only cookie 
    const sessionId = extractSessionFromCookies(req.headers.cookie)
    
    if (!sessionId) {
      logger.warn('Field deployment API: No session cookie found')
      return res.status(401).json({
        success: false,
        error: 'No active Salesforce session'
      })
    }

    // Validate session
    const sessionData = await getSalesforceSession(sessionId)
    
    if (!sessionData) {
      logger.warn('Field deployment API: Invalid session', { sessionId: sessionId.substring(0, 10) + '...' })
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired Salesforce session'
      })
    }

    logger.info('Starting automated field deployment', {
      sessionId: sessionId.substring(0, 10) + '...',
      userId: sessionData.userInfo.user_id,
      orgId: sessionData.userInfo.organization_id
    })

    // First, validate current schema status
    const validator = createSchemaValidator(sessionData.tokenResponse)
    const validationResult = await validator.validateSchema()
    
    // Check if both objects exist
    if (!validationResult.documentsObject.exists || !validationResult.faqsObject.exists) {
      logger.warn('Cannot deploy fields - objects do not exist', {
        documentsExists: validationResult.documentsObject.exists,
        faqsExists: validationResult.faqsObject.exists
      })
      
      return res.status(400).json({
        success: false,
        error: 'Cannot deploy fields to non-existent objects. Please create objects first.',
        data: {
          documentsExists: validationResult.documentsObject.exists,
          faqsExists: validationResult.faqsObject.exists,
          recommendedAction: 'create_objects'
        }
      })
    }

    // Check if fields are actually missing
    const totalMissingFields = validationResult.documentsObject.missingFields.length + 
                              validationResult.faqsObject.missingFields.length

    if (totalMissingFields === 0) {
      logger.info('No missing fields found - schema is complete')
      
      return res.status(200).json({
        success: true,
        data: {
          message: '✅ All fields already exist! Schema is complete.',
          deploymentResults: {
            documents: { success: true, fieldsDeployed: 0, message: 'All fields present' },
            faqs: { success: true, fieldsDeployed: 0, message: 'All fields present' }
          },
          validationResult
        }
      })
    }

    logger.info('Deploying missing fields via enhanced Metadata API', {
      documentsMissingFields: validationResult.documentsObject.missingFields.length,
      faqsMissingFields: validationResult.faqsObject.missingFields.length,
      totalMissingFields
    })

    // Create metadata deployer
    const deployer = createMetadataDeployer(
      sessionData.tokenResponse,
      sessionData.userInfo
    )

    const deploymentResults = {
      documents: { success: true, fieldsDeployed: 0, error: undefined as string | undefined, deploymentId: undefined as string | undefined },
      faqs: { success: true, fieldsDeployed: 0, error: undefined as string | undefined, deploymentId: undefined as string | undefined }
    }

    // Deploy document fields if needed
    if (validationResult.documentsObject.missingFields.length > 0) {
      logger.info('Deploying fields for Slack_Document__c', {
        fieldCount: validationResult.documentsObject.missingFields.length
      })

      const documentFields = deployer.getDocumentFieldDefinitions()
      const missingDocumentFields = documentFields.filter(field => 
        validationResult.documentsObject.missingFields.includes(field.fullName)
      )

      const documentResult = await deployer.deployFields('Slack_Document__c', missingDocumentFields)
      
      deploymentResults.documents = {
        success: documentResult.success,
        fieldsDeployed: missingDocumentFields.length,
        error: documentResult.error,
        deploymentId: documentResult.deploymentId
      }
    }

    // Deploy FAQ fields if needed
    if (validationResult.faqsObject.missingFields.length > 0) {
      logger.info('Deploying fields for Slack_FAQ__c', {
        fieldCount: validationResult.faqsObject.missingFields.length
      })

      const faqFields = deployer.getFaqFieldDefinitions()
      const missingFaqFields = faqFields.filter(field => 
        validationResult.faqsObject.missingFields.includes(field.fullName)
      )

      const faqResult = await deployer.deployFields('Slack_FAQ__c', missingFaqFields)
      
      deploymentResults.faqs = {
        success: faqResult.success,
        fieldsDeployed: missingFaqFields.length,
        error: faqResult.error,
        deploymentId: faqResult.deploymentId
      }
    }

    const overallSuccess = deploymentResults.documents.success && deploymentResults.faqs.success
    const totalFieldsDeployed = deploymentResults.documents.fieldsDeployed + deploymentResults.faqs.fieldsDeployed

    if (overallSuccess) {
      logger.info('Automated field deployment completed successfully', {
        totalFieldsDeployed,
        documentsFieldsDeployed: deploymentResults.documents.fieldsDeployed,
        faqsFieldsDeployed: deploymentResults.faqs.fieldsDeployed,
        userId: sessionData.userInfo.user_id
      })

      return res.status(200).json({
        success: true,
        data: {
          message: `🎉 Successfully deployed ${totalFieldsDeployed} fields via Enhanced Metadata API!`,
          deploymentResults,
          summary: {
            totalFieldsDeployed,
            documentsFieldsDeployed: deploymentResults.documents.fieldsDeployed,
            faqsFieldsDeployed: deploymentResults.faqs.fieldsDeployed,
            deploymentMethod: 'ZIP-based Metadata API'
          },
          validationResult
        }
      })
    } else {
      logger.error('Automated field deployment failed', {
        documentsError: deploymentResults.documents.error,
        faqsError: deploymentResults.faqs.error,
        userId: sessionData.userInfo.user_id
      })

      return res.status(400).json({
        success: false,
        error: 'Field deployment partially failed',
        data: {
          deploymentResults,
          summary: {
            totalFieldsAttempted: totalMissingFields,
            documentsSuccess: deploymentResults.documents.success,
            faqsSuccess: deploymentResults.faqs.success
          }
        }
      })
    }

  } catch (error) {
    logger.error('Field deployment API error', {
      error: error instanceof Error ? error.message : error
    })

    return res.status(500).json({
      success: false,
      error: 'Internal server error during field deployment'
    })
  }
} 