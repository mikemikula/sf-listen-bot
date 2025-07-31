/**
 * Salesforce Sync Service
 * Handles synchronization of data between our system and Salesforce
 * Maps our data structures to Salesforce objects and manages bulk operations
 * 
 * Key Features:
 * - Data mapping between local and Salesforce objects
 * - Bulk operations for efficient syncing
 * - Incremental sync support
 * - Error handling and retry logic
 * - Conflict resolution strategies
 * - Progress tracking and reporting
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { logger } from './logger'
import { prisma } from './db'
import { SalesforceApiClient, createApiClient, getSalesforceConfig } from './salesforce'
import type {
  ProcessedDocument,
  FAQ,
  BaseMessage,
  SalesforceDocumentRecord,
  SalesforceFAQRecord,
  SalesforceMessageRecord,
  SalesforceSyncJob,
  SalesforceSyncConfig,
  SalesforceSyncSummary,
  SalesforceTokenResponse,
  DocumentDisplay,
  FAQDisplay,
  MessageDisplay
} from '@/types'
import {
  SalesforceSyncError
} from '@/types'

/**
 * Default Salesforce Object Names
 * Can be configured via environment variables or settings
 */
const DEFAULT_OBJECT_NAMES = {
  document: 'Slack_Document__c',
  faq: 'Slack_FAQ__c',
  message: 'Slack_Message__c'
} as const

/**
 * Salesforce Sync Configuration
 * Manages sync settings and preferences
 */
export class SalesforceSyncConfiguration {
  private config: SalesforceSyncConfig

  constructor(config?: Partial<SalesforceSyncConfig>) {
    this.config = {
      enabled: process.env.SALESFORCE_ENABLED === 'true',
      syncDocuments: process.env.SALESFORCE_SYNC_DOCUMENTS !== 'false',
      syncFaqs: process.env.SALESFORCE_SYNC_FAQS !== 'false',
      syncMessages: process.env.SALESFORCE_SYNC_MESSAGES === 'true',
      documentObjectName: process.env.SALESFORCE_DOCUMENT_OBJECT || DEFAULT_OBJECT_NAMES.document,
      faqObjectName: process.env.SALESFORCE_FAQ_OBJECT || DEFAULT_OBJECT_NAMES.faq,
      messageObjectName: process.env.SALESFORCE_MESSAGE_OBJECT || DEFAULT_OBJECT_NAMES.message,
      syncInterval: parseInt(process.env.SALESFORCE_SYNC_INTERVAL || '60'), // minutes
      ...config
    }
  }

  public getConfig(): SalesforceSyncConfig {
    return { ...this.config }
  }

  public updateConfig(updates: Partial<SalesforceSyncConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  public isEnabled(): boolean {
    return this.config.enabled
  }
}

/**
 * Data Mapper Class
 * Handles mapping between our data structures and Salesforce objects
 */
export class SalesforceDataMapper {
  private config: SalesforceSyncConfiguration

  constructor(config: SalesforceSyncConfiguration) {
    this.config = config
  }

  /**
   * Map ProcessedDocument to Salesforce Document Record
   * 
   * @param document - Local document record
   * @param channelNames - Associated channel names from messages
   * @returns Salesforce document record
   */
  public mapDocumentToSalesforce(
    document: ProcessedDocument,
    channelNames: string[] = []
  ): SalesforceDocumentRecord {
    return {
      Name: this.truncateTitle(document.title, 80), // Salesforce Name field limit
      Description__c: document.description,
      Category__c: document.category,
      Status__c: document.status,
      Confidence_Score__c: document.confidenceScore,
      Created_By__c: document.createdBy || 'System',
      Slack_Channel__c: channelNames.join(', '),
      Message_Count__c: 0, // Will be updated with actual count
      FAQ_Count__c: 0, // Will be updated with actual count
      Conversation_Analysis__c: document.conversationAnalysis ? 
        JSON.stringify(document.conversationAnalysis) : undefined
    }
  }

  /**
   * Map FAQ to Salesforce FAQ Record
   * 
   * @param faq - Local FAQ record
   * @param sourceDocumentIds - Associated document IDs
   * @returns Salesforce FAQ record
   */
  public mapFaqToSalesforce(
    faq: FAQ,
    sourceDocumentIds: string[] = []
  ): SalesforceFAQRecord {
    return {
      Name: this.truncateTitle(faq.question, 80),
      Question__c: faq.question,
      Answer__c: faq.answer,
      Category__c: faq.category,
      Status__c: faq.status,
      Confidence_Score__c: faq.confidenceScore,
      Approved_By__c: faq.approvedBy || undefined,
      Approved_Date__c: faq.approvedAt?.toISOString(),
      Source_Documents__c: sourceDocumentIds.join(', ')
    }
  }

