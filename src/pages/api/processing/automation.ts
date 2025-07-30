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
import { backgroundJobService } from '@/lib/backgroundJobs'

/**
 * Initialize default automation rules in the database
 * Creates the basic document processing and FAQ generation rules if they don't exist
 */
async function initializeDefaultAutomationRules() {
  try {
    // Check if default rules already exist
    const existingRules = await db.automationRule.findMany({
      where: { 
        id: { 
          in: ['doc-automation', 'faq-automation'] 
        } 
      }
    })

    const existingIds = existingRules.map(rule => rule.id)

    // Create document processing rule if it doesn't exist
    if (!existingIds.includes('doc-automation')) {
      await db.automationRule.create({
        data: {
          id: 'doc-automation',
          name: 'Document Processing Automation',
          description: 'Automatically process messages into documents',
          enabled: false, // Default to disabled
          jobType: 'DOCUMENT_CREATION',
          jobConfig: {
            type: 'document',
            parameters: {
              batchSize: 25,
              minMessagesRequired: 3,
              channelFilters: [],
              excludeThreads: false,
              requireQuestionAnswer: true,
              autoTitle: true,
              autoCategory: true
            }
          },
          createdBy: 'system'
        }
      })
      logger.info('Created default document processing automation rule')
    }

    // Create or update FAQ generation rule
    if (!existingIds.includes('faq-automation')) {
      await db.automationRule.create({
        data: {
          id: 'faq-automation',
          name: 'FAQ Generation Automation',
          description: 'Generate FAQs from processed documents',
          enabled: false, // Default to disabled
          jobType: 'FAQ_GENERATION',
          jobConfig: {
            type: 'faq',
            parameters: {
              maxFAQsPerRun: 10,
              minDocumentsRequired: 0,
              requireApproval: false,
              categories: ['technical', 'general', 'product'],
              qualityThreshold: 0.7,
              // NEW: Message processing limits
              maxUnprocessedMessages: 50,
              messageBatchSize: 10,
              maxDocumentsPerRun: 50,
              messageProcessingEnabled: true
            }
          },
          createdBy: 'system'
        }
      })
      logger.info('Created default FAQ generation automation rule')
    } else {
      // Update existing rule to ensure it has the latest defaults
      const existingRule = existingRules.find(rule => rule.id === 'faq-automation')
      if (existingRule) {
        const currentConfig = existingRule.jobConfig as any
        const needsUpdate = !currentConfig?.parameters || 
                           currentConfig.parameters.minDocumentsRequired !== 0 ||
                           currentConfig.parameters.requireApproval !== false ||
                           !currentConfig.parameters.maxUnprocessedMessages
        
        if (needsUpdate) {
          await db.automationRule.update({
            where: { id: 'faq-automation' },
            data: {
              jobConfig: {
                type: 'faq',
                parameters: {
                  maxFAQsPerRun: currentConfig?.parameters?.maxFAQsPerRun || 10,
                  minDocumentsRequired: 0,
                  requireApproval: false,
                  categories: currentConfig?.parameters?.categories || ['technical', 'general', 'product'],
                  qualityThreshold: currentConfig?.parameters?.qualityThreshold || 0.7,
                  // NEW: Message processing limits with backwards compatibility
                  maxUnprocessedMessages: currentConfig?.parameters?.maxUnprocessedMessages || 50,
                  messageBatchSize: currentConfig?.parameters?.messageBatchSize || 10,
                  maxDocumentsPerRun: currentConfig?.parameters?.maxDocumentsPerRun || 50,
                  messageProcessingEnabled: currentConfig?.parameters?.messageProcessingEnabled !== false
                }
              }
            }
          })
          logger.info('Updated FAQ generation automation rule with improved defaults and message processing controls')
        }
      }
    }

  } catch (error) {
    logger.error('Failed to initialize default automation rules:', error)
    // Don't throw - let the app continue with hardcoded fallbacks
  }
}

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
    automationRules: {
      documentProcessing: {
        id: string
        name: string
        description: string
        enabled: boolean
        schedule: {
          frequency: 'manual' | 'hourly' | 'daily' | 'weekly' | 'custom'
          hour?: number | null
          dayOfWeek?: number | null
          customInterval?: number
          customUnit?: 'minutes' | 'hours' | 'days' | 'weeks'
          customTime?: string
          customDayOfWeek?: number
          lastRun: string | null
          nextRun: string | null
        }
        settings: {
          batchSize: number
          minMessagesRequired: number
          channelFilters: string[]
          excludeThreads: boolean
          requireQuestionAnswer: boolean
          autoTitle: boolean
          autoCategory: boolean
        }
        stats: {
          totalRuns: number
          successfulRuns: number
          documentsCreated: number
          avgProcessingTime: number
        }
      } | null
      faqGeneration: {
        id: string
        name: string
        description: string
        enabled: boolean
        schedule: {
          frequency: 'manual' | 'hourly' | 'daily' | 'weekly' | 'custom'
          hour?: number | null
          dayOfWeek?: number | null
          customInterval?: number
          customUnit?: 'minutes' | 'hours' | 'days' | 'weeks'
          customTime?: string
          customDayOfWeek?: number
          lastRun: string | null
          nextRun: string | null
        }
        settings: {
          maxFAQsPerRun: number
          minDocumentsRequired: number
          requireApproval: boolean
          categories: string[]
          qualityThreshold: number
          // NEW: Message processing limits
          maxUnprocessedMessages: number
          messageBatchSize: number
          maxDocumentsPerRun: number
          messageProcessingEnabled: boolean
          faqGenerationEnabled: boolean
        }
        stats: {
          totalRuns: number
          successfulRuns: number
          faqsGenerated: number
          avgProcessingTime: number
        }
      } | null
    }
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

    // Initialize default automation rules on first request
    await initializeDefaultAutomationRules()

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
 * Retrieves active and recent jobs of all types with statistics
 */
