/**
 * Pinecone Vector Database Service
 * Provides scalable FAQ similarity search and duplicate detection
 * Handles embedding storage, retrieval, and batch operations
 */

import { Pinecone } from '@pinecone-database/pinecone'
import { logger } from './logger'
import { geminiService } from './gemini'
import { 
  PineconeConfig, 
  FAQEmbedding, 
  DuplicateCheckResult, 
  PineconeError,
  FAQ 
} from '@/types'

// Configuration constants
const INDEX_NAME = 'faq-duplicates'
const VECTOR_DIMENSION = 768 // Gemini text-embedding-004 dimensions
const SIMILARITY_THRESHOLD = 0.85 // Minimum similarity for duplicates
const BATCH_SIZE = 100 // Batch operations size
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

/**
 * Pinecone vector database service for FAQ embeddings
 */
class PineconeService {
  private client: Pinecone
  private index: any
  private initialized = false

  constructor() {
    const apiKey = process.env.PINECONE_API_KEY

    if (!apiKey) {
      throw new Error('PINECONE_API_KEY environment variable is required')
    }

    this.client = new Pinecone({
      apiKey
    })
  }

  /**
   * Initialize Pinecone index connection
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      this.index = this.client.index(INDEX_NAME)
      this.initialized = true
      logger.info('Pinecone service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize Pinecone service:', error)
      throw new PineconeError('Failed to initialize Pinecone service', error)
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error = new Error('Unknown error')

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        logger.warn(`Pinecone operation attempt ${attempt} failed for ${context}:`, error)

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw new PineconeError(`Pinecone operation failed after ${MAX_RETRIES} attempts: ${context}`, lastError)
  }

  /**
   * Store FAQ embedding in Pinecone index
   */
  async storeFAQEmbedding(faq: FAQ): Promise<void> {
    await this.initialize()

    try {
      // Generate embedding for FAQ content
      const embeddingText = `${faq.question} ${faq.answer}`
      const embeddingResponse = await geminiService.generateEmbedding(embeddingText)

      if (!embeddingResponse.success || !embeddingResponse.data) {
        throw new Error(`Failed to generate embedding: ${embeddingResponse.error}`)
      }

      const embedding: FAQEmbedding = {
        id: faq.id,
        values: embeddingResponse.data,
        metadata: {
          category: faq.category,
          status: faq.status,
          question: faq.question.substring(0, 200) // Limit metadata size
        }
      }

      await this.withRetry(async () => {
        await this.index.upsert([embedding])
      }, `store-embedding-${faq.id}`)

      logger.info(`Stored FAQ embedding for: ${faq.id}`)
    } catch (error) {
      logger.error(`Failed to store FAQ embedding for ${faq.id}:`, error)
      throw new PineconeError(`Failed to store FAQ embedding for ${faq.id}`, error)
    }
  }

  /**
   * Store multiple FAQ embeddings in batch
   */
  async storeFAQEmbeddingsBatch(faqs: FAQ[]): Promise<void> {
    await this.initialize()

    const batches = this.chunkArray(faqs, BATCH_SIZE)
    
    for (const batch of batches) {
      try {
        const embeddings: FAQEmbedding[] = []

        // Generate embeddings for batch
        for (const faq of batch) {
          const embeddingText = `${faq.question} ${faq.answer}`
          const embeddingResponse = await geminiService.generateEmbedding(embeddingText)

          if (embeddingResponse.success && embeddingResponse.data) {
            embeddings.push({
              id: faq.id,
              values: embeddingResponse.data,
              metadata: {
                category: faq.category,
                status: faq.status,
                question: faq.question.substring(0, 200)
              }
            })
          } else {
            logger.warn(`Failed to generate embedding for FAQ ${faq.id}: ${embeddingResponse.error}`)
          }
        }

        // Store batch
        if (embeddings.length > 0) {
          await this.withRetry(async () => {
            await this.index.upsert(embeddings)
          }, `store-batch-${embeddings.length}-embeddings`)

          logger.info(`Stored ${embeddings.length} FAQ embeddings in batch`)
        }
      } catch (error) {
        logger.error('Failed to store FAQ embeddings batch:', error)
        throw new PineconeError('Failed to store FAQ embeddings batch', error)
      }
    }
  }

