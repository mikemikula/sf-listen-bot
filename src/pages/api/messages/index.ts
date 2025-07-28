/**
 * Messages API endpoint
 * Handles fetching and filtering messages
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import type { 
  ApiResponse, 
  PaginatedMessages, 
  MessageFilters,
  MessageDisplay 
} from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { piiDetectorService } from '@/lib/piiDetector'

/**
 * Parse query parameters into MessageFilters
 */
const parseFilters = (query: NextApiRequest['query']): MessageFilters => {
  return {
    channel: query.channel as string,
    userId: query.userId as string,
    search: query.search as string,
    startDate: query.startDate as string,
    endDate: query.endDate as string,
    page: query.page ? parseInt(query.page as string) : 1,
    limit: query.limit ? parseInt(query.limit as string) : 50,
  }
}

/**
 * Build Prisma where clause from filters
 */
const buildWhereClause = (filters: MessageFilters): object => {
  const where: any = {}

  if (filters.channel) {
    where.channel = filters.channel
  }

  if (filters.userId) {
    where.userId = filters.userId
  }

  if (filters.search) {
    where.text = {
      contains: filters.search,
      mode: 'insensitive'
    }
  }

  if (filters.startDate || filters.endDate) {
    where.timestamp = {}
    
    if (filters.startDate) {
      where.timestamp.gte = new Date(filters.startDate)
    }
    
    if (filters.endDate) {
      where.timestamp.lte = new Date(filters.endDate)
    }
  }

  return where
}

/**
 * Transform database messages to display format with thread support and PII replacements
 */
const transformMessages = async (messages: any[]): Promise<MessageDisplay[]> => {
  const transformedMessages = await Promise.all(messages.map(async (message) => {
    // Get the primary document relationship (there should only be one per message)
    const primaryDocRelation = message.documentMessages?.[0]
    
    // Apply PII replacements to message text
    let processedText = message.text
    if (message.piiDetections && message.piiDetections.length > 0) {
      try {
        processedText = await piiDetectorService.replacePII(message.text, message.piiDetections)
      } catch (error) {
        console.error(`Failed to apply PII replacements for message ${message.id}:`, error)
        // Fallback to original text if PII replacement fails
        processedText = message.text
      }
    }
    
    // Process thread replies with PII replacements
    const processedThreadReplies = message.threadReplies ? await Promise.all(
      message.threadReplies.map(async (reply: any) => {
        let processedReplyText = reply.text
        
        // Apply PII replacements to thread reply text
        if (reply.piiDetections && reply.piiDetections.length > 0) {
          try {
            processedReplyText = await piiDetectorService.replacePII(reply.text, reply.piiDetections)
          } catch (error) {
            console.error(`Failed to apply PII replacements for thread reply ${reply.id}:`, error)
            processedReplyText = reply.text
          }
        }
        
        return {
          ...reply,
          text: processedReplyText,
          timeAgo: formatDistanceToNow(new Date(reply.timestamp), { addSuffix: true }),
          channelName: reply.channel.startsWith('C') 
            ? `#${reply.channel.slice(1, 8)}` 
            : reply.channel,
          // Include PII detection status information for thread replies
          hasPIIDetections: !!reply.piiDetections?.length,
          piiDetectionCount: reply.piiDetections?.length || 0,
          piiPendingReview: reply.piiDetections?.filter((d: any) => d.status === 'PENDING_REVIEW').length || 0,
          piiWhitelisted: reply.piiDetections?.filter((d: any) => d.status === 'WHITELISTED').length || 0,
          piiAutoReplaced: reply.piiDetections?.filter((d: any) => d.status === 'AUTO_REPLACED').length || 0,
          piiDetections: reply.piiDetections || []
        }
      })
    ) : []
    
    return {
      ...message,
      text: processedText, // Use processed text with PII replacements
      timeAgo: formatDistanceToNow(new Date(message.timestamp), { addSuffix: true }),
      channelName: message.channel.startsWith('C') 
        ? `#channel-${message.channel.slice(-4)}` // Show last 4 chars for readability
        : message.channel,
      // Include thread information
      isThreadReply: message.isThreadReply || false,
      threadTs: message.threadTs || null,
      parentMessage: message.parentMessage || null,
      threadReplies: processedThreadReplies,
      // Include processing status information
      isProcessed: !!primaryDocRelation,
      documentId: primaryDocRelation?.documentId || null,
      documentTitle: primaryDocRelation?.document?.title || null,
      documentStatus: primaryDocRelation?.document?.status || null,
      messageRole: primaryDocRelation?.messageRole || null,
      processingConfidence: primaryDocRelation?.processingConfidence || null,
      // Include PII detection status information
      hasPIIDetections: !!message.piiDetections?.length,
      piiDetectionCount: message.piiDetections?.length || 0,
      piiPendingReview: message.piiDetections?.filter((d: any) => d.status === 'PENDING_REVIEW').length || 0,
      piiWhitelisted: message.piiDetections?.filter((d: any) => d.status === 'WHITELISTED').length || 0,
      piiAutoReplaced: message.piiDetections?.filter((d: any) => d.status === 'AUTO_REPLACED').length || 0,
      piiDetections: message.piiDetections || []
    }
  }))
  
  return transformedMessages
}

