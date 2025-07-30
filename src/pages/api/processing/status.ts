/**
 * Processing Status API Endpoint
 * Provides real-time status monitoring for document processing and FAQ generation
 * Includes system health checks and comprehensive progress tracking
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { documentProcessorService } from '@/lib/documentProcessor'
import { faqGeneratorService } from '@/lib/faqGenerator'
import { piiDetectorService } from '@/lib/piiDetector'
import { pineconeService } from '@/lib/pinecone'
import { 
  ApiResponse, 
  AutomationJob,
  ValidationError,
  DatabaseError
} from '@/types'

/**
 * Processing status response interface
 */
interface ProcessingStatusResponse {
  systemHealth: {
    isHealthy: boolean
    services: {
      database: { status: 'healthy' | 'error'; error?: string }
      documentProcessor: { status: 'healthy' | 'error'; error?: string; stats?: any }
      faqGenerator: { status: 'healthy' | 'error'; error?: string; stats?: any }
      piiDetector: { status: 'healthy' | 'error'; error?: string; stats?: any }
      pinecone: { status: 'healthy' | 'error'; error?: string; stats?: any }
    }
  }
  processingJobs: {
      active: AutomationJob[]
  recent: AutomationJob[]
    statistics: {
      totalJobs: number
      completedJobs: number
      failedJobs: number
      queuedJobs: number
      processingJobs: number
      avgProcessingTime: number
    }
  }
  systemStats: {
    totalDocuments: number
    totalFAQs: number
    totalMessages: number
    pendingFAQReviews: number
    piiDetectionsToday: number
    documentsCreatedToday: number
    faqsGeneratedToday: number
  }
}

/**
 * Processing Status API handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ProcessingStatusResponse | AutomationJob | { jobId: string }>>
) {
  try {
    switch (req.method) {
      case 'GET':
        if (req.query.jobId) {
          return await handleGetJobStatus(req, res)
        } else {
          return await handleGetSystemStatus(req, res)
        }
      case 'POST':
        return await handleTriggerProcessing(req, res)
      default:
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        })
    }
  } catch (error) {
    logger.error('Processing status API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Handle GET /api/processing/status - Get system status and health
 */
async function handleGetSystemStatus(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ProcessingStatusResponse>>
) {
  try {
    // Check system health for all services
    const [
      dbHealth,
      docProcessorHealth,
      faqGeneratorHealth,
      piiDetectorHealth,
      pineconeHealth
    ] = await Promise.allSettled([
      checkDatabaseHealth(),
      documentProcessorService.healthCheck(),
      faqGeneratorService.healthCheck(),
      piiDetectorService.healthCheck(),
      pineconeService.healthCheck()
    ])

    // Get processing jobs status
    const [activeJobs, recentJobs, jobStats] = await Promise.all([
      getActiveJobs(),
      getRecentJobs(),
      getJobStatistics()
    ])

    // Get system statistics
    const systemStats = await getSystemStatistics()

    const response: ProcessingStatusResponse = {
      systemHealth: {
        isHealthy: [
          dbHealth,
          docProcessorHealth,
          faqGeneratorHealth,
          piiDetectorHealth,
          pineconeHealth
        ].every(result => result.status === 'fulfilled' && (typeof result.value === 'boolean' ? result.value : result.value?.isHealthy)),
        services: {
          database: {
            status: dbHealth.status === 'fulfilled' && dbHealth.value ? 'healthy' : 'error',
            error: dbHealth.status === 'rejected' ? String(dbHealth.reason) : undefined
          },
          documentProcessor: {
            status: docProcessorHealth.status === 'fulfilled' && docProcessorHealth.value?.isHealthy ? 'healthy' : 'error',
            error: docProcessorHealth.status === 'fulfilled' ? docProcessorHealth.value?.error : String(docProcessorHealth.reason)
          },
          faqGenerator: {
            status: faqGeneratorHealth.status === 'fulfilled' && faqGeneratorHealth.value?.isHealthy ? 'healthy' : 'error',
            error: faqGeneratorHealth.status === 'fulfilled' ? faqGeneratorHealth.value?.error : String(faqGeneratorHealth.reason),
            stats: faqGeneratorHealth.status === 'fulfilled' ? faqGeneratorHealth.value?.stats : undefined
          },
          piiDetector: {
            status: piiDetectorHealth.status === 'fulfilled' && piiDetectorHealth.value?.isHealthy ? 'healthy' : 'error',
            error: piiDetectorHealth.status === 'fulfilled' ? piiDetectorHealth.value?.error : String(piiDetectorHealth.reason),
            stats: piiDetectorHealth.status === 'fulfilled' ? piiDetectorHealth.value?.stats : undefined
          },
          pinecone: {
            status: pineconeHealth.status === 'fulfilled' && pineconeHealth.value?.isHealthy ? 'healthy' : 'error',
            error: pineconeHealth.status === 'fulfilled' ? pineconeHealth.value?.error : String(pineconeHealth.reason),
            stats: pineconeHealth.status === 'fulfilled' ? pineconeHealth.value?.stats : undefined
          }
        }
      },
      processingJobs: {
        active: activeJobs,
        recent: recentJobs,
        statistics: jobStats
      },
      systemStats
    }

    logger.info('System status retrieved successfully')

    return res.status(200).json({
      success: true,
      data: response
    })

  } catch (error) {
    logger.error('Failed to get system status:', error)
    throw new DatabaseError('Failed to get system status', error)
  }
}

/**
 * Handle GET /api/processing/status?jobId=xyz - Get specific job status
 */
