/**
 * Background Job System
 * Manages async processing of documents, FAQs, and other intensive tasks
 * Uses Bull queue for reliable job processing with Redis backing
 */

import Queue from 'bull'
import { logger } from './logger'
import { documentProcessorService } from './documentProcessor'
import { faqGeneratorService } from './faqGenerator'
import { DocumentProcessingInput, FAQGenerationInput } from '@/types'

// Job types
export enum JobType {
  DOCUMENT_PROCESSING = 'document-processing',
  FAQ_GENERATION = 'faq-generation',
  DOCUMENT_ENHANCEMENT = 'document-enhancement',
  BATCH_PROCESSING = 'batch-processing',
  CLEANUP = 'cleanup'
}

// Job status tracking
export interface JobStatus {
  id: string
  type: JobType
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused'
  progress: number
  data?: any
  result?: any
  error?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  failedAt?: Date
}

/**
 * Background job service class
 */
class BackgroundJobService {
  private documentQueue: Queue.Queue
  private faqQueue: Queue.Queue
  private cleanupQueue: Queue.Queue
  private initialized = false

  constructor() {
    // Initialize queues (Redis connection required)
    const redisConfig = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0')
      }
    }

    this.documentQueue = new Queue('document processing', redisConfig)
    this.faqQueue = new Queue('faq generation', redisConfig)
    this.cleanupQueue = new Queue('cleanup tasks', redisConfig)
  }

  /**
   * Initialize job processors
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Document processing jobs
      this.documentQueue.process(JobType.DOCUMENT_PROCESSING, 2, async (job) => {
        logger.info(`Processing document job ${job.id}`)
        
        const input: DocumentProcessingInput = job.data
        job.progress(10)

                          try {
           const result = await documentProcessorService.processMessagesIntoDocument(input)
           job.progress(100)
           
           logger.info(`Document job ${job.id} completed successfully`)
           return result
         } catch (error) {
           logger.error(`Document job ${job.id} failed:`, error)
           throw error
         }
       })

       // FAQ generation jobs
       this.faqQueue.process(JobType.FAQ_GENERATION, 1, async (job) => {
         logger.info(`Processing FAQ job ${job.id}`)
         
         const input: FAQGenerationInput = job.data
         job.progress(10)

                  try {
           const result = await faqGeneratorService.generateFAQsFromDocument(input)
           job.progress(100)
           
           logger.info(`FAQ job ${job.id} completed successfully`)
           return result
         } catch (error) {
           logger.error(`FAQ job ${job.id} failed:`, error)
           throw error
         }
       })

       // Document enhancement jobs
       this.documentQueue.process(JobType.DOCUMENT_ENHANCEMENT, 1, async (job) => {
         logger.info(`Processing document enhancement job ${job.id}`)
         job.progress(10)

         const { documentId, additionalMessageIds, userId } = job.data

         try {
           const result = await documentProcessorService.enhanceDocument(
             documentId,
             additionalMessageIds,
             userId || 'system'
           )
          job.progress(100)
          
          logger.info(`Document enhancement job ${job.id} completed`)
          return result
        } catch (error) {
          logger.error(`Document enhancement job ${job.id} failed:`, error)
          throw error
        }
      })

      // Cleanup jobs
      this.cleanupQueue.process(JobType.CLEANUP, 1, async (job) => {
        logger.info(`Processing cleanup job ${job.id}`)
        job.progress(10)

        const { type, olderThanDays } = job.data

        try {
          // Implement cleanup logic based on type
          let result
          switch (type) {
            case 'failed-jobs':
              result = await this.cleanupFailedJobs(olderThanDays)
              break
            case 'completed-jobs':
              result = await this.cleanupCompletedJobs(olderThanDays)
              break
            default:
              throw new Error(`Unknown cleanup type: ${type}`)
          }

          job.progress(100)
          logger.info(`Cleanup job ${job.id} completed`)
          return result
        } catch (error) {
          logger.error(`Cleanup job ${job.id} failed:`, error)
          throw error
        }
      })

      // Set up error handlers
      this.documentQueue.on('error', (error) => {
        logger.error('Document queue error:', error)
      })

      this.faqQueue.on('error', (error) => {
        logger.error('FAQ queue error:', error)
      })

      this.cleanupQueue.on('error', (error) => {
        logger.error('Cleanup queue error:', error)
      })

      // Set up job event handlers
      this.documentQueue.on('completed', (job, result) => {
        logger.info(`Document job ${job.id} completed`, { result })
      })

      this.faqQueue.on('completed', (job, result) => {
        logger.info(`FAQ job ${job.id} completed`, { result })
      })

      this.documentQueue.on('failed', (job, error) => {
        logger.error(`Document job ${job.id} failed`, { error })
      })

      this.faqQueue.on('failed', (job, error) => {
        logger.error(`FAQ job ${job.id} failed`, { error })
      })

      this.initialized = true
      logger.info('Background job system initialized successfully')

    } catch (error) {
      logger.error('Failed to initialize background job system:', error)
      throw error
    }
  }

  /**
   * Add document processing job
   */
  async addDocumentProcessingJob(
    input: DocumentProcessingInput,
    options: {
      priority?: number
      delay?: number
      attempts?: number
    } = {}
  ): Promise<string> {
    const job = await this.documentQueue.add(
      JobType.DOCUMENT_PROCESSING,
      input,
      {
        priority: options.priority || 0,
        delay: options.delay || 0,
        attempts: options.attempts || 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 10,
        removeOnFail: 5
      }
    )

    logger.info(`Added document processing job ${job.id}`)
    return job.id.toString()
  }

  /**
   * Add FAQ generation job
   */
  async addFAQGenerationJob(
    input: FAQGenerationInput,
    options: {
      priority?: number
      delay?: number
      attempts?: number
    } = {}
  ): Promise<string> {
    const job = await this.faqQueue.add(
      JobType.FAQ_GENERATION,
      input,
      {
        priority: options.priority || 0,
        delay: options.delay || 0,
        attempts: options.attempts || 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 10,
        removeOnFail: 5
      }
    )

    logger.info(`Added FAQ generation job ${job.id}`)
    return job.id.toString()
  }

  /**
   * Add document enhancement job
   */
  async addDocumentEnhancementJob(
    documentId: string,
    additionalMessageIds: string[],
    options: {
      priority?: number
      delay?: number
    } = {}
  ): Promise<string> {
    const job = await this.documentQueue.add(
      JobType.DOCUMENT_ENHANCEMENT,
      { documentId, additionalMessageIds },
      {
        priority: options.priority || 0,
        delay: options.delay || 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 10,
        removeOnFail: 5
      }
    )

    logger.info(`Added document enhancement job ${job.id}`)
    return job.id.toString()
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    try {
      // Try to find job in each queue
      const queues = [this.documentQueue, this.faqQueue, this.cleanupQueue]
      
      for (const queue of queues) {
        const job = await queue.getJob(jobId)
        if (job) {
          return {
            id: job.id.toString(),
            type: job.name as JobType,
            status: await job.getState() as any,
            progress: job.progress(),
            data: job.data,
            result: job.returnvalue,
            error: job.failedReason,
            createdAt: new Date(job.timestamp),
            startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
            completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
            failedAt: job.failedReason && job.finishedOn ? new Date(job.finishedOn) : undefined
          }
        }
      }

      return null
    } catch (error) {
      logger.error(`Failed to get job status for ${jobId}:`, error)
      return null
    }
  }

  /**
   * Get active jobs
   */
  async getActiveJobs(): Promise<JobStatus[]> {
    try {
      const queues = [this.documentQueue, this.faqQueue, this.cleanupQueue]
      const activeJobs: JobStatus[] = []

      for (const queue of queues) {
        const jobs = await queue.getActive()
        for (const job of jobs) {
          activeJobs.push({
            id: job.id.toString(),
            type: job.name as JobType,
            status: 'active',
            progress: job.progress(),
            data: job.data,
            createdAt: new Date(job.timestamp),
            startedAt: job.processedOn ? new Date(job.processedOn) : undefined
          })
        }
      }

      return activeJobs
    } catch (error) {
      logger.error('Failed to get active jobs:', error)
      return []
    }
  }

  /**
   * Get job statistics
   */
  async getJobStatistics(): Promise<{
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
  }> {
    try {
      const queues = [this.documentQueue, this.faqQueue, this.cleanupQueue]
      const stats = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0
      }

      for (const queue of queues) {
        const counts = await queue.getJobCounts()
        stats.waiting += counts.waiting || 0
        stats.active += counts.active || 0
        stats.completed += counts.completed || 0
        stats.failed += counts.failed || 0
        stats.delayed += counts.delayed || 0
      }

      return stats
    } catch (error) {
      logger.error('Failed to get job statistics:', error)
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0
      }
    }
  }

  /**
   * Clean up old failed jobs
   */
  private async cleanupFailedJobs(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    let cleanedCount = 0
    const queues = [this.documentQueue, this.faqQueue, this.cleanupQueue]

    for (const queue of queues) {
      const failedJobs = await queue.getFailed()
      for (const job of failedJobs) {
        if (job.finishedOn && job.finishedOn < cutoffDate.getTime()) {
          await job.remove()
          cleanedCount++
        }
      }
    }

    logger.info(`Cleaned up ${cleanedCount} failed jobs older than ${olderThanDays} days`)
    return cleanedCount
  }

  /**
   * Clean up old completed jobs
   */
  private async cleanupCompletedJobs(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    let cleanedCount = 0
    const queues = [this.documentQueue, this.faqQueue, this.cleanupQueue]

    for (const queue of queues) {
      const completedJobs = await queue.getCompleted()
      for (const job of completedJobs) {
        if (job.finishedOn && job.finishedOn < cutoffDate.getTime()) {
          await job.remove()
          cleanedCount++
        }
      }
    }

    logger.info(`Cleaned up ${cleanedCount} completed jobs older than ${olderThanDays} days`)
    return cleanedCount
  }

  /**
   * Health check for background job system
   */
  async healthCheck(): Promise<{
    isHealthy: boolean
    error?: string
    details: {
      initialized: boolean
      queuesConnected: boolean
      activeJobs: number
      failedJobs: number
    }
  }> {
    try {
      const stats = await this.getJobStatistics()
      const activeJobs = await this.getActiveJobs()

      return {
        isHealthy: this.initialized,
        details: {
          initialized: this.initialized,
          queuesConnected: true, // If we got stats, connection is working
          activeJobs: activeJobs.length,
          failedJobs: stats.failed
        }
      }
    } catch (error) {
      return {
        isHealthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          initialized: this.initialized,
          queuesConnected: false,
          activeJobs: 0,
          failedJobs: 0
        }
      }
    }
  }

  /**
   * Shutdown job system gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down background job system...')
    
    await Promise.all([
      this.documentQueue.close(),
      this.faqQueue.close(),
      this.cleanupQueue.close()
    ])
    
    logger.info('Background job system shut down successfully')
  }
}

// Export singleton instance
export const backgroundJobService = new BackgroundJobService()
export default backgroundJobService

// Auto-initialize if in server environment
if (typeof window === 'undefined') {
  backgroundJobService.initialize().catch((error) => {
    logger.error('Failed to auto-initialize background job system:', error)
  })
} 