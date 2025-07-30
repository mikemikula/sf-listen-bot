/**
 * Business-Aware PII Detector Service
 * Intelligently distinguishes between personal PII and business-critical information
 * Preserves essential business data while protecting personal information
 * Implements SOLID principles with comprehensive error handling
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

// Business email patterns that should NOT be treated as PII
const BUSINESS_EMAIL_PATTERNS = [
  // Support and customer service
  /\b(support|help|customer|service|assist|care)@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi,
  // Sales and business development
  /\b(sales|biz|business|bd|partnerships|deals)@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi,
  // Technical and operations
  /\b(admin|ops|tech|engineering|dev|devops|api|noreply|no-reply)@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi,
  // Billing and finance
  /\b(billing|invoice|payments|finance|accounting|accounts)@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi,
  // Legal and compliance
  /\b(legal|compliance|security|privacy|dmca)@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi,
  // General business functions
  /\b(info|contact|hello|inquiries|team|office)@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi,
  // Marketing and communications
  /\b(marketing|press|media|pr|communications|newsletter)@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi
]

// Well-known business domains that are typically not PII
const BUSINESS_DOMAINS = new Set([
  // Major vendors and services
  'salesforce.com', 'hubspot.com', 'mailchimp.com', 'stripe.com', 'paypal.com',
  'aws.amazon.com', 'microsoft.com', 'google.com', 'adobe.com', 'oracle.com',
  'atlassian.com', 'slack.com', 'zoom.us', 'dropbox.com', 'box.com',
  // Common business email providers
  'company.com', 'corp.com', 'inc.com', 'llc.com', 'ltd.com',
  // Support domains
  'support.com', 'help.com', 'service.com'
])

// Regular expression patterns for PII detection
const PII_PATTERNS = {
  // Personal email pattern (will be filtered against business patterns)
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Personal phone numbers (not business lines)
  PERSONAL_PHONE: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
  
  // Sensitive URLs (not public business URLs)
  SENSITIVE_URL: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
  
  // Financial information
  CREDIT_CARD: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  SSN: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  
  // Personal identifiers
  PERSONAL_ID: /\b\d{9,12}\b/g // Generic ID numbers
}

// Replacement templates
const PII_REPLACEMENTS = {
  EMAIL: '[PERSONAL_EMAIL]',
  PHONE: '[PERSONAL_PHONE]',
  NAME: '[PERSON_NAME]',
  URL: '[SENSITIVE_URL]',
  CUSTOM: '[REDACTED]',
  CREDIT_CARD: '[CREDIT_CARD]',
  SSN: '[SSN]',
  PERSONAL_ID: '[ID_NUMBER]'
}

// Terms that are commonly mistaken for names but are not PII
const NAME_WHITELIST = new Set([
  // Technical terms
  'api', 'url', 'http', 'https', 'json', 'xml', 'css', 'html', 'js', 'javascript',
  'react', 'node', 'npm', 'yarn', 'git', 'github', 'gitlab', 'docker', 'aws',
  // Business roles and functions
  'admin', 'user', 'guest', 'bot', 'system', 'support', 'help', 'service',
  'manager', 'director', 'executive', 'team', 'staff', 'department',
  // Generic terms
  'password', 'username', 'email', 'phone', 'name', 'address', 'login',
  'signin', 'signup', 'account', 'profile', 'settings', 'config',
  // Business terms
  'company', 'corporation', 'business', 'organization', 'enterprise'
])

/**
 * Business-aware PII Detection service
 * Preserves essential business information while protecting personal data
 */
class BusinessAwarePIIDetectorService {
  