async function getProcessingJobsData() {
  const [activeJobs, recentJobs, statistics] = await Promise.all([
    // Active jobs (processing or queued) - ALL job types
    db.automationJob.findMany({
      where: {
        status: {
          in: ['PROCESSING', 'QUEUED']
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    }),
    
    // Recent jobs (last 50) - ALL job types
    db.automationJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    }),
    
    // Job statistics across all job types
    getJobStatistics()
  ])

  // Transform jobs to match interface with proper job type handling
  const transformJob = (job: any) => ({
    id: job.id,
    status: job.status,
    jobType: job.jobType, // This will show DOCUMENT_CREATION, FAQ_GENERATION, etc.
    progress: job.progress || 0,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString(),
    completedAt: job.completedAt?.toISOString(),
    errorMessage: job.errorMessage,
    createdBy: job.createdBy || 'system',
    // Add job type specific display name
    displayName: getJobDisplayName(job.jobType),
    // Add duration if completed
    duration: job.completedAt && job.startedAt 
      ? Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)
      : null
  })

  return {
    active: activeJobs.map(transformJob),
    recent: recentJobs.map(transformJob),
    statistics
  }
}

/**
 * Get user-friendly display name for job types
 */
function getJobDisplayName(jobType: string): string {
  const displayNames: Record<string, string> = {
    'DOCUMENT_CREATION': 'Document Creation',
    'DOCUMENT_ENHANCEMENT': 'Document Enhancement', 
    'FAQ_GENERATION': 'FAQ Generation'
  }
  
  return displayNames[jobType] || jobType.replace(/_/g, ' ').toLowerCase()
}

/**
 * Get Job Statistics
 * Calculates statistics across all job types
 */
