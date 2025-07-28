import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

interface CleanupResult {
  success: boolean
  orphanedCount?: number
  cleanedCount?: number
  threadReplies?: Array<{
    id: string
    slackId: string
    text: string
    username: string
    timestamp: string
    parentText?: string
  }>
  error?: string
}

/**
 * Admin endpoint to clean up orphaned messages
 * Messages that were deleted in Slack but still exist in our database
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CleanupResult>
) {
  try {
    if (req.method === 'GET') {
      // Return information about potential orphans for manual review
      const threadReplies = await db.message.findMany({
        where: {
          isThreadReply: true
        },
        include: {
          parentMessage: {
            select: {
              text: true
            }
          },
          piiDetections: true
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: 50
      })

      const threadRepliesInfo = threadReplies.map(reply => ({
        id: reply.id,
        slackId: reply.slackId,
        text: reply.text.substring(0, 100),
        username: reply.username,
        timestamp: reply.timestamp.toISOString(),
        parentText: reply.parentMessage?.text?.substring(0, 50)
      }))

      return res.status(200).json({
        success: true,
        threadReplies: threadRepliesInfo
      })
    }

    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      })
    }

    const { messageIds } = req.body as { messageIds?: string[] }

    logger.info('Starting orphaned message cleanup...')

    if (!messageIds || messageIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No message IDs provided for cleanup'
      })
    }

    // Find the specific messages to clean up
    const messagesToClean = await db.message.findMany({
      where: {
        id: { in: messageIds }
      },
      include: {
        piiDetections: true
      }
    })

    if (messagesToClean.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No messages found with provided IDs'
      })
    }

    // Clean up orphaned messages and their PII detections
    let cleanedCount = 0
    
    for (const message of messagesToClean) {
      try {
        // Clean up PII detections first
        if (message.piiDetections.length > 0) {
          await db.pIIDetection.deleteMany({
            where: {
              sourceType: 'MESSAGE',
              sourceId: message.id
            }
          })
          logger.info(`Cleaned up ${message.piiDetections.length} PII detections for message ${message.id}`)
        }

        // Delete the message
        await db.message.delete({
          where: {
            id: message.id
          }
        })

        logger.info(`Cleaned up orphaned message: ${message.slackId} (${message.text.substring(0, 50)}...)`)
        cleanedCount++

      } catch (error) {
        logger.error(`Failed to clean up message ${message.id}:`, error)
      }
    }

    logger.info(`Orphaned message cleanup completed: ${cleanedCount} messages cleaned`)

    return res.status(200).json({
      success: true,
      orphanedCount: messagesToClean.length,
      cleanedCount
    })

  } catch (error) {
    logger.error('Orphaned message cleanup failed:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 