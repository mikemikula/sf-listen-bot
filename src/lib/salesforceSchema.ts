/**
 * Salesforce Schema Management
 * Automated deployment and management of custom objects and fields
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { logger } from './logger'
import type { 
  SalesforceTokenResponse, 
  SalesforceUserInfo,
  ApiResponse 
} from '@/types'

/**
 * Schema definition for Slack Document custom object
 */
const SLACK_DOCUMENT_SCHEMA = {
  fullName: 'Slack_Document__c',
  label: 'Slack Document',
  pluralLabel: 'Slack Documents',
  description: 'Documents processed from Slack channels',
  deploymentStatus: 'Deployed',
  sharingModel: 'ReadWrite',
  enableActivities: true,
  enableReports: true,
  enableSearch: true,
  enableSharing: true,
  enableBulkApi: true,
  enableStreamingApi: true,
  fields: [
    {
      fullName: 'Document_ID__c',
      label: 'Document ID',
      type: 'Text',
      length: 255,
      unique: true,
      externalId: true,
      required: true,
      description: 'Unique identifier from the source system'
    },
    {
      fullName: 'Title__c',
      label: 'Title',
      type: 'Text',
      length: 255,
      required: true,
      description: 'Document title or subject'
    },
    {
      fullName: 'Content__c',
      label: 'Content',
      type: 'LongTextArea',
      length: 32768,
      visibleLines: 10,
      description: 'Full document content'
    },
    {
      fullName: 'Channel_Name__c',
      label: 'Channel Name',
      type: 'Text',
      length: 100,
      description: 'Slack channel where document originated'
    },
    {
      fullName: 'Author__c',
      label: 'Author',
      type: 'Text',
      length: 100,
      description: 'Document author or creator'
    },
    {
      fullName: 'Source_URL__c',
      label: 'Source URL',
      type: 'Url',
      description: 'Link to original document or message'
    },
    {
      fullName: 'Tags__c',
      label: 'Tags',
      type: 'Text',
      length: 500,
      description: 'Comma-separated tags for categorization'
    },
    {
      fullName: 'Word_Count__c',
      label: 'Word Count',
      type: 'Number',
      precision: 10,
      scale: 0,
      description: 'Number of words in the document'
    },
    {
      fullName: 'Processed_Date__c',
      label: 'Processed Date',
      type: 'DateTime',
      required: true,
      description: 'When the document was processed and synced'
    },
    {
      fullName: 'Status__c',
      label: 'Status',
      type: 'Picklist',
      description: 'Processing status of the document',
      valueSet: {
        restricted: true,
        valueSetDefinition: {
          value: [
            { fullName: 'Draft', default: true, label: 'Draft' },
            { fullName: 'Processed', default: false, label: 'Processed' },
            { fullName: 'Published', default: false, label: 'Published' },
            { fullName: 'Archived', default: false, label: 'Archived' }
          ]
        }
      }
    }
  ]
}

/**
 * Schema definition for Slack FAQ custom object
 */
