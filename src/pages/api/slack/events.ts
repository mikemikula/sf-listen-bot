/**
 * Slack Events API webhook handler
 * Handles URL verification and message events with full transaction logging
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { verifySlackSignature } from '@/lib/slack'
import { logger } from '@/lib/logger'
import { processSlackEvent, EventProcessingResult } from '@/lib/eventProcessor'
import type { SlackWebhookPayload, ApiResponse } from '@/types'

/**
 * Get raw body from request for signature verification
 */
const getRawBody = (req: NextApiRequest): Promise<string> => {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      resolve(data)
    })
    req.on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Main webhook handler
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
    // Get raw body for signature verification
    const rawBody = await getRawBody(req)
    const signature = req.headers['x-slack-signature'] as string
    const timestamp = req.headers['x-slack-request-timestamp'] as string

    // Verify request is from Slack
    if (!signature || !timestamp) {
      return res.status(400).json({
        success: false,
        error: 'Missing Slack headers'
      })
    }

    const isValidSignature = verifySlackSignature(signature, timestamp, rawBody)
    
    if (!isValidSignature) {
      console.error('❌ Invalid Slack signature')
      return res.status(401).json({
        success: false,
        error: 'Invalid signature'
      })
    }

    // Parse the payload
    const payload: SlackWebhookPayload = JSON.parse(rawBody)

    // Process the event using the robust event processor
    const result = await processSlackEvent(payload, rawBody)
    
    // Handle different processing results
    switch (result.result) {
      case EventProcessingResult.SUCCESS:
        logger.info(`Event processed successfully: ${payload.event_id}`)
        return res.status(200).json({
          success: true,
          data: result.data,
          message: result.message || 'Event processed successfully'
        })
      
      case EventProcessingResult.DUPLICATE:
        logger.warn(`Duplicate event ignored: ${payload.event_id}`)
        return res.status(200).json({
          success: true,
          data: result.data,
          message: result.message || 'Duplicate event ignored'
        })
      
      case EventProcessingResult.SKIPPED:
        logger.info(`Event skipped: ${payload.event_id}`)
        return res.status(200).json({
          success: true,
          message: result.message || 'Event skipped'
        })
      
      case EventProcessingResult.FAILED:
        logger.error(`Event processing failed: ${payload.event_id}`, result.error)
        
        // Still return 200 to Slack to prevent retries for permanent failures
        // The error is logged in our database for manual review
        return res.status(200).json({
          success: false,
          error: result.error?.message || 'Event processing failed',
          message: 'Event logged for manual review'
        })
      
      default:
        logger.error(`Unknown processing result: ${result.result}`)
        return res.status(500).json({
          success: false,
          error: 'Unknown processing result'
        })
    }

  } catch (error) {
    console.error('❌ Webhook handler error:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

/**
 * Disable body parser to get raw body for signature verification
 */
export const config = {
  api: {
    bodyParser: false,
  },
} 