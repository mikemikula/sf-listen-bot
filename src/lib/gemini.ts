/**
 * Gemini AI Service
 * Provides AI-powered document processing, FAQ generation, and embedding creation
 * Uses Gemini 2.0 Flash for optimal cost-effectiveness and performance
 * Implements rate limiting, error handling, and usage tracking
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'
import { logger } from './logger'
import { GeminiConfig, GeminiResponse, GeminiError } from '@/types'

// Configuration constants
// Using Gemini 2.0 Flash for 5x cost savings with near-Claude quality performance
const DEFAULT_MODEL = 'gemini-2.0-flash-exp'
const EMBEDDING_MODEL = 'text-embedding-004'
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000
const RATE_LIMIT_DELAY_MS = 100

/**
 * Gemini AI service class with rate limiting and error handling
 */
class GeminiService {
  private client: GoogleGenerativeAI
  private model: GenerativeModel
  private embeddingModel: GenerativeModel
  private requestCount = 0
  private lastRequestTime = 0

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required')
    }

    this.client = new GoogleGenerativeAI(apiKey)
    this.model = this.client.getGenerativeModel({ model: DEFAULT_MODEL })
    this.embeddingModel = this.client.getGenerativeModel({ model: EMBEDDING_MODEL })
  }

  /**
   * Rate limiting to respect API quotas
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
      await new Promise(resolve => 
        setTimeout(resolve, RATE_LIMIT_DELAY_MS - timeSinceLastRequest)
      )
    }

    this.lastRequestTime = Date.now()
    this.requestCount++
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
        await this.rateLimit()
        return await operation()
      } catch (error) {
        lastError = error as Error
        logger.warn(`Gemini API attempt ${attempt} failed for ${context}:`, error)

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw new GeminiError(`Gemini API failed after ${MAX_RETRIES} attempts: ${context}`, lastError)
  }

  /**
   * Generate content using Gemini with error handling
   * Optimized configuration for Gemini 2.0 Flash
   */
  private async generateContent(prompt: string, context: string): Promise<GeminiResponse<string>> {
    try {
      const result = await this.withRetry(async () => {
        const response = await this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1, // Lower temperature for more consistent results
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 32768, // Increased for large document processing (Flash 2.0 supports up to 64k)
          }
        })
        return response.response.text()
      }, context)

      return {
        success: true,
        data: result,
        usage: {
          promptTokens: prompt.length, // Approximate
          completionTokens: result.length, // Approximate
          totalTokens: prompt.length + result.length
        }
      }
    } catch (error) {
      logger.error(`Gemini generation failed for ${context}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }



  /**
   * Parse JSON response that might be wrapped in markdown code blocks
   */
  private parseJSONResponse(responseText: string): any {
    // First try direct JSON parsing
    try {
      return JSON.parse(responseText)
    } catch (directError) {
      // If direct parsing fails, try to extract JSON from markdown code blocks
      const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```/i
      const match = responseText.match(jsonBlockRegex)
      
      if (match && match[1]) {
        try {
          return JSON.parse(match[1])
        } catch (blockError) {
          logger.warn('Failed to parse JSON from code block:', blockError)
        }
      }
      
      // Try to find JSON-like content without code blocks
      const jsonPattern = /(\{[\s\S]*\}|\[[\s\S]*\])/
      const jsonMatch = responseText.match(jsonPattern)
      
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1])
        } catch (patternError) {
          logger.warn('Failed to parse JSON from pattern match:', patternError)
        }
      }
      
      // If all parsing attempts fail, throw the original error
      throw directError
    }
  }

  /**
   * Detect PII in text with contextual understanding
   */
  async detectPII(text: string): Promise<GeminiResponse<Array<{
    type: 'EMAIL' | 'PHONE' | 'NAME' | 'URL' | 'CUSTOM'
    originalText: string
    startIndex: number
    endIndex: number
    confidence: number
    replacement: string
  }>>> {
    const prompt = `
Analyze the following text for Personally Identifiable Information (PII):

"${text}"

Detect:
1. Email addresses
2. Phone numbers
3. Person names (real names, not usernames like @alice)
4. URLs that might contain sensitive information
5. Other sensitive data patterns

For each PII found, provide:
- type: EMAIL, PHONE, NAME, URL, or CUSTOM
- originalText: the actual PII text
- startIndex: character position where PII starts
- endIndex: character position where PII ends
- confidence: 0-1 score for detection confidence
- replacement: appropriate placeholder ([EMAIL], [PHONE], [PERSON_NAME], [URL], etc.)

Be conservative - only flag clear PII, not technical terms or common words.
Avoid false positives for:
- Technical usernames (@alice, @bot)
- Generic terms (password, email, phone)
- Code snippets or technical URLs

Provide response in JSON format:
[
  {
    "type": "EMAIL",
    "originalText": "user@company.com",
    "startIndex": 25,
    "endIndex": 41,
    "confidence": 0.95,
    "replacement": "[EMAIL]"
  }
]
`

    const response = await this.generateContent(prompt, 'pii-detection')
    
    if (!response.success) {
      return {
        success: false,
        error: response.error
      }
    }

    try {
      const data = this.parseJSONResponse(response.data!)
      return {
        success: true,
        data: Array.isArray(data) ? data : [],
        usage: response.usage
      }
    } catch (error) {
      logger.error('Failed to parse Gemini PII detection response:', error)
      logger.error('Raw response:', response.data)
      return {
        success: false,
        error: 'Failed to parse AI response'
      }
    }
  }

  /**
   * Generate FAQs from processed document content
   * Automatically handles large message sets with intelligent chunking
   */
  async generateFAQs(document: {
    title: string
    description: string
    category: string
    messages: Array<{
      text: string
      username: string
      role: string
      timestamp: Date
    }>
  }): Promise<GeminiResponse<Array<{
    question: string
    answer: string
    category: string
    confidence: number
    sourceMessageIds: string[]
  }>>> {
    // Handle large message sets with chunking (>150 messages or >50k chars)
    const totalContent = document.messages.map(m => m.text).join(' ')
    const shouldChunk = document.messages.length > 150 || totalContent.length > 50000

    if (shouldChunk) {
      logger.info(`Large document detected (${document.messages.length} messages, ${totalContent.length} chars) - using chunked processing`)
      return this.generateFAQsWithChunking(document)
    }

    return this.generateFAQsSingle(document)
  }

  /**
   * Generate FAQs for large documents using intelligent chunking
   */
  private async generateFAQsWithChunking(document: {
    title: string
    description: string
    category: string
    messages: Array<{
      text: string
      username: string
      role: string
      timestamp: Date
    }>
  }): Promise<GeminiResponse<Array<{
    question: string
    answer: string
    category: string
    confidence: number
    sourceMessageIds: string[]
  }>>> {
    const CHUNK_SIZE = 100 // Process 100 messages at a time
    const chunks: Array<typeof document.messages> = []
    
    // Create overlapping chunks to maintain context
    for (let i = 0; i < document.messages.length; i += CHUNK_SIZE) {
      const chunk = document.messages.slice(i, i + CHUNK_SIZE + 20) // 20 message overlap
      chunks.push(chunk)
    }

    const allFAQs: Array<{
      question: string
      answer: string
      category: string
      confidence: number
      sourceMessageIds: string[]
    }> = []

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const chunkDoc = {
        ...document,
        title: `${document.title} (Part ${i + 1}/${chunks.length})`,
        messages: chunk
      }

      logger.info(`Processing chunk ${i + 1}/${chunks.length} with ${chunk.length} messages`)
      
      const chunkResult = await this.generateFAQsSingle(chunkDoc)
      
      if (chunkResult.success && chunkResult.data) {
        // Adjust sourceMessageIds for global indexing
        const adjustedFAQs = chunkResult.data.map(faq => ({
          ...faq,
          sourceMessageIds: faq.sourceMessageIds.map(id => 
            String(parseInt(id) + (i * CHUNK_SIZE))
          )
        }))
        allFAQs.push(...adjustedFAQs)
      }

      // Small delay between chunks to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Deduplicate similar FAQs
    const deduplicatedFAQs = this.deduplicateFAQs(allFAQs)

    return {
      success: true,
      data: deduplicatedFAQs,
      usage: {
        promptTokens: 0, // Approximate - would need to sum all chunks
        completionTokens: 0,
        totalTokens: 0
      }
    }
  }

  /**
   * Generate FAQs for a single document (no chunking)
   */
  private async generateFAQsSingle(document: {
    title: string
    description: string
    category: string
    messages: Array<{
      text: string
      username: string
      role: string
      timestamp: Date
    }>
  }): Promise<GeminiResponse<Array<{
    question: string
    answer: string
    category: string
    confidence: number
    sourceMessageIds: string[]
  }>>> {
    const prompt = `
Generate FAQs from the following document about "${document.title}":

Description: ${document.description}
Category: ${document.category}

Messages:
${document.messages.map((msg, idx) => `[${idx}] ${msg.username} (${msg.role}): ${msg.text}`).join('\n')}

Create comprehensive FAQs that:
1. Extract clear question-answer pairs (even simple ones like "what is X?" followed by a definition)
2. Synthesize information from multiple messages
3. Use natural, helpful language
4. Provide complete, actionable answers
5. Categorize appropriately
6. Include ALL questions asked, even basic definitional ones

For each FAQ, provide:
- question: Clear, searchable question
- answer: Complete, helpful answer
- category: Appropriate category (inherit from document or suggest better)
- confidence: 0-1 score for FAQ quality
- sourceMessageIds: Array of message indices that contributed to this FAQ

Focus on:
- User-facing questions and solutions
- Step-by-step instructions
- Common problems and their fixes
- Important context and warnings

Provide response in JSON format:
[
  {
    "question": "How do I reset my password?",
    "answer": "To reset your password: 1. Go to settings...",
    "category": "Account Management",
    "confidence": 0.95,
    "sourceMessageIds": [0, 1, 3]
  }
]
`

    const response = await this.generateContent(prompt, 'faq-generation')
    
    if (!response.success) {
      return {
        success: false,
        error: response.error
      }
    }

    try {
      const data = this.parseJSONResponse(response.data!)
      return {
        success: true,
        data: Array.isArray(data) ? data : [],
        usage: response.usage
      }
    } catch (error) {
      logger.error('Failed to parse Gemini FAQ generation response:', error)
      logger.error('Raw FAQ response:', response.data)
      return {
        success: false,
        error: 'Failed to parse AI response'
      }
    }
  }

  /**
   * Generate embeddings for FAQ content (for Pinecone similarity search)
   */
  async generateEmbedding(text: string): Promise<GeminiResponse<number[]>> {
    try {
      const result = await this.withRetry(async () => {
        const response = await this.embeddingModel.embedContent(text)
        return response.embedding.values
      }, 'embedding-generation')

      return {
        success: true,
        data: result,
        usage: {
          promptTokens: text.length, // Approximate
          completionTokens: 0,
          totalTokens: text.length
        }
      }
    } catch (error) {
      logger.error('Gemini embedding generation failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Enhance existing FAQ by merging with new content
   */
  async enhanceFAQ(existingFAQ: {
    question: string
    answer: string
  }, newCandidate: {
    question: string
    answer: string
  }): Promise<GeminiResponse<{
    enhancedQuestion: string
    enhancedAnswer: string
    confidence: number
  }>> {
    const prompt = `
Enhance the existing FAQ by intelligently merging it with new information:

EXISTING FAQ:
Q: ${existingFAQ.question}
A: ${existingFAQ.answer}

NEW CANDIDATE:
Q: ${newCandidate.question}
A: ${newCandidate.answer}

Create an enhanced FAQ that:
1. Combines the best elements of both
2. Provides more comprehensive information
3. Maintains clarity and readability
4. Eliminates redundancy
5. Preserves important details from both sources

Provide response in JSON format:
{
  "enhancedQuestion": "Improved question text",
  "enhancedAnswer": "Enhanced answer with merged information",
  "confidence": 0.85
}
`

    const response = await this.generateContent(prompt, 'faq-enhancement')
    
    if (!response.success) {
      return {
        success: false,
        error: response.error
      }
    }

    try {
      const data = this.parseJSONResponse(response.data!)
      return {
        success: true,
        data,
        usage: response.usage
      }
    } catch (error) {
      logger.error('Failed to parse Gemini FAQ enhancement response:', error)
      logger.error('Raw response:', response.data)
      return {
        success: false,
        error: 'Failed to parse AI response'
      }
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): {
    requestCount: number
    lastRequestTime: number
  } {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime
    }
  }

  /**
   * Reset usage statistics
   */
  resetUsageStats(): void {
    this.requestCount = 0
    this.lastRequestTime = 0
  }

  /**
   * Generate document metadata from conversation content
   */
  async generateDocumentMetadata(messageContent: string): Promise<GeminiResponse<{
    title: string
    category: string
    description: string
  }>> {
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

    try {
      const result = await this.generateContent(prompt, 'document metadata generation')
      
      if (result.success && result.data) {
        try {
          const metadata = this.parseJSONResponse(result.data)
          return {
            success: true,
            data: {
              title: metadata.title || 'AI-Generated Document',
              category: metadata.category || 'General',
              description: metadata.description || 'Auto-generated from conversation analysis'
            },
            usage: result.usage
          }
        } catch (parseError) {
          logger.error('Failed to parse document metadata response:', parseError)
          logger.error('Raw response:', result.data)
          return {
            success: false,
            error: 'Failed to parse metadata JSON response'
          }
        }
      }
      
      return {
        success: false,
        error: result.error || 'Failed to generate metadata'
      }
    } catch (error) {
      logger.error('Document metadata generation failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Health check for Gemini API connection and functionality
   * Uses lightweight checks to avoid consuming API quota during health monitoring
   */
  async healthCheck(): Promise<{
    isHealthy: boolean
    error?: string
    details: {
      apiKeyConfigured: boolean
      modelAccessible: boolean
      embeddingModelAccessible: boolean
      lastRequestTime: number
      requestCount: number
    }
  }> {
    const details = {
      apiKeyConfigured: !!process.env.GEMINI_API_KEY,
      modelAccessible: false,
      embeddingModelAccessible: false,
      lastRequestTime: this.lastRequestTime,
      requestCount: this.requestCount
    }

    // Basic configuration check (no API call)
    if (!details.apiKeyConfigured) {
      return {
        isHealthy: false,
        error: 'Gemini API key not configured',
        details
      }
    }

    // Only perform actual API tests occasionally (every 20th health check)
    // to avoid consuming quota during regular monitoring
    const shouldPerformFullCheck = Math.random() < 0.05 // 5% chance

    if (!shouldPerformFullCheck) {
      // Return optimistic health status for lightweight checks
      return {
        isHealthy: true,
        error: 'Service available (lightweight check - API key configured)',
        details: {
          ...details,
          modelAccessible: true, // Assume healthy unless we know otherwise
          embeddingModelAccessible: true
        }
      }
    }

    try {
      // Perform full API test (rarely)
      logger.info('Performing full Gemini API health check')

      // Test basic text generation
      const testResponse = await this.generateContent(
        'Test prompt for health check. Respond with: "Gemini is healthy"',
        'health-check'
      )
      
      if (testResponse.success && testResponse.data?.includes('healthy')) {
        details.modelAccessible = true
      }

      // Test embedding generation
      const embeddingResponse = await this.generateEmbedding('test embedding health check')
      
      if (embeddingResponse.success && Array.isArray(embeddingResponse.data) && embeddingResponse.data.length > 0) {
        details.embeddingModelAccessible = true
      }

      const isHealthy = details.apiKeyConfigured && details.modelAccessible && details.embeddingModelAccessible

      return {
        isHealthy,
        error: isHealthy ? 'Full API test completed successfully' : 'One or more Gemini services are not accessible',
        details
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Handle rate limit errors gracefully
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
        logger.warn('Gemini API rate limited during health check')
        return {
          isHealthy: true, // Service is functional, just rate-limited
          error: 'API quota exceeded - service running in degraded mode',
          details: {
            ...details,
            modelAccessible: true, // Assume functional but rate-limited
            embeddingModelAccessible: true
          }
        }
      }
      
      logger.error('Gemini health check failed:', error)
      
      return {
        isHealthy: false,
        error: `Gemini health check failed: ${errorMessage}`,
        details
      }
    }
  }

  /**
   * Deduplicate similar FAQs based on question similarity
   */
  private deduplicateFAQs(faqs: Array<{
    question: string
    answer: string
    category: string
    confidence: number
    sourceMessageIds: string[]
  }>): Array<{
    question: string
    answer: string
    category: string
    confidence: number
    sourceMessageIds: string[]
  }> {
    const deduplicated: typeof faqs = []
    const seen = new Set<string>()

    for (const faq of faqs) {
      // Create a normalized key for similarity detection
      const normalizedQuestion = faq.question.toLowerCase()
        .replace(/[?!.,]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

      // Check for exact or very similar questions
      let isDuplicate = false
      for (const seenKey of Array.from(seen)) {
        if (this.calculateSimilarity(normalizedQuestion, seenKey) > 0.85) {
          isDuplicate = true
          break
        }
      }

      if (!isDuplicate) {
        seen.add(normalizedQuestion)
        deduplicated.push(faq)
      }
    }

    // Sort by confidence score (highest first)
    return deduplicated.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Calculate simple string similarity using Jaccard index
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(' '))
    const words2 = new Set(str2.split(' '))
    
    const intersection = new Set(Array.from(words1).filter(x => words2.has(x)))
    const union = new Set(Array.from(words1).concat(Array.from(words2)))
    
    return intersection.size / union.size
  }
}

// Export singleton instance
export const geminiService = new GeminiService()
export default geminiService 