/**
 * Messages API endpoint
 * Handles fetching and filtering messages
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import type { 
  ApiResponse, 
  PaginatedMessages, 
  MessageFilters,
  MessageDisplay 
} from '@/types'
import { formatDistanceToNow } from 'date-fns'

/**
 * Parse query parameters into MessageFilters
 */
const parseFilters = (query: NextApiRequest['query']): MessageFilters => {
  return {
    channel: query.channel as string,
    userId: query.userId as string,
    search: query.search as string,
    startDate: query.startDate as string,
    endDate: query.endDate as string,
    page: query.page ? parseInt(query.page as string) : 1,
    limit: query.limit ? parseInt(query.limit as string) : 20,
  }
}

/**
 * Build Prisma where clause from filters
 */
const buildWhereClause = (filters: MessageFilters): object => {
  const where: any = {}

  if (filters.channel) {
    where.channel = filters.channel
  }

  if (filters.userId) {
    where.userId = filters.userId
  }

  if (filters.search) {
    where.text = {
      contains: filters.search,
      mode: 'insensitive'
    }
  }

  if (filters.startDate || filters.endDate) {
    where.timestamp = {}
    
    if (filters.startDate) {
      where.timestamp.gte = new Date(filters.startDate)
    }
    
    if (filters.endDate) {
      where.timestamp.lte = new Date(filters.endDate)
    }
  }

  return where
}

/**
 * Transform database messages to display format
 */
const transformMessages = (messages: any[]): MessageDisplay[] => {
  return messages.map(message => ({
    ...message,
    timeAgo: formatDistanceToNow(new Date(message.timestamp), { addSuffix: true }),
    channelName: message.channel.startsWith('C') 
      ? `#${message.channel.slice(1, 8)}` 
      : message.channel
  }))
}

/**
 * Main messages handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<PaginatedMessages>>
): Promise<void> {
  
  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    const filters = parseFilters(req.query)
    const page = filters.page || 1
    const limit = Math.min(filters.limit || 20, 100) // Max 100 per page
    const skip = (page - 1) * limit

    const whereClause = buildWhereClause(filters)

    // Get total count for pagination
    const total = await db.message.count({
      where: whereClause
    })

    // Get messages with pagination
    const messages = await db.message.findMany({
      where: whereClause,
      orderBy: {
        timestamp: 'desc'
      },
      skip,
      take: limit
    })

    // Transform messages for display
    const displayMessages = transformMessages(messages)

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit)
    const hasNext = page < totalPages
    const hasPrev = page > 1

    const response: PaginatedMessages = {
      messages: displayMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev
      }
    }

    return res.status(200).json({
      success: true,
      data: response
    })

  } catch (error) {
    console.error('❌ Messages API error:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
} 