const SLACK_FAQ_SCHEMA = {
  fullName: 'Slack_FAQ__c',
  label: 'Slack FAQ',
  pluralLabel: 'Slack FAQs',
  description: 'Frequently Asked Questions generated from Slack conversations',
  deploymentStatus: 'Deployed',
  sharingModel: 'ReadWrite',
  enableActivities: true,
  enableReports: true,
  enableSearch: true,
  enableSharing: true,
  enableBulkApi: true,
  enableStreamingApi: true,
  fields: [
    {
      fullName: 'FAQ_ID__c',
      label: 'FAQ ID',
      type: 'Text',
      length: 255,
      unique: true,
      externalId: true,
      required: true,
      description: 'Unique identifier for the FAQ'
    },
    {
      fullName: 'Question__c',
      label: 'Question',
      type: 'Text',
      length: 500,
      required: true,
      description: 'The frequently asked question'
    },
    {
      fullName: 'Answer__c',
      label: 'Answer',
      type: 'LongTextArea',
      length: 32768,
      visibleLines: 10,
      required: true,
      description: 'The answer to the question'
    },
    {
      fullName: 'Category__c',
      label: 'Category',
      type: 'Text',
      length: 100,
      description: 'FAQ category for organization'
    },
    {
      fullName: 'Source_Document__c',
      label: 'Source Document',
      type: 'Lookup',
      referenceTo: 'Slack_Document__c',
      relationshipLabel: 'FAQs',
      relationshipName: 'FAQs',
      description: 'Related source document'
    },
    {
      fullName: 'Channel_Name__c',
      label: 'Channel Name',
      type: 'Text',
      length: 100,
      description: 'Slack channel where FAQ originated'
    },
    {
      fullName: 'Confidence_Score__c',
      label: 'Confidence Score',
      type: 'Number',
      precision: 5,
      scale: 2,
      description: 'AI confidence score for the FAQ (0-100)'
    },
    {
      fullName: 'View_Count__c',
      label: 'View Count',
      type: 'Number',
      precision: 10,
      scale: 0,
      defaultValue: '0',
      description: 'Number of times this FAQ has been viewed'
    },
    {
      fullName: 'Helpful_Count__c',
      label: 'Helpful Count',
      type: 'Number',
      precision: 10,
      scale: 0,
      defaultValue: '0',
      description: 'Number of times marked as helpful'
    },
    {
      fullName: 'Generated_Date__c',
      label: 'Generated Date',
      type: 'DateTime',
      required: true,
      description: 'When the FAQ was generated'
    },
    {
      fullName: 'Last_Updated__c',
      label: 'Last Updated',
      type: 'DateTime',
      description: 'When the FAQ was last updated'
    },
    {
      fullName: 'Status__c',
      label: 'Status',
      type: 'Picklist',
      description: 'FAQ status',
      valueSet: {
        restricted: true,
        valueSetDefinition: {
          value: [
            { fullName: 'Draft', default: true, label: 'Draft' },
            { fullName: 'Review', default: false, label: 'Under Review' },
            { fullName: 'Published', default: false, label: 'Published' },
            { fullName: 'Archived', default: false, label: 'Archived' }
          ]
        }
      }
    }
  ]
}

/**
 * Salesforce Schema Manager Class
 */
export class SalesforceSchemaManager {
  private tokenResponse: SalesforceTokenResponse
  private userInfo: SalesforceUserInfo

  constructor(tokenResponse: SalesforceTokenResponse, userInfo: SalesforceUserInfo) {
    this.tokenResponse = tokenResponse
    this.userInfo = userInfo
  }

  /**
   * Deploy all required custom objects
   */
  async deploySchema(): Promise<{
    success: boolean
    results: {
      documents: { success: boolean; id?: string; error?: string }
      faqs: { success: boolean; id?: string; error?: string }
    }
    error?: string
  }> {
    try {
      logger.info('Starting Salesforce schema deployment', {
        orgId: this.userInfo.organization_id,
        userId: this.userInfo.user_id
      })

      // Try Tooling API first
      const toolingResult = await this.deployViaToolingAPI()
      
      if (toolingResult.success) {
        logger.info('Schema deployment successful via Tooling API', {
          documentResult: toolingResult.results.documents.success,
          faqResult: toolingResult.results.faqs.success
        })
        return toolingResult
      } else {
        logger.warn('Tooling API deployment failed, attempting Metadata API fallback', {
          toolingError: toolingResult.error
        })

        // Fallback to Metadata API
        const metadataResult = await this.deployViaMetadataAPI()
        
        if (metadataResult.success) {
          logger.info('Schema deployment successful via Metadata API fallback', {
            documentResult: metadataResult.results.documents.success,
            faqResult: metadataResult.results.faqs.success
          })
          return metadataResult
        } else {
          logger.error('Both Tooling API and Metadata API deployment failed', {
            toolingError: toolingResult.error,
            metadataError: metadataResult.error
          })
          
          return {
            success: false,
            results: {
              documents: { 
                success: false, 
                error: `Tooling API: ${toolingResult.error}; Metadata API: ${metadataResult.error}` 
              },
              faqs: { 
                success: false, 
                error: 'All deployment methods failed' 
              }
            },
            error: `All deployment methods failed. Tooling API: ${toolingResult.error}. Metadata API: ${metadataResult.error}`
          }
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Schema deployment failed', {
        error: errorMessage,
        orgId: this.userInfo.organization_id
      })

      return {
        success: false,
        results: {
          documents: { success: false, error: errorMessage },
          faqs: { success: false, error: 'Deployment aborted' }
        },
        error: errorMessage
      }
    }
  }

