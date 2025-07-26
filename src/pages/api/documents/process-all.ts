/**
 * Process All Unprocessed Messages API Endpoint
 * One-click solution to automatically create documents from all unprocessed Slack messages
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { backgroundJobService } from '@/lib/backgroundJobs'
import { documentProcessorService } from '@/lib/documentProcessor'
import { ApiResponse, DocumentDisplay, DocumentProcessingInput } from '@/types'

interface ProcessAllResponse {
  documents?: DocumentDisplay[]
  jobIds?: string[]
  message: string
  stats: {
    totalMessages: number
    documentsCreated: number
    messagesProcessed: number
  }
}

/**
 * Handle POST request - Process all unprocessed messages
 */
async function handleProcessAllMessages(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ProcessAllResponse>>
) {
  try {
    const { 
      useBackgroundJob = false,
      batchSize = 20, // Process messages in batches
      options = {}
    } = req.body

    logger.info('Starting bulk processing of all unprocessed messages')

    // Step 1: Find all unprocessed messages
    const unprocessedMessages = await db.message.findMany({
      where: {
        // Messages that aren't part of any document yet
        documentMessages: {
          none: {}
        }
      },
      orderBy: {
        timestamp: 'desc' // Process newest first
      },
      take: 100 // Limit to prevent overwhelming the system
    })

    if (unprocessedMessages.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          documents: [],
          message: 'No unprocessed messages found',
          stats: {
            totalMessages: 0,
            documentsCreated: 0,
            messagesProcessed: 0
          }
        }
      })
    }

    logger.info(`Found ${unprocessedMessages.length} unprocessed messages`)

    // Step 2: Group messages by conversation/thread for better document creation
    const messageGroups = groupMessagesByConversation(unprocessedMessages, batchSize)
    
    logger.info(`Grouped into ${messageGroups.length} conversation batches`)

    const documents: DocumentDisplay[] = []
    const jobIds: string[] = []
    let totalProcessed = 0

    // Step 3: Process each group
    for (let index = 0; index < messageGroups.length; index++) {
      const messageGroup = messageGroups[index]
      const messageIds = messageGroup.map((msg: any) => msg.id)
      
      const processingInput: DocumentProcessingInput = {
        messageIds,
        userId: options.userId || 'system'
      }

      if (useBackgroundJob) {
        // Use background job for async processing
        try {
          const jobId = await backgroundJobService.addDocumentProcessingJob(processingInput, {
            priority: 1, // High priority for bulk processing
            delay: index * 2000 // Stagger jobs to prevent API overload
          })
          
          jobIds.push(jobId)
          logger.info(`Created background job ${jobId} for batch ${index + 1}`)
        } catch (error) {
          logger.error(`Failed to create background job for batch ${index + 1}:`, error)
          // Continue with synchronous processing for this batch
        }
      }

      if (!useBackgroundJob || jobIds.length === 0) {
        // Synchronous processing
        try {
          logger.info(`Processing batch ${index + 1}/${messageGroups.length} (${messageIds.length} messages)`)
          
          const result = await documentProcessorService.processMessagesIntoDocument(processingInput)
          
          // Get the created document with stats
          const documentWithStats = await db.processedDocument.findUnique({
            where: { id: result.document.id },
            include: {
              documentMessages: {
                include: {
                  message: true
                }
              },
              documentFAQs: true
            }
          })

          if (documentWithStats) {
            // Transform to display format
            const participants = Array.from(new Set(documentWithStats.documentMessages.map((dm: any) => dm.message?.username).filter(Boolean))) as string[]
            const channelNames = Array.from(new Set(documentWithStats.documentMessages.map((dm: any) => dm.message?.channel).filter(Boolean))) as string[]
            const lastActivity = documentWithStats.updatedAt > documentWithStats.createdAt ? documentWithStats.updatedAt : documentWithStats.createdAt

            const documentDisplay: DocumentDisplay = {
              id: documentWithStats.id,
              title: documentWithStats.title,
              description: documentWithStats.description || '',
              category: documentWithStats.category,
              status: documentWithStats.status,
              processingJobId: documentWithStats.processingJobId,
              confidenceScore: documentWithStats.confidenceScore,
              createdBy: documentWithStats.createdBy,
              messageCount: documentWithStats.documentMessages.length,
              faqCount: documentWithStats.documentFAQs.length,
              participantCount: participants.length,
              participants,
              channelNames,
              lastActivity,
              timeAgo: getTimeAgo(lastActivity),
              createdAt: documentWithStats.createdAt,
              updatedAt: documentWithStats.updatedAt
            }

            documents.push(documentDisplay)
            totalProcessed += messageIds.length
            
            logger.info(`Created document: "${documentDisplay.title}" from ${messageIds.length} messages`)
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          
          // Check if it's a rate limit error
          if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
            logger.warn(`Rate limit hit during batch ${index + 1} processing:`, error)
            // Return early with helpful message about rate limits
            return res.status(429).json({
              success: false,
              error: 'Gemini API quota exceeded. Please wait for quota to reset (typically resets daily) or upgrade your Gemini API plan for higher limits.',
              data: {
                message: `Processed ${documents.length} documents before hitting rate limits`,
                stats: {
                  totalMessages: unprocessedMessages.length,
                  documentsCreated: documents.length,
                  messagesProcessed: totalProcessed
                },
                documents: documents.length > 0 ? documents : undefined
              }
            })
          }
          
          logger.error(`Failed to process batch ${index + 1}:`, error)
          // Continue with next batch for other types of errors
        }
      }

      // Add small delay between synchronous processing to prevent API overload
      if (!useBackgroundJob && index < messageGroups.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    const response: ProcessAllResponse = {
      message: useBackgroundJob && jobIds.length > 0
        ? `Started ${jobIds.length} background jobs to process ${unprocessedMessages.length} messages`
        : `Successfully created ${documents.length} documents from ${totalProcessed} messages`,
      stats: {
        totalMessages: unprocessedMessages.length,
        documentsCreated: useBackgroundJob ? 0 : documents.length, // Background jobs haven't completed yet
        messagesProcessed: totalProcessed
      }
    }

    if (useBackgroundJob && jobIds.length > 0) {
      response.jobIds = jobIds
    } else {
      response.documents = documents
    }

    return res.status(200).json({
      success: true,
      data: response
    })

  } catch (error) {
    logger.error('Bulk document processing failed:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Group messages by conversation/channel for better document creation
 */
function groupMessagesByConversation(messages: any[], batchSize: number): any[][] {
  // Group by channel and time proximity
  const channelGroups: { [key: string]: any[] } = {}
  
  messages.forEach(message => {
    const key = message.channel
    if (!channelGroups[key]) {
      channelGroups[key] = []
    }
    channelGroups[key].push(message)
  })

  const groups: any[][] = []
  
  // Create batches within each channel
  Object.values(channelGroups).forEach(channelMessages => {
    // Sort by timestamp
    channelMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    
    // Create batches of batchSize
    for (let i = 0; i < channelMessages.length; i += batchSize) {
      const batch = channelMessages.slice(i, i + batchSize)
      groups.push(batch)
    }
  })

  return groups
}

/**
 * Utility function to calculate time ago
 */
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) {
    return 'just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return date.toLocaleDateString()
  }
}

/**
 * Main API handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) {
  const { method } = req

  try {
    switch (method) {
      case 'POST':
        return await handleProcessAllMessages(req, res)
        
      default:
        res.setHeader('Allow', ['POST'])
        return res.status(405).json({
          success: false,
          error: `Method ${method} not allowed`
        })
    }
  } catch (error) {
    logger.error('Process all API handler error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
} 