async function getJobStatistics() {
  try {
    const [
      totalJobs,
      completedJobs,
      failedJobs,
      queuedJobs,
      processingJobs,
      // Get stats by job type
      jobTypeStats
    ] = await Promise.all([
      db.automationJob.count(),
      db.automationJob.count({ where: { status: 'COMPLETE' } }),
      db.automationJob.count({ where: { status: 'FAILED' } }),
      db.automationJob.count({ where: { status: 'QUEUED' } }),
      db.automationJob.count({ where: { status: 'PROCESSING' } }),
      // Get breakdown by job type
      db.automationJob.groupBy({
        by: ['jobType'],
        _count: { id: true },
        _avg: { progress: true }
      })
    ])

    // Calculate average processing time for completed jobs
    const completedJobsWithTiming = await db.automationJob.findMany({
      where: { 
        status: 'COMPLETE',
        startedAt: { not: null },
        completedAt: { not: null }
      },
      select: { startedAt: true, completedAt: true }
    })

    const avgProcessingTime = completedJobsWithTiming.length > 0
      ? completedJobsWithTiming.reduce((sum, job) => {
          const duration = new Date(job.completedAt!).getTime() - new Date(job.startedAt!).getTime()
          return sum + duration
        }, 0) / completedJobsWithTiming.length
      : 0

    // Transform job type stats
    const jobTypeBreakdown = jobTypeStats.reduce((acc, stat) => {
      acc[stat.jobType] = {
        count: stat._count.id,
        avgProgress: stat._avg.progress || 0
      }
      return acc
    }, {} as Record<string, { count: number, avgProgress: number }>)

    return {
      totalJobs,
      completedJobs,
      failedJobs,
      queuedJobs,
      processingJobs,
      avgProcessingTime: Math.round(avgProcessingTime),
      successRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
      // Add breakdown by job type
      byJobType: jobTypeBreakdown
    }

  } catch (error) {
    logger.error('Failed to get job statistics:', error)
    
    // Return fallback statistics
    return {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      queuedJobs: 0,
      processingJobs: 0,
      avgProcessingTime: 0,
      successRate: 0,
      byJobType: {}
    }
  }
}

/**
 * Get Automation Configuration
 * Retrieves real automation settings from database for job processing
 */
