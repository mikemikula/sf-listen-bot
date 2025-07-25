/**
 * Slack Events API webhook handler
 * Handles URL verification and message events
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { 
  verifySlackSignature, 
  parseSlackTimestamp, 
  formatUsername,
  shouldProcessMessage 
} from '@/lib/slack'
import type { 
  SlackWebhookPayload, 
  ApiResponse,
  SlackVerificationError
} from '@/types'
import { DatabaseError } from '@/types'

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

    // Handle URL verification challenge
    if (payload.type === 'url_verification') {
      console.log('✅ URL verification challenge received')
      return res.status(200).json({
        success: true,
        data: { challenge: payload.challenge }
      })
    }

    // Handle message events
    if (payload.type === 'event_callback' && payload.event) {
      const event = payload.event

      // Validate message should be processed
      if (!shouldProcessMessage(event)) {
        return res.status(200).json({
          success: true,
          message: 'Event ignored'
        })
      }

      try {
        // Store message in database
        const message = await db.message.create({
          data: {
            slackId: event.ts,
            text: event.text,
            userId: event.user,
            username: formatUsername(event.user),
            channel: event.channel,
            timestamp: parseSlackTimestamp(event.ts),
          }
        })

        console.log(`✅ Message stored: ${message.id}`)
        
        return res.status(200).json({
          success: true,
          data: { messageId: message.id },
          message: 'Message processed successfully'
        })

      } catch (dbError) {
        console.error('❌ Database error:', dbError)
        
        // Handle duplicate message (Slack retries)
        if (dbError instanceof Error && dbError.message.includes('Unique constraint')) {
          return res.status(200).json({
            success: true,
            message: 'Message already processed'
          })
        }

        throw new DatabaseError('Failed to store message', dbError)
      }
    }

    // Unknown event type
    return res.status(200).json({
      success: true,
      message: 'Event type not handled'
    })

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