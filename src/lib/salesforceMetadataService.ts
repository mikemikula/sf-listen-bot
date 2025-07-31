/**
 * Salesforce Metadata API Service
 * Production-ready implementation using SOAP Metadata API for custom object creation
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
 * Metadata API Service for reliable custom object creation
 * Uses the proven SOAP-based Metadata API approach
 */
export class SalesforceMetadataService {
  private tokenResponse: SalesforceTokenResponse
  private userInfo: SalesforceUserInfo

  constructor(tokenResponse: SalesforceTokenResponse, userInfo: SalesforceUserInfo) {
    this.tokenResponse = tokenResponse
    this.userInfo = userInfo
  }

  /**
   * Deploy custom objects using reliable Metadata API approach
   */
  async deploySchemaViaMetadataAPI(): Promise<{
    success: boolean
    results: {
      documents: { success: boolean; id?: string; error?: string }
      faqs: { success: boolean; id?: string; error?: string }
    }
    error?: string
  }> {
    try {
      logger.info('Starting reliable Metadata API schema deployment', {
        orgId: this.userInfo.organization_id,
        userId: this.userInfo.user_id
      })

      // Use the proven MetadataService approach
      const deployResult = await this.deployUsingMetadataService()
      
      if (deployResult.success) {
        logger.info('Metadata API deployment successful', {
          documentsCreated: deployResult.documentsCreated,
          faqsCreated: deployResult.faqsCreated
        })

        return {
          success: true,
          results: {
            documents: { success: deployResult.documentsCreated, id: 'metadata-deploy' },
            faqs: { success: deployResult.faqsCreated, id: 'metadata-deploy' }
          }
        }
      } else {
        logger.error('Metadata API deployment failed', {
          error: deployResult.error
        })

        return {
          success: false,
          results: {
            documents: { success: false, error: deployResult.error },
            faqs: { success: false, error: deployResult.error }
          },
          error: deployResult.error
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Metadata API deployment error', {
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
   * Deploy using the proven MetadataService pattern
   * This approach has been successfully used by thousands of developers
   * 
   * IMPORTANT: Salesforce requires custom objects and fields to be created separately
   */
  private async deployUsingMetadataService(): Promise<{
    success: boolean
    documentsCreated: boolean
    faqsCreated: boolean
    error?: string
  }> {
    try {
      // Step 1: Create Slack Document Object (without fields first)
      logger.info('Creating Slack Document custom object (without fields)', {
        approach: 'Metadata API - Object Only'
      })

      const documentObjectResult = await this.createCustomObjectViaSOAP('Slack_Document__c', {
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
        // Note: No fields array - they'll be created separately
      })

      let documentFieldsResult = { success: false, error: 'Object creation failed' }
      
      if (documentObjectResult.success) {
        // Step 2: Create fields for Slack Document Object
        logger.info('Creating fields for Slack Document object', {
          approach: 'Metadata API - Fields'
        })
        documentFieldsResult = await this.createFieldsForObject('Slack_Document__c', this.getDocumentFields()) as { success: boolean; error: string }
      }

      const documentFullSuccess = documentObjectResult.success && documentFieldsResult.success

       let faqResult: { success: boolean; error?: string } = { success: false, error: 'Skipped due to document creation failure' }
      
      if (documentFullSuccess) {
        // Step 3: Create Slack FAQ Object (without fields first)
        logger.info('Creating Slack FAQ custom object (without fields)', {
          approach: 'Metadata API - Object Only'
        })

        const faqObjectResult = await this.createCustomObjectViaSOAP('Slack_FAQ__c', {
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
          // Note: No fields array - they'll be created separately
        })

        if (faqObjectResult.success) {
          // Step 4: Create fields for Slack FAQ Object
          logger.info('Creating fields for Slack FAQ object', {
            approach: 'Metadata API - Fields'
          })
          const faqFieldsResult = await this.createFieldsForObject('Slack_FAQ__c', this.getFaqFields())
          faqResult = {
            success: faqObjectResult.success && faqFieldsResult.success,
            error: faqFieldsResult.error || faqObjectResult.error
          }
        } else {
          faqResult = faqObjectResult
        }
      }

      const overallSuccess = documentFullSuccess && faqResult.success

      return {
        success: overallSuccess,
        documentsCreated: documentFullSuccess,
        faqsCreated: faqResult.success,
        error: overallSuccess ? undefined : (documentFieldsResult.error || faqResult.error)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('MetadataService deployment error', {
        error: errorMessage
      })

      return {
        success: false,
        documentsCreated: false,
        faqsCreated: false,
        error: errorMessage
      }
    }
  }

  /**
   * Create fields for a custom object separately
   * This is required by Salesforce - fields must be created after the object
   */
  async createFieldsForObject(objectName: string, fields: any[]): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      logger.info('Creating fields for custom object', {
        objectName,
        fieldCount: fields.length
      })

      const results: boolean[] = []
      const errors: string[] = []

      // Create each field separately
      for (const field of fields) {
        const fieldResult = await this.createSingleFieldViaSOAP(objectName, field)
        results.push(fieldResult.success)
        
        if (!fieldResult.success && fieldResult.error) {
          errors.push(`${field.fullName}: ${fieldResult.error}`)
        }

        // Small delay between field creations to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const overallSuccess = results.every(result => result === true)
      const errorMessage = errors.length > 0 ? errors.join('; ') : undefined

      if (overallSuccess) {
        logger.info('All fields created successfully', {
          objectName,
          fieldCount: fields.length
        })
      } else {
        logger.error('Some fields failed to create', {
          objectName,
          successCount: results.filter(r => r).length,
          totalCount: results.length,
          errors: errorMessage
        })
      }

      return {
        success: overallSuccess,
        error: errorMessage
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Field creation error', {
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
   * Create a single field using SOAP Metadata API
   */
  private async createSingleFieldViaSOAP(objectName: string, field: any): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const fieldSOAP = this.buildCreateFieldSOAPRequest(objectName, field)
      
      const response = await fetch(`${this.tokenResponse.instance_url}/services/Soap/m/59.0`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=UTF-8',
          'SOAPAction': 'create'
        },
        body: fieldSOAP
      })

      const responseText = await response.text()
      
      if (response.ok) {
        // Handle both sync and async field creation
        const isImmediateSuccess = responseText.includes('<success>true</success>')
        const isDoneMatch = responseText.match(/<done>(.*?)<\/done>/)
        const deploymentIdMatch = responseText.match(/<id>(.*?)<\/id>/)
        
        if (isImmediateSuccess) {
          logger.info('Field created successfully via SOAP (immediate)', {
            objectName,
            fieldName: field.fullName
          })
          return { success: true }
        } else if (isDoneMatch && deploymentIdMatch) {
          const isDone = isDoneMatch[1] === 'true'
          const deploymentId = deploymentIdMatch[1]
          
          if (isDone) {
            logger.info('Field created successfully via SOAP (completed)', {
              objectName,
              fieldName: field.fullName,
              deploymentId
            })
            return { success: true }
          } else {
            // Asynchronous field deployment
            logger.info('Field deployment started, polling for completion', {
              objectName,
              fieldName: field.fullName,
              deploymentId
            })
            
            return await this.pollDeploymentStatus(`${objectName}.${field.fullName}`, deploymentId)
          }
        } else {
          const errorMatch = responseText.match(/<message>(.*?)<\/message>/)
          const errorMessage = errorMatch ? errorMatch[1] : 'Field creation failed'
          
          logger.error('Field creation failed via SOAP', {
            objectName,
            fieldName: field.fullName,
            error: errorMessage,
            responsePreview: responseText.substring(0, 300)
          })
          
          return { success: false, error: errorMessage }
        }
      } else {
        logger.error('Field creation HTTP error', {
          objectName,
          fieldName: field.fullName,
          status: response.status,
          statusText: response.statusText
        })
        
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Field creation SOAP error', {
        objectName,
        fieldName: field.fullName,
        error: errorMessage
      })

      return { success: false, error: errorMessage }
    }
  }

  /**
   * Create custom object using SOAP Metadata API pattern
   * This is the proven approach that works reliably
   */
  async createCustomObjectViaSOAP(objectName: string, objectConfig: any): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      logger.info('Creating custom object via SOAP Metadata API', {
        objectName,
        approach: 'MetadataService'
      })

      // Construct SOAP request for Metadata API
      const soapBody = this.buildCreateMetadataSOAPRequest(objectName, objectConfig)
      
      const response = await fetch(`${this.tokenResponse.instance_url}/services/Soap/m/59.0`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=UTF-8',
          'SOAPAction': 'create'
        },
        body: soapBody
      })

