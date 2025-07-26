/**
 * Slack integration utilities
 * Handles signature verification and event processing
 */

import crypto from 'crypto'

/**
 * Slack event types we handle
 */
export interface SlackMessage {
  type: string
  user?: string
  text?: string
  ts: string
  channel: string
  event_ts: string
  subtype?: string
  deleted_ts?: string // For message deletion events
  message?: {
    type: string
    user: string
    text: string
    ts: string
  }
  previous_message?: {
    type: string
    user: string
    text: string
    ts: string
  }
}

export interface SlackEvent {
  token: string
  team_id: string
  api_app_id: string
  event: SlackMessage
  type: 'event_callback' | 'url_verification'
  challenge?: string
  event_id: string
  event_time: number
}

/**
 * Verifies Slack request signature for security
 * @param requestSignature - Signature from Slack headers
 * @param requestTimestamp - Timestamp from Slack headers  
 * @param rawBody - Raw request body as string
 * @returns boolean indicating if signature is valid
 */
export const verifySlackSignature = (
  requestSignature: string,
  requestTimestamp: string,
  rawBody: string
): boolean => {
  try {
    // Get signing secret from environment
    const signingSecret = process.env.SLACK_SIGNING_SECRET
    
    if (!signingSecret) {
      console.error('❌ SLACK_SIGNING_SECRET not found in environment')
      return false
    }

    // Check if request is too old (5 minutes)
    const timestamp = parseInt(requestTimestamp)
    const time = Math.floor(Date.now() / 1000)
    
    if (Math.abs(time - timestamp) > 300) {
      console.warn('⚠️ Request timestamp too old')
      return false
    }

    // Create signature
    const hmac = crypto.createHmac('sha256', signingSecret)
    hmac.update(`v0:${requestTimestamp}:${rawBody}`)
    const computedSignature = `v0=${hmac.digest('hex')}`

    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(computedSignature),
      Buffer.from(requestSignature)
    )
  } catch (error) {
    console.error('❌ Error verifying Slack signature:', error)
    return false
  }
}

/**
 * Extracts username from Slack user ID
 * @param userId - Slack user ID
 * @returns formatted username
 */
export const formatUsername = (userId: string): string => {
  // For now, return the user ID
  // In production, you might want to fetch actual username from Slack API
  return userId.startsWith('U') ? `user_${userId.slice(1, 8)}` : userId
}

/**
 * Formats Slack timestamp to JavaScript Date
 * @param slackTimestamp - Slack timestamp string
 * @returns Date object
 */
export const parseSlackTimestamp = (slackTimestamp: string): Date => {
  // Slack timestamps are in format "1234567890.123456"
  const timestamp = parseFloat(slackTimestamp) * 1000
  return new Date(timestamp)
}

/**
 * Validates if message event should be processed
 * @param event - Slack message event
 * @returns boolean indicating if event should be processed
 */
export const shouldProcessMessage = (event: SlackMessage): boolean => {
  // Skip bot messages (but not for deletions)
  if (event.type === 'message' && 'bot_id' in event && event.subtype !== 'message_deleted') {
    return false
  }

  // Process message deletions
  if (event.subtype === 'message_deleted') {
    return true
  }

  // Process message edits
  if (event.subtype === 'message_changed') {
    return true
  }

  // Skip other message subtypes we don't want (file uploads, etc.)
  if (event.subtype && event.subtype !== 'message_deleted' && event.subtype !== 'message_changed') {
    return false
  }

  // Only process regular messages
  return event.type === 'message' && Boolean(event.text) && Boolean(event.user)
}

/**
 * Check if event is a message deletion
 * @param event - Slack message event
 * @returns boolean indicating if this is a deletion event
 */
export const isMessageDeletion = (event: SlackMessage): boolean => {
  return event.subtype === 'message_deleted' && Boolean(event.deleted_ts)
}

/**
 * Check if event is a message edit
 * @param event - Slack message event
 * @returns boolean indicating if this is an edit event
 */
export const isMessageEdit = (event: SlackMessage): boolean => {
  return event.subtype === 'message_changed' && Boolean(event.message) && Boolean(event.previous_message)
} 