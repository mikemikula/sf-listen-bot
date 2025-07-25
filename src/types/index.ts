/**
 * Type definitions for Listen Bot application
 * Provides type safety across the entire application
 */

import type { Message } from '@prisma/client'

/**
 * Message display data for frontend components
 */
export interface MessageDisplay extends Message {
  timeAgo: string
  channelName: string
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
    user: string
    text: string
    ts: string
    channel: string
    event_ts: string
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