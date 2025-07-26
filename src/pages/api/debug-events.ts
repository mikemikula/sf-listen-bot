/**
 * Debug endpoint to check what events are in the database
 * Temporary endpoint for troubleshooting
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  
  try {
    // Get total count
    const totalCount = await db.slackEvent.count()
    
    // Get count by status
    const statusCounts = await db.slackEvent.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    })
    
    // Get recent events (all of them, not just 20)
    const recentEvents = await db.slackEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        slackEventId: true,
        eventType: true,
        eventSubtype: true,
        status: true,
        channel: true,
        createdAt: true,
        errorMessage: true
      }
    })

    return res.status(200).json({
      success: true,
      data: {
        totalCount,
        statusCounts: statusCounts.reduce((acc: any, item) => {
          acc[item.status] = item._count.status
          return acc
        }, {}),
        recentEvents: recentEvents.map(event => ({
          ...event,
          createdAt: event.createdAt.toISOString()
        }))
      }
    })

  } catch (error) {
    console.error('Debug events error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 