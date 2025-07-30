/**
 * Slack Channel Data Puller Service
 * 
 * Comprehensive service for pulling all historical data from a Slack channel
 * Implements proper pagination, rate limiting, thread handling, and progress tracking
 * 
 * Features:
 * - Fetches all messages from a channel with pagination
 * - Handles thread replies automatically
 * - Processes messages through existing event processor
 * - Provides real-time progress updates
 * - Implements exponential backoff for rate limiting
 * - Maintains data integrity and deduplication
 */

import { logger } from '@/lib/logger'
import { processSlackEvent, EventProcessingResult } from '@/lib/eventProcessor'
import { formatUsername, parseSlackTimestamp } from '@/lib/slack'
import { prisma } from '@/lib/db'
import type { SlackWebhookPayload, ApiResponse } from '@/types'

// ===== TYPES =====

export interface ChannelPullConfig {
  channelId: string
  channelName?: string
  startDate?: Date
  endDate?: Date
  includeThreads?: boolean
  batchSize?: number
  delayBetweenRequests?: number
  skipPIIDetection?: boolean // Skip PII detection for faster historical imports
  userId?: string // User who initiated the pull
}

export interface ChannelPullProgress {
  id: string
  channelId: string
  channelName: string
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  progress: number // 0-100
  totalMessages: number
  processedMessages: number
  threadsProcessed: number
  startedAt: Date | null
  completedAt: Date | null
  errorMessage: string | null
  userId: string | null
  stats: {
    newMessages: number
    duplicateMessages: number
    threadRepliesFetched: number
    documentsCreated: number
    faqsGenerated: number
    piiDetected: number
  }
}

export interface SlackMessage {
  type: string
  user?: string
  text?: string
  ts: string
  channel?: string // Optional since Slack API doesn't include channel ID in message objects (it's contextual)
  thread_ts?: string
  subtype?: string
  reply_count?: number
  replies?: Array<{ user: string; ts: string }>
  [key: string]: any
}

export interface SlackHistoryResponse {
  ok: boolean
  messages: SlackMessage[]
  has_more: boolean
  response_metadata?: {
    next_cursor?: string
  }
  error?: string
}

// ===== MAIN SERVICE CLASS =====

export class SlackChannelPuller {
  private botToken: string
  private baseUrl = 'https://slack.com/api'
  private defaultBatchSize = 100 // Slack API default
  private defaultDelay = 1000 // 1 second between requests
  private maxRetries = 3
  private static progressStore = new Map<string, ChannelPullProgress>() // In-memory progress storage
  private static cancellationTokens = new Map<string, boolean>() // Cancellation signals
  
  constructor(botToken?: string) {
    this.botToken = botToken || process.env.SLACK_BOT_TOKEN || ''
    
    if (!this.botToken) {
      throw new Error('SLACK_BOT_TOKEN environment variable is required')
    }
  }

  /**
   * Start a channel data pull operation
   * Creates a progress record and begins the pull process
   */
  async startChannelPull(config: ChannelPullConfig): Promise<ChannelPullProgress> {
    logger.info(`🚀 Starting channel pull for ${config.channelId}`, { config })

    // Create progress record
    const progressId = `pull_${config.channelId}_${Date.now()}`
    
    const progress: ChannelPullProgress = {
      id: progressId,
      channelId: config.channelId,
      channelName: config.channelName || config.channelId,
      status: 'QUEUED',
      progress: 0,
      totalMessages: 0,
      processedMessages: 0,
      threadsProcessed: 0,
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      userId: config.userId || null,
      stats: {
        newMessages: 0,
        duplicateMessages: 0,
        threadRepliesFetched: 0,
        documentsCreated: 0,
        faqsGenerated: 0,
        piiDetected: 0
      }
    }

    // Store initial progress (in production, this would go to database/cache)
    await this.updateProgress(progress)

    // Start the pull process asynchronously
    this.executeChannelPull(config, progress).catch(error => {
      logger.error('❌ Channel pull failed', { error, config })
      progress.status = error.message === 'Operation cancelled by user' ? 'CANCELLED' : 'FAILED'
      progress.errorMessage = error.message
      progress.completedAt = new Date()
      this.updateProgress(progress)
      
      // Schedule cleanup of failed/cancelled progress record (keep for 2 minutes)
      setTimeout(() => {
        SlackChannelPuller.progressStore.delete(progress.id)
        SlackChannelPuller.cancellationTokens.delete(progress.id)
        logger.info(`🧹 Cleaned up failed/cancelled progress record for ${progress.id}`)
      }, 2 * 60 * 1000)
    })

    return progress
  }

