/**
 * FAQ Generator Service
 * Generates FAQs from processed documents using AI
 * Integrates with Pinecone for scalable duplicate detection and enhancement
 */

import { logger } from './logger'
import { db } from './db'
import { geminiService } from './gemini'
import { pineconeService } from './pinecone'
import { 
  FAQ,
  ProcessedDocument,
  FAQGenerationInput,
  FAQGenerationResult,
  DocumentFAQ,
  MessageFAQ,
  FAQStatus,
  GenerationMethod,
  ContributionType,
  ProcessingError
} from '@/types'

// Configuration constants
const DEFAULT_CONFIDENCE_THRESHOLD = 0.8
const MAX_FAQS_PER_DOCUMENT = 20
const DUPLICATE_SIMILARITY_THRESHOLD = 0.85
const ENHANCEMENT_SIMILARITY_THRESHOLD = 0.9

/**
 * FAQ generation statistics
 */
interface FAQGenerationStats {
  candidatesGenerated: number
  duplicatesFound: number
  duplicatesEnhanced: number
  newFAQsCreated: number
  processingTime: number
  averageConfidence: number
}

/**
 * FAQ Generator service for creating FAQs from documents
 */
class FAQGeneratorService {

  /**
   * Generate FAQs from a processed document
   */
  async generateFAQsFromDocument(
    input: FAQGenerationInput
  ): Promise<FAQGenerationResult> {
    const startTime = Date.now()
    
    try {
      logger.info(`Starting FAQ generation for document ${input.documentId}`)
      
      // DEBUG: Check existing FAQs before we start
      const allFAQsBefore = await db.fAQ.count()
      const allDocumentFAQsBefore = await db.documentFAQ.count()
      console.log(`🔍 BEFORE FAQ generation - Total FAQs: ${allFAQsBefore}, DocumentFAQ relationships: ${allDocumentFAQsBefore}`)

      // Step 1: Fetch document with related data  
      const document = await this.fetchDocumentWithMessages(input.documentId)

      // Step 2: Generate FAQ candidates using AI
      const faqCandidates = await this.generateFAQCandidates(document, input)

      // Step 3: Process each candidate for duplicates and enhancement
      const processingResults = await this.processFAQCandidates(
        faqCandidates,
        document,
        input
      )

      // Step 4: Create junction table relationships
      await this.createFAQRelationships(
        processingResults.createdFAQs,
        document,
        faqCandidates
      )

      // Step 5: Store embeddings in Pinecone
      await this.storeFAQEmbeddings(processingResults.createdFAQs)

      const result: FAQGenerationResult = {
        faqs: processingResults.createdFAQs,
        duplicatesFound: processingResults.duplicatesFound,
        enhancedExisting: processingResults.enhancedExisting,
        processingTime: Date.now() - startTime
      }

      // DEBUG: Check existing FAQs after we finish
      const allFAQsAfter = await db.fAQ.count()
      const allDocumentFAQsAfter = await db.documentFAQ.count()
      console.log(`🔍 AFTER FAQ generation - Total FAQs: ${allFAQsAfter}, DocumentFAQ relationships: ${allDocumentFAQsAfter}`)
      console.log(`📊 FAQ generation results: Created ${result.faqs.length} FAQs, Found ${result.duplicatesFound} duplicates, Enhanced ${result.enhancedExisting} existing`)

      logger.info(`FAQ generation completed: ${result.faqs.length} FAQs created (${result.processingTime}ms)`)
      return result

    } catch (error) {
      logger.error(`FAQ generation failed for document ${input.documentId}:`, error)
      throw new ProcessingError(`FAQ generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate FAQ candidates from multiple documents
   */
  async generateFAQsFromMultipleDocuments(
    documentIds: string[],
    options: {
      categoryOverride?: string
      userId?: string
      mergeStrategy?: 'separate' | 'combined'
    } = {}
  ): Promise<{
    results: FAQGenerationResult[]
    totalFAQs: number
    totalDuplicates: number
  }> {
    try {
      logger.info(`Generating FAQs from ${documentIds.length} documents`)

      const results: FAQGenerationResult[] = []
      let totalFAQs = 0
      let totalDuplicates = 0

      for (const documentId of documentIds) {
        try {
          const input: FAQGenerationInput = {
            documentId,
            categoryOverride: options.categoryOverride,
            userId: options.userId
          }

          const result = await this.generateFAQsFromDocument(input)
          results.push(result)
          totalFAQs += result.faqs.length
          totalDuplicates += result.duplicatesFound

        } catch (error) {
          logger.error(`FAQ generation failed for document ${documentId}:`, error)
          // Continue with other documents
        }
      }

      return {
        results,
        totalFAQs,
        totalDuplicates
      }

    } catch (error) {
      logger.error('Batch FAQ generation failed:', error)
      throw new ProcessingError(`Batch FAQ generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Enhance existing FAQ with new information
   */
  async enhanceFAQ(
    existingFAQId: string,
    newContent: {
      question?: string
      answer?: string
      sourceDocumentId?: string
    },
    userId: string
  ): Promise<FAQ> {
    try {
      logger.info(`Enhancing FAQ ${existingFAQId}`)

      // Step 1: Fetch existing FAQ
      const existingFAQ = await db.fAQ.findUnique({
        where: { id: existingFAQId }
      })

      if (!existingFAQ) {
        throw new Error(`FAQ ${existingFAQId} not found`)
      }

      // Step 2: Use AI to enhance content
      const enhancementResponse = await geminiService.enhanceFAQ(
        {
          question: existingFAQ.question,
          answer: existingFAQ.answer
        },
        {
          question: newContent.question || existingFAQ.question,
          answer: newContent.answer || existingFAQ.answer
        }
      )

      if (!enhancementResponse.success || !enhancementResponse.data) {
        throw new Error(`FAQ enhancement failed: ${enhancementResponse.error}`)
      }

      const enhanced = enhancementResponse.data

      // Step 3: Update FAQ in database
      console.log(`🔄 Updating FAQ ${existingFAQId} in database`)
      console.log(`🔄 Old question: "${existingFAQ.question}"`)
      console.log(`🔄 New question: "${enhanced.enhancedQuestion}"`)
      
      const updatedFAQ = await db.fAQ.update({
        where: { id: existingFAQId },
        data: {
          question: enhanced.enhancedQuestion,
          answer: enhanced.enhancedAnswer,
          confidenceScore: enhanced.confidence,
          status: FAQStatus.PENDING, // Requires re-approval after enhancement
          updatedAt: new Date()
        }
      })

      // Step 4: Update embedding in Pinecone
      await pineconeService.updateFAQEmbedding(updatedFAQ)

      // Step 5: Track enhancement relationship if from new document
      if (newContent.sourceDocumentId) {
        await db.documentFAQ.create({
          data: {
            documentId: newContent.sourceDocumentId,
            faqId: existingFAQId,
            generationMethod: GenerationMethod.HYBRID,
            sourceMessageIds: [],
            confidenceScore: enhanced.confidence,
            generatedBy: userId
          }
        })
      }

      logger.info(`FAQ ${existingFAQId} enhanced successfully`)
      return updatedFAQ

    } catch (error) {
      logger.error(`FAQ enhancement failed for ${existingFAQId}:`, error)
      throw new ProcessingError(`FAQ enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Approve or reject FAQ
   */
  async reviewFAQ(
    faqId: string,
    status: FAQStatus.APPROVED | FAQStatus.REJECTED,
    reviewedBy: string,
    feedback?: string
  ): Promise<FAQ> {
    try {
      const updatedFAQ = await db.fAQ.update({
        where: { id: faqId },
        data: {
          status,
          approvedBy: reviewedBy,
          approvedAt: new Date()
        }
      })

      // Update Pinecone index if approved
      if (status === FAQStatus.APPROVED) {
        await pineconeService.updateFAQEmbedding(updatedFAQ)
      }

      logger.info(`FAQ ${faqId} ${status.toLowerCase()} by ${reviewedBy}`)
      return updatedFAQ

    } catch (error) {
      logger.error(`FAQ review failed for ${faqId}:`, error)
      throw new ProcessingError(`FAQ review failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Find similar FAQs across the system
   */
  async findSimilarFAQs(
    query: string,
    options: {
      category?: string
      status?: FAQStatus[]
      limit?: number
      minScore?: number
    } = {}
  ): Promise<Array<{
    faq: FAQ
    similarity: number
    metadata: any
  }>> {
    try {
      // Search using Pinecone
      const searchResults = await pineconeService.searchSimilarFAQs(query, {
        category: options.category,
        status: options.status?.map(s => s.toString()),
        topK: options.limit || 10,
        minScore: options.minScore || 0.7
      })

      // Fetch full FAQ data
      const faqIds = searchResults.map(result => result.id)
      const faqs = await db.fAQ.findMany({
        where: { id: { in: faqIds } }
      })

             // Combine results
       const results = searchResults.map(result => {
         const faq = faqs.find((f: any) => f.id === result.id)
         if (!faq) return null

         return {
           faq,
           similarity: result.score,
           metadata: result.metadata
         }
       }).filter((result): result is NonNullable<typeof result> => result !== null)

      return results

    } catch (error) {
      logger.error('Similar FAQ search failed:', error)
      throw new ProcessingError(`Similar FAQ search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Fetch document with all necessary related data
   */
  private async fetchDocumentWithMessages(documentId: string): Promise<{
    document: ProcessedDocument
    messages: Array<{
      id: string
      text: string
      username: string
      role: string
      timestamp: Date
      messageRole: string
      confidence: number
    }>
  }> {
    const document = await db.processedDocument.findUnique({
      where: { id: documentId },
      include: {
        documentMessages: {
          include: { message: true },
          orderBy: { message: { timestamp: 'asc' } }
        }
      }
    })

    if (!document) {
      throw new Error(`Document ${documentId} not found`)
    }

    const messages = document.documentMessages.map((dm: any) => ({
      id: dm.message.id,
      text: dm.message.text,
      username: dm.message.username,
      role: dm.messageRole,
      timestamp: dm.message.timestamp,
      messageRole: dm.messageRole,
      confidence: dm.processingConfidence
    }))

    return { document, messages }
  }

  /**
   * Generate FAQ candidates using AI
   */
  private async generateFAQCandidates(
    documentData: {
      document: ProcessedDocument
      messages: Array<{
        id: string
        text: string
        username: string
        role: string
        timestamp: Date
      }>
    },
    input: FAQGenerationInput
  ): Promise<Array<{
    question: string
    answer: string
    category: string
    confidence: number
    sourceMessageIds: string[]
  }>> {
    try {
      console.log(`Generating FAQs for document "${documentData.document.title}" with ${documentData.messages.length} messages:`, 
        documentData.messages.map(m => ({ text: m.text.substring(0, 50) + '...', role: m.role })))

      const response = await geminiService.generateFAQs({
        title: documentData.document.title,
        description: documentData.document.description,
        category: input.categoryOverride || documentData.document.category,
        messages: documentData.messages
      })

      if (!response.success || !response.data) {
        throw new Error(`AI FAQ generation failed: ${response.error}`)
      }

      // Filter candidates by confidence
      const qualifiedCandidates = response.data.filter(
        candidate => candidate.confidence >= DEFAULT_CONFIDENCE_THRESHOLD
      )

      // Limit number of FAQs per document
      const limitedCandidates = qualifiedCandidates.slice(0, MAX_FAQS_PER_DOCUMENT)

      logger.info(`Generated ${limitedCandidates.length} FAQ candidates from ${response.data.length} total`)
      return limitedCandidates

    } catch (error) {
      logger.error('AI FAQ generation failed:', error)
      return [] // Return empty array to continue processing
    }
  }

  /**
   * Process FAQ candidates for duplicates and enhancement
   */
  private async processFAQCandidates(
    candidates: Array<{
      question: string
      answer: string
      category: string
      confidence: number
      sourceMessageIds: string[]
    }>,
    document: { document: ProcessedDocument },
    input: FAQGenerationInput
  ): Promise<{
    createdFAQs: FAQ[]
    duplicatesFound: number
    enhancedExisting: number
  }> {
    const createdFAQs: FAQ[] = []
    let duplicatesFound = 0
    let enhancedExisting = 0

    for (const candidate of candidates) {
      try {
        // TEMPORARY FIX: Skip Pinecone duplicate check to isolate the deletion bug
        console.log(`⚠️ SKIPPING Pinecone duplicate check for FAQ: "${candidate.question}"`)
        const duplicateCheck: { isDuplicate: boolean; matches: any[] } = { isDuplicate: false, matches: [] }
        
        // Original code (commented out):
        // const duplicateCheck = await pineconeService.findDuplicateFAQs({
        //   question: candidate.question,
        //   answer: candidate.answer,
        //   category: candidate.category
        // })

        // TEMPORARY FIX: Skip duplicate detection/enhancement to isolate the deletion bug
        // TODO: Re-enable after fixing the FAQ deletion issue
        console.log(`⚠️ TEMPORARILY SKIPPING duplicate detection for FAQ: "${candidate.question}"`)
        
        if (false && duplicateCheck.isDuplicate && duplicateCheck.matches.length > 0) {
          duplicatesFound++
          
          // Check if we should enhance the existing FAQ
          const bestMatch = duplicateCheck.matches[0]
          if (bestMatch.score >= ENHANCEMENT_SIMILARITY_THRESHOLD) {
            try {
              console.log(`🔧 ENHANCING FAQ ${bestMatch.id} - Original question: "${bestMatch.metadata?.question}"`)
              console.log(`🔧 New candidate question: "${candidate.question}"`)
              
              const enhancedFAQ = await this.enhanceFAQ(
                bestMatch.id,
                {
                  question: candidate.question,
                  answer: candidate.answer,
                  sourceDocumentId: document.document.id
                },
                input.userId || 'system'
              )
              createdFAQs.push(enhancedFAQ)
              enhancedExisting++
              
              console.log(`✅ Enhanced FAQ ${bestMatch.id} successfully`)
              logger.info(`Enhanced existing FAQ ${bestMatch.id} with new content`)
            } catch (error) {
              logger.warn(`Failed to enhance FAQ ${bestMatch.id}:`, error)
              // Continue processing
            }
          } else {
            logger.info(`Skipped duplicate FAQ: ${candidate.question.substring(0, 50)}`)
          }
        } else {
          // Create new FAQ
          const newFAQ = await db.fAQ.create({
            data: {
              question: candidate.question,
              answer: candidate.answer,
              category: candidate.category,
              status: FAQStatus.PENDING,
              confidenceScore: candidate.confidence
            }
          })
          
          createdFAQs.push(newFAQ)
          logger.info(`Created new FAQ: ${newFAQ.id}`)
        }

      } catch (error) {
        logger.error(`Failed to process FAQ candidate:`, error)
        // Continue with other candidates
      }
    }

    return {
      createdFAQs,
      duplicatesFound,
      enhancedExisting
    }
  }

  /**
   * Create FAQ junction table relationships
   */
  private async createFAQRelationships(
    faqs: FAQ[],
    documentData: { 
      document: ProcessedDocument
      messages: Array<{
        id: string
        text: string
        username: string
        role: string
        timestamp: Date
      }>
    },
    candidates: Array<{
      question: string
      answer: string
      sourceMessageIds: string[]
    }>
  ): Promise<void> {
    try {
      for (let i = 0; i < faqs.length; i++) {
        const faq = faqs[i]
        const candidate = candidates.find(c => 
          c.question === faq.question && c.answer === faq.answer
        )

        if (!candidate) continue

        // Create DocumentFAQ relationship
        await db.documentFAQ.create({
          data: {
            documentId: documentData.document.id,
            faqId: faq.id,
            generationMethod: GenerationMethod.AI_GENERATED,
            sourceMessageIds: candidate.sourceMessageIds.map(indexStr => {
              const index = parseInt(indexStr)
              return documentData.messages[index]?.id || indexStr
            }),
            confidenceScore: faq.confidenceScore
          }
        })

        // Create MessageFAQ relationships for traceability
        for (const indexStr of candidate.sourceMessageIds) {
          const index = parseInt(indexStr)
          const messageId = documentData.messages[index]?.id
          
          if (!messageId) continue

          // Determine contribution type based on message role
          const contributionType = this.determineContributionType(indexStr, i)

          await db.messageFAQ.create({
            data: {
              messageId,
              faqId: faq.id,
              contributionType,
              documentId: documentData.document.id
            }
          })
        }
      }

      logger.info(`Created relationships for ${faqs.length} FAQs`)

    } catch (error) {
      logger.error('Failed to create FAQ relationships:', error)
      // Don't throw error - relationships are nice to have but not critical
    }
  }

  /**
   * Store FAQ embeddings in Pinecone
   */
  private async storeFAQEmbeddings(faqs: FAQ[]): Promise<void> {
    try {
      if (faqs.length === 0) return

      // Store embeddings in batch for efficiency
      await pineconeService.storeFAQEmbeddingsBatch(faqs)
      
      logger.info(`Stored ${faqs.length} FAQ embeddings in Pinecone`)

    } catch (error) {
      logger.error('Failed to store FAQ embeddings:', error)
      // Don't throw error - embeddings can be regenerated later
    }
  }

  /**
   * Determine contribution type for message-FAQ relationship
   */
  private determineContributionType(
    messageIndex: string,
    faqIndex: number
  ): ContributionType {
    // Simple heuristic - could be enhanced with more sophisticated logic
    const index = parseInt(messageIndex) || 0
    
    if (index === 0 || faqIndex === 0) {
      return ContributionType.PRIMARY_QUESTION
    } else if (index === 1 || faqIndex === 1) {
      return ContributionType.PRIMARY_ANSWER
    } else {
      return ContributionType.SUPPORTING_CONTEXT
    }
  }

  /**
   * Get FAQ generation statistics
   */
  async getFAQStats(): Promise<{
    totalFAQs: number
    byStatus: Record<string, number>
    byCategory: Record<string, number>
    averageConfidence: number
    pendingReview: number
  }> {
    try {
      const faqs = await db.fAQ.findMany({
        select: {
          status: true,
          category: true,
          confidenceScore: true
        }
      })

      const stats = {
        totalFAQs: faqs.length,
        byStatus: {} as Record<string, number>,
        byCategory: {} as Record<string, number>,
        averageConfidence: 0,
        pendingReview: 0
      }

      // Initialize counters
      Object.values(FAQStatus).forEach(status => {
        stats.byStatus[status] = 0
      })

      let totalConfidence = 0

      // Calculate statistics
      for (const faq of faqs) {
        stats.byStatus[faq.status]++
        stats.byCategory[faq.category] = (stats.byCategory[faq.category] || 0) + 1
        totalConfidence += faq.confidenceScore
        
        if (faq.status === FAQStatus.PENDING) {
          stats.pendingReview++
        }
      }

      stats.averageConfidence = faqs.length > 0 ? totalConfidence / faqs.length : 0

      return stats

    } catch (error) {
      logger.error('Failed to get FAQ statistics:', error)
      throw new ProcessingError(`Failed to get FAQ statistics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Health check for FAQ generator service
   */
  async healthCheck(): Promise<{
    isHealthy: boolean
    error?: string
    stats?: any
  }> {
    try {
      const stats = await this.getFAQStats()
      
      return {
        isHealthy: true,
        stats
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
export const faqGeneratorService = new FAQGeneratorService()
export default faqGeneratorService 