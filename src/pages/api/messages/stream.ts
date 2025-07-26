/**
 * Server-Sent Events endpoint for real-time message updates
 * Provides real-time streaming of new messages to connected clients
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getEventStats } from '@/lib/eventProcessor'
import type { MessageDisplay } from '@/types'
import { formatDistanceToNow } from 'date-fns'

/**
 * Transform database message to display format with thread support
 */
const transformMessage = (message: any): MessageDisplay => ({
  ...message,
  timeAgo: formatDistanceToNow(new Date(message.timestamp), { addSuffix: true }),
  channelName: message.channel.startsWith('C') 
    ? `#${message.channel.slice(1, 8)}` 
    : message.channel,
  isThreadReply: message.isThreadReply || false,
  threadTs: message.threadTs || null,
  parentMessage: message.parentMessage || null,
  threadReplies: message.threadReplies ? message.threadReplies.map((reply: any) => ({
    ...reply,
    timeAgo: formatDistanceToNow(new Date(reply.timestamp), { addSuffix: true }),
    channelName: reply.channel.startsWith('C') 
      ? `#${reply.channel.slice(1, 8)}` 
      : reply.channel
  })) : []
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
    let lastMessageCount = 0
    let lastUpdateTime = new Date()
    let lastEventCount = 0
    
    // Get initial message count, last update time, and event count
    try {
      lastMessageCount = await db.message.count()
      const latestUpdate = await db.message.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
      })
      if (latestUpdate) {
        lastUpdateTime = latestUpdate.updatedAt
      }
      
      const initialStats = await getEventStats()
      lastEventCount = initialStats.total
    } catch (error) {
      logger.warn('Could not get initial message/event stats:', error)
    }
    
    // Poll for changes every 5 seconds (reduced frequency)
    const pollInterval = setInterval(async () => {
      try {
        // Check for new messages (use >= to catch messages at exact timestamp)
        const newMessages = await db.message.findMany({
          where: {
            timestamp: {
              gte: lastCheckTime
            }
          },
          orderBy: [
            { timestamp: 'asc' }, // Chronological order
            { isThreadReply: 'asc' }
          ],
          take: 20, // Reasonable limit
          include: {
            parentMessage: {
              select: {
                id: true,
                text: true,
                username: true,
                timestamp: true,
                slackId: true
              }
            },
            threadReplies: {
              orderBy: { timestamp: 'asc' },
              select: {
                id: true,
                text: true,
                username: true,
                timestamp: true,
                slackId: true,
                userId: true,
                channel: true,
                isThreadReply: true
              }
            }
          }
        })

        // Check for deletions by comparing message count
        const currentMessageCount = await db.message.count()
        const hasDeletedMessages = currentMessageCount < lastMessageCount
        
        // Check for edits by looking for recently updated messages  
        const recentlyUpdated = await db.message.findMany({
          where: {
            updatedAt: {
              gte: lastUpdateTime // Use >= to catch exact timestamps
            },
            createdAt: {
              lt: lastUpdateTime // Only messages that were created before our last check (so they're edits, not new)
            }
          },
          orderBy: [
            { updatedAt: 'asc' },
            { isThreadReply: 'asc' }
          ],
          take: 10,
          include: {
            parentMessage: {
              select: {
                id: true,
                text: true,
                username: true,
                timestamp: true,
                slackId: true
              }
            },
            threadReplies: {
              orderBy: { timestamp: 'asc' },
              select: {
                id: true,
                text: true,
                username: true,
                timestamp: true,
                slackId: true,
                userId: true,
                channel: true,
                isThreadReply: true
              }
            }
          }
        })
        
        // Update tracking variables AFTER processing to avoid race conditions
        // Use the timestamp of the newest message found, not current time
        if (newMessages.length > 0) {
          const newestMessage = newMessages[newMessages.length - 1]
          lastCheckTime = new Date(newestMessage.timestamp)
        }
        
        lastMessageCount = currentMessageCount
        
        if (recentlyUpdated.length > 0) {
          const newestUpdate = recentlyUpdated[recentlyUpdated.length - 1]
          lastUpdateTime = new Date(newestUpdate.updatedAt)
        }

        // Send new messages (but handle thread replies differently)
        if (newMessages.length > 0) {
          logger.sse(`Processing ${newMessages.length} new messages`)
          
          for (const message of newMessages) {
            const displayMessage = transformMessage(message)
            
            if (message.isThreadReply) {
              // For thread replies, send a thread update event instead
              // This will trigger the parent message to refresh its replies
              res.write(`data: ${JSON.stringify({
                type: 'thread_reply_added',
                data: {
                  parentThreadTs: message.threadTs,
                  reply: displayMessage,
                  channel: message.channel
                }
              })}\n\n`)
            } else {
              // For parent messages, send normally
              res.write(`data: ${JSON.stringify({
                type: 'message',
                data: displayMessage
              })}\n\n`)
            }
            
            lastMessageId = message.id
          }
        }

        // Send edited messages
        if (recentlyUpdated.length > 0) {
          logger.sse(`Sending ${recentlyUpdated.length} edited messages`)
          
          for (const message of recentlyUpdated) {
            const displayMessage = transformMessage(message)
            
            res.write(`data: ${JSON.stringify({
              type: 'message_edited',
              data: displayMessage
            })}\n\n`)
          }
        }

        // Notify about deletions (simple approach)
        if (hasDeletedMessages) {
          logger.sse('Messages were deleted, notifying client to refresh')
          
          res.write(`data: ${JSON.stringify({
            type: 'messages_deleted',
            message: 'Some messages were deleted. Refreshing feed.'
          })}\n\n`)
        }

        // Check for new transaction events
        const currentEventStats = await getEventStats()
        if (currentEventStats.total > lastEventCount) {
          logger.sse(`📊 New transaction events: ${lastEventCount} -> ${currentEventStats.total}`)
          
          // Get the latest events
          const latestEvents = await db.slackEvent.findMany({
            where: {
              createdAt: {
                gt: lastCheckTime
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              slackEventId: true,
              eventType: true,
              eventSubtype: true,
              payload: true,
              status: true,
              attempts: true,
              errorMessage: true,
              channel: true,
              createdAt: true,
              lastAttemptAt: true
            }
          })

          res.write(`data: ${JSON.stringify({
            type: 'transaction_update',
            data: {
              stats: currentEventStats,
              newEvents: latestEvents
            }
          })}\n\n`)
          
          lastEventCount = currentEventStats.total
        }

        // Send heartbeat every 30 seconds
        if (Date.now() % 30000 < 2000) {
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
    }, 2000) // Poll every 2 seconds for faster updates

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