async function handleGetJobStatus(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<AutomationJob>>
) {
  try {
    const { jobId } = req.query

    if (!jobId || typeof jobId !== 'string') {
      throw new ValidationError('jobId parameter is required')
    }

    const job = await db.automationJob.findUnique({
      where: { id: jobId },
      include: {
        processedDocuments: true
      }
    })

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Processing job not found'
      })
    }

    logger.info(`Retrieved status for job ${jobId}: ${job.status}`)

    return res.status(200).json({
      success: true,
              data: job as AutomationJob
    })

  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message
      })
    }

    logger.error('Failed to get job status:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get job status'
    })
  }
}

/**
 * Handle POST /api/processing/status - Trigger background processing
 */
async function handleTriggerProcessing(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ jobId: string }>>
) {
  try {
    const { type, data } = req.body

    if (!type) {
      throw new ValidationError('Processing type is required')
    }

    let jobId: string

    switch (type) {
      case 'document':
        if (!data.messageIds || !Array.isArray(data.messageIds)) {
          throw new ValidationError('messageIds array is required for document processing')
        }
        // Create background job for document processing
        jobId = await createDocumentProcessingJob(data)
        break

      case 'faq':
        if (!data.documentId) {
          throw new ValidationError('documentId is required for FAQ generation')
        }
        // Create background job for FAQ generation
        jobId = await createFAQGenerationJob(data)
        break

      case 'batch':
        if (!data.documentIds || !Array.isArray(data.documentIds)) {
          throw new ValidationError('documentIds array is required for batch processing')
        }
        // Create background job for batch processing
        jobId = await createBatchProcessingJob(data)
        break

      default:
        throw new ValidationError(`Unknown processing type: ${type}`)
    }

    logger.info(`Created background processing job: ${jobId}`)

    return res.status(202).json({
      success: true,
      data: { jobId },
      message: 'Processing job created successfully'
    })

  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message
      })
    }

    logger.error('Failed to trigger processing:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to trigger processing'
    })
  }
}

/**
 * Helper functions for system monitoring
 */

async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    logger.error('Database health check failed:', error)
    return false
  }
}

async function getActiveJobs(): Promise<AutomationJob[]> {
  return await db.automationJob.findMany({
    where: {
      status: {
        in: ['QUEUED', 'PROCESSING']
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  }) as AutomationJob[]
}

async function getRecentJobs(): Promise<AutomationJob[]> {
  return await db.automationJob.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  }) as AutomationJob[]
}

async function getJobStatistics() {
  const jobs = await db.automationJob.findMany({
    select: {
      status: true,
      createdAt: true,
      completedAt: true
    }
  })

  const totalJobs = jobs.length
  const completedJobs = jobs.filter((j: any) => j.status === 'COMPLETE').length
  const failedJobs = jobs.filter((j: any) => j.status === 'FAILED').length
  const queuedJobs = jobs.filter((j: any) => j.status === 'QUEUED').length
  const processingJobs = jobs.filter((j: any) => j.status === 'PROCESSING').length

  // Calculate average processing time for completed jobs
  const completedWithTimes = jobs.filter((j: any) => j.status === 'COMPLETE' && j.completedAt)
  const avgProcessingTime = completedWithTimes.length > 0
    ? completedWithTimes.reduce((sum: number, job: any) => {
        const processingTime = job.completedAt!.getTime() - job.createdAt.getTime()
        return sum + processingTime
      }, 0) / completedWithTimes.length
    : 0

  return {
    totalJobs,
    completedJobs,
    failedJobs,
    queuedJobs,
    processingJobs,
    avgProcessingTime: Math.round(avgProcessingTime / 1000) // Convert to seconds
  }
}

async function getSystemStatistics() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [
    totalDocuments,
    totalFAQs,
    totalMessages,
    pendingFAQReviews,
    piiDetectionsToday,
    documentsCreatedToday,
    faqsGeneratedToday
  ] = await Promise.all([
    db.processedDocument.count(),
    db.fAQ.count(),
    db.message.count(),
    db.fAQ.count({ where: { status: 'PENDING' } }),
    db.pIIDetection.count({ where: { createdAt: { gte: todayStart } } }),
    db.processedDocument.count({ where: { createdAt: { gte: todayStart } } }),
    db.fAQ.count({ where: { createdAt: { gte: todayStart } } })
  ])

  return {
    totalDocuments,
    totalFAQs,
    totalMessages,
    pendingFAQReviews,
    piiDetectionsToday,
    documentsCreatedToday,
    faqsGeneratedToday
  }
}

/**
 * Helper functions for creating background jobs
 */

async function createDocumentProcessingJob(data: any): Promise<string> {
  const job = await db.automationJob.create({
    data: {
      automationRuleId: data.automationRuleId || 'manual',
      jobType: 'DOCUMENT_CREATION',
      status: 'QUEUED',
      inputData: data,
      progress: 0,
      retryCount: 0
    }
  })

  // TODO: Add to background job queue
  // This would integrate with Bull Queue or similar job processing system

  return job.id
}

async function createFAQGenerationJob(data: any): Promise<string> {
  const job = await db.automationJob.create({
    data: {
      automationRuleId: data.automationRuleId || 'manual',
      jobType: 'FAQ_GENERATION',
      status: 'QUEUED',
      inputData: data,
      progress: 0,
      retryCount: 0
    }
  })

  // TODO: Add to background job queue
  return job.id
}

async function createBatchProcessingJob(data: any): Promise<string> {
  const job = await db.automationJob.create({
    data: {
      automationRuleId: data.automationRuleId || 'manual',
      jobType: 'DOCUMENT_ENHANCEMENT',
      status: 'QUEUED',
      inputData: data,
      progress: 0,
      retryCount: 0
    }
  })

  // TODO: Add to background job queue
  return job.id
} 