  /**
   * Find duplicate FAQs using similarity search
   */
  async findDuplicateFAQs(newFAQ: {
    question: string
    answer: string
    category: string
  }): Promise<DuplicateCheckResult> {
    await this.initialize()

    try {
      // Generate embedding for new FAQ
      const embeddingText = `${newFAQ.question} ${newFAQ.answer}`
      const embeddingResponse = await geminiService.generateEmbedding(embeddingText)

      if (!embeddingResponse.success || !embeddingResponse.data) {
        throw new Error(`Failed to generate embedding: ${embeddingResponse.error}`)
      }

      // Search for similar FAQs
      const searchResult = await this.withRetry(async () => {
        return await this.index.query({
          vector: embeddingResponse.data,
          topK: 10,
          includeMetadata: true,
          filter: {
            category: { $eq: newFAQ.category },
            status: { $in: ['PENDING', 'APPROVED'] }
          }
        })
      }, 'duplicate-search')

      // Filter results by similarity threshold
      const duplicates = searchResult.matches?.filter(
        (match: any) => match.score >= SIMILARITY_THRESHOLD
      ) || []

      return {
        isDuplicate: duplicates.length > 0,
        matches: duplicates.map((match: any) => ({
          id: match.id,
          score: match.score,
          metadata: match.metadata
        }))
      }
    } catch (error) {
      logger.error('Failed to find duplicate FAQs:', error)
      throw new PineconeError('Failed to find duplicate FAQs', error)
    }
  }