      const responseText = await response.text()
      
      logger.info('SOAP Metadata API response', {
        objectName,
        status: response.status,
        responsePreview: responseText.substring(0, 500)
      })

      if (response.ok) {
        // Parse SOAP response - handle both sync and async deployments
        const isImmediateSuccess = responseText.includes('<success>true</success>')
        const isDoneMatch = responseText.match(/<done>(.*?)<\/done>/)
        const deploymentIdMatch = responseText.match(/<id>(.*?)<\/id>/)
        const stateMatch = responseText.match(/<state>(.*?)<\/state>/)
        
        if (isImmediateSuccess) {
          // Synchronous success
          logger.info('Custom object created successfully via SOAP (immediate)', {
            objectName
          })
          return { success: true }
        } else if (isDoneMatch && deploymentIdMatch) {
          const isDone = isDoneMatch[1] === 'true'
          const deploymentId = deploymentIdMatch[1]
          const state = stateMatch ? stateMatch[1] : 'Unknown'
          
          if (isDone) {
            // Deployment completed immediately
            logger.info('Custom object created successfully via SOAP (completed)', {
              objectName,
              deploymentId
            })
            return { success: true }
          } else {
            // Asynchronous deployment - poll for completion
            logger.info('Custom object deployment started, polling for completion', {
              objectName,
              deploymentId,
              state
            })
            
            return await this.pollDeploymentStatus(objectName, deploymentId)
          }
        } else {
          const errorMatch = responseText.match(/<message>(.*?)<\/message>/)
          const errorMessage = errorMatch ? errorMatch[1] : 'SOAP request failed - unexpected response format'
          
          logger.error('SOAP Metadata API returned error', {
            objectName,
            error: errorMessage,
            responsePreview: responseText.substring(0, 500)
          })
          
          return { success: false, error: errorMessage }
        }
      } else {
        logger.error('SOAP Metadata API HTTP error', {
          objectName,
          status: response.status,
          statusText: response.statusText
        })
        
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('SOAP Metadata API error', {
        objectName,
        error: errorMessage
      })

      return { success: false, error: errorMessage }
    }
  }

  /**
   * Poll deployment status for asynchronous Metadata API deployments
   */
  private async pollDeploymentStatus(objectName: string, deploymentId: string): Promise<{
    success: boolean
    error?: string
  }> {
    const maxAttempts = 30 // 5 minutes with 10-second intervals
    let attempts = 0
    
    while (attempts < maxAttempts) {
      try {
        await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds
        attempts++
        
        logger.info('Polling deployment status', {
          objectName,
          deploymentId,
          attempt: attempts,
          maxAttempts
        })
        
        const checkStatusSOAP = this.buildCheckStatusSOAPRequest(deploymentId)
        
        const response = await fetch(`${this.tokenResponse.instance_url}/services/Soap/m/59.0`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset=UTF-8',
            'SOAPAction': 'urn:checkStatus'
          },
          body: checkStatusSOAP
        })
        
        const responseText = await response.text()
        
                      if (response.ok) {
                const isDoneMatch = responseText.match(/<done>(.*?)<\/done>/)
                const stateMatch = responseText.match(/<state>(.*?)<\/state>/)
                const successMatch = responseText.match(/<success>(.*?)<\/success>/)
                
                logger.info('Deployment status response parsed', {
                  objectName,
                  deploymentId,
                  isDone: isDoneMatch ? isDoneMatch[1] : 'not found',
                  state: stateMatch ? stateMatch[1] : 'not found',
                  hasSuccessField: !!successMatch,
                  successValue: successMatch ? successMatch[1] : 'not found'
                })
                
                if (isDoneMatch && isDoneMatch[1] === 'true') {
                  const state = stateMatch ? stateMatch[1] : 'Unknown'
                  
                  // Check for success in multiple ways - Salesforce APIs can vary
                  const explicitSuccess = successMatch && successMatch[1] === 'true'
                  const stateBasedSuccess = state === 'Completed' || state === 'Success' || state === 'Succeeded'
                  const isSuccess = explicitSuccess || stateBasedSuccess
                  
                  if (isSuccess) {
                    logger.info('Asynchronous deployment completed successfully', {
                      objectName,
                      deploymentId,
                      state,
                      successMethod: explicitSuccess ? 'explicit-field' : 'state-based',
                      totalTime: `${attempts * 10} seconds`
                    })
                    return { success: true }
                  } else {
                    // Look for error details in multiple places
                    const errorMatch = responseText.match(/<message>(.*?)<\/message>/) ||
                                     responseText.match(/<problem>(.*?)<\/problem>/) ||
                                     responseText.match(/<error>(.*?)<\/error>/)
                    const errorMessage = errorMatch ? errorMatch[1] : `Deployment completed with unexpected state: ${state}`
                    
                    // If state suggests completion but no clear error, verify object exists
                    if (state === 'Completed' || state === 'Success') {
                      logger.warn('Deployment completed but no explicit success - verifying object creation', {
                        objectName,
                        deploymentId,
                        state
                      })
                      
                      const verification = await this.verifyObjectExists(objectName)
                      if (verification.success) {
                        logger.info('Object verification confirms successful creation despite ambiguous response', {
                          objectName,
                          deploymentId
                        })
                        return { success: true }
                      }
                    }
                    
                    logger.error('Asynchronous deployment failed', {
                      objectName,
                      deploymentId,
                      state,
                      error: errorMessage,
                      responsePreview: responseText.substring(0, 500)
                    })
                    
                    return { success: false, error: errorMessage }
                  }
                } else {
                  const state = stateMatch ? stateMatch[1] : 'InProgress'
                  logger.info('Deployment still in progress', {
                    objectName,
                    deploymentId,
                    state,
                    attempt: attempts,
                    isDone: isDoneMatch ? isDoneMatch[1] : 'not found'
                  })
                  // Continue polling
                }
              } else {
           const responseText = await response.text()
           logger.warn('Failed to check deployment status', {
             objectName,
             deploymentId,
             status: response.status,
             statusText: response.statusText,
             attempt: attempts,
             responsePreview: responseText.substring(0, 200)
           })
           
           // If we consistently get 500 errors, the deployment might have completed
           // but the status API endpoint is having issues
           if (response.status === 500 && attempts >= 3) {
             logger.info('Status API consistently failing, assuming deployment completed', {
               objectName,
               deploymentId,
               attempts
             })
             
             // Try to verify by making a simple describe call for the object
             return await this.verifyObjectExists(objectName)
           }
           // Continue polling - might be a temporary issue
         }
        
      } catch (error) {
        logger.warn('Error checking deployment status', {
          objectName,
          deploymentId,
          attempt: attempts,
          error: error instanceof Error ? error.message : error
        })
        // Continue polling - might be a temporary network issue
      }
    }
    
    // Max attempts reached
    logger.error('Deployment polling timeout', {
      objectName,
      deploymentId,
      maxAttempts,
      totalTime: `${maxAttempts * 10} seconds`
    })
    
    return {
      success: false,
      error: `Deployment polling timeout after ${maxAttempts * 10} seconds`
    }
  }

  /**
   * Verify if an object exists by making a describe call
   * Used as a fallback when status polling fails
   */
  private async verifyObjectExists(objectName: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      logger.info('Verifying object exists via describe call', {
        objectName
      })

      const describeUrl = `${this.tokenResponse.instance_url}/services/data/v59.0/sobjects/${objectName}/describe`
      
      const response = await fetch(describeUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.tokenResponse.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const result = await response.json()
        
        if (result.name === objectName) {
          logger.info('Object verification successful - object exists', {
            objectName,
            label: result.label
          })
          return { success: true }
        } else {
          logger.warn('Object describe succeeded but name mismatch', {
            objectName,
            describedName: result.name
          })
          return { success: false, error: 'Object name mismatch in describe response' }
        }
      } else if (response.status === 404) {
        logger.info('Object verification failed - object does not exist yet', {
          objectName,
          status: response.status
        })
        return { success: false, error: 'Object not found (deployment may still be in progress)' }
      } else {
        logger.warn('Object verification request failed', {
          objectName,
          status: response.status,
          statusText: response.statusText
        })
        return { success: false, error: `Verification request failed: ${response.status}` }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Object verification error', {
        objectName,
        error: errorMessage
      })

      return { success: false, error: errorMessage }
    }
  }

  /**
   * Build SOAP request to check deployment status
   * Using the correct Metadata API structure for status checks
   */
  private buildCheckStatusSOAPRequest(deploymentId: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
   <soapenv:Header>
      <met:SessionHeader>
         <met:sessionId>${this.tokenResponse.access_token}</met:sessionId>
      </met:SessionHeader>
   </soapenv:Header>
   <soapenv:Body>
      <met:checkStatus>
         <met:asyncProcessId>${deploymentId}</met:asyncProcessId>
      </met:checkStatus>
   </soapenv:Body>
</soapenv:Envelope>`
  }

  /**
   * Build SOAP request for creating a single field
   */
  private buildCreateFieldSOAPRequest(objectName: string, field: any): string {
    let fieldXML = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
   <soapenv:Header>
      <met:SessionHeader>
         <met:sessionId>${this.tokenResponse.access_token}</met:sessionId>
      </met:SessionHeader>
   </soapenv:Header>
   <soapenv:Body>
      <met:create>
         <met:metadata xsi:type="met:CustomField" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <met:fullName>${objectName}.${field.fullName}</met:fullName>
            <met:label>${field.label}</met:label>
            <met:type>${field.type}</met:type>`

    if (field.description) fieldXML += `\n            <met:description>${field.description}</met:description>`
    if (field.required) fieldXML += `\n            <met:required>${field.required}</met:required>`
    if (field.unique) fieldXML += `\n            <met:unique>${field.unique}</met:unique>`
    if (field.externalId) fieldXML += `\n            <met:externalId>${field.externalId}</met:externalId>`
    if (field.length) fieldXML += `\n            <met:length>${field.length}</met:length>`
    if (field.precision) fieldXML += `\n            <met:precision>${field.precision}</met:precision>`
    if (field.scale) fieldXML += `\n            <met:scale>${field.scale}</met:scale>`
    if (field.visibleLines) fieldXML += `\n            <met:visibleLines>${field.visibleLines}</met:visibleLines>`
    if (field.defaultValue) fieldXML += `\n            <met:defaultValue>${field.defaultValue}</met:defaultValue>`
    if (field.referenceTo) fieldXML += `\n            <met:referenceTo>${field.referenceTo}</met:referenceTo>`
    if (field.relationshipLabel) fieldXML += `\n            <met:relationshipLabel>${field.relationshipLabel}</met:relationshipLabel>`
    if (field.relationshipName) fieldXML += `\n            <met:relationshipName>${field.relationshipName}</met:relationshipName>`
    
    // Handle picklist values
    if (field.valueSet) {
      fieldXML += `\n            <met:valueSet>
               <met:restricted>${field.valueSet.restricted}</met:restricted>
               <met:valueSetDefinition>`
      
      field.valueSet.valueSetDefinition.value.forEach((val: any) => {
        fieldXML += `\n                  <met:value>
                     <met:fullName>${val.fullName}</met:fullName>
                     <met:default>${val.default}</met:default>
                     <met:label>${val.label}</met:label>
                  </met:value>`
      })
      
      fieldXML += `\n               </met:valueSetDefinition>
            </met:valueSet>`
    }

    fieldXML += `
         </met:metadata>
      </met:create>
   </soapenv:Body>
</soapenv:Envelope>`

    return fieldXML
  }

  /**
   * Build SOAP request for creating custom object (without fields)
   * Fields must be created separately as per Salesforce requirements
   */
  private buildCreateMetadataSOAPRequest(objectName: string, config: any): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
   <soapenv:Header>
      <met:SessionHeader>
         <met:sessionId>${this.tokenResponse.access_token}</met:sessionId>
      </met:SessionHeader>
   </soapenv:Header>
   <soapenv:Body>
      <met:create>
         <met:metadata xsi:type="met:CustomObject" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <met:fullName>${objectName}</met:fullName>
            <met:label>${config.label}</met:label>
            <met:pluralLabel>${config.pluralLabel}</met:pluralLabel>
            <met:description>${config.description}</met:description>
            <met:deploymentStatus>${config.deploymentStatus}</met:deploymentStatus>
            <met:sharingModel>${config.sharingModel}</met:sharingModel>
            <met:enableActivities>${config.enableActivities}</met:enableActivities>
            <met:enableReports>${config.enableReports}</met:enableReports>
            <met:enableSearch>${config.enableSearch}</met:enableSearch>
            <met:enableSharing>${config.enableSharing}</met:enableSharing>
            <met:enableBulkApi>${config.enableBulkApi}</met:enableBulkApi>
            <met:enableStreamingApi>${config.enableStreamingApi}</met:enableStreamingApi>
            <met:nameField>
               <met:type>${config.nameField.type}</met:type>
               <met:label>${config.nameField.label}</met:label>
               <met:displayFormat>${config.nameField.displayFormat}</met:displayFormat>
               <met:startingNumber>${config.nameField.startingNumber}</met:startingNumber>
            </met:nameField>
         </met:metadata>
      </met:create>
   </soapenv:Body>
</soapenv:Envelope>`
  }



  /**
   * Get document field definitions
   */
  getDocumentFields(): any[] {
    return [
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
   * Get FAQ field definitions
   */
  getFaqFields(): any[] {
    return [
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
}

/**
 * Create a Metadata API service instance
 */
export function createMetadataService(
  tokenResponse: SalesforceTokenResponse,
  userInfo: SalesforceUserInfo
): SalesforceMetadataService {
  return new SalesforceMetadataService(tokenResponse, userInfo)
} 