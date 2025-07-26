/**
 * Conversation Analyzer Service  
 * AI-powered analysis of Slack conversations to identify Q&A patterns,
 * conversation boundaries, and message roles for document processing
 */

import { logger } from './logger'
import { geminiService } from './gemini'
import { 
  BaseMessage, 
  MessageRole, 
  ProcessingError,
  GeminiResponse 
} from '@/types'

// Configuration constants
const MIN_CONVERSATION_LENGTH = 2 // Minimum messages for a conversation
const MAX_CONVERSATION_GAP_MINUTES = 30 // Max time gap within a conversation
const CONFIDENCE_THRESHOLD = 0.7 // Minimum confidence for AI decisions
const QA_CONFIDENCE_THRESHOLD = 0.8 // Higher threshold for Q&A pairs

/**
 * Analyzed conversation structure
 */
export interface ConversationBoundary {
  startIndex: number
  endIndex: number
  topic: string
  confidence: number
  messageIds: string[]
}

/**
 * Question-Answer pair identification
 */
export interface QAPair {
  questionIndex: number
  answerIndex: number
  questionMessageId: string
  answerMessageId: string
  confidence: number
  topic: string
}

/**
 * Message role analysis result
 */
export interface MessageRoleAnalysis {
  messageId: string
  role: MessageRole
  confidence: number
  reasoning: string
}

/**
 * Complete conversation analysis result
 */
export interface ConversationAnalysis {
  conversationBoundaries: ConversationBoundary[]
  qaPairs: QAPair[]
  messageRoles: MessageRoleAnalysis[]
  overallConfidence: number
  processingTime: number
}

/**
 * Conversation Analyzer service for intelligent message processing
 */
class ConversationAnalyzerService {
  
