/**
 * PII Detector Service
 * Combines AI-powered contextual detection with rule-based patterns
 * Provides comprehensive PII identification, replacement, and audit trails
 */

import { logger } from './logger'
import { geminiService } from './gemini'
import { db } from './db'
import { 
  PIIDetection, 
  PIIType, 
  PIIStatus, 
  PIISourceType,
  ProcessingError 
} from '@/types'

// Regular expression patterns for basic PII detection
const PII_PATTERNS = {
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  PHONE: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
  URL: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
  // Credit card patterns (basic)
  CREDIT_CARD: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  // Social Security Number (US format)
  SSN: /\b\d{3}-?\d{2}-?\d{4}\b/g
}

// Replacement templates
const PII_REPLACEMENTS = {
  EMAIL: '[EMAIL]',
  PHONE: '[PHONE]',
  NAME: '[PERSON_NAME]',
  URL: '[URL]',
  CUSTOM: '[REDACTED]',
  CREDIT_CARD: '[CREDIT_CARD]',
  SSN: '[SSN]'
}

// Words that are commonly mistaken for names but are not PII
const NAME_WHITELIST = new Set([
  // Technical terms
  'api', 'url', 'http', 'https', 'json', 'xml', 'css', 'html', 'js', 'javascript',
  'react', 'node', 'npm', 'yarn', 'git', 'github', 'gitlab', 'docker', 'aws',
  // Common usernames/handles
  'admin', 'user', 'guest', 'bot', 'system', 'support', 'help', 'service',
  // Generic terms
  'password', 'username', 'email', 'phone', 'name', 'address', 'login',
  'signin', 'signup', 'account', 'profile', 'settings', 'config'
])

/**
 * PII Detection service with AI enhancement and rule-based fallbacks
 */
class PIIDetectorService {
  
