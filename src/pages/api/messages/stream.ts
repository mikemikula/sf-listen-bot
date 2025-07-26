/**
 * Server-Sent Events endpoint for real-time message updates
 * Provides real-time streaming of new messages to connected clients
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { MessageDisplay } from '@/types'
import { formatDistanceToNow } from 'date-fns'

/**
 * Transform database message to display format
 */
const transformMessage = (message: any): MessageDisplay => ({
  ...message,
  timeAgo: formatDistanceToNow(new Date(message.timestamp), { addSuffix: true }),
  channelName: message.channel.startsWith('C') 
    ? `#${message.channel.slice(1, 8)}` 
    : message.channel
})

/**
 * Server-Sent Events handler for real-time updates
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {

  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  })

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`)

  let lastMessageId: string | null = null
  
  try {
    // Get the most recent message to establish baseline
    const latestMessage = await db.message.findFirst({
      orderBy: { timestamp: 'desc' }
    })
    
    if (latestMessage) {
      lastMessageId = latestMessage.id
    }

    let lastCheckTime = new Date()
    
    // Poll for new messages every 5 seconds (reduced frequency)
    const pollInterval = setInterval(async () => {
      try {
        // Query for messages newer than our last check time (more efficient)
        const newMessages = await db.message.findMany({
          where: {
            timestamp: {
              gt: lastCheckTime
            }
          },
          orderBy: { timestamp: 'asc' }, // Chronological order
          take: 20 // Reasonable limit
        })

        // Update last check time
        lastCheckTime = new Date()

        // Only send if there are new messages (reduces noise)
        if (newMessages.length > 0) {
          logger.sse(`Sending ${newMessages.length} new messages`)
          
          for (const message of newMessages) {
            const displayMessage = transformMessage(message)
            
            res.write(`data: ${JSON.stringify({
              type: 'message',
              data: displayMessage
            })}\n\n`)
            
            lastMessageId = message.id
          }
        }

        // Send heartbeat every 60 seconds (reduced frequency)
        if (Date.now() % 60000 < 5000) {
          res.write(`data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })}\n\n`)
        }

      } catch (error) {
        logger.error('SSE polling error:', error)
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: 'Error fetching new messages'
        })}\n\n`)
      }
    }, 5000) // Poll every 5 seconds (reduced from 2s)

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(pollInterval)
      logger.sse('Client disconnected')
    })

    req.on('error', (error) => {
      clearInterval(pollInterval)
      logger.error('SSE connection error:', error)
    })

  } catch (error) {
    logger.error('SSE setup error:', error)
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: 'Failed to setup real-time connection'
    })}\n\n`)
    res.end()
  }
} 