/**
 * PII Review API Endpoint
 * Allows users to review and override PII detections
 * Implements CRUD operations for PII review management
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '@/lib/logger'
import { piiDetectorService } from '@/lib/piiDetector'
import { PIIStatus } from '@/types'

/**
 * Handle PII review operations
 * GET: Fetch pending PII reviews
 * PUT: Update PII detection status (whitelist/flag)
 * POST: Bulk update multiple PII detections
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  try {
    switch (req.method) {
      case 'GET':
        await handleGetPendingReviews(req, res)
        break
      case 'PUT':
        await handleUpdatePIIStatus(req, res)
        break
      case 'POST':
        await handleBulkUpdatePII(req, res)
        break
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'POST'])
        res.status(405).json({ 
          error: 'Method not allowed',
          allowedMethods: ['GET', 'PUT', 'POST']
        })
    }
  } catch (error) {
    logger.error('PII review API error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * GET /api/pii/review - Fetch pending PII reviews
 * Query params:
 * - limit: number of items to return (default: 50)
 * - offset: pagination offset (default: 0)
 * - status: filter by status (optional)
 */
async function handleGetPendingReviews(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const { 
    limit = '50', 
    offset = '0',
    status 
  } = req.query

  const limitNum = parseInt(limit as string, 10)
  const offsetNum = parseInt(offset as string, 10)

  // Validate parameters
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    res.status(400).json({ 
      error: 'Invalid limit parameter. Must be between 1 and 100.' 
    })
    return
  }

  if (isNaN(offsetNum) || offsetNum < 0) {
    res.status(400).json({ 
      error: 'Invalid offset parameter. Must be 0 or greater.' 
    })
    return
  }

  try {
    // Get pending reviews (or filtered by status)
    if (status && status !== 'PENDING_REVIEW') {
      // TODO: Add method to get reviews by specific status
      const stats = await piiDetectorService.getPIIStats()
      res.json({
        detections: [],
        total: 0,
        stats,
        message: `Filtering by status ${status} not yet implemented`
      })
      return
    }

    const result = await piiDetectorService.getPendingReviews(limitNum, offsetNum)
    const stats = await piiDetectorService.getPIIStats()

    res.json({
      ...result,
      stats,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: result.total > offsetNum + limitNum
      }
    })

  } catch (error) {
    logger.error('Failed to fetch pending PII reviews:', error)
    res.status(500).json({ 
      error: 'Failed to fetch PII reviews',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * PUT /api/pii/review - Update single PII detection status
 * Body: {
 *   detectionId: string,
 *   status: 'WHITELISTED' | 'FLAGGED' | 'AUTO_REPLACED',
 *   reviewedBy: string,
 *   customReplacement?: string,
 *   reviewNote?: string
 * }
 */
async function handleUpdatePIIStatus(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const { 
    detectionId, 
    status, 
    reviewedBy, 
    customReplacement,
    reviewNote 
  } = req.body

  // Validate required fields
  if (!detectionId || !status || !reviewedBy) {
    res.status(400).json({ 
      error: 'Missing required fields: detectionId, status, reviewedBy' 
    })
    return
  }

  // Validate status
  const validStatuses = [
    PIIStatus.WHITELISTED, 
    PIIStatus.FLAGGED, 
    PIIStatus.AUTO_REPLACED
  ]
  
  if (!validStatuses.includes(status as PIIStatus)) {
    res.status(400).json({ 
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      validStatuses
    })
    return
  }

  try {
    // Update PII detection status
    await piiDetectorService.reviewPII(
      detectionId,
      status as PIIStatus,
      reviewedBy,
      customReplacement
    )

    logger.info(`PII detection ${detectionId} reviewed by ${reviewedBy}: ${status}${reviewNote ? ` (${reviewNote})` : ''}`)

    res.json({
      success: true,
      message: `PII detection updated to ${status}`,
      data: {
        detectionId,
        status,
        reviewedBy,
        reviewedAt: new Date().toISOString(),
        customReplacement,
        reviewNote
      }
    })

  } catch (error) {
    logger.error(`Failed to update PII detection ${detectionId}:`, error)
    res.status(500).json({ 
      error: 'Failed to update PII detection',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * POST /api/pii/review - Bulk update multiple PII detections
 * Body: {
 *   updates: Array<{
 *     detectionId: string,
 *     status: PIIStatus,
 *     customReplacement?: string
 *   }>,
 *   reviewedBy: string,
 *   reviewNote?: string
 * }
 */
async function handleBulkUpdatePII(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const { updates, reviewedBy, reviewNote } = req.body

  // Validate required fields
  if (!updates || !Array.isArray(updates) || !reviewedBy) {
    res.status(400).json({ 
      error: 'Missing required fields: updates (array), reviewedBy' 
    })
    return
  }

  if (updates.length === 0) {
    res.status(400).json({ 
      error: 'Updates array cannot be empty' 
    })
    return
  }

  if (updates.length > 50) {
    res.status(400).json({ 
      error: 'Maximum 50 updates allowed per request' 
    })
    return
  }

  const validStatuses = [
    PIIStatus.WHITELISTED, 
    PIIStatus.FLAGGED, 
    PIIStatus.AUTO_REPLACED
  ]

  // Validate each update
  for (const update of updates) {
    if (!update.detectionId || !update.status) {
      res.status(400).json({ 
        error: 'Each update must have detectionId and status' 
      })
      return
    }

    if (!validStatuses.includes(update.status as PIIStatus)) {
      res.status(400).json({ 
        error: `Invalid status: ${update.status}. Must be one of: ${validStatuses.join(', ')}` 
      })
      return
    }
  }

  try {
    const results = []
    const errors = []

    // Process each update
    for (const update of updates) {
      try {
        await piiDetectorService.reviewPII(
          update.detectionId,
          update.status as PIIStatus,
          reviewedBy,
          update.customReplacement
        )
        results.push({
          detectionId: update.detectionId,
          status: update.status,
          success: true
        })
      } catch (error) {
        logger.error(`Failed to update PII detection ${update.detectionId}:`, error)
        errors.push({
          detectionId: update.detectionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    logger.info(`Bulk PII review by ${reviewedBy}: ${results.length} successful, ${errors.length} failed${reviewNote ? ` (${reviewNote})` : ''}`)

    res.json({
      success: errors.length === 0,
      message: `Processed ${updates.length} updates: ${results.length} successful, ${errors.length} failed`,
      results,
      errors,
      reviewedBy,
      reviewedAt: new Date().toISOString(),
      reviewNote
    })

  } catch (error) {
    logger.error('Bulk PII review failed:', error)
    res.status(500).json({ 
      error: 'Failed to process bulk PII updates',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 