  /**
   * Map Message to Salesforce Message Record
   * 
   * @param message - Local message record
   * @returns Salesforce message record
   */
  public mapMessageToSalesforce(message: BaseMessage): SalesforceMessageRecord {
    return {
      Name: `${message.username} - ${message.timestamp.toISOString()}`,
      Text__c: this.truncateText(message.text, 32000), // Long text field limit
      Username__c: message.username,
      User_ID__c: message.userId,
      Channel__c: message.channel,
      Timestamp__c: message.timestamp.toISOString(),
      Thread_ID__c: message.threadTs || undefined,
      Is_Thread_Reply__c: message.isThreadReply,
      Slack_Message_ID__c: message.slackId
    }
  }

  /**
   * Truncate title to fit Salesforce field limits
   */
  private truncateTitle(title: string, maxLength: number): string {
    if (title.length <= maxLength) {
      return title
    }
    return title.substring(0, maxLength - 3) + '...'
  }

  /**
   * Truncate text to fit Salesforce field limits
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text
    }
    return text.substring(0, maxLength - 3) + '...'
  }
}

/**
 * Main Salesforce Sync Service
 * Orchestrates sync operations between our system and Salesforce
 */
export class SalesforceSyncService {
  private apiClient: SalesforceApiClient
  private mapper: SalesforceDataMapper
  private config: SalesforceSyncConfiguration

  constructor(tokenResponse: SalesforceTokenResponse, config?: SalesforceSyncConfiguration) {
    this.apiClient = createApiClient(tokenResponse)
    this.config = config || new SalesforceSyncConfiguration()
    this.mapper = new SalesforceDataMapper(this.config)
  }

  /**
   * Perform Full Sync
   * Syncs all enabled record types to Salesforce
   * 
   * @param filters - Optional filters for what to sync
   * @returns Sync summary
   */
  public async performFullSync(filters?: {
    startDate?: Date
    endDate?: Date
    categories?: string[]
    statuses?: string[]
  }): Promise<SalesforceSyncSummary> {
    const startTime = Date.now()
    logger.info('Starting full Salesforce sync', { filters })

    const summary: SalesforceSyncSummary = {
      totalRecords: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      skippedRecords: 0,
      syncDuration: 0,
      recordTypes: {
        documents: { synced: 0, failed: 0 },
        faqs: { synced: 0, failed: 0 },
        messages: { synced: 0, failed: 0 }
      },
      errors: []
    }

    try {
      // Sync documents if enabled
      if (this.config.getConfig().syncDocuments) {
        const documentResult = await this.syncDocuments(filters)
        summary.recordTypes.documents = documentResult
        summary.totalRecords += documentResult.synced + documentResult.failed
        summary.successfulSyncs += documentResult.synced
        summary.failedSyncs += documentResult.failed
      }

      // Sync FAQs if enabled
      if (this.config.getConfig().syncFaqs) {
        const faqResult = await this.syncFaqs(filters)
        summary.recordTypes.faqs = faqResult
        summary.totalRecords += faqResult.synced + faqResult.failed
        summary.successfulSyncs += faqResult.synced
        summary.failedSyncs += faqResult.failed
      }

      // Sync messages if enabled
      if (this.config.getConfig().syncMessages) {
        const messageResult = await this.syncMessages(filters)
        summary.recordTypes.messages = messageResult
        summary.totalRecords += messageResult.synced + messageResult.failed
        summary.successfulSyncs += messageResult.synced
        summary.failedSyncs += messageResult.failed
      }

      summary.syncDuration = Date.now() - startTime

      logger.info('Full sync completed', {
        totalRecords: summary.totalRecords,
        successful: summary.successfulSyncs,
        failed: summary.failedSyncs,
        duration: summary.syncDuration
      })

      return summary

    } catch (error) {
      logger.error('Full sync failed', { error })
      throw new SalesforceSyncError('Full sync operation failed', undefined, undefined, undefined)
    }
  }