/**
 * Main messages handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<PaginatedMessages>>
): Promise<void> {
  
  // Disable caching for real-time data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  
  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    // Validate database connection first
    if (!db) {
      console.error('❌ Database client not initialized')
      return res.status(500).json({
        success: false,
        error: 'Database connection failed - client not initialized'
      })
    }

    // Test database connectivity
    await db.$queryRaw`SELECT 1`

    const filters = parseFilters(req.query)
    const page = filters.page || 1
    const limit = Math.min(filters.limit || 50, 100) // Max 100 per page
    const skip = (page - 1) * limit

    const whereClause = buildWhereClause(filters)

    // Modify where clause to exclude thread replies from the main query
    const mainMessagesWhere = {
      ...whereClause,
      isThreadReply: false // Only get parent messages, not thread replies
    }

    // Get total count for pagination (only parent messages)
    const total = await db.message.count({
      where: mainMessagesWhere
    })

    // Get messages with pagination and thread information
    const messages = await db.message.findMany({
      where: mainMessagesWhere,
      orderBy: {
        timestamp: 'desc'
      },
      skip,
      take: limit,
      include: {
        parentMessage: {
          select: {
            id: true,
            text: true,
            username: true,
            timestamp: true,
            slackId: true
          }
        },
        threadReplies: {
          orderBy: {
            timestamp: 'asc' // Replies ordered chronologically  
          },
          include: {
            // Include PII detection information for thread replies
            piiDetections: {
              select: {
                id: true,
                piiType: true,
                originalText: true,
                replacementText: true,
                confidence: true,
                status: true,
                reviewedBy: true,
                reviewedAt: true,
                createdAt: true
              }
            }
          }
        },
        // Include document relationship information
        documentMessages: {
          select: {
            documentId: true,
            messageRole: true,
            processingConfidence: true,
            document: {
              select: {
                id: true,
                title: true,
                status: true,
                createdAt: true
              }
            }
          }
        },
        // Include PII detection information
        piiDetections: {
          select: {
            id: true,
            piiType: true,
            originalText: true,
            replacementText: true,
            confidence: true,
            status: true,
            reviewedBy: true,
            reviewedAt: true,
            createdAt: true
          }
        }
      }
    })

    // Transform messages for display with PII replacements
    const displayMessages = await transformMessages(messages)

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit)
    const hasNext = page < totalPages
    const hasPrev = page > 1

    const response: PaginatedMessages = {
      messages: displayMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev
      }
    }

    return res.status(200).json({
      success: true,
      data: response
    })

  } catch (error) {
    console.error('❌ Messages API error:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown error type',
      databaseUrl: process.env.DATABASE_URL ? 'Set' : 'Not set',
      nodeEnv: process.env.NODE_ENV || 'Not set'
    })
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
} 