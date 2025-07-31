/**
 * Salesforce Metadata API Field Deployer
 * Handles automatic deployment of custom fields using proper metadata packaging
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { logger } from './logger'
import JSZip from 'jszip'

/**
 * Salesforce Token Response interface
 */
interface SalesforceTokenResponse {
  access_token: string
  instance_url: string
  token_type: string
}

/**
 * User Info interface
 */
interface SalesforceUserInfo {
  user_id: string
  organization_id: string
  username: string
}

/**
 * Field definition interface
 */
interface FieldDefinition {
  fullName: string
  label: string
  type: string
  length?: number
  precision?: number
  scale?: number
  required?: boolean
  unique?: boolean
  externalId?: boolean
  description?: string
  defaultValue?: string
  referenceTo?: string[]
  relationshipLabel?: string
  relationshipName?: string
  valueSet?: {
    restricted: boolean
    valueSetDefinition: {
      value: Array<{
        fullName: string
        default: boolean
        label: string
      }>
    }
  }
  visibleLines?: number
}

/**
 * Deployment result interface
 */
interface DeploymentResult {
  success: boolean
  deploymentId?: string
  error?: string
  details?: any
}

/**
 * Enhanced Metadata API Field Deployer
 * Uses proper ZIP packaging and metadata structure for field deployment
 */
export class SalesforceMetadataDeployer {
  private tokenResponse: SalesforceTokenResponse
  private userInfo: SalesforceUserInfo

  constructor(tokenResponse: SalesforceTokenResponse, userInfo: SalesforceUserInfo) {
    this.tokenResponse = tokenResponse
    this.userInfo = userInfo
  }