  /**
   * Execute the actual channel pull operation
   * Implements pagination, rate limiting, and progress tracking
   */
  private async executeChannelPull(
    config: ChannelPullConfig, 
    progress: ChannelPullProgress
  ): Promise<void> {
    try {
      // Check for cancellation before starting
      this.checkCancellation(progress.id)
      
      progress.status = 'RUNNING'
      progress.startedAt = new Date()
      await this.updateProgress(progress)

      logger.info(`🔄 Executing channel pull for ${config.channelId}`)

      // Step 1: Fetch channel info to get channel name
      this.checkCancellation(progress.id)
      const channelInfo = await this.getChannelInfo(config.channelId)
      if (channelInfo) {
        progress.channelName = channelInfo.name || progress.channelName
        await this.updateProgress(progress)
        
        // Security check: Ensure bot has proper access to the channel
        if (channelInfo.is_private && !channelInfo.is_member) {
          logger.error('🚨 Security violation: Attempted to pull private channel without membership', {
            channelId: config.channelId,
            channelName: channelInfo.name,
            userId: config.userId
          })
          progress.status = 'FAILED'
          progress.errorMessage = 'Access denied: Bot is not a member of this private channel'
          progress.completedAt = new Date()
          await this.updateProgress(progress)
          return
        }
      }

      // Step 2: Fetch all messages with pagination
      this.checkCancellation(progress.id)
      const allMessages = await this.fetchAllMessages(config, progress)
      
      // Step 3: Process messages through existing event processor
      this.checkCancellation(progress.id)
      await this.processMessages(allMessages, config, progress)

      // Step 4: Handle threads if enabled
      this.checkCancellation(progress.id)
      if (config.includeThreads !== false) {
        await this.processThreads(allMessages, config, progress)
      }

      // Mark as completed
      progress.status = 'COMPLETED'
      progress.progress = 100
      progress.completedAt = new Date()
      await this.updateProgress(progress)

      logger.info(`✅ Channel pull completed for ${config.channelId}`, {
        stats: progress.stats,
        duration: progress.completedAt.getTime() - progress.startedAt!.getTime()
      })

      // Schedule cleanup of progress record (keep for 5 minutes after completion)
      setTimeout(() => {
        SlackChannelPuller.progressStore.delete(progress.id)
        SlackChannelPuller.cancellationTokens.delete(progress.id)
        logger.info(`🧹 Cleaned up progress record for ${progress.id}`)
      }, 5 * 60 * 1000)

    } catch (error) {
      logger.error(`❌ Channel pull execution failed for ${config.channelId}`, error)
      throw error
    }
  }

  /**
   * Fetch all messages from a channel using pagination
   * Implements proper rate limiting and error handling
   */
  private async fetchAllMessages(
    config: ChannelPullConfig, 
    progress: ChannelPullProgress
  ): Promise<SlackMessage[]> {
    const allMessages: SlackMessage[] = []
    let cursor: string | undefined
    let hasMore = true
    const batchSize = config.batchSize || this.defaultBatchSize

    logger.info(`📥 Fetching messages from ${config.channelId}`)

    while (hasMore) {
      try {
        // Check for cancellation before each batch
        this.checkCancellation(progress.id)
        
        const response = await this.fetchMessagesPage(
          config.channelId,
          cursor,
          batchSize,
          config.startDate,
          config.endDate
        )

        if (!response.ok) {
          throw new Error(`Slack API error: ${response.error}`)
        }

        const messages = response.messages || []
        allMessages.push(...messages)

        // Update progress (0-20% for message discovery)
        progress.totalMessages = allMessages.length
        progress.progress = Math.min(20, 5 + (allMessages.length / 50) * 15)
        await this.updateProgress(progress)

        // Check for more pages
        hasMore = response.has_more || false
        cursor = response.response_metadata?.next_cursor

        // Rate limiting delay
        if (hasMore) {
          await this.delay(config.delayBetweenRequests || this.defaultDelay)
        }

        logger.info(`📊 Fetched ${messages.length} messages (total: ${allMessages.length})`)

      } catch (error) {
        logger.error('❌ Error fetching messages page', error)
        await this.handleRateLimit(error)
      }
    }

    logger.info(`✅ Completed message fetch: ${allMessages.length} messages from ${config.channelId}`)
    return allMessages
  }

