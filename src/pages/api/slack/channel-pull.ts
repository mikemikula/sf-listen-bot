/**
 * Slack Channel Pull API Endpoints
 * 
 * Provides REST API endpoints for managing Slack channel data pulls
 * 
 * Endpoints:
 * - POST /api/slack/channel-pull - Start a new channel pull
 * - GET /api/slack/channel-pull?progressId=... - Get pull progress
 * - GET /api/slack/channel-pull?action=list-channels - List available channels
 * - GET /api/slack/channel-pull?action=list-active-pulls - List active pulls
 * - GET /api/slack/channel-pull?action=list-all-pulls - List all pulls
 * - DELETE /api/slack/channel-pull?progressId=... - Cancel a running pull
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '@/lib/logger'
import { 
  createChannelPuller, 
  validatePullConfig,
  estimatePullTime,
  SlackChannelPuller,
  type ChannelPullConfig,
  type ChannelPullProgress
} from '@/lib/slackChannelPuller'
import type { ApiResponse } from '@/types'

interface StartPullRequest {
  channelId: string
  channelName?: string
  startDate?: string // ISO date string
  endDate?: string // ISO date string
  includeThreads?: boolean
  batchSize?: number
  delayBetweenRequests?: number
  userId?: string
}

interface StartPullResponse {
  progress: ChannelPullProgress
  estimatedTimeMs: number
}

interface ListChannelsResponse {
  channels: Array<{
    id: string
    name: string
    memberCount?: number
  }>
}

interface ProgressResponse {
  progress: ChannelPullProgress
}

/**
 * Main API handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
): Promise<void> {
  try {
    switch (req.method) {
      case 'POST':
        return await handleStartPull(req, res)
      case 'GET':
        return await handleGetRequest(req, res)
      case 'DELETE':
        return await handleCancelPull(req, res)
      default:
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        })
    }
  } catch (error) {
    logger.error('❌ Channel pull API error', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

/**
 * Handle POST requests - Start a new channel pull
 */
async function handleStartPull(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<StartPullResponse>>
): Promise<void> {
  try {
    const body: StartPullRequest = req.body

    // Validate request body
    if (!body.channelId) {
      return res.status(400).json({
        success: false,
        error: 'channelId is required'
      })
    }

    // Validate and normalize configuration
    const config: ChannelPullConfig = validatePullConfig({
      channelId: body.channelId,
      channelName: body.channelName,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      includeThreads: body.includeThreads,
      batchSize: body.batchSize,
      delayBetweenRequests: body.delayBetweenRequests,
      userId: body.userId
    })

    // Validate date range
    if (config.startDate && config.endDate && config.startDate > config.endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate must be before endDate'
      })
    }

    // Create puller and start the operation
    const puller = createChannelPuller()
    const progress = await puller.startChannelPull(config)

    // Estimate completion time (rough estimate)
    const estimatedTimeMs = estimatePullTime(1000, config.includeThreads) // Default estimate

    logger.info(`✅ Channel pull started`, {
      progressId: progress.id,
      channelId: config.channelId,
      channelName: config.channelName
    })

    return res.status(200).json({
      success: true,
      data: {
        progress,
        estimatedTimeMs
      },
      message: `Channel pull started for ${config.channelName || config.channelId}`
    })

  } catch (error) {
    logger.error('❌ Error starting channel pull', error)
    
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start channel pull'
    })
  }
}

/**
 * Handle GET requests based on action parameter
 */
async function handleGetRequest(req: NextApiRequest, res: NextApiResponse<ApiResponse>): Promise<void> {
  const { action, progressId } = req.query
  

  if (action === 'list-channels') {
    return handleListChannels(req, res)
  }
  
  if (action === 'list-active-pulls') {
    return handleListActivePulls(req, res)
  }
  
  if (action === 'list-all-pulls') {
    return handleListAllPulls(req, res)
  }
  
  if (action === 'cancel' && progressId) {
    return handleCancelPull(req, res)
  }
  
  if (progressId) {
    return handleGetProgress(progressId as string, req, res)
  }
  
  return res.status(400).json({
    success: false,
    error: 'Either progressId or action parameter is required'
  })
}

/**
 * Handle progress check
 */
