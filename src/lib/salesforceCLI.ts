import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from './logger'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export interface CLIDeployResult {
  success: boolean
  deploymentId?: string
  componentsSummary?: {
    total: number
    deployed: number
    failed: number
  }
  errors?: string[]
}

export interface CLIFieldInfo {
  fullName: string
  label: string
  type: string
  length?: number
  required?: boolean
  unique?: boolean
}

export interface CLIObjectInfo {
  fullName: string
  label: string
  fields: CLIFieldInfo[]
}

export class SalesforceCLI {
  private orgAlias: string
  private projectPath: string

  constructor(orgAlias: string = 'sf-listen-bot') {
    this.orgAlias = orgAlias
    this.projectPath = process.cwd()
  }

  /**
   * Check if SF CLI is installed
   */
  async checkCLI(): Promise<boolean> {
    try {
      // Try to use the CLI - it will use either global or local installation
      const { stdout } = await execAsync('npx sf --version')
      logger.info('SF CLI version', { version: stdout.trim() })
      return true
    } catch (error) {
      // Fallback to direct sf command if npx fails
      try {
        const { stdout } = await execAsync('sf --version')
        logger.info('SF CLI version (global)', { version: stdout.trim() })
        return true
      } catch (globalError) {
        logger.error('SF CLI not found', { error: globalError })
        return false
      }
    }
  }

  /**
   * Authenticate using access token
   */
  async authenticate(accessToken: string, instanceUrl: string): Promise<boolean> {
    try {
      // Store the access token
      const command = `echo "${accessToken}" | npx sf org login access-token --instance-url ${instanceUrl} --alias ${this.orgAlias} --no-prompt`
      
      await execAsync(command, { shell: '/bin/bash' })
      
      logger.info('Successfully authenticated with SF CLI', { 
        orgAlias: this.orgAlias,
        instanceUrl 
      })
      
      return true
    } catch (error) {
      logger.error('Failed to authenticate with SF CLI', { error })
      return false
    }
  }

  /**
   * Get object metadata including fields
   */
  async describeObject(objectName: string): Promise<CLIObjectInfo | null> {
    try {
      const command = `npx sf sobject describe --sobject ${objectName} --target-org ${this.orgAlias} --json`
      const { stdout } = await execAsync(command)
      const result = JSON.parse(stdout)
      
      if (result.status !== 0) {
        logger.error('Failed to describe object', { 
          objectName, 
          error: result.message 
        })
        return null
      }

      const objectInfo = result.result
      const customFields = objectInfo.fields
        .filter((field: any) => field.custom && field.name.endsWith('__c'))
        .map((field: any) => ({
          fullName: field.name,
          label: field.label,
          type: field.type,
          length: field.length,
          required: !field.nillable,
          unique: field.unique
        }))

      return {
        fullName: objectInfo.name,
        label: objectInfo.label,
        fields: customFields
      }
    } catch (error) {
      logger.error('Failed to describe object', { objectName, error })
      return null
    }
  }