  /**
   * Deploy fields to existing objects using proper Metadata API packaging
   */
  async deployFields(objectName: string, fields: FieldDefinition[]): Promise<DeploymentResult> {
    try {
      logger.info('Starting enhanced field deployment via Metadata API', {
        objectName,
        fieldCount: fields.length,
        deploymentMethod: 'ZIP-based Metadata API'
      })

      // Generate metadata package
      const metadataPackage = await this.generateMetadataPackage(objectName, fields)
      
      // Deploy via Metadata API
      const deploymentResult = await this.deployMetadataPackage(metadataPackage)
      
      if (deploymentResult.success && deploymentResult.deploymentId) {
        // Poll for completion
        const finalResult = await this.pollDeploymentCompletion(deploymentResult.deploymentId)
        
        logger.info('Enhanced field deployment completed', {
          objectName,
          fieldCount: fields.length,
          success: finalResult.success,
          deploymentId: deploymentResult.deploymentId
        })
        
        return finalResult
      } else {
        return deploymentResult
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Enhanced field deployment failed', {
        objectName,
        fieldCount: fields.length,
        error: errorMessage
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Generate proper metadata package structure
   */
  private async generateMetadataPackage(objectName: string, fields: FieldDefinition[]): Promise<Buffer> {
    const zip = new JSZip()
    
    // Create package.xml
    const packageXml = this.generatePackageXML(objectName, fields)
    zip.file('package.xml', packageXml)
    
    // Create objects directory
    const objectsFolder = zip.folder('objects')

    if (objectsFolder) {
      // For Metadata API format, create a single object file with all fields
      const objectXml = this.generateObjectWithFieldsXML(objectName, fields)
      objectsFolder.file(`${objectName}.object`, objectXml)
    }

    // Debug: List all files in the ZIP
    const zipContents: string[] = []
    zip.forEach((relativePath, file) => {
      if (!file.dir) {
        zipContents.push(relativePath)
      }
    })

    // Log the actual object XML for debugging
    const objectXml = await zip.file(`objects/${objectName}.object`)?.async('string')
    if (objectXml) {
      logger.info('Generated object XML preview', {
        objectName,
        xmlLength: objectXml.length,
        xmlPreview: objectXml.substring(0, 500) + '...',
        fieldNames: fields.map(f => f.fullName)
      })
    }
    
    logger.info('Generated metadata package structure', {
      objectName,
      fieldCount: fields.length,
      packageStructure: {
        packageXml: true,
        objectFile: true,
        format: 'Metadata API (all fields in object file)'
      },
      zipContents: zipContents,
      totalFiles: zipContents.length
    })

    // Generate ZIP buffer
    return await zip.generateAsync({ type: 'nodebuffer' })
  }

  /**
   * Generate package.xml with proper metadata types
   */
  private generatePackageXML(objectName: string, fields: FieldDefinition[]): string {
    // For Metadata API format, we only need to reference the CustomObject
    // All fields are included within the object file
    return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>${objectName}</members>
        <name>CustomObject</name>
    </types>
    <version>59.0</version>
</Package>`
  }

  /**
   * Generate object XML with all fields included
   */
  private generateObjectWithFieldsXML(objectName: string, fields: FieldDefinition[]): string {
    const label = objectName.replace('__c', '').replace(/_/g, ' ')
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>${label}</label>
    <pluralLabel>${label}s</pluralLabel>
    <nameField>
        <label>${label} Name</label>
        <type>AutoNumber</type>
        <displayFormat>{0000}</displayFormat>
    </nameField>
    <deploymentStatus>Deployed</deploymentStatus>
    <sharingModel>ReadWrite</sharingModel>`

    // Log the fields we're about to add
    logger.info('Adding fields to object XML', {
      objectName,
      fieldCount: fields.length,
      fieldNames: fields.map(f => f.fullName)
    })

    // Add each field to the object
    for (const field of fields) {
      xml += `
    <fields>
        <fullName>${field.fullName}</fullName>
        <label>${field.label}</label>
        <type>${field.type}</type>`

      // Add type-specific properties
      if (field.length) xml += `
        <length>${field.length}</length>`
      if (field.precision !== undefined) xml += `
        <precision>${field.precision}</precision>`
      if (field.scale !== undefined) xml += `
        <scale>${field.scale}</scale>`
      if (field.visibleLines) xml += `
        <visibleLines>${field.visibleLines}</visibleLines>`
      
      // Add field properties
      if (field.required) xml += `
        <required>${field.required}</required>`
      if (field.unique) xml += `
        <unique>${field.unique}</unique>`
      if (field.externalId) xml += `
        <externalId>${field.externalId}</externalId>`
      if (field.description) xml += `
        <description><![CDATA[${field.description}]]></description>`
      if (field.defaultValue) xml += `
        <defaultValue>${field.defaultValue}</defaultValue>`

      // Add relationship properties
      if (field.referenceTo && field.referenceTo.length > 0) {
        xml += `
        <referenceTo>${field.referenceTo[0]}</referenceTo>`
        if (field.relationshipLabel) xml += `
        <relationshipLabel>${field.relationshipLabel}</relationshipLabel>`
        if (field.relationshipName) xml += `
        <relationshipName>${field.relationshipName}</relationshipName>`
      }

      // Add picklist values
      if (field.valueSet) {
        xml += `
        <valueSet>
            <restricted>${field.valueSet.restricted}</restricted>
            <valueSetDefinition>`
        
        for (const value of field.valueSet.valueSetDefinition.value) {
          xml += `
                <value>
                    <fullName>${value.fullName}</fullName>
                    <default>${value.default}</default>
                    <label>${value.label}</label>
                </value>`
        }
        
        xml += `
            </valueSetDefinition>
        </valueSet>`
      }

      xml += `
    </fields>`
    }

    xml += `
</CustomObject>`

    return xml
  }

  /**
   * Generate XML metadata for a custom field
   */
  private generateFieldXML(objectName: string, field: FieldDefinition): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${field.fullName}</fullName>
    <label>${field.label}</label>
    <type>${field.type}</type>`

    // Add type-specific properties
    if (field.length) xml += `\n    <length>${field.length}</length>`
    if (field.precision) xml += `\n    <precision>${field.precision}</precision>`
    if (field.scale) xml += `\n    <scale>${field.scale}</scale>`
    if (field.visibleLines) xml += `\n    <visibleLines>${field.visibleLines}</visibleLines>`
    
    // Add field properties
    if (field.required) xml += `\n    <required>${field.required}</required>`
    if (field.unique) xml += `\n    <unique>${field.unique}</unique>`
    if (field.externalId) xml += `\n    <externalId>${field.externalId}</externalId>`
    if (field.description) xml += `\n    <description><![CDATA[${field.description}]]></description>`
    if (field.defaultValue) xml += `\n    <defaultValue>${field.defaultValue}</defaultValue>`

    // Add relationship properties
    if (field.referenceTo && field.referenceTo.length > 0) {
      xml += `\n    <referenceTo>${field.referenceTo[0]}</referenceTo>`
      if (field.relationshipLabel) xml += `\n    <relationshipLabel>${field.relationshipLabel}</relationshipLabel>`
      if (field.relationshipName) xml += `\n    <relationshipName>${field.relationshipName}</relationshipName>`
    }

    // Add picklist values
    if (field.valueSet) {
      xml += `\n    <valueSet>
        <restricted>${field.valueSet.restricted}</restricted>
        <valueSetDefinition>`
      
      for (const value of field.valueSet.valueSetDefinition.value) {
        xml += `\n            <value>
                <fullName>${value.fullName}</fullName>
                <default>${value.default}</default>
                <label>${value.label}</label>
            </value>`
      }
      
      xml += `\n        </valueSetDefinition>
    </valueSet>`
    }

    xml += '\n</CustomField>'
    return xml
  }

  /**
   * Deploy metadata package via Metadata API
   */
  private async deployMetadataPackage(zipBuffer: Buffer): Promise<DeploymentResult> {
    try {
      const base64Zip = zipBuffer.toString('base64')
      
      const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
   <soapenv:Header>
      <met:SessionHeader>
         <met:sessionId>${this.tokenResponse.access_token}</met:sessionId>
      </met:SessionHeader>
   </soapenv:Header>
   <soapenv:Body>
      <met:deploy>
         <met:ZipFile>${base64Zip}</met:ZipFile>
         <met:DeployOptions>
            <met:allowMissingFiles>false</met:allowMissingFiles>
            <met:autoUpdatePackage>false</met:autoUpdatePackage>
            <met:checkOnly>false</met:checkOnly>
            <met:ignoreWarnings>false</met:ignoreWarnings>
            <met:performRetrieve>false</met:performRetrieve>
            <met:purgeOnDelete>false</met:purgeOnDelete>
            <met:rollbackOnError>true</met:rollbackOnError>
            <met:testLevel>NoTestRun</met:testLevel>
            <met:singlePackage>true</met:singlePackage>
         </met:DeployOptions>
      </met:deploy>
   </soapenv:Body>
</soapenv:Envelope>`

      logger.info('Sending ZIP-based metadata deployment request', {
        zipSizeKB: Math.round(zipBuffer.length / 1024),
        deploymentOptions: {
          checkOnly: false,
          singlePackage: true,
          rollbackOnError: true
        }
      })

      const response = await fetch(`${this.tokenResponse.instance_url}/services/Soap/m/59.0`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=UTF-8',
          'SOAPAction': 'urn:deploy'
        },
        body: soapRequest
      })

      const responseText = await response.text()
      
      if (response.ok) {
        const deploymentIdMatch = responseText.match(/<id>(.*?)<\/id>/)
        
        if (deploymentIdMatch) {
          const deploymentId = deploymentIdMatch[1]
          
          logger.info('Metadata deployment initiated successfully', {
            deploymentId,
            status: 'InProgress'
          })
          
          return {
            success: true,
            deploymentId
          }
        } else {
          logger.error('No deployment ID found in successful response', {
            responsePreview: responseText.substring(0, 500)
          })
          
          return {
            success: false,
            error: 'No deployment ID returned from Metadata API'
          }
        }
      } else {
        logger.error('Metadata deployment request failed', {
          status: response.status,
          statusText: response.statusText,
          responsePreview: responseText.substring(0, 500)
        })
        
        return {
          success: false,
          error: `Deployment request failed: ${response.status} ${response.statusText}`
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Metadata deployment request error', {
        error: errorMessage
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Poll deployment status until completion
   */
  private async pollDeploymentCompletion(deploymentId: string): Promise<DeploymentResult> {
    const maxAttempts = 60 // 10 minutes with 10-second intervals
    let attempts = 0
    
    while (attempts < maxAttempts) {
      try {
        await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds
        attempts++
        
        logger.info('Polling metadata deployment status', {
          deploymentId,
          attempt: attempts,
          maxAttempts
        })
        
        const statusResult = await this.checkDeploymentStatus(deploymentId)
        
        if (statusResult.completed) {
          if (statusResult.success) {
            logger.info('Metadata deployment completed successfully', {
              deploymentId,
              totalTime: `${attempts * 10} seconds`,
              componentDeployments: statusResult.details?.componentDeployments || 0,
              numberComponentsDeployed: statusResult.details?.numberComponentsDeployed || 0,
              numberComponentsTotal: statusResult.details?.numberComponentsTotal || 0
            })
            
            // Check if any components were actually deployed
            if ((statusResult.details?.numberComponentsDeployed || 0) === 0) {
              logger.warn('Deployment succeeded but no components were deployed - possible duplicate field issue')
            }
            
            return {
              success: true,
              deploymentId,
              details: statusResult.details
            }
          } else {
            logger.error('Metadata deployment completed with errors', {
              deploymentId,
              state: statusResult.details?.state,
              numberComponentErrors: statusResult.details?.numberComponentErrors,
              componentFailures: statusResult.details?.componentFailures || []
            })
            
            // Log first few failures for debugging
            if (statusResult.details?.componentFailures?.length > 0) {
              logger.error('Component failure details', {
                failures: statusResult.details.componentFailures.slice(0, 3)
              })
            }
            
            return {
              success: false,
              deploymentId,
              error: statusResult.error || 'Deployment completed with errors',
              details: statusResult.details
            }
          }
        } else {
          logger.info('Metadata deployment still in progress', {
            deploymentId,
            attempt: attempts,
            progress: statusResult.details?.numberComponentsTotal ? 
              `${statusResult.details.numberComponentsDeployed}/${statusResult.details.numberComponentsTotal}` : 
              'unknown'
          })
        }
        
      } catch (error) {
        logger.warn('Error checking deployment status', {
          deploymentId,
          attempt: attempts,
          error: error instanceof Error ? error.message : error
        })
      }
    }
    
    // Timeout reached
    logger.error('Metadata deployment polling timeout', {
      deploymentId,
      maxAttempts,
      totalTime: `${maxAttempts * 10} seconds`
    })
    
    return {
      success: false,
      deploymentId,
      error: `Deployment polling timeout after ${maxAttempts * 10} seconds`
    }
  }

  /**
   * Check deployment status
   */
  private async checkDeploymentStatus(deploymentId: string): Promise<{
    completed: boolean
    success: boolean
    error?: string
    details?: any
  }> {
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
   <soapenv:Header>
      <met:SessionHeader>
         <met:sessionId>${this.tokenResponse.access_token}</met:sessionId>
      </met:SessionHeader>
   </soapenv:Header>
   <soapenv:Body>
      <met:checkDeployStatus>
         <met:asyncProcessId>${deploymentId}</met:asyncProcessId>
      </met:checkDeployStatus>
   </soapenv:Body>
</soapenv:Envelope>`

    const response = await fetch(`${this.tokenResponse.instance_url}/services/Soap/m/59.0`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPAction': 'urn:checkDeployStatus'
      },
      body: soapRequest
    })

    const responseText = await response.text()

    if (response.ok) {
      const doneMatch = responseText.match(/<done>(.*?)<\/done>/)
      const successMatch = responseText.match(/<success>(.*?)<\/success>/)
      const stateMatch = responseText.match(/<state>(.*?)<\/state>/)
      
      const isDone = doneMatch && doneMatch[1] === 'true'
      const isSuccess = successMatch && successMatch[1] === 'true'
      const state = stateMatch ? stateMatch[1] : 'Unknown'

      // Extract deployment details
      const numberComponentsTotalMatch = responseText.match(/<numberComponentsTotal>(.*?)<\/numberComponentsTotal>/)
      const numberComponentsDeployedMatch = responseText.match(/<numberComponentsDeployed>(.*?)<\/numberComponentsDeployed>/)
      const numberComponentErrorsMatch = responseText.match(/<numberComponentErrors>(.*?)<\/numberComponentErrors>/)

      // Extract error details if deployment failed
      let componentFailures: any[] = []
      if (isDone && !isSuccess) {
        // Look for component failures
        const failuresMatch = responseText.match(/<componentFailures>([\s\S]*?)<\/componentFailures>/g)
        if (failuresMatch) {
          componentFailures = failuresMatch.map(failure => {
            const fullNameMatch = failure.match(/<fullName>(.*?)<\/fullName>/)
            const componentTypeMatch = failure.match(/<componentType>(.*?)<\/componentType>/)
            const problemMatch = failure.match(/<problem>(.*?)<\/problem>/)
            const fileNameMatch = failure.match(/<fileName>(.*?)<\/fileName>/)
            
            return {
              fullName: fullNameMatch ? fullNameMatch[1] : '',
              componentType: componentTypeMatch ? componentTypeMatch[1] : '',
              problem: problemMatch ? problemMatch[1] : '',
              fileName: fileNameMatch ? fileNameMatch[1] : ''
            }
          })
        }
      }

      // Check for deployment warnings even if successful
      const deploymentWarnings: any[] = []
      const warningsMatch = responseText.match(/<runTestResult>([\s\S]*?)<\/runTestResult>/)
      if (warningsMatch) {
        logger.warn('Deployment has test results/warnings', {
          deploymentId,
          warningPreview: warningsMatch[1].substring(0, 200)
        })
      }

      // Log full response if no components were deployed
      if (isDone && isSuccess && numberComponentsDeployedMatch && numberComponentsDeployedMatch[1] === '0') {
        logger.warn('Deployment succeeded but 0 components deployed - possible duplicate fields', {
          deploymentId,
          responsePreview: responseText.substring(0, 1000)
        })
      }

      const details = {
        state,
        numberComponentsTotal: numberComponentsTotalMatch ? parseInt(numberComponentsTotalMatch[1]) : 0,
        numberComponentsDeployed: numberComponentsDeployedMatch ? parseInt(numberComponentsDeployedMatch[1]) : 0,
        numberComponentErrors: numberComponentErrorsMatch ? parseInt(numberComponentErrorsMatch[1]) : 0,
        componentFailures
      }

      return {
        completed: Boolean(isDone),
        success: Boolean(isSuccess),
        details
      }
    } else {
      throw new Error(`Status check failed: ${response.status} ${response.statusText}`)
    }
  }

  /**
   * Retrieve existing object metadata
   */
  private async retrieveObjectMetadata(objectName: string): Promise<any> {
    try {
      const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
   <soapenv:Header>
      <met:SessionHeader>
         <met:sessionId>${this.tokenResponse.access_token}</met:sessionId>
      </met:SessionHeader>
   </soapenv:Header>
   <soapenv:Body>
      <met:readMetadata>
         <met:type>CustomObject</met:type>
         <met:fullNames>${objectName}</met:fullNames>
      </met:readMetadata>
   </soapenv:Body>
</soapenv:Envelope>`

      const response = await fetch(`${this.tokenResponse.instance_url}/services/Soap/m/59.0`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=UTF-8',
          'SOAPAction': 'urn:readMetadata'
        },
        body: soapRequest
      })

      const responseText = await response.text()
      logger.info('Retrieved object metadata', {
        objectName,
        status: response.status,
        responsePreview: responseText.substring(0, 500)
      })

      return responseText
    } catch (error) {
      logger.error('Failed to retrieve object metadata', {
        objectName,
        error: error instanceof Error ? error.message : error
      })
      return null
    }
  }

