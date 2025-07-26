/**
 * Message deletions API endpoint
 * Handles message deletion events and notifies connected clients
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/types'

interface DeletionPayload {
  slackId: string
  channel: string
}

/**
 * Handle message deletion notifications
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
): Promise<void> {

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    const { slackId, channel }: DeletionPayload = req.body

    if (!slackId || !channel) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: slackId, channel'
      })
    }

    // Find the message before deleting it (for notification purposes)
    const messageToDelete = await db.message.findFirst({
      where: {
        slackId,
        channel
      }
    })

    if (!messageToDelete) {
      logger.warn(`Message not found for deletion: ${slackId} in ${channel}`)
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      })
    }

    // Delete the message from database
    const deletionResult = await db.message.deleteMany({
      where: {
        slackId,
        channel
      }
    })

    logger.info(`Message deleted: ${messageToDelete.id} (${deletionResult.count} records)`)

    return res.status(200).json({
      success: true,
      data: {
        deletedMessageId: messageToDelete.id,
        slackId,
        channel,
        deletedCount: deletionResult.count
      },
      message: 'Message deletion processed successfully'
    })

  } catch (error) {
    logger.error('Message deletion error:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
} 