  /**
   * Sync Documents to Salesforce
   * 
   * @param filters - Optional filters
   * @returns Sync result
   */
  private async syncDocuments(filters?: {
    startDate?: Date
    endDate?: Date
    categories?: string[]
    statuses?: string[]
  }): Promise<{ synced: number; failed: number }> {
    logger.info('Syncing documents to Salesforce')

    try {
      // Build filter criteria
      const where: any = {}
      
      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {}
        if (filters.startDate) where.createdAt.gte = filters.startDate
        if (filters.endDate) where.createdAt.lte = filters.endDate
      }
      
      if (filters?.categories && filters.categories.length > 0) {
        where.category = { in: filters.categories }
      }
      
      if (filters?.statuses && filters.statuses.length > 0) {
        where.status = { in: filters.statuses }
      } else {
        // Default: only sync completed documents
        where.status = 'COMPLETE'
      }

      // Fetch documents from database
      const documents = await prisma.processedDocument.findMany({
        where,
        include: {
          documentMessages: {
            include: {
              message: true
            }
          },
          documentFAQs: true
        },
        orderBy: { createdAt: 'asc' }
      })

      logger.info(`Found ${documents.length} documents to sync`)

      let synced = 0
      let failed = 0

      // Process documents in batches
      const batchSize = 10 // Salesforce API limits
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize)
        
        for (const document of batch) {
          try {
            // Get channel names from associated messages
            const channelNames = Array.from(new Set(
              document.documentMessages.map(dm => dm.message.channel)
            ))

            // Map to Salesforce format
            const salesforceRecord = this.mapper.mapDocumentToSalesforce(
              document as unknown as ProcessedDocument,
              channelNames
            )

            // Update counts
            salesforceRecord.Message_Count__c = document.documentMessages.length
            salesforceRecord.FAQ_Count__c = document.documentFAQs.length

            // Upsert to Salesforce
            await this.apiClient.upsertRecord(
              this.config.getConfig().documentObjectName,
              'External_Id__c',
              document.id,
              salesforceRecord
            )

            synced++
            logger.debug('Successfully synced document', { documentId: document.id })

          } catch (error) {
            failed++
            logger.error('Failed to sync document', { 
              documentId: document.id, 
              error: error instanceof Error ? error.message : error 
            })
          }
        }

        // Brief pause between batches to respect rate limits
        if (i + batchSize < documents.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      logger.info('Document sync completed', { synced, failed })
      return { synced, failed }

    } catch (error) {
      logger.error('Document sync failed', { error })
      throw new SalesforceSyncError('Document sync failed')
    }
  }

