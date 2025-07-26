/**
 * Document Processor Service
 * Orchestrates the creation of processed documents from Slack messages
 * Handles conversation analysis, PII detection, and junction table relationships
 */

import { logger } from './logger'
import { db } from './db'
import { geminiService } from './gemini'
import { piiDetectorService } from './piiDetector'
import { conversationAnalyzerService } from './conversationAnalyzer'
import { 
  ProcessedDocument,
  DocumentProcessingInput,
  DocumentProcessingResult,
  BaseMessage,
  DocumentMessage,
  PIIDetection,
  DocumentStatus,
  InclusionMethod,
  MessageRole,
  PIISourceType,
  ProcessingError
} from '@/types'

// Configuration constants
const DEFAULT_CONFIDENCE_THRESHOLD = 0.7
const MAX_MESSAGES_PER_DOCUMENT = 100
const MAX_PROCESSING_TIME_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Document processing statistics
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
 * Document Processor service for creating structured documents from messages
 */
class DocumentProcessorService {

  /**
   * Process selected messages into a structured document
   */
  async processMessagesIntoDocument(
    input: DocumentProcessingInput
  ): Promise<DocumentProcessingResult> {
    const startTime = Date.now()
    
    try {
      logger.info(`Starting document processing for ${input.messageIds.length} messages`)

      // Step 1: Validate input
      this.validateInput(input)

      // Step 2: Fetch messages from database
      const messages = await this.fetchMessages(input.messageIds)
      console.log(`Fetched ${messages.length} messages for document processing:`, messages.map(m => ({ id: m.id, text: m.text.substring(0, 50) + '...' })))

      // Step 3: Analyze conversation structure
      const conversationAnalysis = await conversationAnalyzerService.analyzeConversation(messages)

      // Step 4: Detect and handle PII
      const piiResults = await this.processPII(messages)

      // Step 5: Create document with metadata
      const document = await this.createDocument(input, messages, conversationAnalysis, piiResults)

      // Step 6: Create junction table relationships
      await this.createDocumentMessageRelationships(document.id, messages, conversationAnalysis)

      // Step 7: Calculate final statistics
      const stats: ProcessingStats = {
        messagesAnalyzed: messages.length,
        messagesIncluded: messages.length,
        piiItemsDetected: piiResults.detections.length,
        piiItemsReplaced: piiResults.replacements,
        qaPairsFound: conversationAnalysis.qaPairs.length,
        confidenceScore: document.confidenceScore,
        processingTimeMs: Date.now() - startTime,
        warnings: this.generateWarnings(conversationAnalysis, piiResults)
      }

      const result: DocumentProcessingResult = {
        document,
        messagesProcessed: messages.length,
        piiDetected: piiResults.detections,
        confidenceScore: document.confidenceScore,
        processingTime: stats.processingTimeMs
      }

      logger.info(`Document processing completed: ${document.id} (${stats.processingTimeMs}ms)`)
      return result

    } catch (error) {
      logger.error('Document processing failed:', error)
      throw new ProcessingError(`Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Enhance existing document by adding more messages
   */
  async enhanceDocument(
    documentId: string,
    additionalMessageIds: string[],
    userId: string
  ): Promise<{
    updatedDocument: ProcessedDocument
    messagesAdded: number
    newPiiDetections: PIIDetection[]
  }> {
    try {
      logger.info(`Enhancing document ${documentId} with ${additionalMessageIds.length} additional messages`)

      // Step 1: Fetch existing document
      const existingDocument = await db.processedDocument.findUnique({
        where: { id: documentId },
        include: {
          documentMessages: {
            include: { message: true }
          }
        }
      })

      if (!existingDocument) {
        throw new Error(`Document ${documentId} not found`)
      }

      // Step 2: Fetch new messages
      const newMessages = await this.fetchMessages(additionalMessageIds)

      // Step 3: Combine with existing messages for analysis
      const existingMessages = existingDocument.documentMessages.map((dm: any) => dm.message)
      const allMessages = [...existingMessages, ...newMessages]

      // Step 4: Re-analyze conversation with enhanced context
      const conversationAnalysis = await conversationAnalyzerService.analyzeConversation(allMessages)

      // Step 5: Process PII in new messages
      const piiResults = await this.processPII(newMessages)

      // Step 6: Update document metadata
      const updatedDocument = await this.updateDocumentWithEnhancements(
        documentId,
        conversationAnalysis,
        piiResults
      )

      // Step 7: Create relationships for new messages
      await this.createDocumentMessageRelationships(
        documentId,
        newMessages,
        conversationAnalysis,
        InclusionMethod.USER_ENHANCED,
        userId
      )

      logger.info(`Document ${documentId} enhanced with ${newMessages.length} messages`)

      return {
        updatedDocument,
        messagesAdded: newMessages.length,
        newPiiDetections: piiResults.detections
      }

    } catch (error) {
      logger.error(`Document enhancement failed for ${documentId}:`, error)
      throw new ProcessingError(`Document enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Merge multiple documents into a single comprehensive document
   */
  async mergeDocuments(
    documentIds: string[],
    mergedTitle: string,
    mergedCategory: string,
    userId: string
  ): Promise<ProcessedDocument> {
    try {
      logger.info(`Merging ${documentIds.length} documents into new document`)

      // Step 1: Fetch all documents with their messages
      const documents = await db.processedDocument.findMany({
        where: { id: { in: documentIds } },
        include: {
          documentMessages: {
            include: { message: true }
          }
        }
      })

      if (documents.length !== documentIds.length) {
        throw new Error('Some documents not found')
      }

      // Step 2: Collect all messages
      const allMessages: BaseMessage[] = []
      const seenMessageIds = new Set<string>()

      for (const doc of documents) {
        for (const dm of doc.documentMessages) {
          if (!seenMessageIds.has(dm.message.id)) {
            allMessages.push(dm.message)
            seenMessageIds.add(dm.message.id)
          }
        }
      }

             // Step 3: Process as new document
       const mergeInput: DocumentProcessingInput = {
         messageIds: allMessages.map((m: any) => m.id),
         title: mergedTitle,
         category: mergedCategory,
         userId
       }

      const result = await this.processMessagesIntoDocument(mergeInput)

      // Step 4: Archive original documents
      await db.processedDocument.updateMany({
        where: { id: { in: documentIds } },
        data: { status: DocumentStatus.COMPLETE } // Keep originals for traceability
      })

      logger.info(`Successfully merged ${documentIds.length} documents into ${result.document.id}`)
      return result.document

    } catch (error) {
      logger.error('Document merging failed:', error)
      throw new ProcessingError(`Document merging failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate processing input
   */
  private validateInput(input: DocumentProcessingInput): void {
    if (!input.messageIds || input.messageIds.length === 0) {
      throw new Error('At least one message ID is required')
    }

    if (input.messageIds.length > MAX_MESSAGES_PER_DOCUMENT) {
      throw new Error(`Maximum ${MAX_MESSAGES_PER_DOCUMENT} messages allowed per document`)
    }

    // Title and category are now optional - they will be AI-generated if not provided
    if (input.title && input.title.trim().length === 0) {
      throw new Error('Document title cannot be empty string (omit for AI generation)')
    }

    if (input.category && input.category.trim().length === 0) {
      throw new Error('Document category cannot be empty string (omit for AI generation)')
    }
  }

  /**
   * Fetch messages from database
   */
  private async fetchMessages(messageIds: string[]): Promise<BaseMessage[]> {
    const messages = await db.message.findMany({
      where: { id: { in: messageIds } },
      orderBy: { timestamp: 'asc' }
    })

    if (messages.length !== messageIds.length) {
      const foundIds = messages.map((m: BaseMessage) => m.id)
      const missingIds = messageIds.filter(id => !foundIds.includes(id))
      throw new Error(`Messages not found: ${missingIds.join(', ')}`)
    }

    return messages
  }

  /**
   * Process PII detection and replacement for messages
   */
  private async processPII(messages: BaseMessage[]): Promise<{
    detections: PIIDetection[]
    replacements: number
    cleanedTexts: Map<string, string>
  }> {
    const allDetections: PIIDetection[] = []
    const cleanedTexts = new Map<string, string>()
    let replacements = 0

    for (const message of messages) {
      try {
        // Detect PII in message text
        const detections = await piiDetectorService.detectPII(
          message.text,
          PIISourceType.MESSAGE,
          message.id,
          { useAI: true, confidenceThreshold: 0.7 }
        )

        allDetections.push(...detections)

        // Apply PII replacements
        const cleanedText = await piiDetectorService.replacePII(message.text, detections)
        
        if (cleanedText !== message.text) {
          cleanedTexts.set(message.id, cleanedText)
          replacements++
        }

      } catch (error) {
        logger.warn(`PII processing failed for message ${message.id}:`, error)
        // Continue processing other messages
      }
    }

    return {
      detections: allDetections,
      replacements,
      cleanedTexts
    }
  }

  /**
   * Auto-generate document metadata using AI analysis
   */
  private async generateDocumentMetadata(
    messages: BaseMessage[],
    conversationAnalysis: any
  ): Promise<{ title: string; category: string; description: string }> {
    try {
      // Prepare message content for AI analysis
      const messageContent = messages
        .slice(0, 10) // Use first 10 messages for efficiency
        .map(msg => `${msg.username}: ${msg.text}`)
        .join('\n')

      const prompt = `Analyze this Slack conversation and generate appropriate metadata:

CONVERSATION:
${messageContent}

Please provide:
1. A clear, descriptive title (max 60 characters)
2. An appropriate category from: Support, Development, General, Planning, Documentation, Bug Report, Feature Request, Discussion
3. A brief description (max 200 characters)

Respond in JSON format:
{
  "title": "Generated title here",
  "category": "Category here", 
  "description": "Generated description here"
}`

      const response = await geminiService.generateDocumentMetadata(messageContent)
      
      if (response.success && response.data) {
        // Validate and sanitize the response
        const title = response.data.title?.trim()?.slice(0, 60) || 'AI-Generated Document'
        const category = this.validateCategory(response.data.category) || 'General'
        const description = response.data.description?.trim()?.slice(0, 200) || 'Auto-generated from conversation analysis'
        
        return { title, category, description }
      }
    } catch (error) {
      logger.error('AI metadata generation failed:', error)
    }

    // Fallback to basic generation
    return this.generateBasicMetadata(messages, conversationAnalysis)
  }

  /**
   * Validate category against allowed values
   */
  private validateCategory(category: string): string | null {
    const allowedCategories = [
      'Support', 'Development', 'General', 'Planning', 
      'Documentation', 'Bug Report', 'Feature Request', 'Discussion'
    ]
    
    return allowedCategories.find(cat => 
      cat.toLowerCase() === category?.toLowerCase()
    ) || null
  }

  /**
   * Generate basic metadata when AI generation fails
   */
  private generateBasicMetadata(
    messages: BaseMessage[],
    conversationAnalysis: any
  ): { title: string; category: string; description: string } {
    // Simple title generation based on participants and message count
    const participants = Array.from(new Set(messages.map(m => m.username)))
    const participantList = participants.slice(0, 3).join(', ')
    
    const title = participants.length > 3 
      ? `Conversation: ${participantList} and ${participants.length - 3} others`
      : `Conversation: ${participantList}`

    // Basic category inference
    const text = messages.map((m: BaseMessage) => m.text.toLowerCase()).join(' ')
    let category = 'General'
    
    if (text.includes('bug') || text.includes('error') || text.includes('issue')) {
      category = 'Bug Report'
    } else if (text.includes('feature') || text.includes('enhancement')) {
      category = 'Feature Request'
    } else if (text.includes('help') || text.includes('support') || text.includes('how')) {
      category = 'Support'
    } else if (text.includes('plan') || text.includes('meeting') || text.includes('schedule')) {
      category = 'Planning'
    }

    const description = `Auto-generated document from ${messages.length} messages between ${participants.length} participants`

    return { title: title.slice(0, 60), category, description }
  }

  /**
   * Create processed document in database with AI-generated metadata
   */
  private async createDocument(
    input: DocumentProcessingInput,
    messages: BaseMessage[],
    conversationAnalysis: any,
    piiResults: any
  ): Promise<ProcessedDocument> {
    // Use provided metadata or generate with AI
    let title = input.title?.trim()
    let category = input.category?.trim()
    let description: string

    if (!title || !category) {
      logger.info('Auto-generating document metadata with AI analysis')
      const metadata = await this.generateDocumentMetadata(messages, conversationAnalysis)
      
      title = title || metadata.title
      category = category || metadata.category
      description = metadata.description
    } else {
      // Generate description for manually titled documents
      description = await this.generateDocumentDescription(messages, conversationAnalysis)
    }

    // Calculate confidence score
    const confidenceScore = this.calculateDocumentConfidence(messages, conversationAnalysis, piiResults)

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
   * Create document-message junction table relationships
   */
  private async createDocumentMessageRelationships(
    documentId: string,
    messages: BaseMessage[],
    conversationAnalysis: any,
    inclusionMethod: InclusionMethod = InclusionMethod.AI_AUTOMATIC,
    addedBy?: string
  ): Promise<void> {
    const relationships: any[] = []

    for (const message of messages) {
      // Determine message role from analysis
      const roleAnalysis = conversationAnalysis.messageRoles.find(
        (r: any) => r.messageId === message.id
      )

      const messageRole = roleAnalysis?.role || MessageRole.CONTEXT
      const confidence = roleAnalysis?.confidence || 0.5

      relationships.push({
        documentId,
        messageId: message.id,
        inclusionMethod,
        messageRole,
        addedBy,
        processingConfidence: confidence
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
   * Update document when enhanced with additional messages
   */
  private async updateDocumentWithEnhancements(
    documentId: string,
    conversationAnalysis: any,
    piiResults: any
  ): Promise<ProcessedDocument> {
    // Recalculate confidence with new messages
    const newConfidence = Math.min(conversationAnalysis.overallConfidence + 0.05, 1.0)

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
   * Generate document description using AI
   */
  private async generateDocumentDescription(
    messages: BaseMessage[],
    conversationAnalysis: any
  ): Promise<string> {
    try {
      const messageTexts = messages.map(m => m.text).join(' ')
      const summary = messageTexts.substring(0, 500) // Limit for AI processing

      // Simple description generation (could be enhanced with AI)
      if (conversationAnalysis.qaPairs.length > 0) {
        const topics = conversationAnalysis.qaPairs.map((pair: any) => pair.topic).slice(0, 3)
        return `Q&A discussion covering: ${topics.join(', ')}`
      }

               return `Conversation thread with ${messages.length} messages from ${new Set(messages.map((m: any) => m.username)).size} participants`

    } catch (error) {
      logger.warn('Failed to generate AI description, using fallback:', error)
      return `Document containing ${messages.length} messages`
    }
  }

  /**
   * Calculate document confidence score
   */
  private calculateDocumentConfidence(
    messages: BaseMessage[],
    conversationAnalysis: any,
    piiResults: any
  ): number {
    let confidence = 0.5 // Base confidence

    // Boost confidence for clear Q&A patterns
    if (conversationAnalysis.qaPairs.length > 0) {
      confidence += 0.3 * Math.min(conversationAnalysis.qaPairs.length / messages.length, 1)
    }

    // Boost confidence for good message role analysis
    const roleConfidences = conversationAnalysis.messageRoles.map((r: any) => r.confidence)
    if (roleConfidences.length > 0) {
      const avgRoleConfidence = roleConfidences.reduce((sum: number, conf: number) => sum + conf, 0) / roleConfidences.length
      confidence += 0.2 * avgRoleConfidence
    }

    // Reduce confidence for excessive PII
    const piiRatio = piiResults.detections.length / messages.length
    if (piiRatio > 0.5) {
      confidence -= 0.1
    }

    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * Generate processing warnings
   */
  private generateWarnings(conversationAnalysis: any, piiResults: any): string[] {
    const warnings: string[] = []

    if (conversationAnalysis.qaPairs.length === 0) {
      warnings.push('No clear Q&A pairs detected - document may not be suitable for FAQ generation')
    }

    if (piiResults.detections.length > 10) {
      warnings.push(`High number of PII detections (${piiResults.detections.length}) - review recommended`)
    }

    const lowConfidenceRoles = conversationAnalysis.messageRoles.filter((r: any) => r.confidence < 0.6)
    if (lowConfidenceRoles.length > conversationAnalysis.messageRoles.length / 2) {
      warnings.push('Many messages have uncertain roles - manual review may be needed')
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
    piiDetectionCount: number
    averageConfidence: number
    categories: string[]
  }> {
    try {
      const document = await db.processedDocument.findUnique({
        where: { id: documentId },
        include: {
          documentMessages: {
            include: { message: true }
          }
        }
      })

      if (!document) {
        throw new Error(`Document ${documentId} not found`)
      }

      const messages = document.documentMessages.map((dm: any) => dm.message)
      const participants = new Set(messages.map((m: any) => m.username))

      // Get related data
      const [piiDetections] = await Promise.all([
        db.pIIDetection.count({
          where: {
            sourceType: PIISourceType.MESSAGE,
            sourceId: { in: messages.map((m: any) => m.id) }
          }
        })
      ])

      const averageConfidence = document.documentMessages.reduce(
        (sum: number, dm: any) => sum + dm.processingConfidence, 0
      ) / document.documentMessages.length

      return {
        messageCount: messages.length,
        participantCount: participants.size,
        qaPairCount: 0, // Would need separate query for FAQ count
        piiDetectionCount: piiDetections,
        averageConfidence,
        categories: [document.category]
      }

    } catch (error) {
      logger.error(`Failed to get document stats for ${documentId}:`, error)
      throw new ProcessingError(`Failed to get document stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Health check for document processor service
   */
  async healthCheck(): Promise<{
    isHealthy: boolean
    error?: string
    stats?: any
  }> {
    try {
      // Test basic database connectivity
      const documentCount = await db.processedDocument.count()
      
      return {
        isHealthy: true,
        stats: { totalDocuments: documentCount }
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