  /**
   * Detect PII in text with business context awareness
   * @param text - Text to analyze
   * @param sourceType - Source type (MESSAGE, DOCUMENT)
   * @param sourceId - Source entity ID
   * @param options - Detection options
   * @returns Array of PII detections
   */
  async detectPII(
    text: string,
    sourceType: PIISourceType,
    sourceId: string,
    options: {
      useAI?: boolean
      skipRulesBased?: boolean
      confidenceThreshold?: number
      preserveBusinessEmails?: boolean
    } = {}
  ): Promise<PIIDetection[]> {
    const detections: PIIDetection[] = []
    
    try {
      logger.info(`Starting business-aware PII detection for ${sourceType} ${sourceId}`)
      
      // Step 1: Rule-based detection with business awareness
      if (!options.skipRulesBased) {
        const ruleBasedDetections = await this.detectWithBusinessRules(
          text, 
          sourceType, 
          sourceId,
          options.preserveBusinessEmails !== false
        )
        detections.push(...ruleBasedDetections)
      }

      // Step 2: AI-powered detection with business context
      if (options.useAI !== false) {
        const aiDetections = await this.detectWithBusinessAI(
          text, 
          sourceType, 
          sourceId, 
          options.confidenceThreshold
        )
        
        // Merge AI detections, avoiding duplicates
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
        logger.info(`Detected ${detections.length} PII items (business emails preserved) in ${sourceType} ${sourceId}`)
      } else {
        logger.info(`No personal PII detected in ${sourceType} ${sourceId} (business information preserved)`)
      }

      return detections

    } catch (error) {
      logger.error(`Business-aware PII detection failed for ${sourceType} ${sourceId}:`, error)
      throw new ProcessingError(`PII detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Business-aware rule-based PII detection
   * Preserves business-critical email addresses and contact information
   */
  private async detectWithBusinessRules(
    text: string,
    sourceType: PIISourceType,
    sourceId: string,
    preserveBusinessEmails: boolean = true
  ): Promise<PIIDetection[]> {
    const detections: PIIDetection[] = []

    // Email detection with business awareness
    const emailMatches = Array.from(text.matchAll(PII_PATTERNS.EMAIL))
    for (const match of emailMatches) {
      if (match.index !== undefined) {
        const email = match[0]
        
        // Skip business emails if preservation is enabled
        if (preserveBusinessEmails && this.isBusinessEmail(email)) {
          logger.debug(`Preserving business email: ${email}`)
          continue
        }
        
        // Only flag personal emails as PII
        detections.push({
          id: '', // Will be set when stored
          sourceType,
          sourceId,
          piiType: PIIType.EMAIL,
          originalText: email,
          replacementText: PII_REPLACEMENTS.EMAIL,
          confidence: 0.95,
          status: PIIStatus.AUTO_REPLACED,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: new Date()
        })
      }
    }

    // Personal phone number detection (excluding business lines)
    const phoneMatches = Array.from(text.matchAll(PII_PATTERNS.PERSONAL_PHONE))
    for (const match of phoneMatches) {
      if (match.index !== undefined && this.isLikelyPersonalPhone(match[0], text)) {
        detections.push({
          id: '',
          sourceType,
          sourceId,
          piiType: PIIType.PHONE,
          originalText: match[0],
          replacementText: PII_REPLACEMENTS.PHONE,
          confidence: 0.85, // Lower confidence for context-dependent detection
          status: PIIStatus.PENDING_REVIEW, // Require review for phone numbers
          reviewedBy: null,
          reviewedAt: null,
          createdAt: new Date()
        })
      }
    }

    // Sensitive URL detection (excluding public business URLs)
    const urlMatches = Array.from(text.matchAll(PII_PATTERNS.SENSITIVE_URL))
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

    // Financial information detection
    const creditCardMatches = Array.from(text.matchAll(PII_PATTERNS.CREDIT_CARD))
    for (const match of creditCardMatches) {
      if (match.index !== undefined) {
        detections.push({
          id: '',
          sourceType,
          sourceId,
          piiType: PIIType.CUSTOM,
          originalText: match[0],
          replacementText: PII_REPLACEMENTS.CREDIT_CARD,
          confidence: 0.98,
          status: PIIStatus.AUTO_REPLACED,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: new Date()
        })
      }
    }

    return detections
  }

  /**
   * AI-powered PII detection with business context
   */
  private async detectWithBusinessAI(
    text: string,
    sourceType: PIISourceType,
    sourceId: string,
    confidenceThreshold: number = 0.7
  ): Promise<PIIDetection[]> {
    try {
      const response = await geminiService.detectBusinessAwarePII(text)
      
      if (!response.success || !response.data) {
        logger.warn(`AI business-aware PII detection failed for ${sourceType} ${sourceId}: ${response.error}`)
        return []
      }

      const detections: PIIDetection[] = []

      for (const aiDetection of response.data) {
        // Filter by confidence threshold
        if (aiDetection.confidence < confidenceThreshold) {
          continue
        }

        // Skip business emails identified by AI
        if (aiDetection.type === 'EMAIL' && aiDetection.isBusinessEmail) {
          continue
        }

        // Additional validation for names to reduce false positives
        if (aiDetection.type === 'NAME' && this.isWhitelistedName(aiDetection.originalText)) {
          continue
        }

        // Map AI detection types to our schema enum values
        const mappedPiiType = this.mapAITypeToPIIType(aiDetection.type)
        if (!mappedPiiType) {
          logger.warn(`Unknown AI PII type: ${aiDetection.type}, skipping detection`)
          continue
        }

        detections.push({
          id: '',
          sourceType,
          sourceId,
          piiType: mappedPiiType,
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
      logger.error(`AI business-aware PII detection failed for ${sourceType} ${sourceId}:`, error)
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
   * Get PII detections for review with optional status filtering
   */
  async getAllReviews(
    limit: number = 50,
    offset: number = 0,
    status?: PIIStatus
  ): Promise<{
    detections: PIIDetection[]
    total: number
  }> {
    try {
      const whereClause = status ? { status } : {}
      
      const [detections, total] = await Promise.all([
        db.pIIDetection.findMany({
          where: whereClause,
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
          where: whereClause
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
      logger.error('Failed to get PII reviews:', error)
      throw new ProcessingError(`Failed to get PII reviews: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
    whitelisted: number
    flagged: number
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
        autoReplaced: 0,
        whitelisted: 0,
        flagged: 0
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
        } else if (detection.status === PIIStatus.WHITELISTED) {
          stats.whitelisted++
        } else if (detection.status === PIIStatus.FLAGGED) {
          stats.flagged++
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
   * Determine if an email address is business-related
   * @param email - Email address to check
   * @returns True if email appears to be business-related
   */
  private isBusinessEmail(email: string): boolean {
    const emailLower = email.toLowerCase()
    
    // Check against business email patterns
    for (const pattern of BUSINESS_EMAIL_PATTERNS) {
      if (pattern.test(emailLower)) {
        logger.debug(`Email ${email} matches business pattern: ${pattern}`)
        return true
      }
    }
    
    // Check against known business domains
    const domain = emailLower.split('@')[1]
    if (domain && BUSINESS_DOMAINS.has(domain)) {
      logger.debug(`Email ${email} has business domain: ${domain}`)
      return true
    }
    
    // Check for generic business indicators in local part
    const localPart = emailLower.split('@')[0]
    const businessIndicators = [
      'support', 'help', 'sales', 'info', 'contact', 'admin', 'service',
      'billing', 'accounts', 'team', 'office', 'hello', 'inquiries'
    ]
    
    for (const indicator of businessIndicators) {
      if (localPart.includes(indicator)) {
        logger.debug(`Email ${email} has business indicator: ${indicator}`)
        return true
      }
    }
    
    return false
  }

  /**
   * Determine if a phone number is likely personal vs business
   * @param phone - Phone number
   * @param context - Surrounding text context
   * @returns True if phone appears to be personal
   */
  private isLikelyPersonalPhone(phone: string, context: string): boolean {
    const contextLower = context.toLowerCase()
    
    // Business phone indicators
    const businessIndicators = [
      'support', 'customer service', 'sales', 'office', 'main line',
      'headquarters', 'help desk', 'call center', 'business hours'
    ]
    
    // Check if phone appears in business context
    for (const indicator of businessIndicators) {
      if (contextLower.includes(indicator)) {
        return false // Not personal
      }
    }
    
    // Personal phone indicators
    const personalIndicators = [
      'my number', 'personal', 'mobile', 'cell', 'direct line',
      'reach me at', 'call me', 'text me'
    ]
    
    for (const indicator of personalIndicators) {
      if (contextLower.includes(indicator)) {
        return true // Likely personal
      }
    }
    
    // Default to requiring review
    return false
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
   * Map AI detection types to our schema PIIType enum values
   */
  private mapAITypeToPIIType(aiType: string): PIIType | null {
    const typeMapping: Record<string, PIIType> = {
      'EMAIL': PIIType.EMAIL,
      'PHONE': PIIType.PHONE,
      'NAME': PIIType.NAME,
      'PERSON_NAME': PIIType.NAME, // AI often returns PERSON_NAME, map to NAME
      'URL': PIIType.URL,
      'CUSTOM': PIIType.CUSTOM
    }
    
    return typeMapping[aiType] || null
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
export const piiDetectorService = new BusinessAwarePIIDetectorService()
export default piiDetectorService 