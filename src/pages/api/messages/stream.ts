/**
 * Server-Sent Events endpoint for real-time message updates
 * Provides real-time streaming of new messages to connected clients
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
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

    // Poll for new messages every 2 seconds
    const pollInterval = setInterval(async () => {
      try {
        // Query for messages newer than our last seen message
        const whereClause = lastMessageId 
          ? {
              timestamp: {
                gt: latestMessage?.timestamp || new Date(0)
              }
            }
          : {}

        const newMessages = await db.message.findMany({
          where: whereClause,
          orderBy: { timestamp: 'desc' },
          take: 10 // Limit to prevent overwhelming
        })

        // Send new messages to client
        for (const message of newMessages.reverse()) { // Send in chronological order
          const displayMessage = transformMessage(message)
          
          res.write(`data: ${JSON.stringify({
            type: 'message',
            data: displayMessage
          })}\n\n`)
          
          lastMessageId = message.id
        }

        // Send heartbeat every 30 seconds to keep connection alive
        if (Date.now() % 30000 < 2000) {
          res.write(`data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })}\n\n`)
        }

      } catch (error) {
        console.error('❌ SSE polling error:', error)
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: 'Error fetching new messages'
        })}\n\n`)
      }
    }, 2000) // Poll every 2 seconds

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(pollInterval)
      console.log('🔌 SSE client disconnected')
    })

    req.on('error', (error) => {
      clearInterval(pollInterval)
      console.error('❌ SSE connection error:', error)
    })

  } catch (error) {
    console.error('❌ SSE setup error:', error)
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: 'Failed to setup real-time connection'
    })}\n\n`)
    res.end()
  }
} 