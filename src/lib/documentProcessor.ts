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
  InclusionMethod,
  PIISourceType,
  ProcessingError
} from '@/types'
import type { Message, PIIDetection } from '@prisma/client'

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
   * Process messages into a structured document with AI analysis
   */
  async processDocument(input: DocumentProcessingInput): Promise<{
    document: ProcessedDocument
    analysisResults: {
      conversationAnalysis: any
      piiDetections: PIIDetection[]
      processingTimeMs: number
      warnings: string[]
    }
  }> {
    const startTime = Date.now()
    
    // Create a job record for tracking (even for synchronous processing)
    const processingJob = await db.automationJob.create({
      data: {
        automationRuleId: 'doc-automation', // Default automation rule
        status: 'PROCESSING',
        jobType: 'DOCUMENT_CREATION',
        inputData: input as any,
        progress: 0,
        startedAt: new Date()
      }
    })

    try {
      // Validate input
      this.validateInput(input)

      // Update progress
      await db.automationJob.update({
        where: { id: processingJob.id },
        data: { progress: 0.1 }
      })

      // Fetch messages from database
      const messages = await this.fetchMessages(input.messageIds)
      logger.info(`Processing ${messages.length} messages into document with AI analysis`)

      // Update progress
      await db.automationJob.update({
        where: { id: processingJob.id },
        data: { progress: 0.2 }
      })

      // Process PII detection and replacement
      const piiResults = await this.processPII(messages)
      logger.info(`Detected and replaced ${piiResults.replacements} PII instances`)

      // Update progress
      await db.automationJob.update({
        where: { id: processingJob.id },
        data: { progress: 0.4 }
      })

      // Generate AI conversation analysis
      const conversationAnalysisResult = await geminiService.analyzeConversationPatterns(
        messages.map(m => ({
          id: m.id,
          text: m.text,
          username: m.username,
          timestamp: m.timestamp.toISOString(),
          channel: m.channel
        }))
      )
      const conversationAnalysis = conversationAnalysisResult.success ? conversationAnalysisResult.data : null
      
      // Update progress
      await db.automationJob.update({
        where: { id: processingJob.id },
        data: { progress: 0.6 }
      })

      // Create the document with AI analysis
      const document = await this.createDocument(input, messages, conversationAnalysis)

      // Update progress
      await db.automationJob.update({
        where: { id: processingJob.id },
        data: { progress: 0.8 }
      })

      // Create document-message relationships
      await this.createDocumentMessageRelationships(
        document.id,
        messages,
        conversationAnalysis,
        input.userId ? InclusionMethod.USER_MANUAL : InclusionMethod.AI_AUTOMATIC,
        input.userId
      )

      // Update the document to reference the processing job
      await db.processedDocument.update({
        where: { id: document.id },
        data: { automationJobId: processingJob.id }
      })

      // Mark job as complete
      await db.automationJob.update({
        where: { id: processingJob.id },
        data: {
          status: 'COMPLETE',
          progress: 1.0,
          completedAt: new Date(),
          outputData: {
            documentId: document.id,
            messageCount: messages.length,
            piiDetections: piiResults.detections.length,
            confidenceScore: document.confidenceScore
          }
        }
      })

      const processingTimeMs = Date.now() - startTime
      logger.info(`Document processing completed in ${processingTimeMs}ms: "${document.title}"`)

      return {
        document,
        analysisResults: {
          conversationAnalysis,
          piiDetections: piiResults.detections,
          processingTimeMs,
          warnings: this.generateWarnings(piiResults)
        }
      }

    } catch (error) {
      // Mark job as failed
      await db.automationJob.update({
        where: { id: processingJob.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      })

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
    addedMessages: Message[]
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
      const newMessages = await db.message.findMany({ where: { id: { in: additionalMessageIds } } })

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
        null, // No conversation analysis for manually added messages
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
  private async fetchMessages(messageIds: string[]): Promise<Message[]> {
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
  private async processPII(messages: Message[]): Promise<{
    detections: PIIDetection[]
    replacements: number
  }> {
    let allDetections: PIIDetection[] = []
    let totalReplacements = 0

    for (const message of messages) {
            try {
        const detections = await piiDetectorService.detectPII(message.text, PIISourceType.MESSAGE, message.id)
        // Type cast to handle enum compatibility
        allDetections.push(...(detections as PIIDetection[]))
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
    messages: Message[]
  ): Promise<{ title: string; description: string; category: string; confidence: number }> {
    const messageContent = messages.map((m) => m.text).join('\n')
    
    const metadataResult = await geminiService.generateDocumentMetadata(messageContent)
    
    if (metadataResult.success && metadataResult.data) {
      return { ...metadataResult.data, confidence: 0.8 }
    }
    
    logger.warn('AI metadata generation failed, using basic metadata')
    return {
      title: 'Untitled Document',
      description: 'Document description not available',
      category: 'General',
      confidence: 0.7
    }
  }

  /**
   * Generate basic metadata as fallback
   */
  private generateBasicMetadata(messages: Message[]): { title: string; category: string; description: string } {
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
    messages: Message[],
    conversationAnalysis: any | null
  ): Promise<ProcessedDocument> {
    const { title, category, userId } = input

    // Use AI-generated metadata if available, otherwise create basic metadata
    const metadata = (title && category) 
      ? { title, description: 'Generated from conversation', category, confidence: 1.0 }
      : await this.generateDocumentMetadata(messages)

    const newDocument = await db.processedDocument.create({
      data: {
        title: metadata.title,
        description: metadata.description,
        category: metadata.category,
        confidenceScore: metadata.confidence,
        status: 'COMPLETE',
        automationJobId: null,
        createdBy: userId || 'system',
        ...(conversationAnalysis && { conversationAnalysis: conversationAnalysis as any }),
      },
    })

    logger.info(`Created document: "${newDocument.title}" (Category: ${newDocument.category})`)
    return newDocument
  }

  /**
   * Create document-message relationships with AI-determined roles
   */
  private async createDocumentMessageRelationships(
    documentId: string,
    messages: Message[],
    conversationAnalysis: any,
    inclusionMethod: InclusionMethod = InclusionMethod.AI_AUTOMATIC,
    addedBy?: string
  ): Promise<void> {
    const relationships: any[] = []

    // Create a map of message ID to role based on AI analysis
    const messageRoleMap = new Map<string, { role: string; confidence: number }>()
    
    if (conversationAnalysis?.patterns) {
      for (const pattern of conversationAnalysis.patterns) {
        const { type, messageIds, confidence } = pattern
        
        for (const messageId of messageIds) {
          let role: string
          
          // Map AI analysis types to database roles (direct 1:1 mapping)
          switch (type) {
            case 'question':
              role = 'QUESTION'
              break
            case 'answer':
              role = 'ANSWER'
              break
            case 'follow_up':
              role = 'FOLLOW_UP'
              break
            case 'confirmation':
              role = 'CONFIRMATION'
              break
            case 'context':
            default:
              role = 'CONTEXT'
              break
          }
          
          messageRoleMap.set(messageId, { role, confidence })
        }
      }
    }

    for (const message of messages) {
      const roleInfo = messageRoleMap.get(message.id) || { role: 'CONTEXT', confidence: 0.8 }
      
      relationships.push({
        documentId,
        messageId: message.id,
        inclusionMethod,
        messageRole: roleInfo.role,
        addedBy,
        processingConfidence: roleInfo.confidence
      })
    }

    await db.documentMessage.createMany({
      data: relationships
    })

    logger.info(`Created ${relationships.length} document-message relationships with AI-determined roles`)
    console.log('Document-message relationships created:', relationships.map(r => ({
      documentId: r.documentId,
      messageId: r.messageId,
      role: r.messageRole,
      method: r.inclusionMethod,
      confidence: r.processingConfidence
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
    messages: Message[]
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
    messages: Message[],
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
  private generateWarnings(piiResults: { detections: PIIDetection[]; replacements: number }): string[] {
    const warnings: string[] = []
    
    if (piiResults.detections.length > 0) {
      warnings.push(`${piiResults.detections.length} PII items detected and need review`)
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