  /**
   * Detect PII in text using hybrid approach (AI + rules)
   */
  async detectPII(
    text: string,
    sourceType: PIISourceType,
    sourceId: string,
    options: {
      useAI?: boolean
      skipRulesBased?: boolean
      confidenceThreshold?: number
    } = {}
  ): Promise<PIIDetection[]> {
    const detections: PIIDetection[] = []
    
    try {
      // Step 1: Rule-based detection (fast, reliable for common patterns)
      if (!options.skipRulesBased) {
        const ruleBasedDetections = await this.detectWithRules(text, sourceType, sourceId)
        detections.push(...ruleBasedDetections)
      }

      // Step 2: AI-powered detection (contextual, better for names and edge cases)
      if (options.useAI !== false) {
        const aiDetections = await this.detectWithAI(text, sourceType, sourceId, options.confidenceThreshold)
        
        // Merge AI detections with rule-based, avoiding duplicates
        for (const aiDetection of aiDetections) {
          const isDuplicate = detections.some(existing => 
            this.isOverlapping(existing, aiDetection)
          )
          
          if (!isDuplicate) {
            detections.push(aiDetection)
          }
        }
      }

      // Step 3: Store detections in database
      if (detections.length > 0) {
        await this.storeDetections(detections)
        logger.info(`Detected ${detections.length} PII items in ${sourceType} ${sourceId}`)
      }

      return detections

    } catch (error) {
      logger.error(`PII detection failed for ${sourceType} ${sourceId}:`, error)
      throw new ProcessingError(`PII detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Rule-based PII detection using regex patterns
   */
  private async detectWithRules(
    text: string,
    sourceType: PIISourceType,
    sourceId: string
  ): Promise<PIIDetection[]> {
    const detections: PIIDetection[] = []

    // Email detection
    const emailMatches = Array.from(text.matchAll(PII_PATTERNS.EMAIL))
    for (const match of emailMatches) {
      if (match.index !== undefined) {
        detections.push({
          id: '', // Will be set when stored
          sourceType,
          sourceId,
          piiType: PIIType.EMAIL,
          originalText: match[0],
          replacementText: PII_REPLACEMENTS.EMAIL,
          confidence: 0.95, // High confidence for email regex
          status: PIIStatus.AUTO_REPLACED,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: new Date()
        })
      }
    }

    // Phone number detection
    const phoneMatches = Array.from(text.matchAll(PII_PATTERNS.PHONE))
    for (const match of phoneMatches) {
      if (match.index !== undefined) {
        detections.push({
          id: '',
          sourceType,
          sourceId,
          piiType: PIIType.PHONE,
          originalText: match[0],
          replacementText: PII_REPLACEMENTS.PHONE,
          confidence: 0.9, // High confidence for phone regex
          status: PIIStatus.AUTO_REPLACED,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: new Date()
        })
      }
    }

    // URL detection (for potentially sensitive URLs)
    const urlMatches = Array.from(text.matchAll(PII_PATTERNS.URL))
    for (const match of urlMatches) {
      if (match.index !== undefined && this.isSensitiveURL(match[0])) {
        detections.push({
          id: '',
          sourceType,
          sourceId,
          piiType: PIIType.URL,
          originalText: match[0],
          replacementText: PII_REPLACEMENTS.URL,
          confidence: 0.8,
          status: PIIStatus.PENDING_REVIEW, // URLs need manual review
          reviewedBy: null,
          reviewedAt: null,
          createdAt: new Date()
        })
      }
    }

    return detections
  }

  /**
   * AI-powered PII detection using Gemini
   */
  private async detectWithAI(
    text: string,
    sourceType: PIISourceType,
    sourceId: string,
    confidenceThreshold: number = 0.7
  ): Promise<PIIDetection[]> {
    try {
      const response = await geminiService.detectPII(text)
      
      if (!response.success || !response.data) {
        logger.warn(`AI PII detection failed for ${sourceType} ${sourceId}: ${response.error}`)
        return []
      }

      const detections: PIIDetection[] = []

      for (const aiDetection of response.data) {
        // Filter by confidence threshold
        if (aiDetection.confidence < confidenceThreshold) {
          continue
        }

        // Additional validation for names to reduce false positives
        if (aiDetection.type === 'NAME' && this.isWhitelistedName(aiDetection.originalText)) {
          continue
        }

        detections.push({
          id: '',
          sourceType,
          sourceId,
          piiType: aiDetection.type as PIIType,
          originalText: aiDetection.originalText,
          replacementText: aiDetection.replacement,
          confidence: aiDetection.confidence,
          status: aiDetection.confidence > 0.9 ? PIIStatus.AUTO_REPLACED : PIIStatus.PENDING_REVIEW,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: new Date()
        })
      }

      return detections

    } catch (error) {
      logger.error(`AI PII detection failed for ${sourceType} ${sourceId}:`, error)
      return []
    }
  }

  /**
   * Apply PII replacements to text
   */
  async replacePII(text: string, detections: PIIDetection[]): Promise<string> {
    let cleanedText = text

    // Sort detections by position (descending) to avoid index issues
    const sortedDetections = detections
      .filter(d => d.status === PIIStatus.AUTO_REPLACED || d.status === PIIStatus.WHITELISTED)
      .sort((a, b) => {
        const aStart = text.indexOf(a.originalText)
        const bStart = text.indexOf(b.originalText)
        return bStart - aStart
      })

    for (const detection of sortedDetections) {
      if (detection.status === PIIStatus.WHITELISTED) {
        continue // Keep whitelisted items as-is
      }

      cleanedText = cleanedText.replace(
        new RegExp(this.escapeRegExp(detection.originalText), 'g'),
        detection.replacementText
      )
    }

    return cleanedText
  }

  /**
   * Review and update PII detection status
   */
  async reviewPII(
    detectionId: string,
    status: PIIStatus,
    reviewedBy: string,
    customReplacement?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        reviewedBy,
        reviewedAt: new Date()
      }

      if (customReplacement) {
        updateData.replacementText = customReplacement
      }

      await db.pIIDetection.update({
        where: { id: detectionId },
        data: updateData
      })

      logger.info(`PII detection ${detectionId} reviewed by ${reviewedBy}, status: ${status}`)

    } catch (error) {
      logger.error(`Failed to review PII detection ${detectionId}:`, error)
      throw new ProcessingError(`Failed to review PII detection: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get pending PII detections for review
   */
  async getPendingReviews(
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    detections: PIIDetection[]
    total: number
  }> {
    try {
      const [detections, total] = await Promise.all([
        db.pIIDetection.findMany({
          where: {
            status: PIIStatus.PENDING_REVIEW
          },
          include: {
            message: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: limit,
          skip: offset
        }),
        db.pIIDetection.count({
          where: {
            status: PIIStatus.PENDING_REVIEW
          }
        })
      ])

      return { 
        detections: detections.map((d: any) => ({
          ...d,
          message: d.message || undefined
        })) as PIIDetection[], 
        total 
      }

    } catch (error) {
      logger.error('Failed to get pending PII reviews:', error)
      throw new ProcessingError(`Failed to get pending PII reviews: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get PII statistics for reporting
   */
  async getPIIStats(): Promise<{
    totalDetections: number
    byType: Record<PIIType, number>
    byStatus: Record<PIIStatus, number>
    pendingReview: number
    autoReplaced: number
  }> {
    try {
      const detections = await db.pIIDetection.findMany({
        select: {
          piiType: true,
          status: true
        }
      })

      const stats = {
        totalDetections: detections.length,
        byType: {} as Record<PIIType, number>,
        byStatus: {} as Record<PIIStatus, number>,
        pendingReview: 0,
        autoReplaced: 0
      }

      // Initialize counters
      Object.values(PIIType).forEach(type => {
        stats.byType[type] = 0
      })
      Object.values(PIIStatus).forEach(status => {
        stats.byStatus[status] = 0
      })

      // Count detections
      for (const detection of detections) {
        stats.byType[detection.piiType as PIIType]++
        stats.byStatus[detection.status as PIIStatus]++
        
        if (detection.status === PIIStatus.PENDING_REVIEW) {
          stats.pendingReview++
        } else if (detection.status === PIIStatus.AUTO_REPLACED) {
          stats.autoReplaced++
        }
      }

      return stats

    } catch (error) {
      logger.error('Failed to get PII statistics:', error)
      throw new ProcessingError(`Failed to get PII statistics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Store PII detections in database
   */
  private async storeDetections(detections: PIIDetection[]): Promise<void> {
    try {
      await db.pIIDetection.createMany({
        data: detections.map(detection => ({
          sourceType: detection.sourceType as any,
          sourceId: detection.sourceId,
          piiType: detection.piiType as any,
          originalText: detection.originalText,
          replacementText: detection.replacementText,
          confidence: detection.confidence,
          status: detection.status as any
        }))
      })
    } catch (error) {
      logger.error('Failed to store PII detections:', error)
      throw new ProcessingError(`Failed to store PII detections: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if two PII detections overlap
   */
  private isOverlapping(detection1: PIIDetection, detection2: PIIDetection): boolean {
    const text1 = detection1.originalText.toLowerCase()
    const text2 = detection2.originalText.toLowerCase()
    
    // Check if texts are identical or one contains the other
    return text1 === text2 || text1.includes(text2) || text2.includes(text1)
  }

  /**
   * Check if a URL is potentially sensitive
   */
  private isSensitiveURL(url: string): boolean {
    const sensitivePatterns = [
      /admin/i,
      /dashboard/i,
      /api\//i,
      /token/i,
      /key/i,
      /secret/i,
      /private/i,
      /internal/i
    ]

    return sensitivePatterns.some(pattern => pattern.test(url))
  }

  /**
   * Check if a detected name is in the whitelist
   */
  private isWhitelistedName(name: string): boolean {
    const lowerName = name.toLowerCase()
    
    // Check against whitelist
    if (NAME_WHITELIST.has(lowerName)) {
      return true
    }

    // Check if it looks like a username or technical term
    if (lowerName.startsWith('@') || lowerName.includes('_') || lowerName.includes('.')) {
      return true
    }

    // Check if it's all uppercase (likely an acronym)
    if (name === name.toUpperCase() && name.length <= 5) {
      return true
    }

    return false
  }

  /**
   * Escape special regex characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Health check for PII detector service
   */
  async healthCheck(): Promise<{
    isHealthy: boolean
    error?: string
    stats?: any
  }> {
    try {
      const stats = await this.getPIIStats()
      
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
export const piiDetectorService = new PIIDetectorService()
export default piiDetectorService 