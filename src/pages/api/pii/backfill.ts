/**
 * PII Backfill API Endpoint
 * Runs PII detection on existing messages that were stored before PII integration
 * Supports batch processing with progress tracking
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { piiDetectorService } from '@/lib/piiDetector'
import { logger } from '@/lib/logger'
import { PIISourceType } from '@/types'

/**
 * Handle PII backfill operations
 * POST: Start PII detection backfill process
 * GET: Check backfill progress/status
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  try {
    switch (req.method) {
      case 'POST':
        await handleBackfillStart(req, res)
        break
      case 'GET':
        await handleBackfillStatus(req, res)
        break
      default:
        res.setHeader('Allow', ['POST', 'GET'])
        res.status(405).json({ 
          error: 'Method not allowed',
          allowedMethods: ['POST', 'GET']
        })
    }
  } catch (error) {
    logger.error('PII backfill API error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * POST /api/pii/backfill - Start PII detection backfill
 * Body: {
 *   batchSize?: number,
 *   skipExisting?: boolean,
 *   dryRun?: boolean
 * }
 */
async function handleBackfillStart(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const { 
    batchSize = 100, 
    skipExisting = true,
    dryRun = false 
  } = req.body

  // Validate parameters
  if (batchSize < 1 || batchSize > 1000) {
    res.status(400).json({ 
      error: 'Invalid batchSize. Must be between 1 and 1000.' 
    })
    return
  }

  try {
    // Get messages that need PII detection
    const whereClause: any = {}
    
    if (skipExisting) {
      // Only process messages without existing PII detections
      whereClause.piiDetections = {
        none: {}
      }
    }

    // Count total messages to process
    const totalMessages = await db.message.count({
      where: whereClause
    })

    if (totalMessages === 0) {
      res.json({
        success: true,
        message: 'No messages need PII detection',
        stats: {
          totalMessages: 0,
          processed: 0,
          skipped: 0,
          errors: 0
        }
      })
      return
    }

    if (dryRun) {
      res.json({
        success: true,
        message: `Dry run: Would process ${totalMessages} messages`,
        stats: {
          totalMessages,
          processed: 0,
          skipped: 0,
          errors: 0
        },
        dryRun: true
      })
      return
    }

    // Process messages in batches
    let processed = 0
    let skipped = 0
    let errors = 0
    const startTime = Date.now()

    logger.info(`Starting PII backfill for ${totalMessages} messages (batch size: ${batchSize})`)

    // Process in batches to avoid memory issues
    for (let offset = 0; offset < totalMessages; offset += batchSize) {
      const messages = await db.message.findMany({
        where: whereClause,
        skip: offset,
        take: batchSize,
        select: {
          id: true,
          text: true,
          slackId: true,
          username: true,
          channel: true
        }
      })

      // Process each message in the batch
      for (const message of messages) {
        try {
          // Skip empty messages
          if (!message.text || message.text.trim().length === 0) {
            skipped++
            continue
          }

          // Run PII detection
          const piiDetections = await piiDetectorService.detectPII(
            message.text,
            PIISourceType.MESSAGE,
            message.id,
            {
              useAI: true,
              preserveBusinessEmails: true,
              confidenceThreshold: 0.7
            }
          )

          processed++

          if (piiDetections.length > 0) {
            logger.debug(`PII backfill: Message ${message.id} - ${piiDetections.length} detections`)
          }

        } catch (error) {
          errors++
          logger.error(`PII backfill failed for message ${message.id}:`, error)
        }
      }

      // Log progress every 10 batches
      if ((offset / batchSize) % 10 === 0) {
        const progress = Math.round((processed + skipped + errors) / totalMessages * 100)
        logger.info(`PII backfill progress: ${progress}% (${processed + skipped + errors}/${totalMessages})`)
      }
    }

    const duration = Date.now() - startTime
    const stats = {
      totalMessages,
      processed,
      skipped,
      errors,
      durationMs: duration,
      messagesPerSecond: Math.round((processed / duration) * 1000)
    }

    logger.info(`PII backfill completed:`, stats)

    res.json({
      success: true,
      message: `PII backfill completed successfully`,
      stats
    })

  } catch (error) {
    logger.error('PII backfill failed:', error)
    res.status(500).json({ 
      error: 'Failed to run PII backfill',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * GET /api/pii/backfill - Get backfill status and statistics
 */
async function handleBackfillStatus(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  try {
    // Get overall statistics
    const [
      totalMessages,
      messagesWithPII,
      totalDetections,
      pendingReviews
    ] = await Promise.all([
      db.message.count(),
      db.message.count({
        where: {
          piiDetections: {
            some: {}
          }
        }
      }),
      db.pIIDetection.count(),
      db.pIIDetection.count({
        where: {
          status: 'PENDING_REVIEW'
        }
      })
    ])

    // Get PII detection coverage by type
    const detectionsByType = await db.pIIDetection.groupBy({
      by: ['piiType'],
      _count: {
        id: true
      }
    })

    // Get recent detection activity
    const recentDetections = await db.pIIDetection.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        piiType: true,
        status: true,
        confidence: true,
        createdAt: true
      }
    })

    const coverage = totalMessages > 0 ? Math.round((messagesWithPII / totalMessages) * 100) : 0

    res.json({
      success: true,
      data: {
        overview: {
          totalMessages,
          messagesWithPII,
          messagesWithoutPII: totalMessages - messagesWithPII,
          totalDetections,
          pendingReviews,
          coveragePercentage: coverage
        },
        detectionsByType: detectionsByType.reduce((acc, item) => {
          acc[item.piiType] = item._count.id
          return acc
        }, {} as Record<string, number>),
        recentActivity: recentDetections,
        recommendations: getBackfillRecommendations(
          totalMessages, 
          messagesWithPII, 
          pendingReviews
        )
      }
    })

  } catch (error) {
    logger.error('Failed to get PII backfill status:', error)
    res.status(500).json({ 
      error: 'Failed to get backfill status',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Generate backfill recommendations based on current state
 */
function getBackfillRecommendations(
  totalMessages: number,
  messagesWithPII: number,
  pendingReviews: number
): string[] {
  const recommendations: string[] = []
  const coverage = totalMessages > 0 ? (messagesWithPII / totalMessages) * 100 : 0

  if (coverage < 50) {
    recommendations.push('Run PII backfill to scan existing messages')
  }

  if (pendingReviews > 50) {
    recommendations.push('Review pending PII detections to improve accuracy')
  }

  if (coverage > 90 && pendingReviews === 0) {
    recommendations.push('PII detection is up to date - no action needed')
  }

  if (totalMessages > 10000 && coverage < 100) {
    recommendations.push('Consider running backfill in smaller batches during off-peak hours')
  }

  return recommendations
} 