  /**
   * Deploy schema selectively - only create missing objects
   */
  async deploySchemaSelective(options: {
    createDocuments: boolean
    createFaqs: boolean
    validationResult: any
  }): Promise<{
    success: boolean
    results: {
      documents: { success: boolean; id?: string; error?: string }
      faqs: { success: boolean; id?: string; error?: string }
    }
    error?: string
  }> {
    logger.info('Starting selective schema deployment', {
      createDocuments: options.createDocuments,
      createFaqs: options.createFaqs
    })

    // If neither object needs to be created, provide guidance for field addition
    if (!options.createDocuments && !options.createFaqs) {
      const documentsNeedsFields = options.validationResult.documentsObject.exists && 
                                   options.validationResult.documentsObject.missingFields.length > 0
      const faqsNeedsFields = options.validationResult.faqsObject.exists && 
                              options.validationResult.faqsObject.missingFields.length > 0

      if (documentsNeedsFields || faqsNeedsFields) {
        return {
          success: false,
          results: {
            documents: { 
              success: false, 
              error: documentsNeedsFields ? 
                `Object exists but missing ${options.validationResult.documentsObject.missingFields.length} fields. Use manual deployment.` :
                'Object complete'
            },
            faqs: { 
              success: false, 
              error: faqsNeedsFields ? 
                `Object exists but missing ${options.validationResult.faqsObject.missingFields.length} fields. Use manual deployment.` :
                'Object complete'
            }
          },
          error: 'Objects exist but missing fields. Manual deployment required for field addition.'
        }
      }
    }

    // If both need to be created, use full deployment
    if (options.createDocuments && options.createFaqs) {
      logger.info('Both objects need creation - using full deployment')
      return await this.deploySchema()
    }

    // Selective deployment - only create what's missing
    try {
      logger.info('Starting selective Salesforce schema deployment', {
        orgId: this.userInfo.organization_id,
        userId: this.userInfo.user_id,
        createDocuments: options.createDocuments,
        createFaqs: options.createFaqs
      })

      // For selective deployment, we'll use the metadata API which handles single objects better
      const metadataService = await import('./salesforceMetadataService')
      const service = new metadataService.SalesforceMetadataService(this.tokenResponse, this.userInfo)
      
             const results: {
         documents: { success: boolean; error: string | undefined }
         faqs: { success: boolean; error: string | undefined }
       } = {
         documents: { success: true, error: undefined },
         faqs: { success: true, error: undefined }
       }

      // Create documents object if needed
      if (options.createDocuments) {
        logger.info('Creating Slack Document object (selective deployment)')
        const docResult = await service.createCustomObjectViaSOAP('Slack_Document__c', {
          label: 'Slack Document',
          pluralLabel: 'Slack Documents',
          description: 'Documents processed from Slack channels',
          deploymentStatus: 'Deployed',
          sharingModel: 'ReadWrite',
          enableActivities: true,
          enableReports: true,
          enableSearch: true,
          enableSharing: true,
          enableBulkApi: true,
          enableStreamingApi: true,
          nameField: {
            type: 'AutoNumber',
            label: 'Document Number',
            displayFormat: 'DOC-{00000}',
            startingNumber: 1
          }
        })

                 results.documents = { 
           success: docResult.success, 
           error: docResult.error !== undefined ? docResult.error : undefined 
         }
         
         // Create fields for documents if object creation succeeded
         if (docResult.success) {
           const fieldsResult = await service.createFieldsForObject('Slack_Document__c', service.getDocumentFields())
           if (!fieldsResult.success) {
             results.documents = { success: false, error: `Object created but fields failed: ${fieldsResult.error}` }
           }
         }
      } else {
        results.documents = { success: true, error: 'Skipped - already exists' }
      }

      // Create FAQs object if needed
      if (options.createFaqs) {
        logger.info('Creating Slack FAQ object (selective deployment)')
        const faqResult = await service.createCustomObjectViaSOAP('Slack_FAQ__c', {
          label: 'Slack FAQ',
          pluralLabel: 'Slack FAQs',
          description: 'Frequently Asked Questions generated from Slack conversations',
          deploymentStatus: 'Deployed',
          sharingModel: 'ReadWrite',
          enableActivities: true,
          enableReports: true,
          enableSearch: true,
          enableSharing: true,
          enableBulkApi: true,
          enableStreamingApi: true,
          nameField: {
            type: 'AutoNumber',
            label: 'FAQ Number',
            displayFormat: 'FAQ-{00000}',
            startingNumber: 1
          }
        })

                 results.faqs = { 
           success: faqResult.success, 
           error: faqResult.error !== undefined ? faqResult.error : undefined 
         }

        // Create fields for FAQs if object creation succeeded
        if (faqResult.success) {
          const fieldsResult = await service.createFieldsForObject('Slack_FAQ__c', service.getFaqFields())
          if (!fieldsResult.success) {
            results.faqs = { success: false, error: `Object created but fields failed: ${fieldsResult.error}` }
          }
        }
      } else {
        results.faqs = { success: true, error: 'Skipped - already exists' }
      }

      const overallSuccess = results.documents.success && results.faqs.success

      if (overallSuccess) {
        logger.info('Selective schema deployment successful', {
          documentsCreated: options.createDocuments,
          faqsCreated: options.createFaqs
        })
      } else {
        logger.error('Selective schema deployment failed', {
          documentsError: results.documents.error,
          faqsError: results.faqs.error
        })
      }

      return {
        success: overallSuccess,
        results,
        error: overallSuccess ? undefined : 'Some objects failed to deploy'
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Selective schema deployment failed', {
        error: errorMessage,
        orgId: this.userInfo.organization_id
      })

      return {
        success: false,
        results: {
          documents: { success: false, error: errorMessage },
          faqs: { success: false, error: 'Deployment aborted' }
        },
        error: errorMessage
      }
    }
  }

  /**
   * Deploy using Tooling API (original approach)
   */
  private async deployViaToolingAPI(): Promise<{
    success: boolean
    results: {
      documents: { success: boolean; id?: string; error?: string }
      faqs: { success: boolean; id?: string; error?: string }
    }
    error?: string
  }> {
    // Deploy Document object first (FAQ depends on it)
    const documentResult = await this.deployCustomObject(SLACK_DOCUMENT_SCHEMA)
    
    let faqResult: { success: boolean; id?: string; error?: string } = { 
      success: false, 
      error: 'Skipped due to document deployment failure' 
    }
    
    if (documentResult.success) {
      // Deploy FAQ object with lookup to Document
      faqResult = await this.deployCustomObject(SLACK_FAQ_SCHEMA)
    }

    const overallSuccess = documentResult.success && faqResult.success

    return {
      success: overallSuccess,
      results: {
        documents: documentResult,
        faqs: faqResult
      },
      error: overallSuccess ? undefined : (documentResult.error || faqResult.error)
    }
  }

  /**
   * Deploy using Metadata API (robust fallback)
   */
  private async deployViaMetadataAPI(): Promise<{
    success: boolean
    results: {
      documents: { success: boolean; id?: string; error?: string }
      faqs: { success: boolean; id?: string; error?: string }
    }
    error?: string
  }> {
    // Import and use the robust Metadata API service
    const { createMetadataService } = await import('./salesforceMetadataService')
    const metadataService = createMetadataService(this.tokenResponse, this.userInfo)
    
    return await metadataService.deploySchemaViaMetadataAPI()
  }

  /**
   * Remove all custom objects (cleanup)
   */
  async removeSchema(): Promise<{
    success: boolean
    results: {
      documents: { success: boolean; error?: string }
      faqs: { success: boolean; error?: string }
    }
    error?: string
  }> {
    try {
      logger.info('Starting Salesforce schema removal', {
        orgId: this.userInfo.organization_id,
        userId: this.userInfo.user_id
      })

      // Remove FAQ object first (due to lookup dependency)
      const faqResult = await this.removeCustomObject('Slack_FAQ__c')
      
      // Remove Document object
      const documentResult = await this.removeCustomObject('Slack_Document__c')

      const overallSuccess = documentResult.success && faqResult.success

      logger.info('Schema removal completed', {
        success: overallSuccess,
        documentResult: documentResult.success,
        faqResult: faqResult.success
      })

      return {
        success: overallSuccess,
        results: {
          documents: documentResult,
          faqs: faqResult
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Schema removal failed', {
        error: errorMessage,
        orgId: this.userInfo.organization_id
      })

      return {
        success: false,
        results: {
          documents: { success: false, error: errorMessage },
          faqs: { success: false, error: errorMessage }
        },
        error: errorMessage
      }
    }
  }

  /**
   * Check current schema status
   */
  async getSchemaStatus(): Promise<{
    success: boolean
    objects: {
      documents: { exists: boolean; id?: string; fieldCount?: number }
      faqs: { exists: boolean; id?: string; fieldCount?: number }
    }
    error?: string
  }> {
    try {
      const [documentStatus, faqStatus] = await Promise.all([
        this.getObjectStatus('Slack_Document__c'),
        this.getObjectStatus('Slack_FAQ__c')
      ])

      return {
        success: true,
        objects: {
          documents: documentStatus,
          faqs: faqStatus
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get schema status', {
        error: errorMessage,
        orgId: this.userInfo.organization_id
      })

      return {
        success: false,
        objects: {
          documents: { exists: false },
          faqs: { exists: false }
        },
        error: errorMessage
      }
    }
  }

  /**
   * Deploy a single custom object using Tooling API
   */
  private async deployCustomObject(objectSchema: any): Promise<{
    success: boolean
    id?: string
    error?: string
  }> {
    try {
      const toolingApiUrl = `${this.tokenResponse.instance_url}/services/data/v59.0/tooling/sobjects/CustomObject`

      // Transform our schema to Salesforce Tooling API format (no Metadata wrapper)
      const customObjectMetadata = {
        fullName: objectSchema.fullName,
        label: objectSchema.label,
        pluralLabel: objectSchema.pluralLabel,
        description: objectSchema.description,
        deploymentStatus: objectSchema.deploymentStatus,
        sharingModel: objectSchema.sharingModel,
        enableActivities: objectSchema.enableActivities,
        enableReports: objectSchema.enableReports,
        enableSearch: objectSchema.enableSearch,
        enableSharing: objectSchema.enableSharing,
        enableBulkApi: objectSchema.enableBulkApi,
        enableStreamingApi: objectSchema.enableStreamingApi,
        nameField: {
          type: 'AutoNumber',
          label: `${objectSchema.label} Number`,
          displayFormat: 'DOC-{00000}',
          startingNumber: 1
        }
      }

      logger.info('Attempting to create custom object via Tooling API', {
        objectName: objectSchema.fullName,
        url: toolingApiUrl,
        metadata: customObjectMetadata
      })

      const response = await fetch(toolingApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tokenResponse.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customObjectMetadata)
      })

      const result = await response.json()

      logger.info('Tooling API response received', {
        objectName: objectSchema.fullName,
        status: response.status,
        ok: response.ok,
        result: result
      })

      if (response.ok && result.success) {
        logger.info('Custom object created successfully', {
          objectName: objectSchema.fullName,
          id: result.id
        })

        // Now create the custom fields
        await this.createCustomFields(objectSchema.fullName, objectSchema.fields)

        return {
          success: true,
          id: result.id
        }
      } else {
        const errorMessage = result.message || result.error || 'Failed to create custom object'
        logger.error('Failed to create custom object', {
          objectName: objectSchema.fullName,
          error: errorMessage,
          response: result,
          fullResponse: JSON.stringify(result)
        })

        return {
          success: false,
          error: errorMessage
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Custom object deployment error', {
        objectName: objectSchema.fullName,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Create custom fields for an object
   */
  private async createCustomFields(objectName: string, fields: any[]): Promise<void> {
    const toolingApiUrl = `${this.tokenResponse.instance_url}/services/data/v59.0/tooling/sobjects/CustomField`

    for (const field of fields) {
      try {
        const fieldMetadata = {
          fullName: `${objectName}.${field.fullName}`,
          label: field.label,
          type: field.type,
          description: field.description,
          required: field.required || false,
          unique: field.unique || false,
          externalId: field.externalId || false,
          length: field.length,
          precision: field.precision,
          scale: field.scale,
          visibleLines: field.visibleLines,
          defaultValue: field.defaultValue,
          referenceTo: field.referenceTo,
          relationshipLabel: field.relationshipLabel,
          relationshipName: field.relationshipName,
          valueSet: field.valueSet
        }

        const response = await fetch(toolingApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.tokenResponse.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(fieldMetadata)
        })

        const result = await response.json()

        if (response.ok && result.success) {
          logger.info('Custom field created successfully', {
            objectName,
            fieldName: field.fullName,
            id: result.id
          })
        } else {
          logger.error('Failed to create custom field', {
            objectName,
            fieldName: field.fullName,
            error: result.message || result.error
          })
        }

        // Small delay between field creations to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        logger.error('Custom field creation error', {
          objectName,
          fieldName: field.fullName,
          error: error instanceof Error ? error.message : error
        })
      }
    }
  }

  /**
   * Remove a custom object
   */
  private async removeCustomObject(objectName: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // First, get the object ID
      const queryUrl = `${this.tokenResponse.instance_url}/services/data/v59.0/tooling/query`
      const query = `SELECT Id FROM CustomObject WHERE DeveloperName = '${objectName.replace('__c', '')}'`

      const queryResponse = await fetch(`${queryUrl}?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${this.tokenResponse.access_token}`
        }
      })

      const queryResult = await queryResponse.json()

      if (queryResult.records && queryResult.records.length > 0) {
        const objectId = queryResult.records[0].Id

        // Delete the object
        const deleteUrl = `${this.tokenResponse.instance_url}/services/data/v59.0/tooling/sobjects/CustomObject/${objectId}`

        const deleteResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.tokenResponse.access_token}`
          }
        })

        if (deleteResponse.ok) {
          logger.info('Custom object removed successfully', {
            objectName,
            id: objectId
          })

          return { success: true }
        } else {
          const error = await deleteResponse.text()
          return { success: false, error }
        }
      } else {
        return { success: true } // Object doesn't exist, consider it success
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Custom object removal error', {
        objectName,
        error: errorMessage
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Get status of a custom object
   */
  private async getObjectStatus(objectName: string): Promise<{
    exists: boolean
    id?: string
    fieldCount?: number
  }> {
    try {
      const queryUrl = `${this.tokenResponse.instance_url}/services/data/v59.0/tooling/query`
      const query = `SELECT Id, DeveloperName FROM CustomObject WHERE DeveloperName = '${objectName.replace('__c', '')}'`

      const response = await fetch(`${queryUrl}?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${this.tokenResponse.access_token}`
        }
      })

      const result = await response.json()

      if (result.records && result.records.length > 0) {
        const objectId = result.records[0].Id

        // Get field count
        const fieldQuery = `SELECT COUNT() FROM CustomField WHERE TableEnumOrId = '${objectId}'`
        const fieldResponse = await fetch(`${queryUrl}?q=${encodeURIComponent(fieldQuery)}`, {
          headers: {
            'Authorization': `Bearer ${this.tokenResponse.access_token}`
          }
        })

        const fieldResult = await fieldResponse.json()
        const fieldCount = fieldResult.records?.[0]?.expr0 || 0

        return {
          exists: true,
          id: objectId,
          fieldCount
        }
      } else {
        return { exists: false }
      }

    } catch (error) {
      logger.error('Object status check error', {
        objectName,
        error: error instanceof Error ? error.message : error
      })

      return { exists: false }
    }
  }
}

/**
 * Create a schema manager instance
 */
export function createSchemaManager(
  tokenResponse: SalesforceTokenResponse,
  userInfo: SalesforceUserInfo
): SalesforceSchemaManager {
  return new SalesforceSchemaManager(tokenResponse, userInfo)
} 