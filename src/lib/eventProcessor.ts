/**
 * Slack Event Processor
 * Handles Slack webhook events with proper error handling, audit trail, and recovery
 */

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { 
  parseSlackTimestamp, 
  formatUsername, 
  isMessageDeletion, 
  isMessageEdit 
} from '@/lib/slack'
import type { SlackWebhookPayload } from '@/types'

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

/**
 * Process a Slack webhook event with full transaction logging
 */
export const processSlackEvent = async (
  payload: SlackWebhookPayload,
  rawPayload: string
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

    const deletedMessage = await db.message.deleteMany({
      where: {
        slackId: deletedMessageId,
        channel: event.channel
      }
    })

    logger.slack(`Message deleted: ${deletedMessageId} (${deletedMessage.count} records)`)
    
    return {
      result: EventProcessingResult.SUCCESS,
      message: 'Message deletion processed',
      data: { 
        deletedSlackId: deletedMessageId,
        deletedCount: deletedMessage.count 
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

    const message = await db.message.create({
      data: {
        slackId: event.ts,
        text: event.text,
        userId: event.user,
        username: formatUsername(event.user),
        channel: event.channel,
        timestamp: parseSlackTimestamp(event.ts),
      }
    })

    logger.slack(`Message stored: ${message.id}`)
    
    return {
      result: EventProcessingResult.SUCCESS,
      message: 'Message processed successfully',
      data: { messageId: message.id }
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