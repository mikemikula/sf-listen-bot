/**
 * Admin Events API
 * Provides event processing statistics and retry functionality
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { retryFailedEvents, getEventStats } from '@/lib/eventProcessor'
import type { ApiResponse } from '@/types'

interface EventsQuery {
  action?: 'stats' | 'retry' | 'list'
  status?: string
  limit?: string
  page?: string
}

/**
 * Admin events handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
): Promise<void> {

  const { action = 'stats', status, limit = '50', page = '1' }: EventsQuery = req.query

  try {
    console.log(`🔍 Admin API called with action: ${action}`)
    
    switch (action) {
      case 'stats':
        console.log('📊 Fetching event stats...')
        const stats = await getEventStats()
        console.log('📊 Event stats result:', stats)
        
        return res.status(200).json({
          success: true,
          data: stats,
          message: 'Event statistics retrieved'
        })

      case 'retry':
        if (req.method !== 'POST') {
          return res.status(405).json({
            success: false,
            error: 'Method not allowed for retry action'
          })
        }

        await retryFailedEvents()
        
        return res.status(200).json({
          success: true,
          message: 'Failed events retry initiated'
        })

      case 'list':
        console.log(`📋 Listing events with status=${status}, limit=${limit}, page=${page}`)
        
        const pageNum = parseInt(page)
        const limitNum = parseInt(limit)
        const skip = (pageNum - 1) * limitNum

        const whereClause = status ? { status: status as any } : {}
        console.log('🔍 Where clause:', whereClause)
        
        const events = await db.slackEvent.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
          select: {
            id: true,
            slackEventId: true,
            eventType: true,
            eventSubtype: true,
            payload: true, // Include the payload for content analysis
            status: true,
            attempts: true,
            errorMessage: true,
            channel: true,
            createdAt: true,
            lastAttemptAt: true
          }
        })

        const total = await db.slackEvent.count({ where: whereClause })
        
        console.log(`📊 Found ${events.length} events out of ${total} total`)
        console.log('📋 Events preview:', events.slice(0, 2))

        return res.status(200).json({
          success: true,
          data: {
            events,
            pagination: {
              page: pageNum,
              limit: limitNum,
              total,
              totalPages: Math.ceil(total / limitNum),
              hasNext: pageNum < Math.ceil(total / limitNum),
              hasPrev: pageNum > 1
            }
          },
          message: 'Events retrieved'
        })

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Use: stats, retry, or list'
        })
    }

  } catch (error) {
    logger.error('Admin events API error:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

/**
 * Example usage:
 * 
 * GET /api/admin/events?action=stats
 * GET /api/admin/events?action=list&status=FAILED&limit=20&page=1
 * POST /api/admin/events?action=retry
 */ 