async function getAutomationRules() {
  try {
    // Fetch automation rules from the database
    const docRule = await db.automationRule.findUnique({ where: { id: 'doc-automation' } })
    const faqRule = await db.automationRule.findUnique({ where: { id: 'faq-automation' } })

    // Transform database rules to expected interface format
        const documentProcessing = docRule ? {
      id: docRule.id,
      name: docRule.name,
      description: docRule.description,
      enabled: docRule.enabled,
      schedule: {
        frequency: ((docRule.jobConfig as any)?.trigger?.schedule?.frequency || 'manual') as 'manual' | 'hourly' | 'daily' | 'weekly' | 'custom',
        hour: (docRule.jobConfig as any)?.trigger?.schedule?.hour || null,
        dayOfWeek: (docRule.jobConfig as any)?.trigger?.schedule?.dayOfWeek || null,
        customInterval: (docRule.jobConfig as any)?.trigger?.customInterval || 1,
        customUnit: ((docRule.jobConfig as any)?.trigger?.customUnit || 'hours') as 'minutes' | 'hours' | 'days' | 'weeks',
        customTime: (docRule.jobConfig as any)?.trigger?.customTime || '09:00',
        customDayOfWeek: (docRule.jobConfig as any)?.trigger?.customDayOfWeek || 1,
        lastRun: docRule.lastRun?.toISOString() || null,
        nextRun: docRule.nextRun?.toISOString() || null
      },
      settings: {
        batchSize: (docRule.jobConfig as any)?.action?.batchSize || 25,
        minMessagesRequired: (docRule.jobConfig as any)?.action?.minMessagesRequired || 3,
        channelFilters: (docRule.jobConfig as any)?.action?.channelFilters || [],
        excludeThreads: (docRule.jobConfig as any)?.action?.excludeThreads || false,
        requireQuestionAnswer: (docRule.jobConfig as any)?.action?.requireQuestionAnswer || true,
        autoTitle: (docRule.jobConfig as any)?.action?.autoTitle || true,
        autoCategory: (docRule.jobConfig as any)?.action?.autoCategory || true
      },
      stats: {
        totalRuns: docRule.runCount,
        successfulRuns: (docRule.jobConfig as any)?.stats?.successCount || 0,
        documentsCreated: (docRule.jobConfig as any)?.stats?.successCount || 0, // Approximation
        avgProcessingTime: (docRule.jobConfig as any)?.stats?.avgExecutionTime || 0
      }
    } : null

        const faqGeneration = faqRule ? {
      id: faqRule.id,
      name: faqRule.name,
      description: faqRule.description,
      enabled: faqRule.enabled,
      schedule: {
        frequency: ((faqRule.jobConfig as any)?.trigger?.frequency || 'manual') as 'manual' | 'hourly' | 'daily' | 'weekly' | 'custom',
        hour: (faqRule.jobConfig as any)?.trigger?.hour || null,
        dayOfWeek: (faqRule.jobConfig as any)?.trigger?.dayOfWeek || null,
        customInterval: (faqRule.jobConfig as any)?.trigger?.customInterval || 1,
        customUnit: ((faqRule.jobConfig as any)?.trigger?.customUnit || 'hours') as 'minutes' | 'hours' | 'days' | 'weeks',
        customTime: (faqRule.jobConfig as any)?.trigger?.customTime || '09:00',
        customDayOfWeek: (faqRule.jobConfig as any)?.trigger?.customDayOfWeek || 1,
        lastRun: faqRule.lastRun?.toISOString() || null,
        nextRun: faqRule.nextRun?.toISOString() || null
      },
      settings: {
        maxFAQsPerRun: (faqRule.jobConfig as any)?.parameters?.maxFAQsPerRun || 10,
        minDocumentsRequired: (faqRule.jobConfig as any)?.parameters?.minDocumentsRequired || 0,
        requireApproval: (faqRule.jobConfig as any)?.parameters?.requireApproval || false,
        categories: (faqRule.jobConfig as any)?.parameters?.categories || ['technical', 'general', 'product'],
        qualityThreshold: (faqRule.jobConfig as any)?.parameters?.qualityThreshold || 0.7,
        // NEW: Message processing limits with defaults
        maxUnprocessedMessages: (faqRule.jobConfig as any)?.parameters?.maxUnprocessedMessages || 50,
        messageBatchSize: (faqRule.jobConfig as any)?.parameters?.messageBatchSize || 10,
        maxDocumentsPerRun: (faqRule.jobConfig as any)?.parameters?.maxDocumentsPerRun || 50,
        messageProcessingEnabled: (faqRule.jobConfig as any)?.parameters?.messageProcessingEnabled ?? true,
        faqGenerationEnabled: (faqRule.jobConfig as any)?.parameters?.faqGenerationEnabled ?? true
      },
     stats: {
        totalRuns: faqRule.runCount,
        successfulRuns: (faqRule.jobConfig as any)?.stats?.successCount || 0,
        faqsGenerated: (faqRule.jobConfig as any)?.stats?.successCount || 0, // Approximation
        avgProcessingTime: (faqRule.jobConfig as any)?.stats?.avgExecutionTime || 0
      }
    } : null

    return {
      documentProcessing,
      faqGeneration
    }

  } catch (error) {
    logger.error('Failed to fetch automation rules from database:', error)
    
    // Fallback to default values if database fails
    return {
      documentProcessing: {
        id: 'doc-automation',
        name: 'Document Processing Automation',
        description: 'Automatically process messages into documents',
        enabled: false,
        schedule: { 
          frequency: 'manual' as const, 
          hour: null, 
          dayOfWeek: null, 
          customInterval: 1,
          customUnit: 'hours' as const,
          customTime: '09:00',
          customDayOfWeek: 1,
          lastRun: null, 
          nextRun: null 
        },
        settings: { batchSize: 25, minMessagesRequired: 3, channelFilters: [], excludeThreads: false, requireQuestionAnswer: true, autoTitle: true, autoCategory: true },
        stats: { totalRuns: 0, successfulRuns: 0, documentsCreated: 0, avgProcessingTime: 0 }
      },
      faqGeneration: {
        id: 'faq-automation',
        name: 'FAQ Generation Automation',
        description: 'Generate FAQs from processed documents',
        enabled: false,
        schedule: { 
          frequency: 'manual' as const, 
          hour: null, 
          dayOfWeek: null, 
          customInterval: 1,
          customUnit: 'hours' as const,
          customTime: '09:00',
          customDayOfWeek: 1,
          lastRun: null, 
          nextRun: null 
        },
        settings: { 
          maxFAQsPerRun: 10, 
          minDocumentsRequired: 0, 
          requireApproval: false, 
          categories: ['technical', 'general', 'product'], 
          qualityThreshold: 0.7,
          maxUnprocessedMessages: 50,
          messageBatchSize: 10,
          maxDocumentsPerRun: 50,
          messageProcessingEnabled: true,
          faqGenerationEnabled: true
        },
        stats: { totalRuns: 0, successfulRuns: 0, faqsGenerated: 0, avgProcessingTime: 0 }
      }
    }
  }
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