  /**
   * Sync FAQs to Salesforce
   */
  private async syncFaqs(filters?: {
    startDate?: Date
    endDate?: Date
    categories?: string[]
    statuses?: string[]
  }): Promise<{ synced: number; failed: number }> {
    logger.info('Syncing FAQs to Salesforce')

    try {
      const where: any = {}
      
      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {}
        if (filters.startDate) where.createdAt.gte = filters.startDate
        if (filters.endDate) where.createdAt.lte = filters.endDate
      }
      
      if (filters?.categories && filters.categories.length > 0) {
        where.category = { in: filters.categories }
      }
      
      if (filters?.statuses && filters.statuses.length > 0) {
        where.status = { in: filters.statuses }
      } else {
        // Default: only sync approved FAQs
        where.status = 'APPROVED'
      }

      const faqs = await prisma.fAQ.findMany({
        where,
        include: {
          documentFAQs: {
            include: {
              document: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      })

      logger.info(`Found ${faqs.length} FAQs to sync`)

      let synced = 0
      let failed = 0

      const batchSize = 10
      for (let i = 0; i < faqs.length; i += batchSize) {
        const batch = faqs.slice(i, i + batchSize)
        
        for (const faq of batch) {
          try {
            // Get source document IDs
            const sourceDocumentIds = faq.documentFAQs.map(df => df.document.id)

            const salesforceRecord = this.mapper.mapFaqToSalesforce(
              faq as unknown as FAQ,
              sourceDocumentIds
            )

            await this.apiClient.upsertRecord(
              this.config.getConfig().faqObjectName,
              'External_Id__c',
              faq.id,
              salesforceRecord
            )

            synced++
            logger.debug('Successfully synced FAQ', { faqId: faq.id })

          } catch (error) {
            failed++
            logger.error('Failed to sync FAQ', { 
              faqId: faq.id, 
              error: error instanceof Error ? error.message : error 
            })
          }
        }

        if (i + batchSize < faqs.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      logger.info('FAQ sync completed', { synced, failed })
      return { synced, failed }

    } catch (error) {
      logger.error('FAQ sync failed', { error })
      throw new SalesforceSyncError('FAQ sync failed')
    }
  }

  /**
   * Sync Messages to Salesforce
   */
  private async syncMessages(filters?: {
    startDate?: Date
    endDate?: Date
    categories?: string[]
    statuses?: string[]
  }): Promise<{ synced: number; failed: number }> {
    logger.info('Syncing messages to Salesforce')

    try {
      const where: any = {}
      
      if (filters?.startDate || filters?.endDate) {
        where.timestamp = {}
        if (filters.startDate) where.timestamp.gte = filters.startDate
        if (filters.endDate) where.timestamp.lte = filters.endDate
      }

      // Only sync messages that are part of documents
      where.documentMessages = {
        some: {}
      }

      const messages = await prisma.message.findMany({
        where,
        orderBy: { timestamp: 'asc' },
        take: 1000 // Limit to prevent overwhelming Salesforce
      })

      logger.info(`Found ${messages.length} messages to sync`)

      let synced = 0
      let failed = 0

      const batchSize = 10
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize)
        
        for (const message of batch) {
          try {
            const salesforceRecord = this.mapper.mapMessageToSalesforce(message as BaseMessage)

            await this.apiClient.upsertRecord(
              this.config.getConfig().messageObjectName,
              'External_Id__c',
              message.id,
              salesforceRecord
            )

            synced++
            logger.debug('Successfully synced message', { messageId: message.id })

          } catch (error) {
            failed++
            logger.error('Failed to sync message', { 
              messageId: message.id, 
              error: error instanceof Error ? error.message : error 
            })
          }
        }

        if (i + batchSize < messages.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      logger.info('Message sync completed', { synced, failed })
      return { synced, failed }

    } catch (error) {
      logger.error('Message sync failed', { error })
      throw new SalesforceSyncError('Message sync failed')
    }
  }

  /**
   * Test Salesforce Connection
   * Verifies that we can communicate with Salesforce
   * 
   * @returns Connection test results
   */
  public async testConnection(): Promise<{
    success: boolean
    details?: {
      instanceUrl: string
      apiVersion: string
      limits: any
    }
    error?: string
  }> {
    try {
      logger.info('Testing Salesforce connection')

      const limits = await this.apiClient.getLimits()
      const instanceUrl = this.apiClient['config'].instanceUrl
      const apiVersion = this.apiClient['config'].apiVersion

      logger.info('Salesforce connection test successful')

      return {
        success: true,
        details: {
          instanceUrl,
          apiVersion,
          limits
        }
      }

    } catch (error) {
      logger.error('Salesforce connection test failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get API Usage Information
   * Returns current API usage statistics
   */
  public getApiUsage(): { used?: string; limit?: string } {
    return this.apiClient.getRateLimitInfo()
  }

  /**
   * Validate Salesforce Objects
   * Checks if the configured Salesforce objects exist and have the required fields
   * 
   * @returns Validation results
   */
  public async validateSalesforceObjects(): Promise<{
    valid: boolean
    issues: string[]
  }> {
    const issues: string[] = []
    const config = this.config.getConfig()

    try {
      // Test if we can describe the objects (basic validation)
      if (config.syncDocuments) {
        try {
          await this.apiClient.query(`SELECT Id FROM ${config.documentObjectName} LIMIT 1`)
        } catch (error) {
          issues.push(`Document object '${config.documentObjectName}' not found or not accessible`)
        }
      }

      if (config.syncFaqs) {
        try {
          await this.apiClient.query(`SELECT Id FROM ${config.faqObjectName} LIMIT 1`)
        } catch (error) {
          issues.push(`FAQ object '${config.faqObjectName}' not found or not accessible`)
        }
      }

      if (config.syncMessages) {
        try {
          await this.apiClient.query(`SELECT Id FROM ${config.messageObjectName} LIMIT 1`)
        } catch (error) {
          issues.push(`Message object '${config.messageObjectName}' not found or not accessible`)
        }
      }

      return {
        valid: issues.length === 0,
        issues
      }

    } catch (error) {
      logger.error('Object validation failed', { error })
      return {
        valid: false,
        issues: ['Failed to validate Salesforce objects']
      }
    }
  }
}

/**
 * Utility Functions
 */

/**
 * Create Sync Service from stored token
 * Helper function to create sync service from database-stored credentials
 * 
 * @param userId - User ID to get credentials for
 * @returns Configured sync service or null if no valid credentials
 */
export async function createSyncServiceForUser(userId: string): Promise<SalesforceSyncService | null> {
  try {
    // This would typically retrieve stored credentials from your user session/database
    // For now, return null - this will be implemented based on your auth strategy
    logger.warn('createSyncServiceForUser not fully implemented - needs credential storage strategy')
    return null
  } catch (error) {
    logger.error('Failed to create sync service for user', { userId, error })
    return null
  }
}

/**
 * Check if Salesforce sync is configured and enabled
 */
export function isSalesforceSyncEnabled(): boolean {
  try {
    const config = new SalesforceSyncConfiguration()
    return config.isEnabled()
  } catch (error) {
    logger.warn('Failed to check Salesforce sync status', { error })
    return false
  }
}

/**
 * Get default sync configuration
 */
export function getDefaultSyncConfig(): SalesforceSyncConfiguration {
  return new SalesforceSyncConfiguration()
} 