  /**
   * Search for similar FAQs across all categories
   */
  async searchSimilarFAQs(
    query: string,
    options: {
      category?: string
      status?: string[]
      topK?: number
      minScore?: number
    } = {}
  ): Promise<Array<{
    id: string
    score: number
    metadata: any
  }>> {
    await this.initialize()

    try {
      // Generate embedding for search query
      const embeddingResponse = await geminiService.generateEmbedding(query)

      if (!embeddingResponse.success || !embeddingResponse.data) {
        throw new Error(`Failed to generate embedding: ${embeddingResponse.error}`)
      }

      // Build filter
      const filter: any = {}
      if (options.category) {
        filter.category = { $eq: options.category }
      }
      if (options.status && options.status.length > 0) {
        filter.status = { $in: options.status }
      }

      // Search for similar FAQs
      const searchResult = await this.withRetry(async () => {
        return await this.index.query({
          vector: embeddingResponse.data,
          topK: options.topK || 10,
          includeMetadata: true,
          filter: Object.keys(filter).length > 0 ? filter : undefined
        })
      }, 'similarity-search')

      // Filter by minimum score
      const minScore = options.minScore || 0.5
      const results = searchResult.matches?.filter(
        (match: any) => match.score >= minScore
      ) || []

      return results.map((match: any) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata
      }))
    } catch (error) {
      logger.error('Failed to search similar FAQs:', error)
      throw new PineconeError('Failed to search similar FAQs', error)
    }
  }

  /**
   * Update FAQ embedding (when FAQ content changes)
   */
  async updateFAQEmbedding(faq: FAQ): Promise<void> {
    await this.initialize()

    try {
      // Generate new embedding
      const embeddingText = `${faq.question} ${faq.answer}`
      const embeddingResponse = await geminiService.generateEmbedding(embeddingText)

      if (!embeddingResponse.success || !embeddingResponse.data) {
        throw new Error(`Failed to generate embedding: ${embeddingResponse.error}`)
      }

      const embedding: FAQEmbedding = {
        id: faq.id,
        values: embeddingResponse.data,
        metadata: {
          category: faq.category,
          status: faq.status,
          question: faq.question.substring(0, 200)
        }
      }

      await this.withRetry(async () => {
        await this.index.upsert([embedding])
      }, `update-embedding-${faq.id}`)

      logger.info(`Updated FAQ embedding for: ${faq.id}`)
    } catch (error) {
      logger.error(`Failed to update FAQ embedding for ${faq.id}:`, error)
      throw new PineconeError(`Failed to update FAQ embedding for ${faq.id}`, error)
    }
  }

  /**
   * Delete FAQ embedding from index
   */
  async deleteFAQEmbedding(faqId: string): Promise<void> {
    await this.initialize()

    try {
      await this.withRetry(async () => {
        await this.index.deleteOne(faqId)
      }, `delete-embedding-${faqId}`)

      logger.info(`Deleted FAQ embedding for: ${faqId}`)
    } catch (error) {
      logger.error(`Failed to delete FAQ embedding for ${faqId}:`, error)
      throw new PineconeError(`Failed to delete FAQ embedding for ${faqId}`, error)
    }
  }

  /**
   * Delete multiple FAQ embeddings
   */
  async deleteFAQEmbeddingsBatch(faqIds: string[]): Promise<void> {
    await this.initialize()

    const batches = this.chunkArray(faqIds, BATCH_SIZE)
    
    for (const batch of batches) {
      try {
        await this.withRetry(async () => {
          await this.index.deleteMany(batch)
        }, `delete-batch-${batch.length}-embeddings`)

        logger.info(`Deleted ${batch.length} FAQ embeddings in batch`)
      } catch (error) {
        logger.error('Failed to delete FAQ embeddings batch:', error)
        throw new PineconeError('Failed to delete FAQ embeddings batch', error)
      }
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<{
    totalVectors: number
    dimension: number
    indexFullness: number
  }> {
    await this.initialize()

    try {
      const stats = await this.withRetry(async () => {
        return await this.index.describeIndexStats()
      }, 'get-index-stats')

      return {
        totalVectors: stats.totalVectorCount || 0,
        dimension: stats.dimension || VECTOR_DIMENSION,
        indexFullness: stats.indexFullness || 0
      }
    } catch (error) {
      logger.error('Failed to get index statistics:', error)
      throw new PineconeError('Failed to get index statistics', error)
    }
  }

  /**
   * Create or ensure index exists with proper configuration
   */
  async ensureIndexExists(): Promise<void> {
    try {
             const existingIndexes = await this.client.listIndexes()
       const indexExists = existingIndexes.indexes?.some((idx: any) => idx.name === INDEX_NAME)

      if (!indexExists) {
        logger.info(`Creating Pinecone index: ${INDEX_NAME}`)
        
        await this.client.createIndex({
          name: INDEX_NAME,
          dimension: VECTOR_DIMENSION,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        })

        // Wait for index to be ready
        let isReady = false
        let attempts = 0
        const maxAttempts = 30

        while (!isReady && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          try {
            const indexDescription = await this.client.describeIndex(INDEX_NAME)
            isReady = indexDescription.status?.ready === true
            attempts++
          } catch (error) {
            attempts++
          }
        }

        if (!isReady) {
          throw new Error(`Index ${INDEX_NAME} failed to become ready after ${maxAttempts} attempts`)
        }

        logger.info(`Successfully created Pinecone index: ${INDEX_NAME}`)
      } else {
        logger.info(`Pinecone index ${INDEX_NAME} already exists`)
      }
    } catch (error) {
      logger.error('Failed to ensure Pinecone index exists:', error)
      throw new PineconeError('Failed to ensure Pinecone index exists', error)
    }
  }

  /**
   * Utility function to chunk arrays for batch operations
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * Check service health
   */
  async healthCheck(): Promise<{
    isHealthy: boolean
    error?: string
    stats?: any
  }> {
    try {
      await this.initialize()
      const stats = await this.getIndexStats()
      
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
export const pineconeService = new PineconeService()
export default pineconeService 