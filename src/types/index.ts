/**
 * Type definitions for Listen Bot application
 * Provides type safety across the entire application
 */

/**
 * Core message data structure matching database schema
 */
export interface BaseMessage {
  id: string
  slackId: string
  text: string
  userId: string
  username: string
  channel: string
  timestamp: Date
  threadTs: string | null
  isThreadReply: boolean
  parentMessageId: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Thread reply data for display 
 */
export interface ThreadReply {
  id: string
  text: string
  username: string
  timestamp: Date
  slackId: string
  userId: string
  channel: string
  isThreadReply: boolean
  timeAgo: string
  channelName: string
}

/**
 * Parent message data for thread context
 */
export interface ParentMessage {
  id: string
  text: string
  username: string
  timestamp: Date
  slackId: string
}

/**
 * Message display data for frontend components with thread support
 */
export interface MessageDisplay extends BaseMessage {
  timeAgo: string
  channelName: string
  parentMessage: ParentMessage | null
  threadReplies: ThreadReply[]
}

/**
 * API Response wrapper for consistent API responses
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Paginated response for message listings
 */
export interface PaginatedMessages {
  messages: MessageDisplay[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Message filters for search and filtering
 */
export interface MessageFilters {
  channel?: string
  userId?: string
  search?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

/**
 * Slack webhook event types
 */
export interface SlackWebhookPayload {
  token: string
  team_id: string
  api_app_id: string
  event?: {
    type: string
    user?: string
    text?: string
    ts: string
    channel: string
    event_ts: string
    subtype?: string
    deleted_ts?: string
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
  type: 'event_callback' | 'url_verification'
  challenge?: string
  event_id?: string
  event_time?: number
}

/**
 * Database operation results
 */
export interface DbOperationResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Component props interfaces
 */
export interface MessageCardProps {
  message: MessageDisplay
  showChannel?: boolean
  className?: string
}

export interface MessageFeedProps {
  messages: MessageDisplay[]
  loading?: boolean
  error?: string
  onLoadMore?: () => void
  hasMore?: boolean
}

export interface FilterBarProps {
  filters: MessageFilters
  onFiltersChange: (filters: MessageFilters) => void
  channels: string[]
  loading?: boolean
}

/**
 * Error types for better error handling
 */
export class SlackVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SlackVerificationError'
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
} 