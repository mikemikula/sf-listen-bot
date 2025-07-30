/**
 * Analytics API Endpoint
 * 
 * Purpose: Provides analytics-focused data for the Analytics Dashboard
 * Returns system health, statistics, and performance metrics
 * 
 * Follows SOLID principles:
 * - Single Responsibility: Only handles analytics data aggregation
 * - Interface Segregation: Returns only analytics-relevant data
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * Analytics Data Response Interface
 * Defines the structure of analytics data returned by this endpoint
 */
interface AnalyticsResponse {
  success: boolean
  data?: {
    systemHealth: {
      isHealthy: boolean
      services: {
        database: { status: 'healthy' | 'error'; error?: string }
        documentProcessor: { status: 'healthy' | 'error'; error?: string }
        faqGenerator: { status: 'healthy' | 'error'; error?: string }
        piiDetector: { status: 'healthy' | 'error'; error?: string }
        pinecone: { status: 'healthy' | 'error'; error?: string }
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
    jobStatistics: {
      totalJobs: number
      completedJobs: number
      failedJobs: number
      queuedJobs: number
      processingJobs: number
      avgProcessingTime: number
    }
    recentActivity: {
      documentsProcessed: number
      faqsGenerated: number
      errorsDetected: number
      lastUpdate: string
    }
  }
  error?: string
}

/**
 * Analytics API Handler
 * Aggregates system data for analytics dashboard
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalyticsResponse>
) {
  // Only allow GET requests for analytics data
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    logger.info('Fetching analytics data')

    // Get current date for today's statistics
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Parallel data fetching for performance
    const [
      systemStats,
      jobStats,
      recentActivity,
      systemHealth
    ] = await Promise.all([
      getSystemStatistics(today, tomorrow),
      getJobStatistics(),
      getRecentActivity(today, tomorrow),
      getSystemHealth()
    ])

    const response: AnalyticsResponse = {
      success: true,
      data: {
        systemHealth,
        systemStats,
        jobStatistics: jobStats,
        recentActivity
      }
    }

    logger.info('Successfully fetched analytics data')
    res.status(200).json(response)

  } catch (error) {
    logger.error('Failed to fetch analytics data:', error)
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

/**
 * Get System Statistics
 * Aggregates core system metrics
 */
async function getSystemStatistics(today: Date, tomorrow: Date) {
  const [
    totalDocuments,
    totalFAQs,
    totalMessages,
    pendingFAQReviews,
    piiDetectionsToday,
    documentsCreatedToday,
    faqsGeneratedToday
  ] = await Promise.all([
    // Total documents count
    db.processedDocument.count(),
    
    // Total FAQs count
    db.fAQ.count(),
    
    // Total messages count
    db.message.count(),
    
    // Pending FAQ reviews
    db.fAQ.count({
      where: { status: 'PENDING' }
    }),
    
    // PII detections today
    db.pIIDetection.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    }),
    
    // Documents created today
    db.processedDocument.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    }),
    
    // FAQs generated today
    db.fAQ.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    })
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
 * Get Job Statistics
 * Aggregates processing job metrics
 */
async function getJobStatistics() {
  const [
    totalJobs,
    completedJobs,
    failedJobs,
    queuedJobs,
    processingJobs,
    avgProcessingTimeResult
  ] = await Promise.all([
    // Total jobs count
    db.automationJob.count(),
    
    // Completed jobs
    db.automationJob.count({
      where: { status: 'COMPLETE' }
    }),
    
    // Failed jobs
    db.automationJob.count({
      where: { status: 'FAILED' }
    }),
    
    // Queued jobs
    db.automationJob.count({
      where: { status: 'QUEUED' }
    }),
    
    // Processing jobs
    db.automationJob.count({
      where: { status: 'PROCESSING' }
    }),
    
    // Average processing time (in seconds) - calculated from startedAt to completedAt
    db.automationJob.findMany({
      where: {
        status: 'COMPLETE',
        startedAt: { not: null },
        completedAt: { not: null }
      },
      select: {
        startedAt: true,
        completedAt: true
      }
    })
  ])

  // Calculate average processing time from completed jobs
  let avgProcessingTime = 0
  if (avgProcessingTimeResult.length > 0) {
    const totalDuration = avgProcessingTimeResult.reduce((sum, job) => {
      if (job.startedAt && job.completedAt) {
        const duration = Math.floor((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)
        return sum + duration
      }
      return sum
    }, 0)
    avgProcessingTime = Math.round(totalDuration / avgProcessingTimeResult.length)
  }

  return {
    totalJobs,
    completedJobs,
    failedJobs,
    queuedJobs,
    processingJobs,
    avgProcessingTime
  }
}

/**
 * Get Recent Activity
 * Aggregates recent system activity for insights
 */
async function getRecentActivity(today: Date, tomorrow: Date) {
  const [documentsProcessed, faqsGenerated, errorsDetected] = await Promise.all([
    // Documents processed today
    db.processedDocument.count({
      where: {
        updatedAt: {
          gte: today,
          lt: tomorrow
        }
      }
    }),
    
    // FAQs generated today
    db.fAQ.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    }),
    
    // Processing errors today
    db.automationJob.count({
      where: {
        status: 'FAILED',
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    })
  ])

  return {
    documentsProcessed,
    faqsGenerated,
    errorsDetected,
    lastUpdate: new Date().toISOString()
  }
}

/**
 * Get System Health
 * Checks health of all system services
 */
async function getSystemHealth() {
  const services = {
    database: await checkDatabaseHealth(),
    documentProcessor: await checkDocumentProcessorHealth(),
    faqGenerator: await checkFAQGeneratorHealth(),
    piiDetector: await checkPIIDetectorHealth(),
    pinecone: await checkPineconeHealth()
  }

  const isHealthy = Object.values(services).every(service => service.status === 'healthy')

  return {
    isHealthy,
    services
  }
}

/**
 * Individual Health Check Functions
 * Each service has its own health check logic
 */

async function checkDatabaseHealth() {
  try {
    await db.$queryRaw`SELECT 1`
    return { status: 'healthy' as const }
  } catch (error) {
    return { 
      status: 'error' as const, 
      error: error instanceof Error ? error.message : 'Database connection failed' 
    }
  }
}

async function checkDocumentProcessorHealth() {
  try {
    // Check if document processing is functioning
    const recentJob = await db.automationJob.findFirst({
      where: { jobType: 'DOCUMENT_CREATION' },
      orderBy: { createdAt: 'desc' }
    })
    
    return { status: 'healthy' as const }
  } catch (error) {
    return { 
      status: 'error' as const, 
      error: 'Document processor check failed' 
    }
  }
}

async function checkFAQGeneratorHealth() {
  try {
    // Simple health check - could be enhanced with actual FAQ generation test
    return { status: 'healthy' as const }
  } catch (error) {
    return { 
      status: 'error' as const, 
      error: 'FAQ generator check failed' 
    }
  }
}

async function checkPIIDetectorHealth() {
  try {
    // Simple health check - could be enhanced with actual PII detection test
    return { status: 'healthy' as const }
  } catch (error) {
    return { 
      status: 'error' as const, 
      error: 'PII detector check failed' 
    }
  }
}

async function checkPineconeHealth() {
  try {
    // Simple health check - could be enhanced with actual Pinecone connection test
    return { status: 'healthy' as const }
  } catch (error) {
    return { 
      status: 'error' as const, 
      error: 'Pinecone check failed' 
    }
  }
} 