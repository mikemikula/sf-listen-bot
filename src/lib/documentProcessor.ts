/**
 * Document Processor Service
 * Simplified service for creating processed documents from Slack messages
 * Focuses on core functionality without analysis overhead
 */

import { logger } from './logger'
import { db } from './db'
import { geminiService } from './gemini'
import { piiDetectorService } from './piiDetector'
import { 
  ProcessedDocument,
  DocumentProcessingInput,
  DocumentProcessingResult,
  BaseMessage,
  DocumentMessage,
  PIIDetection,
  DocumentStatus,
  InclusionMethod,
  PIISourceType,
  ProcessingError
} from '@/types'

/**
 * Processing statistics interface
 */
interface ProcessingStats {
  messagesAnalyzed: number
  messagesIncluded: number
  piiItemsDetected: number
  piiItemsReplaced: number
  qaPairsFound: number
  confidenceScore: number
  processingTimeMs: number
  warnings: string[]
}

/**
 * Document Processing Service
 * Handles creation and enhancement of processed documents from Slack messages
 */
class DocumentProcessorService {

  /**
   * Process a collection of messages into a structured document
   */
  async processDocument(input: DocumentProcessingInput): Promise<DocumentProcessingResult> {
    const startTime = Date.now()
    
    try {
      logger.info(`Starting document processing for ${input.messageIds.length} messages`)

      // Step 1: Validate input
      this.validateInput(input)

      // Step 2: Fetch messages from database
      const messages = await this.fetchMessages(input.messageIds)
      console.log(`Fetched ${messages.length} messages for document processing:`, messages.map(m => ({ id: m.id, text: m.text.substring(0, 50) + '...' })))

      // Step 3: Detect and handle PII
      const piiResults = await this.processPII(messages)

      // Step 4: Create document with metadata
      const document = await this.createDocument(input, messages, piiResults)

      // Step 5: Create junction table relationships
      await this.createDocumentMessageRelationships(document.id, messages)

      // Step 6: Calculate final statistics
      const stats: ProcessingStats = {
        messagesAnalyzed: messages.length,
        messagesIncluded: messages.length,
        piiItemsDetected: piiResults.detections.length,
        piiItemsReplaced: piiResults.replacements,
        qaPairsFound: 0, // Simplified - no longer analyzing Q&A pairs
        confidenceScore: document.confidenceScore,
        processingTimeMs: Date.now() - startTime,
        warnings: this.generateWarnings(piiResults)
      }

      logger.info(`Document processing completed in ${stats.processingTimeMs}ms`)
      console.log('Processing completed with stats:', stats)

             return {
         document,
         messagesProcessed: messages.length,
         piiDetected: piiResults.detections,
         confidenceScore: document.confidenceScore,
         processingTime: stats.processingTimeMs
       }

    } catch (error) {
      logger.error('Document processing failed:', error)
      throw new ProcessingError(`Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Enhance an existing document with additional messages
   */
  async enhanceDocument(
    documentId: string,
    additionalMessageIds: string[],
    userId?: string
  ): Promise<{
    updatedDocument: ProcessedDocument
    addedMessages: BaseMessage[]
    stats: ProcessingStats
  }> {
    const startTime = Date.now()

    try {
      logger.info(`Enhancing document ${documentId} with ${additionalMessageIds.length} additional messages`)

      // Step 1: Validate document exists
      const existingDocument = await db.processedDocument.findUnique({
        where: { id: documentId },
        include: { documentMessages: { include: { message: true } } }
      })

      if (!existingDocument) {
        throw new ProcessingError(`Document ${documentId} not found`)
      }

      // Step 2: Fetch new messages
      const newMessages = await this.fetchMessages(additionalMessageIds)

      // Step 3: Process PII in new messages
      const piiResults = await this.processPII(newMessages)

      // Step 4: Update document metadata
      const updatedDocument = await this.updateDocumentWithEnhancements(
        documentId,
        piiResults
      )

      // Step 5: Create relationships for new messages
      await this.createDocumentMessageRelationships(
        documentId,
        newMessages,
        InclusionMethod.USER_ENHANCED,
        userId
      )

      logger.info(`Document ${documentId} enhanced with ${newMessages.length} messages`)

      return {
        updatedDocument,
        addedMessages: newMessages,
        stats: {
          messagesAnalyzed: newMessages.length,
          messagesIncluded: newMessages.length,
          piiItemsDetected: piiResults.detections.length,
          piiItemsReplaced: piiResults.replacements,
          qaPairsFound: 0, // Simplified
          confidenceScore: updatedDocument.confidenceScore,
          processingTimeMs: Date.now() - startTime,
          warnings: this.generateWarnings(piiResults)
        }
      }

    } catch (error) {
      logger.error('Document enhancement failed:', error)
      throw new ProcessingError(`Document enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Remove messages from a document
   */
  async removeMessagesFromDocument(
    documentId: string,
    messageIds: string[],
    reason?: string
  ): Promise<void> {
    try {
      await db.documentMessage.deleteMany({
        where: {
          documentId,
          messageId: { in: messageIds }
        }
      })

      logger.info(`Removed ${messageIds.length} messages from document ${documentId}`)
    } catch (error) {
      logger.error('Failed to remove messages from document:', error)
      throw new ProcessingError(`Failed to remove messages: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate document processing input
   */
  private validateInput(input: DocumentProcessingInput): void {
    if (!input.messageIds || input.messageIds.length === 0) {
      throw new ProcessingError('At least one message ID is required')
    }

    if (input.messageIds.length > 500) {
      throw new ProcessingError('Too many messages - maximum 500 allowed per document')
    }

    if (input.title && input.title.length > 200) {
      throw new ProcessingError('Title too long - maximum 200 characters')
    }

    
  }

  /**
   * Fetch messages from database with validation
   */
  private async fetchMessages(messageIds: string[]): Promise<BaseMessage[]> {
    const messages = await db.message.findMany({
      where: {
        id: { in: messageIds }
      },
      orderBy: { timestamp: 'asc' }
    })

    if (messages.length !== messageIds.length) {
      const foundIds = messages.map(m => m.id)
      const missingIds = messageIds.filter(id => !foundIds.includes(id))
      throw new ProcessingError(`Messages not found: ${missingIds.join(', ')}`)
    }

    return messages
  }

  /**
   * Process PII detection and replacement
   */
  private async processPII(messages: BaseMessage[]): Promise<{
    detections: PIIDetection[]
    replacements: number
  }> {
    let allDetections: PIIDetection[] = []
    let totalReplacements = 0

    for (const message of messages) {
      try {
                 const detections = await piiDetectorService.detectPII(message.text, PIISourceType.MESSAGE, message.id)
         allDetections = allDetections.concat(detections)
         totalReplacements += detections.length
      } catch (error) {
        logger.warn(`PII processing failed for message ${message.id}:`, error)
      }
    }

    return {
      detections: allDetections,
      replacements: totalReplacements
    }
  }

  /**
   * Generate document metadata using AI or defaults
   */
  private async generateDocumentMetadata(
    messages: BaseMessage[]
  ): Promise<{ title: string; category: string; description: string }> {
    try {
      // Prepare message content for AI analysis
      const messageContent = messages
        .map(m => `${m.username}: ${m.text}`)
        .join('\n')
        .substring(0, 4000) // Limit for AI context

      if (messageContent.length < 100) {
        // Fallback for very short conversations
        return this.generateBasicMetadata(messages)
      }

      // Use AI service to generate metadata
      const response = await geminiService.generateDocumentMetadata(messageContent)
      
      if (response.success && response.data) {
        return {
          title: response.data.title || 'Untitled Document',
          category: response.data.category || 'General',
          description: response.data.description || 'Document description not available'
        }
      } else {
        logger.warn('AI metadata generation failed, using basic metadata')
        return this.generateBasicMetadata(messages)
      }

    } catch (error) {
      logger.error('Document metadata generation failed:', error)
      return this.generateBasicMetadata(messages)
    }
  }

  /**
   * Generate basic metadata as fallback
   */
  private generateBasicMetadata(messages: BaseMessage[]): { title: string; category: string; description: string } {
         const participants = Array.from(new Set(messages.map(m => m.username))).slice(0, 3)
    const firstMessage = messages[0]?.text.substring(0, 100) || 'Discussion'
    
    return {
      title: `Discussion with ${participants.join(', ')}`,
      category: 'General',
      description: `Document created from ${messages.length} messages. Started with: "${firstMessage}..."`
    }
  }

  /**
   * Create document record in database
   */
  private async createDocument(
    input: DocumentProcessingInput,
    messages: BaseMessage[],
    piiResults: any
  ): Promise<ProcessedDocument> {
    // Use provided metadata or generate with AI
    let title = input.title?.trim()
    let category = input.category?.trim()
    let description: string

    if (!title || !category) {
      logger.info('Auto-generating document metadata with AI analysis')
      const metadata = await this.generateDocumentMetadata(messages)
      
      title = title || metadata.title
      category = category || metadata.category
      description = metadata.description
    } else {
      // Generate description for manually titled documents
      description = await this.generateDocumentDescription(messages)
    }

    // Calculate confidence score
    const confidenceScore = this.calculateDocumentConfidence(messages, piiResults)

    const document = await db.processedDocument.create({
      data: {
        title,
        description,
        category,
        status: DocumentStatus.COMPLETE,
        confidenceScore,
        createdBy: input.userId || null
      }
    })

    logger.info(`Created document: "${title}" (Category: ${category})`)
    return document
  }

  /**
   * Create document-message relationships
   */
  private async createDocumentMessageRelationships(
    documentId: string,
    messages: BaseMessage[],
    inclusionMethod: InclusionMethod = InclusionMethod.AI_AUTOMATIC,
    addedBy?: string
  ): Promise<void> {
    const relationships: any[] = []

    for (const message of messages) {
      // Simplified approach - all messages are context with default confidence
      relationships.push({
        documentId,
        messageId: message.id,
        inclusionMethod,
        messageRole: 'CONTEXT', // Default role without analysis
        addedBy,
        processingConfidence: 0.8 // Default confidence
      })
    }

    await db.documentMessage.createMany({
      data: relationships
    })

    logger.info(`Created ${relationships.length} document-message relationships`)
    console.log('Document-message relationships created:', relationships.map(r => ({
      documentId: r.documentId,
      messageId: r.messageId,
      role: r.messageRole,
      method: r.inclusionMethod
    })))
  }

  /**
   * Update document with enhancements
   */
  private async updateDocumentWithEnhancements(
    documentId: string,
    piiResults: any
  ): Promise<ProcessedDocument> {
    // Simplified confidence calculation for enhancements
    const newConfidence = 0.85 // Default enhanced confidence

    const updatedDocument = await db.processedDocument.update({
      where: { id: documentId },
      data: {
        confidenceScore: newConfidence,
        updatedAt: new Date()
      }
    })

    return updatedDocument
  }

  /**
   * Generate simple document description
   */
  private async generateDocumentDescription(
    messages: BaseMessage[]
  ): Promise<string> {
    try {
      const messageTexts = messages.map(m => m.text).join(' ')
      const summary = messageTexts.substring(0, 500) // Limit for processing

             // Simple description generation
       const participants = Array.from(new Set(messages.map(m => m.username)))
      return `Document containing ${messages.length} messages from ${participants.length} participants: ${participants.join(', ')}.`

    } catch (error) {
      logger.error('Description generation failed:', error)
      return `Document containing ${messages.length} messages.`
    }
  }

  /**
   * Calculate document confidence score
   */
  private calculateDocumentConfidence(
    messages: BaseMessage[],
    piiResults: any
  ): number {
    let confidence = 0.7 // Base confidence

    // Adjust for message quality
    if (messages.length >= 3) {
      confidence += 0.1
    }

    // Reduce confidence for high PII detection
    if (piiResults.detections.length > messages.length * 0.5) {
      confidence -= 0.2
    }

    return Math.max(0.1, Math.min(1.0, confidence))
  }

  /**
   * Generate processing warnings
   */
  private generateWarnings(piiResults: any): string[] {
    const warnings: string[] = []

    if (piiResults.detections.length > 10) {
      warnings.push(`High number of PII detections (${piiResults.detections.length}) - review recommended`)
    }

    return warnings
  }

  /**
   * Get processing statistics for a document
   */
  async getDocumentStats(documentId: string): Promise<{
    messageCount: number
    participantCount: number
    qaPairCount: number
    confidenceScore: number
  }> {
    const document = await db.processedDocument.findUnique({
      where: { id: documentId },
      include: {
        documentMessages: {
          include: { message: true }
        }
      }
    })

    if (!document) {
      throw new ProcessingError(`Document ${documentId} not found`)
    }

    const messages = document.documentMessages.map(dm => dm.message)
         const participants = Array.from(new Set(messages.map(m => m.username)))

    return {
      messageCount: messages.length,
      participantCount: participants.length,
      qaPairCount: 0, // Simplified - no Q&A analysis
      confidenceScore: document.confidenceScore
    }
  }

  /**
   * Health check for document processor service
   */
  async healthCheck(): Promise<{
    isHealthy: boolean
    error?: string
  }> {
    try {
      // Test database connectivity
      await db.$queryRaw`SELECT 1`
      
      // Test PII detector service
      const piiHealth = await piiDetectorService.healthCheck()
      if (!piiHealth.isHealthy) {
        return {
          isHealthy: false,
          error: `PII detector service error: ${piiHealth.error}`
        }
      }

      // Test Gemini service
      const geminiHealth = await geminiService.healthCheck()
      if (!geminiHealth.isHealthy) {
        return {
          isHealthy: false,
          error: `Gemini service error: ${geminiHealth.error}`
        }
      }

      return {
        isHealthy: true
      }

    } catch (error) {
      return {
        isHealthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Export singleton instance
export const documentProcessorService = new DocumentProcessorService()
export default documentProcessorService