  /**
   * Analyze a collection of messages for conversation patterns
   */
  async analyzeConversation(messages: BaseMessage[]): Promise<ConversationAnalysis> {
    const startTime = Date.now()
    
    try {
      if (messages.length < MIN_CONVERSATION_LENGTH) {
        return {
          conversationBoundaries: [],
          qaPairs: [],
          messageRoles: [],
          overallConfidence: 0,
          processingTime: Date.now() - startTime
        }
      }

      // Step 1: Pre-process messages for analysis
      const processedMessages = this.preprocessMessages(messages)

      // Step 2: Use AI to analyze conversation structure
      const aiAnalysis = await this.performAIAnalysis(processedMessages)

      // Step 3: Apply rule-based validation and enhancement
      const enhancedAnalysis = await this.enhanceWithRules(processedMessages, aiAnalysis)

      // Step 4: Calculate overall confidence
      const overallConfidence = this.calculateOverallConfidence(enhancedAnalysis)

      const result: ConversationAnalysis = {
        conversationBoundaries: enhancedAnalysis.conversationBoundaries,
        qaPairs: enhancedAnalysis.qaPairs,
        messageRoles: enhancedAnalysis.messageRoles,
        overallConfidence,
        processingTime: Date.now() - startTime
      }

      logger.info(`Analyzed conversation with ${messages.length} messages, found ${result.qaPairs.length} Q&A pairs`)
      return result

    } catch (error) {
      logger.error('Conversation analysis failed:', error)
      throw new ProcessingError(`Conversation analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Identify potential Q&A pairs in messages
   */
  async identifyQAPairs(messages: BaseMessage[]): Promise<QAPair[]> {
    try {
      const analysis = await this.analyzeConversation(messages)
      return analysis.qaPairs.filter(pair => pair.confidence >= QA_CONFIDENCE_THRESHOLD)
    } catch (error) {
      logger.error('Q&A pair identification failed:', error)
      return []
    }
  }

  /**
   * Determine the role of individual messages
   */
  async analyzeMessageRoles(messages: BaseMessage[]): Promise<MessageRoleAnalysis[]> {
    try {
      const analysis = await this.analyzeConversation(messages)
      return analysis.messageRoles
    } catch (error) {
      logger.error('Message role analysis failed:', error)
      return []
    }
  }

  /**
   * Find conversation boundaries in a message thread
   */
  async findConversationBoundaries(messages: BaseMessage[]): Promise<ConversationBoundary[]> {
    try {
      // Rule-based boundary detection first
      const timeBoundaries = this.detectTimeBoundaries(messages)
      
      // AI-enhanced topic boundary detection
      const analysis = await this.analyzeConversation(messages)
      
      // Merge and validate boundaries
      return this.mergeBoundaries(timeBoundaries, analysis.conversationBoundaries)
      
    } catch (error) {
      logger.error('Conversation boundary detection failed:', error)
      return this.detectTimeBoundaries(messages) // Fallback to rule-based
    }
  }

  /**
   * Pre-process messages for analysis
   */
  private preprocessMessages(messages: BaseMessage[]): Array<{
    id: string
    text: string
    username: string
    timestamp: Date
    isThreadReply: boolean
    index: number
    timeFromPrevious?: number
  }> {
    return messages
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map((msg, index) => {
        const timeFromPrevious = index > 0 
          ? msg.timestamp.getTime() - messages[index - 1].timestamp.getTime()
          : 0

        return {
          id: msg.id,
          text: msg.text,
          username: msg.username,
          timestamp: msg.timestamp,
          isThreadReply: msg.isThreadReply,
          index,
          timeFromPrevious
        }
      })
  }

  /**
   * Perform AI-powered conversation analysis
   */
  private async performAIAnalysis(messages: Array<{
    id: string
    text: string
    username: string
    timestamp: Date
    isThreadReply: boolean
    index: number
  }>): Promise<{
    conversationBoundaries: ConversationBoundary[]
    qaPairs: QAPair[]
    messageRoles: MessageRoleAnalysis[]
  }> {
    try {
      const response = await geminiService.analyzeConversation(messages)

      if (!response.success || !response.data) {
        throw new Error(`AI analysis failed: ${response.error}`)
      }

      const data = response.data

      // Convert AI response to our format
      const conversationBoundaries: ConversationBoundary[] = data.conversationBoundaries.map(boundary => ({
        startIndex: boundary.startIndex,
        endIndex: boundary.endIndex,
        topic: boundary.topic,
        confidence: 0.8, // Default AI confidence
        messageIds: messages
          .slice(boundary.startIndex, boundary.endIndex + 1)
          .map(msg => msg.id)
      }))

      const qaPairs: QAPair[] = data.qaPairs.map(pair => ({
        questionIndex: pair.questionIndex,
        answerIndex: pair.answerIndex,
        questionMessageId: messages[pair.questionIndex]?.id || '',
        answerMessageId: messages[pair.answerIndex]?.id || '',
        confidence: pair.confidence,
        topic: pair.topic
      }))

      const messageRoles: MessageRoleAnalysis[] = data.messageRoles.map(roleData => ({
        messageId: roleData.messageId,
        role: roleData.role as MessageRole,
        confidence: roleData.confidence,
        reasoning: 'AI analysis based on content and context'
      }))

      return {
        conversationBoundaries,
        qaPairs,
        messageRoles
      }

    } catch (error) {
      logger.error('AI conversation analysis failed:', error)
      
      // Fallback to rule-based analysis
      return {
        conversationBoundaries: [],
        qaPairs: [],
        messageRoles: messages.map(msg => ({
          messageId: msg.id,
          role: MessageRole.CONTEXT,
          confidence: 0.5,
          reasoning: 'Fallback rule-based classification'
        }))
      }
    }
  }

  /**
   * Enhance AI analysis with rule-based validation
   */
  private async enhanceWithRules(
    messages: Array<{
      id: string
      text: string
      username: string
      timestamp: Date
      isThreadReply: boolean
      index: number
    }>,
    aiAnalysis: {
      conversationBoundaries: ConversationBoundary[]
      qaPairs: QAPair[]
      messageRoles: MessageRoleAnalysis[]
    }
  ): Promise<{
    conversationBoundaries: ConversationBoundary[]
    qaPairs: QAPair[]
    messageRoles: MessageRoleAnalysis[]
  }> {
    // Enhance message roles with rule-based patterns
    const enhancedRoles = aiAnalysis.messageRoles.map(roleAnalysis => {
      const message = messages.find(m => m.id === roleAnalysis.messageId)
      if (!message) return roleAnalysis

      const ruleBasedRole = this.classifyMessageRole(message.text)
      const ruleConfidence = this.calculateRuleConfidence(message.text, ruleBasedRole)

      // Use rule-based classification if it has higher confidence
      if (ruleConfidence > roleAnalysis.confidence) {
        return {
          ...roleAnalysis,
          role: ruleBasedRole,
          confidence: ruleConfidence,
          reasoning: 'Rule-based classification with higher confidence'
        }
      }

      return roleAnalysis
    })

    // Validate Q&A pairs with rules
    const validatedQAPairs = aiAnalysis.qaPairs.filter(pair => {
      const questionMsg = messages[pair.questionIndex]
      const answerMsg = messages[pair.answerIndex]
      
      if (!questionMsg || !answerMsg) return false

      // Check if question looks like a question
      const isQuestion = this.isLikelyQuestion(questionMsg.text)
      
      // Check if answer comes after question
      const isOrdered = pair.answerIndex > pair.questionIndex
      
      // Check time proximity (answers should be reasonably close to questions)
      const timeDiff = answerMsg.timestamp.getTime() - questionMsg.timestamp.getTime()
      const isTimely = timeDiff < (2 * 60 * 60 * 1000) // 2 hours max

      return isQuestion && isOrdered && isTimely
    })

    return {
      conversationBoundaries: aiAnalysis.conversationBoundaries,
      qaPairs: validatedQAPairs,
      messageRoles: enhancedRoles
    }
  }

  /**
   * Classify message role using rule-based patterns
   */
  private classifyMessageRole(text: string): MessageRole {
    const lowerText = text.toLowerCase()

    // Question patterns
    const questionPatterns = [
      /^(how|what|when|where|why|who|which|can|could|would|should|is|are|do|does|did)\s/,
      /\?$/,
      /^(help|assist|support)/,
      /(how to|how do i|how can i)/,
      /(what is|what are|what does)/,
      /(where is|where are|where can)/,
      /(when is|when are|when do)/,
      /(why is|why are|why do)/
    ]

    if (questionPatterns.some(pattern => pattern.test(lowerText))) {
      return MessageRole.QUESTION
    }

    // Answer patterns
    const answerPatterns = [
      /^(yes|no|sure|definitely|absolutely)/,
      /^(you can|you should|you need to|try)/,
      /^(here|there|this|that)/,
      /(here's how|here's what|this is how)/,
      /^(to do this|to fix this|to solve)/,
      /(step 1|first|second|third|next|then|finally)/
    ]

    if (answerPatterns.some(pattern => pattern.test(lowerText))) {
      return MessageRole.ANSWER
    }

    // Confirmation patterns
    const confirmationPatterns = [
      /^(thanks|thank you|perfect|great|awesome|got it|worked)/,
      /^(that worked|that fixed|that solved)/,
      /(problem solved|issue resolved|all set)/
    ]

    if (confirmationPatterns.some(pattern => pattern.test(lowerText))) {
      return MessageRole.CONFIRMATION
    }

    // Follow-up patterns
    const followUpPatterns = [
      /^(but|however|what if|what about)/,
      /(also|additionally|another question)/,
      /^(and|also|plus)/
    ]

    if (followUpPatterns.some(pattern => pattern.test(lowerText))) {
      return MessageRole.FOLLOW_UP
    }

    // Default to context
    return MessageRole.CONTEXT
  }

  /**
   * Calculate confidence for rule-based classification
   */
  private calculateRuleConfidence(text: string, role: MessageRole): number {
    const lowerText = text.toLowerCase()
    
    switch (role) {
      case MessageRole.QUESTION:
        if (lowerText.includes('?')) return 0.9
        if (lowerText.startsWith('how') || lowerText.startsWith('what')) return 0.85
        return 0.7

      case MessageRole.ANSWER:
        if (/step \d|first|second|third/.test(lowerText)) return 0.85
        if (lowerText.startsWith('you can') || lowerText.startsWith('try')) return 0.8
        return 0.7

      case MessageRole.CONFIRMATION:
        if (lowerText.includes('worked') || lowerText.includes('fixed')) return 0.9
        if (lowerText.startsWith('thanks') || lowerText.startsWith('perfect')) return 0.85
        return 0.7

      case MessageRole.FOLLOW_UP:
        if (lowerText.startsWith('but') || lowerText.includes('what if')) return 0.8
        return 0.7

      default:
        return 0.5
    }
  }

  /**
   * Check if text is likely a question
   */
  private isLikelyQuestion(text: string): boolean {
    const lowerText = text.toLowerCase()
    
    // Ends with question mark
    if (text.trim().endsWith('?')) return true
    
    // Starts with question words
    const questionWords = ['how', 'what', 'when', 'where', 'why', 'who', 'which', 'can', 'could', 'would', 'should', 'is', 'are', 'do', 'does', 'did']
    const firstWord = lowerText.split(' ')[0]
    
    return questionWords.includes(firstWord)
  }

  /**
   * Detect conversation boundaries based on time gaps
   */
  private detectTimeBoundaries(messages: BaseMessage[]): ConversationBoundary[] {
    if (messages.length < MIN_CONVERSATION_LENGTH) return []

    const boundaries: ConversationBoundary[] = []
    const sortedMessages = messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    
    let currentStart = 0
    
    for (let i = 1; i < sortedMessages.length; i++) {
      const timeDiff = sortedMessages[i].timestamp.getTime() - sortedMessages[i - 1].timestamp.getTime()
      const minutesDiff = timeDiff / (1000 * 60)
      
      if (minutesDiff > MAX_CONVERSATION_GAP_MINUTES) {
        // End current conversation
        if (i - currentStart >= MIN_CONVERSATION_LENGTH) {
          boundaries.push({
            startIndex: currentStart,
            endIndex: i - 1,
            topic: 'Time-based boundary',
            confidence: 0.8,
            messageIds: sortedMessages.slice(currentStart, i).map(m => m.id)
          })
        }
        
        currentStart = i
      }
    }
    
    // Add final boundary
    if (sortedMessages.length - currentStart >= MIN_CONVERSATION_LENGTH) {
      boundaries.push({
        startIndex: currentStart,
        endIndex: sortedMessages.length - 1,
        topic: 'Time-based boundary',
        confidence: 0.8,
        messageIds: sortedMessages.slice(currentStart).map(m => m.id)
      })
    }
    
    return boundaries
  }

  /**
   * Merge time-based and AI-detected boundaries
   */
  private mergeBoundaries(
    timeBoundaries: ConversationBoundary[],
    aiBoundaries: ConversationBoundary[]
  ): ConversationBoundary[] {
    // For now, prefer AI boundaries if they exist, otherwise use time boundaries
    return aiBoundaries.length > 0 ? aiBoundaries : timeBoundaries
  }

  /**
   * Calculate overall confidence for the analysis
   */
  private calculateOverallConfidence(analysis: {
    conversationBoundaries: ConversationBoundary[]
    qaPairs: QAPair[]
    messageRoles: MessageRoleAnalysis[]
  }): number {
    const allConfidences = [
      ...analysis.conversationBoundaries.map(b => b.confidence),
      ...analysis.qaPairs.map(q => q.confidence),
      ...analysis.messageRoles.map(r => r.confidence)
    ]

    if (allConfidences.length === 0) return 0

    return allConfidences.reduce((sum, conf) => sum + conf, 0) / allConfidences.length
  }

  /**
   * Health check for conversation analyzer service
   * Uses lightweight checks to avoid consuming API quota during health monitoring
   */
  async healthCheck(): Promise<{
    isHealthy: boolean
    error?: string
  }> {
    try {
      // Check if Gemini service is available without making actual API calls
      // This prevents health checks from consuming API quota
      const geminiHealthy = await geminiService.healthCheck()
      
      if (!geminiHealthy.isHealthy) {
        // Check if it's a rate limit error
        if (geminiHealthy.error?.includes('429') || geminiHealthy.error?.includes('quota') || geminiHealthy.error?.includes('rate limit')) {
          return {
            isHealthy: true, // Service is functional, just rate-limited
            error: 'API quota exceeded - service running in degraded mode'
          }
        }
        
        return {
          isHealthy: false,
          error: geminiHealthy.error || 'Gemini service unavailable'
        }
      }

      // Only perform actual AI analysis occasionally (every 10th health check)
      // to avoid consuming quota during regular monitoring
      const shouldPerformFullCheck = Math.random() < 0.1 // 10% chance

      if (!shouldPerformFullCheck) {
        return {
          isHealthy: true,
          error: 'Service available (lightweight check)'
        }
      }

      // Perform full AI analysis test (rarely)
      const testMessages: BaseMessage[] = [
        {
          id: 'test1',
          slackId: 'test1',
          text: 'How do I reset my password?',
          userId: 'user1',
          username: 'testuser',
          channel: 'test',
          timestamp: new Date(),
          threadTs: null,
          isThreadReply: false,
          parentMessageId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'test2',
          slackId: 'test2',
          text: 'Go to settings and click reset password.',
          userId: 'user2',
          username: 'helper',
          channel: 'test',
          timestamp: new Date(Date.now() + 60000),
          threadTs: null,
          isThreadReply: false,
          parentMessageId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      const analysis = await this.analyzeConversation(testMessages)
      
      return {
        isHealthy: analysis.qaPairs.length > 0 || analysis.messageRoles.length > 0,
        error: 'Full AI analysis completed successfully'
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Handle rate limit errors gracefully
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
        return {
          isHealthy: true, // Service is functional, just rate-limited
          error: 'API quota exceeded - service running in degraded mode'
        }
      }
      
      return {
        isHealthy: false,
        error: errorMessage
      }
    }
  }
}

// Export singleton instance
export const conversationAnalyzerService = new ConversationAnalyzerService()
export default conversationAnalyzerService 