  /**
   * Get field definitions for Slack Document object
   */
  getDocumentFieldDefinitions(): FieldDefinition[] {
    return [
      {
        fullName: 'Document_ID__c',
        label: 'Document ID',
        type: 'Text',
        length: 255,
        unique: true,
        externalId: true,
        required: true,
        description: 'Unique identifier for the document from Slack'
      },
      {
        fullName: 'Channel_ID__c',
        label: 'Channel ID',
        type: 'Text',
        length: 255,
        required: true,
        description: 'Slack channel identifier where the document originated'
      },
      {
        fullName: 'Channel_Name__c',
        label: 'Channel Name',
        type: 'Text',
        length: 255,
        required: true,
        description: 'Human-readable name of the Slack channel'
      },
      {
        fullName: 'Thread_ID__c',
        label: 'Thread ID',
        type: 'Text',
        length: 255,
        description: 'Slack thread identifier if document is from a thread'
      },
      {
        fullName: 'Content__c',
        label: 'Content',
        type: 'LongTextArea',
        length: 32768,
        visibleLines: 10,
        description: 'Full text content of the document'
      },
      {
        fullName: 'Author__c',
        label: 'Author',
        type: 'Text',
        length: 255,
        description: 'Author of the document from Slack'
      },
      {
        fullName: 'Message_Count__c',
        label: 'Message Count',
        type: 'Number',
        precision: 10,
        scale: 0,
        description: 'Number of messages in the document'
      },
      {
        fullName: 'Timestamp__c',
        label: 'Timestamp',
        type: 'DateTime',
        required: true,
        description: 'When the document was created in Slack'
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
      },
      {
        fullName: 'Processing_Status__c',
        label: 'Processing Status',
        type: 'Picklist',
        description: 'Current processing state',
        valueSet: {
          restricted: true,
          valueSetDefinition: {
            value: [
              { fullName: 'Pending', default: true, label: 'Pending' },
              { fullName: 'Processing', default: false, label: 'Processing' },
              { fullName: 'Complete', default: false, label: 'Complete' },
              { fullName: 'Error', default: false, label: 'Error' }
            ]
          }
        }
      },
      {
        fullName: 'Document_Type__c',
        label: 'Document Type',
        type: 'Picklist',
        description: 'Type of document from Slack',
        valueSet: {
          restricted: true,
          valueSetDefinition: {
            value: [
              { fullName: 'Thread', default: false, label: 'Thread' },
              { fullName: 'Channel', default: true, label: 'Channel' },
              { fullName: 'Direct', default: false, label: 'Direct Message' }
            ]
          }
        }
      },
      {
        fullName: 'Tags__c',
        label: 'Tags',
        type: 'Text',
        length: 255,
        description: 'Comma-separated tags for categorization'
      }
    ]
  }