async function handleGetProgress(
  progressId: string,
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ProgressResponse>>
): Promise<void> {
  try {
    const puller = createChannelPuller()
    const progress = await puller.getProgress(progressId)

    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Progress record not found'
      })
    }

    return res.status(200).json({
      success: true,
      data: { progress },
      message: `Progress for ${progress.channelName}: ${progress.progress}%`
    })

  } catch (error) {
    logger.error('❌ Error getting progress', error)
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get progress'
    })
  }
}

/**
 * Handle channel listing
 */
async function handleListChannels(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ListChannelsResponse>>
): Promise<void> {
  try {
    const { all } = req.query
    const puller = createChannelPuller()
    
    // Show all channels with membership status, or just accessible ones
    const channels = all === 'true' 
      ? await puller.listAllChannels()
      : await puller.listChannels()

    const accessibleCount = channels.filter(c => c.isMember !== false).length
    const totalCount = channels.length

    logger.info(`📋 Listed ${totalCount} channels (${accessibleCount} accessible)`)

    return res.status(200).json({
      success: true,
      data: { channels },
      message: all === 'true' 
        ? `Found ${totalCount} channels (${accessibleCount} accessible)`
        : `Found ${accessibleCount} accessible channels`
    })

  } catch (error) {
    logger.error('❌ Error listing channels', error)
    
    return res.status(500).json({
      success: false,
      error: 'Failed to list channels'
    })
  }
}

/**
 * Handle listing active pulls
 */
async function handleListActivePulls(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
): Promise<void> {
  try {
    const activePulls = SlackChannelPuller.getActivePulls()
    
    return res.status(200).json({
      success: true,
      data: { pulls: activePulls },
      message: `Found ${activePulls.length} active pulls`
    })

  } catch (error) {
    logger.error('❌ Error listing active pulls', error)
    
    return res.status(500).json({
      success: false,
      error: 'Failed to list active pulls'
    })
  }
}

/**
 * Handle listing all pulls
 */
async function handleListAllPulls(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
): Promise<void> {
  try {
    const allPulls = SlackChannelPuller.getAllPulls()
    
    return res.status(200).json({
      success: true,
      data: { pulls: allPulls },
      message: `Found ${allPulls.length} total pulls`
    })

  } catch (error) {
    logger.error('❌ Error listing all pulls', error)
    
    return res.status(500).json({
      success: false,
      error: 'Failed to list all pulls'
    })
  }
}

/**
 * Handle DELETE requests - Cancel a running pull
 */
async function handleCancelPull(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
): Promise<void> {
  try {
    const { progressId } = req.query

    if (!progressId || typeof progressId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'progressId is required'
      })
    }

    const puller = createChannelPuller()
    const cancelled = await puller.cancelPull(progressId)

    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: 'Pull operation not found or cannot be cancelled'
      })
    }

    logger.info(`🛑 Channel pull cancelled: ${progressId}`)

    return res.status(200).json({
      success: true,
      message: 'Channel pull cancelled successfully'
    })

  } catch (error) {
    logger.error('❌ Error cancelling pull', error)
    
    return res.status(500).json({
      success: false,
      error: 'Failed to cancel pull'
    })
  }
}

/**
 * Input validation middleware
 */
function validateChannelId(channelId: string): boolean {
  // Slack channel IDs start with C (public), G (private), or D (DM)
  return /^[CDG][A-Z0-9]+$/.test(channelId)
}

/**
 * Rate limiting helper (basic implementation)
 * In production, use a proper rate limiting library
 */
const rateLimitMap = new Map<string, number>()

function checkRateLimit(identifier: string, maxRequests = 5, windowMs = 60000): boolean {
  const now = Date.now()
  const key = `${identifier}_${Math.floor(now / windowMs)}`
  
  const current = rateLimitMap.get(key) || 0
  
  if (current >= maxRequests) {
    return false
  }
  
  rateLimitMap.set(key, current + 1)
  
  // Cleanup old entries
  if (Math.random() < 0.1) { // 10% chance to cleanup
    for (const [mapKey] of rateLimitMap) {
      if (mapKey.split('_')[1] && parseInt(mapKey.split('_')[1]) < Math.floor((now - windowMs) / windowMs)) {
        rateLimitMap.delete(mapKey)
      }
    }
  }
  
  return true
} 