  /**
   * Deploy metadata using SF CLI
   */
  async deployMetadata(metadataPath: string = 'force-app'): Promise<CLIDeployResult> {
    try {
      // First, ensure we have the latest API version
      await this.updateProjectApiVersion()

      const command = `npx sf project deploy start --source-dir ${metadataPath} --target-org ${this.orgAlias} --json`
      const { stdout } = await execAsync(command, { 
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large deployments
      })
      
      const result = JSON.parse(stdout)
      
      if (result.status !== 0) {
        return {
          success: false,
          errors: [result.message || 'Deployment failed']
        }
      }

      const deployment = result.result
      
      return {
        success: deployment.status === 'Succeeded',
        deploymentId: deployment.id,
        componentsSummary: {
          total: deployment.numberComponentsTotal || 0,
          deployed: deployment.numberComponentsDeployed || 0,
          failed: deployment.numberComponentErrors || 0
        }
      }
    } catch (error) {
      logger.error('Failed to deploy metadata', { error })
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  /**
   * Validate schema by comparing expected fields with actual fields
   */
  async validateSchema(objectName: string, expectedFields: string[]): Promise<{
    exists: boolean
    valid: boolean
    missingFields: string[]
    extraFields: string[]
  }> {
    const objectInfo = await this.describeObject(objectName)
    
    if (!objectInfo) {
      return {
        exists: false,
        valid: false,
        missingFields: expectedFields,
        extraFields: []
      }
    }

    const actualFieldNames = objectInfo.fields.map(f => f.fullName)
    const missingFields = expectedFields.filter(field => !actualFieldNames.includes(field))
    const extraFields = actualFieldNames.filter(field => !expectedFields.includes(field))

    return {
      exists: true,
      valid: missingFields.length === 0,
      missingFields,
      extraFields
    }
  }

  /**
   * Update project API version to match org
   */
  private async updateProjectApiVersion(): Promise<void> {
    try {
      const projectFile = path.join(this.projectPath, 'sfdx-project.json')
      const content = await fs.readFile(projectFile, 'utf-8')
      const project = JSON.parse(content)
      
      // Get org API version
      const { stdout } = await execAsync(`npx sf org display --target-org ${this.orgAlias} --json`)
      const orgInfo = JSON.parse(stdout)
      
      if (orgInfo.status === 0 && orgInfo.result?.apiVersion) {
        project.sourceApiVersion = orgInfo.result.apiVersion
        await fs.writeFile(projectFile, JSON.stringify(project, null, 2))
        logger.info('Updated project API version', { version: orgInfo.result.apiVersion })
      }
    } catch (error) {
      logger.warn('Could not update project API version', { error })
    }
  }

  /**
   * Generate SFDX metadata files for custom objects and fields
   */
  async generateMetadataFiles(objects: CLIObjectInfo[]): Promise<void> {
    const baseDir = path.join(this.projectPath, 'force-app/main/default/objects')
    
    for (const obj of objects) {
      const objDir = path.join(baseDir, obj.fullName)
      const fieldsDir = path.join(objDir, 'fields')
      
      // Ensure directories exist
      await fs.mkdir(fieldsDir, { recursive: true })
      
      // Generate object metadata file
      const objectXml = this.generateObjectXML(obj)
      await fs.writeFile(
        path.join(objDir, `${obj.fullName}.object-meta.xml`),
        objectXml
      )
      
      // Generate field metadata files
      for (const field of obj.fields) {
        const fieldXml = this.generateFieldXML(field)
        await fs.writeFile(
          path.join(fieldsDir, `${field.fullName}.field-meta.xml`),
          fieldXml
        )
      }
    }
    
    logger.info('Generated SFDX metadata files', { 
      objects: objects.map(o => o.fullName) 
    })
  }

  private generateObjectXML(obj: CLIObjectInfo): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>${obj.label}</label>
    <pluralLabel>${obj.label}s</pluralLabel>
    <nameField>
        <label>${obj.label} Name</label>
        <type>AutoNumber</type>
        <displayFormat>${obj.fullName.replace('__c', '')}-{00000}</displayFormat>
    </nameField>
    <deploymentStatus>Deployed</deploymentStatus>
    <sharingModel>ReadWrite</sharingModel>
    <enableActivities>false</enableActivities>
    <enableBulkApi>true</enableBulkApi>
    <enableReports>true</enableReports>
    <enableSearch>true</enableSearch>
    <enableSharing>true</enableSharing>
    <enableStreamingApi>true</enableStreamingApi>
</CustomObject>`
  }

  private generateFieldXML(field: CLIFieldInfo): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${field.fullName}</fullName>
    <label>${field.label}</label>
    <type>${field.type}</type>`

    if (field.length) {
      xml += `\n    <length>${field.length}</length>`
    }
    
    if (field.required) {
      xml += `\n    <required>true</required>`
    }
    
    if (field.unique) {
      xml += `\n    <unique>true</unique>`
    }

    xml += '\n</CustomField>'
    return xml
  }
} 