import type { NextApiRequest, NextApiResponse } from 'next'
import { processSlackEvent } from '@/lib/eventProcessor'
import { logger } from '@/lib/logger'

interface TestResult {
  success: boolean
  result?: string
  error?: string
  simulatedEvent?: any
}

/**
 * Test endpoint to simulate thread reply deletion events
 * This helps verify our deletion handling works correctly
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TestResult>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    const { slackId, channel } = req.body as { slackId?: string, channel?: string }

    if (!slackId || !channel) {
      return res.status(400).json({
        success: false,
        error: 'slackId and channel are required'
      })
    }

    // Create a simulated thread reply deletion event
    const simulatedEvent = {
      type: 'event_callback' as const,
      event_id: `test-${Date.now()}`,
      token: 'test-token',
      team_id: 'test-team',
      api_app_id: 'test-app',
      event: {
        type: 'message',
        subtype: 'message_deleted',
        deleted_ts: slackId,
        channel: channel,
        ts: `${Date.now() / 1000}`,
        event_ts: `${Date.now() / 1000}`
      }
    }

    logger.info(`Testing thread reply deletion for slackId: ${slackId}, channel: ${channel}`)

    // Process the simulated event
    const result = await processSlackEvent(simulatedEvent, JSON.stringify(simulatedEvent))

    return res.status(200).json({
      success: true,
      result: result.result,
      simulatedEvent: simulatedEvent.event
    })

  } catch (error) {
    logger.error('Test deletion failed:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 