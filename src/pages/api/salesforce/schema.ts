/**
 * Salesforce Schema Management API
 * Deploy, remove, and check status of custom objects
 * 
 * @author AI Assistant  
 * @version 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '@/lib/logger'
import { withAuth } from '@/lib/salesforceAuth'
import { getSalesforceConnection } from '@/lib/salesforceSessionStore'
import { SalesforceCLI } from '@/lib/salesforceCLI'
import { 
  SLACK_DOCUMENT_SCHEMA, 
  SLACK_FAQ_SCHEMA 
} from '@/lib/salesforceSchema'

// Expected field counts
const EXPECTED_FIELDS = {
  documents: SLACK_DOCUMENT_SCHEMA.fields.map(f => f.fullName),
  faqs: SLACK_FAQ_SCHEMA.fields.map(f => f.fullName)
}

export default withAuth(async (
  req: NextApiRequest,
  res: NextApiResponse,
  { sessionId, userId }
) => {
  logger.info('Schema API request', { 
    method: req.method,
    sessionId: sessionId.substring(0, 10) + '...',
    userId
  })

  try {
    // Get Salesforce connection details
    const connection = await getSalesforceConnection(userId)
    if (!connection) {
      return res.status(401).json({ 
        success: false, 
        error: 'No Salesforce connection found' 
      })
    }

    const cli = new SalesforceCLI()
    
    // Check if CLI is available
    const cliAvailable = await cli.checkCLI()
    if (!cliAvailable) {
      logger.warn('SF CLI not available, falling back to API validation')
      // Fall back to basic API validation
      return handleAPIValidation(req, res, connection)
    }

    // Authenticate CLI with current session
    const authenticated = await cli.authenticate(
      connection.accessToken,
      connection.instanceUrl
    )
    
    if (!authenticated) {
      logger.warn('CLI authentication failed, falling back to API validation')
      return handleAPIValidation(req, res, connection)
    }

    switch (req.method) {
      case 'GET':
        return handleGetSchemaStatus(req, res, cli)
      case 'POST':
        return handleDeploySchema(req, res, cli)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    logger.error('Schema API error', { error })
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    })
  }
})

async function handleGetSchemaStatus(
  req: NextApiRequest,
  res: NextApiResponse,
  cli: SalesforceCLI
) {
  logger.info('Checking schema status via SF CLI')

  // Validate both objects
  const [documentsValidation, faqsValidation] = await Promise.all([
    cli.validateSchema('Slack_Document__c', EXPECTED_FIELDS.documents),
    cli.validateSchema('Slack_FAQ__c', EXPECTED_FIELDS.faqs)
  ])

  const overallValid = documentsValidation.valid && faqsValidation.valid
  
  const result: any = {
    success: overallValid,
    valid: overallValid,
    objects: {
      documents: {
        exists: documentsValidation.exists,
        valid: documentsValidation.valid,
        fieldCount: documentsValidation.missingFields.length,
        totalFields: EXPECTED_FIELDS.documents.length,
        deployedFields: EXPECTED_FIELDS.documents.length - documentsValidation.missingFields.length,
        missingFields: documentsValidation.missingFields,
        extraFields: documentsValidation.extraFields
      },
      faqs: {
        exists: faqsValidation.exists,
        valid: faqsValidation.valid,
        fieldCount: faqsValidation.missingFields.length,
        totalFields: EXPECTED_FIELDS.faqs.length,
        deployedFields: EXPECTED_FIELDS.faqs.length - faqsValidation.missingFields.length,
        missingFields: faqsValidation.missingFields,
        extraFields: faqsValidation.extraFields
      }
    }
  }

  // Determine recommended action
  if (!documentsValidation.exists || !faqsValidation.exists) {
    result.recommendedAction = 'create_objects'
    result.message = '⚠️ One or more objects need to be created'
  } else if (!overallValid) {
    const totalMissing = documentsValidation.missingFields.length + faqsValidation.missingFields.length
    result.recommendedAction = 'add_fields'
    result.message = `⚠️ Objects exist but missing ${totalMissing} required fields`
  } else {
    result.recommendedAction = 'none'
    result.message = '✅ Schema is fully deployed and ready'
  }

  logger.info('Schema validation completed', { 
    success: result.success,
    recommendedAction: result.recommendedAction
  })

  return res.status(200).json(result)
}

async function handleDeploySchema(
  req: NextApiRequest,
  res: NextApiResponse,
  cli: SalesforceCLI
) {
  logger.info('Starting schema deployment via SF CLI')

  try {
    // Deploy using existing SFDX metadata files
    const deployResult = await cli.deployMetadata('force-app')
    
    if (!deployResult.success) {
      logger.error('Schema deployment failed', { 
        errors: deployResult.errors 
      })
      
      return res.status(400).json({
        success: false,
        error: 'Deployment failed',
        details: deployResult.errors
      })
    }

    logger.info('Schema deployment successful', {
      deploymentId: deployResult.deploymentId,
      componentsSummary: deployResult.componentsSummary
    })

    // Wait for metadata to propagate
    logger.info('Waiting for Salesforce metadata to propagate...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Validate the deployment
    const [documentsValidation, faqsValidation] = await Promise.all([
      cli.validateSchema('Slack_Document__c', EXPECTED_FIELDS.documents),
      cli.validateSchema('Slack_FAQ__c', EXPECTED_FIELDS.faqs)
    ])

    const overallSuccess = documentsValidation.valid && faqsValidation.valid

    return res.status(200).json({
      success: overallSuccess,
      message: overallSuccess 
        ? '✅ Schema deployed successfully' 
        : '⚠️ Deployment completed but validation shows issues',
      deploymentId: deployResult.deploymentId,
      componentsSummary: deployResult.componentsSummary,
      validationResult: {
        documentsObject: documentsValidation,
        faqsObject: faqsValidation
      }
    })
  } catch (error) {
    logger.error('Schema deployment error', { error })
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Deployment failed'
    })
  }
}

// Fallback API validation when CLI is not available
async function handleAPIValidation(
  req: NextApiRequest,
  res: NextApiResponse,
  connection: any
) {
  if (req.method === 'GET') {
    // Simple status check
    return res.status(200).json({
      success: false,
      valid: false,
      message: '⚠️ SF CLI not available - manual deployment required',
      objects: {
        documents: {
          exists: false,
          valid: false,
          fieldCount: EXPECTED_FIELDS.documents.length,
          totalFields: EXPECTED_FIELDS.documents.length,
          deployedFields: 0
        },
        faqs: {
          exists: false,
          valid: false,
          fieldCount: EXPECTED_FIELDS.faqs.length,
          totalFields: EXPECTED_FIELDS.faqs.length,
          deployedFields: 0
        }
      },
      recommendedAction: 'install_cli'
    })
  } else {
    return res.status(400).json({
      success: false,
      error: 'SF CLI required for deployment. Please run: npm install -g @salesforce/cli'
    })
  }
} 