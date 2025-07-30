/**
 * Automation API Endpoint
 * 
 * Purpose: Provides automation-focused data for the Automation Dashboard
 * Returns job data, automation rules, and processing settings
 * 
 * Follows SOLID principles:
 * - Single Responsibility: Only handles automation data aggregation
 * - Interface Segregation: Returns only automation-relevant data
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * Automation Data Response Interface
 * Defines the structure of automation data returned by this endpoint
 */
interface AutomationResponse {
  success: boolean
  data?: {
    processingJobs: {
      active: Array<{
        id: string
        status: string
        jobType: string
        progress: number
        createdAt: string
        startedAt?: string
        completedAt?: string
        errorMessage?: string
        createdBy?: string
      }>
      recent: Array<{
        id: string
        status: string
        jobType: string
        progress: number
        createdAt: string
        startedAt?: string
        completedAt?: string
        errorMessage?: string
        createdBy?: string
      }>
      statistics: {
        totalJobs: number
        completedJobs: number
        failedJobs: number
        queuedJobs: number
        processingJobs: number
        avgProcessingTime: number
      }
    }
    automationRules: Array<{
      id: string
      name: string
      description: string
      enabled: boolean
      trigger: {
        type: 'schedule' | 'event' | 'manual'
        schedule?: string
        eventType?: string
      }
      action: {
        type: 'document' | 'faq' | 'cleanup' | 'batch'
        parameters: Record<string, any>
      }
      permissions: string[]
      lastRun?: string
      nextRun?: string
      runCount: number
      successRate: number
    }>
    processingSettings: {
      maxConcurrentJobs: number
      defaultJobPriority: number
      autoRetryFailedJobs: boolean
      maxRetryAttempts: number
      jobTimeoutMinutes: number
      enableScheduledProcessing: boolean
      enableAutoCleanup: boolean
      cleanupRetentionDays: number
      notificationSettings: {
        enableEmailAlerts: boolean
        enableSlackAlerts: boolean
        alertOnFailure: boolean
        alertOnSuccess: boolean
      }
    }
  }
  error?: string
}

/**
 * Automation API Handler
 * Aggregates automation data for the automation dashboard
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AutomationResponse>
) {
  // Only allow GET requests for automation data
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    logger.info('Fetching automation data')

    // Parallel data fetching for performance
    const [
      processingJobs,
      automationRules,
      processingSettings
    ] = await Promise.all([
      getProcessingJobsData(),
      getAutomationRules(),
      getProcessingSettings()
    ])

    const response: AutomationResponse = {
      success: true,
      data: {
        processingJobs,
        automationRules,
        processingSettings
      }
    }

    logger.info('Successfully fetched automation data')
    res.status(200).json(response)

  } catch (error) {
    logger.error('Failed to fetch automation data:', error)
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

/**
 * Get Processing Jobs Data
 * Retrieves active and recent jobs with statistics
 */
async function getProcessingJobsData() {
  const [activeJobs, recentJobs, statistics] = await Promise.all([
    // Active jobs (processing or queued)
    db.documentProcessingJob.findMany({
      where: {
        status: {
          in: ['PROCESSING', 'QUEUED']
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    }),
    
    // Recent jobs (last 100)
    db.documentProcessingJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    }),
    
    // Job statistics
    getJobStatistics()
  ])

  // Transform jobs to match interface
  const transformJob = (job: any) => ({
    id: job.id,
    status: job.status,
    jobType: job.jobType,
    progress: job.progress || 0,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString(),
    completedAt: job.completedAt?.toISOString(),
    errorMessage: job.errorMessage,
    createdBy: job.createdBy || 'system'
  })

  return {
    active: activeJobs.map(transformJob),
    recent: recentJobs.map(transformJob),
    statistics
  }
}

/**
 * Get Job Statistics
 * Calculates job performance metrics
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
    db.documentProcessingJob.count(),
    db.documentProcessingJob.count({ where: { status: 'COMPLETE' } }),
    db.documentProcessingJob.count({ where: { status: 'FAILED' } }),
    db.documentProcessingJob.count({ where: { status: 'QUEUED' } }),
    db.documentProcessingJob.count({ where: { status: 'PROCESSING' } }),
    db.documentProcessingJob.findMany({
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
 * Get Automation Rules
 * Retrieves configured automation rules with their statistics
 */
async function getAutomationRules() {
  // For now, return mock automation rules
  // In a real implementation, these would be stored in the database
  const mockRules = [
    {
      id: 'rule-1',
      name: 'Auto Process New Messages',
      description: 'Automatically process new messages into documents when they arrive',
      enabled: true,
      trigger: {
        type: 'event' as const,
        eventType: 'message_received'
      },
      action: {
        type: 'document' as const,
        parameters: {
          batchSize: 10,
          priority: 'normal'
        }
      },
      permissions: ['document:create'],
      lastRun: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      nextRun: new Date(Date.now() + 1800000).toISOString(), // 30 minutes from now
      runCount: 45,
      successRate: 0.95
    },
    {
      id: 'rule-2',
      name: 'Daily FAQ Generation',
      description: 'Generate FAQs from processed documents every day at 3 AM',
      enabled: false,
      trigger: {
        type: 'schedule' as const,
        schedule: '0 3 * * *' // Daily at 3 AM
      },
      action: {
        type: 'faq' as const,
        parameters: {
          maxFAQs: 20,
          reviewRequired: true
        }
      },
      permissions: ['faq:create'],
      lastRun: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      nextRun: new Date(Date.now() + 43200000).toISOString(), // Tomorrow 3 AM
      runCount: 12,
      successRate: 0.88
    },
    {
      id: 'rule-3',
      name: 'Weekly Cleanup',
      description: 'Clean up old processing jobs and optimize database performance',
      enabled: true,
      trigger: {
        type: 'schedule' as const,
        schedule: '0 2 * * 0' // Weekly on Sunday at 2 AM
      },
      action: {
        type: 'cleanup' as const,
        parameters: {
          retentionDays: 30,
          optimizeDatabase: true
        }
      },
      permissions: ['system:cleanup'],
      lastRun: new Date(Date.now() - 604800000).toISOString(), // Last week
      nextRun: new Date(Date.now() + 259200000).toISOString(), // Next Sunday
      runCount: 8,
      successRate: 1.0
    }
  ]

  return mockRules
}

/**
 * Get Processing Settings
 * Retrieves current system processing configuration
 */
async function getProcessingSettings() {
  // For now, return default settings
  // In a real implementation, these would be stored in the database or configuration
  return {
    maxConcurrentJobs: 5,
    defaultJobPriority: 0,
    autoRetryFailedJobs: true,
    maxRetryAttempts: 3,
    jobTimeoutMinutes: 30,
    enableScheduledProcessing: true,
    enableAutoCleanup: true,
    cleanupRetentionDays: 30,
    notificationSettings: {
      enableEmailAlerts: false,
      enableSlackAlerts: true,
      alertOnFailure: true,
      alertOnSuccess: false
    }
  }
} 