  /**
   * Fetch a single page of messages from Slack API
   */
  private async fetchMessagesPage(
    channelId: string,
    cursor?: string,
    limit: number = 100,
    oldest?: Date,
    latest?: Date
  ): Promise<SlackHistoryResponse> {
    const params = new URLSearchParams({
      channel: channelId,
      limit: limit.toString(),
      ...(cursor && { cursor }),
      ...(oldest && { oldest: (oldest.getTime() / 1000).toString() }),
      ...(latest && { latest: (latest.getTime() / 1000).toString() })
    })

    const response = await fetch(`${this.baseUrl}/conversations.history?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Type': 'application/json'
      }
    })

    return response.json()
  }

  /**
   * Process messages through the existing event processor
   * Maintains consistency with real-time message processing
   */
  private async processMessages(
    messages: SlackMessage[],
    config: ChannelPullConfig,
    progress: ChannelPullProgress
  ): Promise<void> {
    logger.info(`🔄 Processing ${messages.length} messages through event processor`)

    // Set baseline progress for message processing phase
    progress.progress = 20
    await this.updateProgress(progress)

    let processed = 0
    const total = messages.length

    for (const message of messages) {
      try {
        // Check for cancellation every 10 messages
        if (processed % 10 === 0) {
          this.checkCancellation(progress.id)
        }
        
        // Convert to webhook payload format for consistency
        const webhookPayload: SlackWebhookPayload = {
          token: 'historical_pull',
          team_id: 'unknown',
          api_app_id: 'channel_puller',
          event: {
            type: message.type,
            user: message.user,
            text: message.text,
            ts: message.ts,
            channel: config.channelId, // Use channel ID from config since Slack API doesn't include it in message objects
            event_ts: message.ts,
            thread_ts: message.thread_ts,
            subtype: message.subtype
          },
          type: 'event_callback',
          event_id: `historical_${message.ts}`,
          event_time: Math.floor(parseSlackTimestamp(message.ts).getTime() / 1000)
        }

        // Process through existing event processor
        const result = await processSlackEvent(
          webhookPayload, 
          JSON.stringify(webhookPayload),
          { skipPIIDetection: config.skipPIIDetection }
        )

        // Update stats based on result
        switch (result.result) {
          case EventProcessingResult.SUCCESS:
            progress.stats.newMessages++
            break
          case EventProcessingResult.DUPLICATE:
            progress.stats.duplicateMessages++
            break
          // SKIPPED and FAILED don't increment counters
        }

        processed++
        progress.processedMessages = processed

        // Update progress (20-70% for message processing)
        progress.progress = 20 + Math.floor((processed / total) * 50)
        
        if (processed % 50 === 0) {
          await this.updateProgress(progress)
          logger.info(`📊 Processed ${processed}/${total} messages`)
        }

        // Small delay to prevent overwhelming the system
        if (processed % 10 === 0) {
          await this.delay(100)
        }

      } catch (error) {
        logger.error('❌ Error processing message', { error, messageTs: message.ts })
        // Continue processing other messages
      }
    }

    await this.updateProgress(progress)
    logger.info(`✅ Completed message processing: ${processed} messages`)
  }

  /**
   * Process thread replies for messages that have threads
   * Fetches and processes all thread replies
   */
  private async processThreads(
    messages: SlackMessage[],
    config: ChannelPullConfig,
    progress: ChannelPullProgress
  ): Promise<void> {
    const threadsToProcess = messages.filter(msg => 
      msg.reply_count && msg.reply_count > 0
    )

    if (threadsToProcess.length === 0) {
      logger.info('No threads to process')
      return
    }

    logger.info(`🧵 Processing ${threadsToProcess.length} threads`)

    // Set baseline progress for thread processing phase
    progress.progress = 70
    await this.updateProgress(progress)

    let processed = 0
    const total = threadsToProcess.length

    for (const parentMessage of threadsToProcess) {
      try {
        // Check for cancellation before processing each thread
        this.checkCancellation(progress.id)
        
        const replies = await this.fetchThreadReplies(
          config.channelId,
          parentMessage.ts
        )

        // Process each reply through event processor
        for (const reply of replies) {
          const webhookPayload: SlackWebhookPayload = {
            token: 'historical_pull',
            team_id: 'unknown',
            api_app_id: 'channel_puller',
            event: {
              type: reply.type,
              user: reply.user,
              text: reply.text,
              ts: reply.ts,
              channel: config.channelId, // Use channel ID from config since Slack API doesn't include it in thread reply objects
              event_ts: reply.ts,
              thread_ts: reply.thread_ts,
              subtype: reply.subtype
            },
            type: 'event_callback',
            event_id: `historical_thread_${reply.ts}`,
            event_time: Math.floor(parseSlackTimestamp(reply.ts).getTime() / 1000)
          }

          await processSlackEvent(
            webhookPayload, 
            JSON.stringify(webhookPayload),
            { skipPIIDetection: config.skipPIIDetection }
          )
          progress.stats.threadRepliesFetched++
        }

        processed++
        progress.threadsProcessed = processed

        // Update progress (70-90% for thread processing)
        progress.progress = 70 + Math.floor((processed / total) * 20)
        
        if (processed % 10 === 0) {
          await this.updateProgress(progress)
          logger.info(`📊 Processed ${processed}/${total} threads`)
        }

        // Rate limiting for thread requests
        await this.delay(config.delayBetweenRequests || this.defaultDelay)

      } catch (error) {
        logger.error('❌ Error processing thread', { error, parentTs: parentMessage.ts })
      }
    }

    await this.updateProgress(progress)
    logger.info(`✅ Completed thread processing: ${processed} threads`)
  }

  /**
   * Fetch thread replies for a specific message
   */
  private async fetchThreadReplies(
    channelId: string,
    threadTs: string
  ): Promise<SlackMessage[]> {
    const params = new URLSearchParams({
      channel: channelId,
      ts: threadTs,
      limit: '1000' // Get all replies in one request
    })

    const response = await fetch(`${this.baseUrl}/conversations.replies?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()
    
    if (!data.ok) {
      throw new Error(`Failed to fetch thread replies: ${data.error}`)
    }

    // Filter out the parent message (first in array)
    return data.messages?.slice(1) || []
  }

  /**
   * Get channel information
   */
  private async getChannelInfo(channelId: string): Promise<any> {
    try {
      const params = new URLSearchParams({ channel: channelId })
      
      const response = await fetch(`${this.baseUrl}/conversations.info?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      return data.ok ? data.channel : null
    } catch (error) {
      logger.error('❌ Error fetching channel info', error)
      return null
    }
  }

  /**
   * Handle rate limiting with exponential backoff
   */
  private async handleRateLimit(error: any): Promise<void> {
    if (error.message?.includes('rate') || error.status === 429) {
      const delay = Math.min(30000, 1000 * Math.pow(2, Math.random() * 3)) // 1-8 seconds
      logger.warn(`⏳ Rate limited, waiting ${delay}ms`)
      await this.delay(delay)
    } else {
      throw error
    }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Check if operation has been cancelled
   */
  private isCancelled(progressId: string): boolean {
    return SlackChannelPuller.cancellationTokens.get(progressId) === true
  }

  /**
   * Throw error if operation has been cancelled
   */
  private checkCancellation(progressId: string): void {
    if (this.isCancelled(progressId)) {
      throw new Error('Operation cancelled by user')
    }
  }

  /**
   * Update progress record
   * Stores progress in memory for real-time tracking
   */
  private async updateProgress(progress: ChannelPullProgress): Promise<void> {
    // Store progress in memory
    SlackChannelPuller.progressStore.set(progress.id, { ...progress })

    // Log progress updates for debugging
    logger.info(`📊 Progress Update: ${progress.channelId} - ${progress.progress}%`, {
      status: progress.status,
      processed: progress.processedMessages,
      total: progress.totalMessages,
      stats: progress.stats
    })

    // TODO: In production, also persist to database or Redis for durability
    // await redis.set(`channel_pull_${progress.id}`, JSON.stringify(progress), 'EX', 3600)
    // or
    // await prisma.channelPullProgress.upsert({...})
  }

  /**
   * Get progress for a specific pull operation
   */
  async getProgress(progressId: string): Promise<ChannelPullProgress | null> {
    logger.info(`Getting progress for ${progressId}`)
    
    // Retrieve progress from memory store
    const progress = SlackChannelPuller.progressStore.get(progressId)
    
    if (!progress) {
      logger.warn(`⚠️ Progress not found for ${progressId}`)
      return null
    }
    
    // Return a copy to prevent external modifications
    return { ...progress }
    
    // TODO: In production, also try fallback to database/Redis
    // if (!progress) {
    //   const dbProgress = await prisma.channelPullProgress.findUnique({
    //     where: { id: progressId }
    //   })
    //   return dbProgress ? mapDbToProgress(dbProgress) : null
    // }
  }

  /**
   * Cancel a running pull operation
   */
  async cancelPull(progressId: string): Promise<boolean> {
    logger.info(`🛑 Cancelling pull ${progressId}`)
    
    const progress = SlackChannelPuller.progressStore.get(progressId)
    if (!progress) {
      logger.warn(`⚠️ Cannot cancel: Progress not found for ${progressId}`)
      return false
    }
    
    // Only allow cancellation of running or queued operations
    if (progress.status !== 'RUNNING' && progress.status !== 'QUEUED') {
      logger.warn(`⚠️ Cannot cancel: Pull ${progressId} is in ${progress.status} state`)
      return false
    }
    
    // Set cancellation token
    SlackChannelPuller.cancellationTokens.set(progressId, true)
    
    // Update progress to cancelled state
    progress.status = 'CANCELLED'
    progress.completedAt = new Date()
    progress.errorMessage = 'Operation cancelled by user'
    await this.updateProgress(progress)
    
    logger.info(`✅ Successfully cancelled pull ${progressId}`)
    return true
  }

  /**
   * List ALL channels with membership status (for UI display)
   */
  async listAllChannels(): Promise<Array<{ id: string; name: string; memberCount?: number; isMember: boolean }>> {
    try {
      const response = await fetch(`${this.baseUrl}/conversations.list?types=public_channel,private_channel`, {
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      
      if (!data.ok) {
        throw new Error(`Failed to fetch channels: ${data.error}`)
      }

      // Security check: Only return channels that are either public or where bot is a member
      const secureChannels = data.channels?.filter((channel: any) => {
        // Always include public channels
        if (!channel.is_private) return true
        
        // For private channels, only include if bot is a member
        if (channel.is_private && channel.is_member) return true
        
        // Log security violation attempt (should never happen with proper Slack API)
        if (channel.is_private && !channel.is_member) {
          logger.warn('🚨 Security: Private channel without membership detected', {
            channelId: channel.id,
            channelName: channel.name
          })
          return false
        }
        
        return false
      }) || []

      return secureChannels.map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        memberCount: channel.num_members,
        isMember: !!channel.is_member
      }))

    } catch (error) {
      logger.error('❌ Error fetching all channels', error)
      return []
    }
  }

  /**
   * Get all active pull operations
   */
  static getActivePulls(): ChannelPullProgress[] {
    return Array.from(SlackChannelPuller.progressStore.values()).filter(
      progress => progress.status === 'RUNNING' || progress.status === 'QUEUED'
    )
  }

  /**
   * Get all pull operations (active and completed)
   */
  static getAllPulls(): ChannelPullProgress[] {
    return Array.from(SlackChannelPuller.progressStore.values())
  }

  /**
   * Clean up old progress records to prevent memory leaks
   * Should be called periodically (e.g., every hour)
   */
  static cleanupOldProgress(): void {
    const now = Date.now()
    const maxAge = 60 * 60 * 1000 // 1 hour
    let cleaned = 0
    
    for (const [id, progress] of SlackChannelPuller.progressStore.entries()) {
      const age = progress.completedAt 
        ? now - progress.completedAt.getTime()
        : progress.startedAt 
          ? now - progress.startedAt.getTime()
          : now - new Date().getTime()
      
      if (age > maxAge) {
        SlackChannelPuller.progressStore.delete(id)
        SlackChannelPuller.cancellationTokens.delete(id)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      logger.info(`🧹 Cleaned up ${cleaned} old progress records`)
    }
  }

  /**
   * List available channels for pulling (only channels bot is a member of)
   */
  async listChannels(): Promise<Array<{ id: string; name: string; memberCount?: number; isMember?: boolean }>> {
    try {
      const response = await fetch(`${this.baseUrl}/conversations.list?types=public_channel,private_channel`, {
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      
      if (!data.ok) {
        throw new Error(`Failed to fetch channels: ${data.error}`)
      }

      // Security: Filter to only show channels where bot is a member
      // Also apply same security checks as listAllChannels
      const accessibleChannels = data.channels?.filter((channel: any) => {
        // For accessible channels list, only show where bot is a member
        if (!channel.is_member) return false
        
        // Security check: If it's private and we're not a member, log warning
        if (channel.is_private && !channel.is_member) {
          logger.warn('🚨 Security: Private channel without membership in accessible list', {
            channelId: channel.id,
            channelName: channel.name
          })
          return false
        }
        
        return true
      }) || []
      
      logger.info(`🔍 Found ${data.channels?.length || 0} total channels, ${accessibleChannels.length} accessible`)

      return accessibleChannels.map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        memberCount: channel.num_members,
        isMember: true
      }))

    } catch (error) {
      logger.error('❌ Error fetching channels', error)
      return []
    }
  }
}

// ===== FACTORY FUNCTION =====

/**
 * Create a new SlackChannelPuller instance
 * Follows dependency injection pattern for better testability
 */
export function createChannelPuller(): SlackChannelPuller {
  const botToken = process.env.SLACK_BOT_TOKEN
  return new SlackChannelPuller(botToken)
}

// ===== HELPER FUNCTIONS =====

/**
 * Validate channel pull configuration
 */
export function validatePullConfig(config: Partial<ChannelPullConfig>): ChannelPullConfig {
  if (!config.channelId) {
    throw new Error('channelId is required')
  }

  if (!config.channelId.match(/^[CDG][A-Z0-9]+$/)) {
    throw new Error('Invalid channel ID format')
  }

  return {
    channelId: config.channelId,
    channelName: config.channelName,
    startDate: config.startDate,
    endDate: config.endDate,
    includeThreads: config.includeThreads !== false, // Default to true
    batchSize: Math.min(config.batchSize || 100, 200), // Cap at 200
    delayBetweenRequests: Math.max(config.delayBetweenRequests || 1000, 500), // Minimum 500ms
    userId: config.userId
  }
}

/**
 * Estimate time for channel pull based on message count
 */
export function estimatePullTime(messageCount: number, includeThreads = true): number {
  // Base time: ~1 second per 100 messages
  const baseTime = Math.ceil(messageCount / 100) * 1000
  
  // Add time for threads (estimated 20% more)
  const threadTime = includeThreads ? baseTime * 0.2 : 0
  
  // Add processing overhead (estimated 50% more)
  const processingTime = baseTime * 0.5
  
  return baseTime + threadTime + processingTime
} 