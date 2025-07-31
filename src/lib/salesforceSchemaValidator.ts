/**
 * Salesforce Schema Validator
 * Validates existing schema and identifies missing components
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { logger } from './logger'

/**
 * Salesforce Token Response interface
 */
interface SalesforceTokenResponse {
  access_token: string
  instance_url: string
  token_type: string
}

/**
 * Object validation result interface
 */
interface ObjectValidationResult {
  exists: boolean
  valid: boolean
  missingFields: string[]
  errors: string[]
}

/**
 * Schema validation result interface
 */
interface SchemaValidationResult {
  success: boolean
  documentsObject: ObjectValidationResult
  faqsObject: ObjectValidationResult
  message: string
  recommendedAction: 'none' | 'create_objects' | 'add_fields' | 'manual_review'
}

/**
 * Salesforce Schema Validator Class
 * Handles validation of existing schema and identification of missing components
 */
export class SalesforceSchemaValidator {
  private tokenResponse: SalesforceTokenResponse

  constructor(tokenResponse: SalesforceTokenResponse) {
    this.tokenResponse = tokenResponse
  }

  /**
   * Validate complete schema - objects and fields
   */
  async validateSchema(): Promise<SchemaValidationResult> {
    try {
      logger.info('Starting comprehensive schema validation')

      // Validate Documents object
      const documentsResult = await this.validateObject('Slack_Document__c', this.getRequiredDocumentFields())
      
      // Validate FAQs object  
      const faqsResult = await this.validateObject('Slack_FAQ__c', this.getRequiredFaqFields())

      // Determine overall status and recommended action
      const result = this.determineValidationResult(documentsResult, faqsResult)

      logger.info('Schema validation completed', {
        documentsExists: documentsResult.exists,
        documentsValid: documentsResult.valid,
        faqsExists: faqsResult.exists,
        faqsValid: faqsResult.valid,
        recommendedAction: result.recommendedAction
      })

      return result

    } catch (error) {
      logger.error('Schema validation failed', {
        error: error instanceof Error ? error.message : error
      })

      return {
        success: false,
        documentsObject: { exists: false, valid: false, missingFields: [], errors: ['Validation failed'] },
        faqsObject: { exists: false, valid: false, missingFields: [], errors: ['Validation failed'] },
        message: 'Schema validation failed due to an error',
        recommendedAction: 'manual_review'
      }
    }
  }

  /**
   * Validate a single object and its required fields
   */
  private async validateObject(objectName: string, requiredFields: string[]): Promise<ObjectValidationResult> {
    try {
      logger.info('Validating object', { objectName, requiredFieldCount: requiredFields.length })

      // Check if object exists
      const describeUrl = `${this.tokenResponse.instance_url}/services/data/v59.0/sobjects/${objectName}/describe`
      
      const response = await fetch(describeUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.tokenResponse.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.status === 404) {
        logger.info('Object does not exist', { objectName })
        return {
          exists: false,
          valid: false,
          missingFields: requiredFields,
          errors: [`Object ${objectName} does not exist`]
        }
      }

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('Failed to describe object', {
          objectName,
          status: response.status,
          error: errorText
        })

        return {
          exists: false,
          valid: false,
          missingFields: requiredFields,
          errors: [`Failed to describe object: ${response.status} ${errorText}`]
        }
      }

      const objectMetadata = await response.json()
      
      // Object exists, now validate fields
      const existingFields = objectMetadata.fields.map((field: any) => field.name)
      const missingFields = requiredFields.filter(required => !existingFields.includes(required))

      const isValid = missingFields.length === 0

      logger.info('Object validation completed', {
        objectName,
        exists: true,
        valid: isValid,
        existingFieldCount: existingFields.length,
        missingFieldCount: missingFields.length,
        missingFields
      })

      return {
        exists: true,
        valid: isValid,
        missingFields,
        errors: isValid ? [] : [`Missing ${missingFields.length} required fields`]
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Object validation error', {
        objectName,
        error: errorMessage
      })

      return {
        exists: false,
        valid: false,
        missingFields: requiredFields,
        errors: [errorMessage]
      }
    }
  }

  /**
   * Determine the overall validation result and recommended action
   */
  private determineValidationResult(
    documentsResult: ObjectValidationResult,
    faqsResult: ObjectValidationResult
  ): SchemaValidationResult {
    
    // Both objects exist and are valid
    if (documentsResult.exists && documentsResult.valid && faqsResult.exists && faqsResult.valid) {
      return {
        success: true,
        documentsObject: documentsResult,
        faqsObject: faqsResult,
        message: '✅ Schema is fully deployed and valid! All required objects and fields are present.',
        recommendedAction: 'none'
      }
    }

    // Objects exist but missing some fields
    if (documentsResult.exists && faqsResult.exists) {
      const totalMissingFields = documentsResult.missingFields.length + faqsResult.missingFields.length
      
      return {
        success: false,
        documentsObject: documentsResult,
        faqsObject: faqsResult,
        message: `⚠️ Objects exist but missing ${totalMissingFields} required fields. Only missing fields need to be added.`,
        recommendedAction: 'add_fields'
      }
    }

    // Some objects don't exist
    const missingObjects = []
    if (!documentsResult.exists) missingObjects.push('Slack_Document__c')
    if (!faqsResult.exists) missingObjects.push('Slack_FAQ__c')

    return {
      success: false,
      documentsObject: documentsResult,
      faqsObject: faqsResult,
      message: `❌ Missing objects: ${missingObjects.join(', ')}. Full schema deployment required.`,
      recommendedAction: 'create_objects'
    }
  }

  /**
   * Get required fields for Document object
   */
  private getRequiredDocumentFields(): string[] {
    return [
      'Document_ID__c',
      'Channel_ID__c', 
      'Channel_Name__c',
      'Thread_ID__c',
      'Content__c',
      'Author__c',
      'Message_Count__c',
      'Timestamp__c',
      'Status__c',
      'Processing_Status__c',
      'Document_Type__c',
      'Tags__c'
    ]
  }

  /**
   * Get required fields for FAQ object
   */
  private getRequiredFaqFields(): string[] {
    return [
      'Question__c',
      'Answer__c',
      'Document__c', // Lookup to Slack_Document__c
      'Channel_ID__c',
      'Channel_Name__c', 
      'Status__c',
      'Confidence_Score__c',
      'Source_Messages__c',
      'Category__c'
    ]
  }
}

/**
 * Factory function to create schema validator
 */
export function createSchemaValidator(tokenResponse: SalesforceTokenResponse): SalesforceSchemaValidator {
  return new SalesforceSchemaValidator(tokenResponse)
} 