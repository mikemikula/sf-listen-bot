/**
 * FAQ Generation API Endpoint
 * Handles FAQ generation from documents using background jobs for scalability
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { backgroundJobService } from '@/lib/backgroundJobs'
import { faqGeneratorService } from '@/lib/faqGenerator'
import { ApiResponse, FAQDisplay, FAQGenerationInput } from '@/types'

interface GenerateFAQsResponse {
  faqs?: FAQDisplay[]
  jobId?: string
  message: string
}

/**
 * Handle POST request - Generate FAQs from document
 */
async function handleGenerateFAQs(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<GenerateFAQsResponse>>
) {
  try {
    const { documentId, useBackgroundJob = false, options = {} } = req.body

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      })
    }

    // Verify document exists
    const document = await db.processedDocument.findUnique({
      where: { id: documentId }
    })

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }

    // Check if document already has FAQs
    const existingFAQs = await db.documentFAQ.count({
      where: { documentId }
    })

    if (existingFAQs > 0 && !options.regenerate) {
      return res.status(400).json({
        success: false,
        error: 'Document already has FAQs. Use regenerate option to create new ones.'
      })
    }

    const faqInput: FAQGenerationInput = {
      documentId,
      categoryOverride: options.categoryOverride,
      userId: options.userId || 'system'
    }

    if (useBackgroundJob) {
      // Use background job for async processing
      try {
        const jobId = await backgroundJobService.addFAQGenerationJob(faqInput, {
          priority: options.priority || 0,
          delay: options.delay || 0
        })

        return res.status(202).json({
          success: true,
          data: {
            jobId,
            message: 'FAQ generation job started. Check job status for progress.'
          }
        })
      } catch (error) {
        logger.error('Failed to create FAQ generation job:', error)
        // Fall back to synchronous processing
      }
    }

    // Synchronous processing
    logger.info(`Generating FAQs synchronously for document ${documentId}`)
    
    const result = await faqGeneratorService.generateFAQsFromDocument(faqInput)

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'FAQ generation failed'
      })
    }

    // Fetch all FAQs for this document
    const documentFAQs = await db.documentFAQ.findMany({
      where: { documentId },
      include: {
        faq: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform FAQs for response
    const faqs: FAQDisplay[] = documentFAQs.map(({ faq }) => ({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      status: faq.status,
      confidenceScore: faq.confidenceScore,
      createdAt: faq.createdAt,
      updatedAt: faq.updatedAt,
      approvedBy: faq.approvedBy || null,
      approvedAt: faq.approvedAt || null,
      sourceDocumentCount: 1,
      sourceMessageCount: result.stats.newFAQsCreated,
      timeAgo: getTimeAgo(faq.createdAt)
    }))

    return res.status(200).json({
      success: true,
      data: {
        faqs,
        message: `Generated ${faqs.length} FAQs successfully`
      }
    })

  } catch (error) {
    logger.error('FAQ generation failed:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Handle GET request - Get FAQ generation status
 */
async function handleGetGenerationStatus(
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
    logger.error('Failed to get FAQ generation status:', error)
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
        return await handleGenerateFAQs(req, res)
        
      case 'GET':
        return await handleGetGenerationStatus(req, res)
        
      default:
        res.setHeader('Allow', ['POST', 'GET'])
        return res.status(405).json({
          success: false,
          error: `Method ${method} not allowed`
        })
    }
  } catch (error) {
    logger.error('FAQ generation API handler error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
} 