/**
 * Document Processing API Endpoint
 * Handles processing of Slack messages into structured documents
 * Supports both synchronous and background job processing
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { backgroundJobService } from '@/lib/backgroundJobs'
import { documentProcessorService } from '@/lib/documentProcessor'
import { ApiResponse, DocumentDisplay, DocumentProcessingInput } from '@/types'

interface ProcessDocumentResponse {
  document?: DocumentDisplay
  jobId?: string
  message: string
}

/**
 * Handle POST request - Process messages into document
 */
async function handleProcessDocument(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ProcessDocumentResponse>>
) {
  try {
    const { 
      messageIds = [], 
      useBackgroundJob = false,
      options = {}
    } = req.body

    if (!messageIds || messageIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message IDs are required'
      })
    }

    // Verify all messages exist
    const existingMessages = await db.message.findMany({
      where: {
        id: { in: messageIds }
      }
    })

    if (existingMessages.length !== messageIds.length) {
      return res.status(400).json({
        success: false,
        error: 'One or more message IDs are invalid'
      })
    }

    const processingInput: DocumentProcessingInput = {
      messageIds,
      userId: options.userId || 'system'
    }

    if (useBackgroundJob) {
      // Use background job for async processing
      try {
        const jobId = await backgroundJobService.addDocumentProcessingJob(processingInput, {
          priority: options.priority || 0,
          delay: options.delay || 0
        })

        return res.status(202).json({
          success: true,
          data: {
            jobId,
            message: 'Document processing job started. Check job status for progress.'
          }
        })
      } catch (error) {
        logger.error('Failed to create document processing job:', error)
        // Fall back to synchronous processing
      }
    }

    // Synchronous processing
    logger.info(`Processing ${messageIds.length} messages into document with AI analysis`)
    
    const result = await documentProcessorService.processDocument(processingInput)

    // Get the created document with stats
    const documentWithStats = await db.processedDocument.findUnique({
      where: { id: result.document.id },
      include: {
        documentMessages: {
          include: {
            message: true
          }
        },
        documentFAQs: true
      }
    })

    if (!documentWithStats) {
      throw new Error('Failed to retrieve created document')
    }

    // Transform response
    const participants = Array.from(new Set(documentWithStats.documentMessages.map((dm: any) => dm.message?.username).filter(Boolean))) as string[]
    const channelNames = Array.from(new Set(documentWithStats.documentMessages.map((dm: any) => dm.message?.channel).filter(Boolean))) as string[]
    const lastActivity = documentWithStats.updatedAt > documentWithStats.createdAt ? documentWithStats.updatedAt : documentWithStats.createdAt

    const documentDisplay: DocumentDisplay = {
      id: documentWithStats.id,
      title: documentWithStats.title,
      description: documentWithStats.description || '',
      category: documentWithStats.category,
      status: documentWithStats.status,
      automationJobId: documentWithStats.automationJobId,
      confidenceScore: documentWithStats.confidenceScore,
      createdBy: documentWithStats.createdBy,
      messageCount: documentWithStats.documentMessages.length,
      faqCount: documentWithStats.documentFAQs.length,
      participantCount: participants.length,
      participants,
      channelNames,
      lastActivity,
      timeAgo: getTimeAgo(lastActivity),
      createdAt: documentWithStats.createdAt,
      updatedAt: documentWithStats.updatedAt
    }

    return res.status(201).json({
      success: true,
      data: {
        document: documentDisplay,
        message: `Document "${documentDisplay.title}" created successfully with ${documentWithStats.documentMessages.length} messages`
      }
    })

  } catch (error) {
    logger.error('Document processing failed:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Handle GET request - Get document processing status
 */
async function handleGetProcessingStatus(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) {
  try {
    const { jobId } = req.query

    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required'
      })
    }

    const jobStatus = await backgroundJobService.getJobStatus(jobId)

    if (!jobStatus) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      })
    }

    return res.status(200).json({
      success: true,
      data: jobStatus
    })

  } catch (error) {
    logger.error('Failed to get document processing status:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Utility function to calculate time ago
 */
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) {
    return 'just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return date.toLocaleDateString()
  }
}

/**
 * Main API handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) {
  const { method } = req

  try {
    switch (method) {
      case 'POST':
        return await handleProcessDocument(req, res)
        
      case 'GET':
        return await handleGetProcessingStatus(req, res)
        
      default:
        res.setHeader('Allow', ['POST', 'GET'])
        return res.status(405).json({
          success: false,
          error: `Method ${method} not allowed`
        })
    }
  } catch (error) {
    logger.error('Document processing API handler error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
} 