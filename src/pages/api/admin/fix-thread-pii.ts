import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { piiDetectorService } from '@/lib/piiDetector'
import { logger } from '@/lib/logger'
import type { PIISourceType } from '@/types'

interface FixResult {
  success: boolean
  results?: {
    processed: number
    piiDetected: number
    details: Array<{
      messageId: string
      text: string
      piiCount: number
    }>
  }
  error?: string
}

/**
 * Fix PII detection for thread replies that missed it
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FixResult>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    logger.info('Starting thread reply PII detection fix...')

    // Find all thread replies that don't have PII detections but should
    const threadReplies = await db.message.findMany({
      where: {
        isThreadReply: true
      },
      include: {
        piiDetections: true
      }
    })

    logger.info(`Found ${threadReplies.length} thread replies to check`)

    const results = {
      processed: 0,
      piiDetected: 0,
      details: [] as Array<{
        messageId: string
        text: string
        piiCount: number
      }>
    }

    for (const reply of threadReplies) {
      try {
        // Check if the reply text contains obvious PII patterns
        const hasEmailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(reply.text)
        const hasPhonePattern = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/.test(reply.text)
        
        // Skip if no obvious PII patterns
        if (!hasEmailPattern && !hasPhonePattern) {
          continue
        }

        logger.info(`Processing thread reply ${reply.id}: ${reply.text.substring(0, 50)}...`)

        // Remove existing PII detections (if any)
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

        results.processed++
        
        if (newDetections.length > 0) {
          results.piiDetected++
          logger.info(`✅ Fixed PII detection for thread reply ${reply.id}: ${newDetections.length} detections`)
        } else {
          logger.info(`❌ No PII detected in thread reply ${reply.id} (this might be expected)`)
        }

        results.details.push({
          messageId: reply.id,
          text: reply.text.substring(0, 100),
          piiCount: newDetections.length
        })

      } catch (error) {
        logger.error(`Failed to fix PII detection for reply ${reply.id}:`, error)
      }
    }

    logger.info(`Thread reply PII fix completed: ${results.processed} processed, ${results.piiDetected} with PII`)

    return res.status(200).json({
      success: true,
      results
    })

  } catch (error) {
    logger.error('Thread reply PII fix failed:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 