import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { piiDetectorService } from '@/lib/piiDetector'
import { logger } from '@/lib/logger'
import type { PIISourceType } from '@/types'

interface ThreadPIIResult {
  success: boolean
  threadData?: {
    parentText: string
    replies: Array<{
      id: string
      text: string
      piiDetections: Array<{
        id: string
        piiType: string
        originalText: string
        status: string
      }>
      newPIIDetected?: number
    }>
  }
  error?: string
}

/**
 * Admin endpoint to check and re-run PII detection on thread replies
 * This helps diagnose why new thread messages aren't getting PII detection
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ThreadPIIResult>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    const { threadTs, channel, rerun = false } = req.body as { 
      threadTs?: string
      channel?: string
      rerun?: boolean
    }

    if (!threadTs || !channel) {
      return res.status(400).json({
        success: false,
        error: 'threadTs and channel are required'
      })
    }

    logger.info(`Checking thread PII for threadTs: ${threadTs}, channel: ${channel}`)

    // Get the parent message and all thread replies
    const parentMessage = await db.message.findFirst({
      where: {
        slackId: threadTs,
        channel: channel
      }
    })

    if (!parentMessage) {
      return res.status(404).json({
        success: false,
        error: 'Parent message not found'
      })
    }

    const threadReplies = await db.message.findMany({
      where: {
        threadTs: threadTs,
        channel: channel,
        isThreadReply: true
      },
      include: {
        piiDetections: true
      },
      orderBy: {
        timestamp: 'asc'
      }
    })

    logger.info(`Found ${threadReplies.length} thread replies`)

    const repliesData = []

    for (const reply of threadReplies) {
      const replyData = {
        id: reply.id,
        text: reply.text.substring(0, 100),
        piiDetections: reply.piiDetections.map(p => ({
          id: p.id,
          piiType: p.piiType,
          originalText: p.originalText,
          status: p.status
        })),
        newPIIDetected: 0
      }

      // If rerun flag is set, re-run PII detection
      if (rerun) {
        try {
          logger.info(`Re-running PII detection for thread reply ${reply.id}`)
          
          // Remove existing PII detections
          await db.pIIDetection.deleteMany({
            where: {
              sourceType: 'MESSAGE',
              sourceId: reply.id
            }
          })

          // Run fresh PII detection
          const newDetections = await piiDetectorService.detectPII(
            reply.text,
            'MESSAGE' as PIISourceType,
            reply.id,
            {
              useAI: true,
              preserveBusinessEmails: true,
              confidenceThreshold: 0.7
            }
          )

          replyData.newPIIDetected = newDetections.length
          
          if (newDetections.length > 0) {
            logger.info(`Found ${newDetections.length} new PII detections in thread reply ${reply.id}`)
          }

        } catch (error) {
          logger.error(`Failed to re-run PII detection for reply ${reply.id}:`, error)
        }
      }

      repliesData.push(replyData)
    }

    return res.status(200).json({
      success: true,
      threadData: {
        parentText: parentMessage.text.substring(0, 100),
        replies: repliesData
      }
    })

  } catch (error) {
    logger.error('Thread PII check failed:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 