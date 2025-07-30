/**
 * Slack Event Processor
 * Handles Slack webhook events with proper error handling, audit trail, and recovery
 */

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { piiDetectorService } from '@/lib/piiDetector'
import { 
  parseSlackTimestamp, 
  formatUsername, 
  isMessageDeletion, 
  isMessageEdit 
} from '@/lib/slack'
import type { SlackWebhookPayload, PIISourceType } from '@/types'

export enum EventProcessingResult {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  DUPLICATE = 'DUPLICATE'
}

interface ProcessingResult {
  result: EventProcessingResult
  message?: string
  data?: any
  error?: Error
}

interface ProcessingOptions {
  skipPIIDetection?: boolean
}

/**
 * Process a Slack webhook event with full transaction logging
 */
export const processSlackEvent = async (
  payload: SlackWebhookPayload,
  rawPayload: string,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> => {
  const eventId = payload.event_id || `${Date.now()}-${Math.random()}`
  
  // First, log the incoming event
  const slackEvent = await db.slackEvent.create({
    data: {
      slackEventId: eventId,
      eventType: payload.type,
      eventSubtype: payload.event?.subtype || null,
      payload: JSON.parse(rawPayload),
      channel: payload.event?.channel || null,
      status: 'PENDING',
      attempts: 0
    }
  })

  logger.info(`Processing Slack event: ${eventId} (${payload.type})`)

  try {
    // Update status to processing
    await db.slackEvent.update({
      where: { id: slackEvent.id },
      data: { 
        status: 'PROCESSING', 
        attempts: 1,
        lastAttemptAt: new Date()
      }
    })

    // Handle URL verification (no further processing needed)
    if (payload.type === 'url_verification') {
      await db.slackEvent.update({
        where: { id: slackEvent.id },
        data: { status: 'SUCCESS' }
      })
      
      return {
        result: EventProcessingResult.SUCCESS,
        message: 'URL verification processed',
        data: { challenge: payload.challenge }
      }
    }

    // Handle event callbacks
    if (payload.type === 'event_callback' && payload.event) {
      const result = await processMessageEvent(payload.event, slackEvent.id)
      
      // Update event status based on result
      await db.slackEvent.update({
        where: { id: slackEvent.id },
        data: { 
          status: result.result === EventProcessingResult.SUCCESS ? 'SUCCESS' : 
                  result.result === EventProcessingResult.SKIPPED ? 'SKIPPED' : 'FAILED',
          errorMessage: result.error?.message || null,
          messageId: result.data?.messageId || null
        }
      })

      return result
    }

    // Unknown event type
    await db.slackEvent.update({
      where: { id: slackEvent.id },
      data: { 
        status: 'SKIPPED',
        errorMessage: 'Unknown event type'
      }
    })

    return {
      result: EventProcessingResult.SKIPPED,
      message: 'Unknown event type'
    }

  } catch (error) {
    logger.error('Event processing failed:', error)

    // Update event with error
    await db.slackEvent.update({
      where: { id: slackEvent.id },
      data: { 
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    })

    return {
      result: EventProcessingResult.FAILED,
      error: error instanceof Error ? error : new Error('Unknown error')
    }
  }
}

/**
 * Process message-related events (new, edit, delete)
 */
const processMessageEvent = async (
  event: any,
  slackEventId: string
): Promise<ProcessingResult> => {
  
  // Handle message deletions
  if (isMessageDeletion(event)) {
    const deletedMessageId = event.deleted_ts
    
    if (!deletedMessageId) {
      throw new Error('Missing deleted message timestamp')
    }

    logger.info(`Processing message deletion for slackId: ${deletedMessageId}, channel: ${event.channel}`)

    // Get message records before deletion to clean up PII detections
    const messagesToDelete = await db.message.findMany({
      where: {
        slackId: deletedMessageId,
        channel: event.channel
      },
      select: { id: true, isThreadReply: true, text: true }
    })

    if (messagesToDelete.length === 0) {
      logger.warn(`No messages found for deletion with slackId: ${deletedMessageId}`)
      return {
        result: EventProcessingResult.SKIPPED,
        message: 'No messages found for deletion'
      }
    }

    logger.info(`Found ${messagesToDelete.length} message(s) to delete:`, messagesToDelete.map(m => ({ id: m.id, isThreadReply: m.isThreadReply, text: m.text.substring(0, 50) })))

    const deletedMessage = await db.message.deleteMany({
      where: {
        slackId: deletedMessageId,
        channel: event.channel
      }
    })

    // Clean up associated PII detections
    if (messagesToDelete.length > 0) {
      try {
        const messageIds = messagesToDelete.map(m => m.id)
        const deletedPII = await db.pIIDetection.deleteMany({
          where: {
            sourceType: 'MESSAGE',
            sourceId: { in: messageIds }
          }
        })
        
        if (deletedPII.count > 0) {
          logger.info(`Cleaned up ${deletedPII.count} PII detections for deleted messages`)
        }
        
      } catch (piiError) {
        logger.error(`Failed to clean up PII detections for deleted message ${deletedMessageId}:`, piiError)
      }
    }

    logger.slack(`Message deleted: ${deletedMessageId} in channel ${event.channel} (${deletedMessage.count} records deleted, including ${messagesToDelete.filter(m => m.isThreadReply).length} thread replies)`)
    
    return {
      result: EventProcessingResult.SUCCESS,
      message: 'Message deletion processed',
      data: { 
        deletedSlackId: deletedMessageId,
        deletedCount: deletedMessage.count,
        threadRepliesDeleted: messagesToDelete.filter(m => m.isThreadReply).length
      }
    }
  }

  // Handle message edits
  if (isMessageEdit(event)) {
    const editedMessage = event.message
    const previousMessage = event.previous_message

    if (!editedMessage || !previousMessage) {
      throw new Error('Missing edited message data')
    }

    const updatedMessage = await db.message.updateMany({
      where: {
        slackId: editedMessage.ts,
        channel: event.channel
      },
      data: {
        text: editedMessage.text,
        updatedAt: new Date()
      }
    })

    logger.slack(`Message edited: ${editedMessage.ts} (${updatedMessage.count} records)`)
    
    // Re-run PII detection on edited message
    if (updatedMessage.count > 0) {
      try {
        // Get the updated message record to get its ID
        const messageRecord = await db.message.findFirst({
          where: {
            slackId: editedMessage.ts,
            channel: event.channel
          }
        })
        
        if (messageRecord) {
          // Remove old PII detections for this message
          await db.pIIDetection.deleteMany({
            where: {
              sourceType: 'MESSAGE',
              sourceId: messageRecord.id
            }
          })
          
          // Run new PII detection
          const piiDetections = await piiDetectorService.detectPII(
            editedMessage.text,
            'MESSAGE' as PIISourceType,
            messageRecord.id,
            {
              useAI: true,
              preserveBusinessEmails: true,
              confidenceThreshold: 0.7
            }
          )
          
          if (piiDetections.length > 0) {
            logger.info(`PII detection re-run for edited message ${messageRecord.id}: ${piiDetections.length} items detected`)
          }
        }
        
      } catch (piiError) {
        // Don't fail message edit processing if PII detection fails
        logger.error(`PII detection failed for edited message ${editedMessage.ts}:`, piiError)
      }
    }
    
    return {
      result: EventProcessingResult.SUCCESS,
      message: 'Message edit processed',
      data: { 
        editedSlackId: editedMessage.ts,
        updatedCount: updatedMessage.count,
        newText: editedMessage.text,
        previousText: previousMessage.text
      }
    }
  }

  // Handle regular message creation
  if (event.type === 'message' && event.text && event.user) {
    
    // Check for duplicate message (idempotency)
    const existingMessage = await db.message.findFirst({
      where: {
        slackId: event.ts,
        channel: event.channel
      }
    })

    if (existingMessage) {
      logger.warn(`Duplicate message detected: ${event.ts}`)
      return {
        result: EventProcessingResult.DUPLICATE,
        message: 'Duplicate message ignored',
        data: { messageId: existingMessage.id }
      }
    }

    // Determine thread information
    const threadTs = event.thread_ts || null
    const isThreadReply = Boolean(threadTs && threadTs !== event.ts)
    let parentMessageId = null
    
    // If this is a thread reply, find the parent message
    if (isThreadReply) {
      const parentMessage = await db.message.findFirst({
        where: {
          slackId: threadTs,
          channel: event.channel
        }
      })
      parentMessageId = parentMessage?.id || null
    }

    const message = await db.message.create({
      data: {
        slackId: event.ts,
        text: event.text,
        userId: event.user,
        username: formatUsername(event.user),
        channel: event.channel,
        timestamp: parseSlackTimestamp(event.ts),
        threadTs: threadTs,
        isThreadReply: isThreadReply,
        parentMessageId: parentMessageId,
      }
    })

    logger.slack(`Message stored: ${message.id} (isThreadReply: ${isThreadReply})`)
    
    // Perform PII detection on new message (if not skipped)
    if (!options.skipPIIDetection) {
      try {
        logger.info(`Starting PII detection for message ${message.id} (isThreadReply: ${isThreadReply}, text length: ${message.text.length})`)
        
        const piiDetections = await piiDetectorService.detectPII(
          message.text,
          'MESSAGE' as PIISourceType,
          message.id,
          {
            useAI: true,
            preserveBusinessEmails: true,
            confidenceThreshold: 0.7
          }
        )
        
        if (piiDetections.length > 0) {
          logger.info(`✅ PII detection completed for message ${message.id} (isThreadReply: ${isThreadReply}): ${piiDetections.length} items detected`)
        } else {
          logger.info(`✅ PII detection completed for message ${message.id} (isThreadReply: ${isThreadReply}): No PII detected`)
        }
        
      } catch (piiError) {
        // Don't fail message processing if PII detection fails
        logger.error(`❌ PII detection FAILED for message ${message.id} (isThreadReply: ${isThreadReply}):`, piiError)
      }
    } else {
      logger.info(`⚡ Skipping PII detection for message ${message.id} (bulk import mode)`)
    }
    
    return {
      result: EventProcessingResult.SUCCESS,
      message: 'Message processed successfully',
      data: { 
        messageId: message.id,
        piiDetected: true // Always true since we attempted detection
      }
    }
  }

  return {
    result: EventProcessingResult.SKIPPED,
    message: 'Event does not match processing criteria'
  }
}

/**
 * Retry failed events
 */
export const retryFailedEvents = async (maxRetries: number = 3): Promise<void> => {
  const failedEvents = await db.slackEvent.findMany({
    where: {
      status: 'FAILED',
      attempts: {
        lt: maxRetries
      }
    },
    orderBy: {
      createdAt: 'asc'
    },
    take: 100 // Process in batches
  })

  logger.info(`Retrying ${failedEvents.length} failed events`)

  for (const event of failedEvents) {
    try {
      // Update attempt count
      await db.slackEvent.update({
        where: { id: event.id },
        data: { 
          attempts: event.attempts + 1,
          lastAttemptAt: new Date(),
          status: 'PROCESSING'
        }
      })

      // Retry processing
      const payload = event.payload as unknown as SlackWebhookPayload
      const result = await processSlackEvent(payload, JSON.stringify(payload))

      logger.info(`Retry result for event ${event.id}: ${result.result}`)

    } catch (error) {
      logger.error(`Retry failed for event ${event.id}:`, error)
    }
  }
}

/**
 * Get event processing statistics
 */
export const getEventStats = async () => {
  const stats = await db.slackEvent.groupBy({
    by: ['status'],
    _count: {
      status: true
    }
  })

  const total = await db.slackEvent.count()
  
  return {
    total,
    byStatus: stats.reduce((acc: Record<string, number>, stat: any) => {
      acc[stat.status] = stat._count.status
      return acc
    }, {} as Record<string, number>)
  }
} 