  /**
   * Get field definitions for Slack FAQ object
   */
  getFaqFieldDefinitions(): FieldDefinition[] {
    return [
      {
        fullName: 'Question__c',
        label: 'Question',
        type: 'LongTextArea',
        length: 32768,
        visibleLines: 3,
        description: 'The FAQ question'
      },
      {
        fullName: 'Answer__c',
        label: 'Answer',
        type: 'LongTextArea',
        length: 32768,
        visibleLines: 8,
        description: 'The FAQ answer'
      },
      {
        fullName: 'Document__c',
        label: 'Source Document',
        type: 'Lookup',
        referenceTo: ['Slack_Document__c'],
        relationshipLabel: 'FAQs',
        relationshipName: 'FAQs',
        description: 'The source document this FAQ was generated from'
      },
      {
        fullName: 'Channel_ID__c',
        label: 'Channel ID',
        type: 'Text',
        length: 255,
        description: 'Slack channel identifier'
      },
      {
        fullName: 'Channel_Name__c',
        label: 'Channel Name',
        type: 'Text',
        length: 255,
        description: 'Human-readable name of the Slack channel'
      },
      {
        fullName: 'Status__c',
        label: 'Status',
        type: 'Picklist',
        description: 'FAQ approval status',
        valueSet: {
          restricted: true,
          valueSetDefinition: {
            value: [
              { fullName: 'Draft', default: true, label: 'Draft' },
              { fullName: 'Review', default: false, label: 'Under Review' },
              { fullName: 'Approved', default: false, label: 'Approved' },
              { fullName: 'Published', default: false, label: 'Published' },
              { fullName: 'Archived', default: false, label: 'Archived' }
            ]
          }
        }
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
        fullName: 'Source_Messages__c',
        label: 'Source Messages',
        type: 'LongTextArea',
        length: 32768,
        visibleLines: 5,
        description: 'Original Slack messages used to generate this FAQ'
      },
      {
        fullName: 'Category__c',
        label: 'Category',
        type: 'Text',
        length: 255,
        description: 'FAQ category for organization'
      }
    ]
  }
}

/**
 * Factory function to create metadata deployer
 */
export function createMetadataDeployer(
  tokenResponse: SalesforceTokenResponse, 
  userInfo: SalesforceUserInfo
): SalesforceMetadataDeployer {
  return new SalesforceMetadataDeployer(tokenResponse, userInfo)
} 