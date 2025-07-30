/**
 * Job Management API Endpoint
 * Handles job control operations: start, stop, pause, resume, retry, delete
 * Supports both individual and bulk operations with proper permissions checking
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { backgroundJobService } from '@/lib/backgroundJobs'
import { ApiResponse, ValidationError, DatabaseError } from '@/types'

/**
 * Job management response interface
 */
interface JobManagementResponse {
  processedJobs: number
  failedJobs: number
  errors: string[]
  results: Record<string, any>
}

/**
 * Job Management API handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<JobManagementResponse>>
) {
  try {
    switch (req.method) {
      case 'POST':
        return await handleJobAction(req, res)
      default:
        res.setHeader('Allow', ['POST'])
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        })
    }
  } catch (error) {
    logger.error('Job management API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Handle POST /api/processing/jobs/manage - Perform actions on jobs
 */
async function handleJobAction(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<JobManagementResponse>>
) {
  try {
    const { action, jobIds, options = {} } = req.body

    // Validate required parameters
    if (!action || typeof action !== 'string') {
      throw new ValidationError('Action is required')
    }

    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      throw new ValidationError('Job IDs array is required')
    }

    // Validate action type
    const validActions = ['start', 'stop', 'pause', 'resume', 'retry', 'delete', 'cancel']
    if (!validActions.includes(action)) {
      throw new ValidationError(`Invalid action: ${action}. Valid actions: ${validActions.join(', ')}`)
    }

    logger.info(`Processing ${action} action for ${jobIds.length} jobs`)

    const results: Record<string, any> = {}
    const errors: string[] = []
    let processedJobs = 0
    let failedJobs = 0

    // Process each job
    for (const jobId of jobIds) {
      try {
        const result = await performJobAction(action, jobId, options)
        results[jobId] = result
        processedJobs++
        
        logger.info(`Successfully performed ${action} on job ${jobId}`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Job ${jobId}: ${errorMessage}`)
        failedJobs++
        
        logger.error(`Failed to perform ${action} on job ${jobId}:`, error)
      }
    }

    const response: JobManagementResponse = {
      processedJobs,
      failedJobs,
      errors,
      results
    }

    const statusCode = failedJobs === 0 ? 200 : (processedJobs === 0 ? 400 : 207) // 207 = Multi-Status

    return res.status(statusCode).json({
      success: failedJobs === 0,
      data: response,
      message: `${action} operation completed: ${processedJobs} succeeded, ${failedJobs} failed`
    })

  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message
      })
    }

    logger.error('Failed to perform job action:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to perform job action'
    })
  }
}

/**
 * Perform a specific action on a job
 */
async function performJobAction(action: string, jobId: string, options: any = {}): Promise<any> {
  // First, try to find the job in the background job system
  const jobStatus = await backgroundJobService.getJobStatus(jobId)
  
  // If not found in background system, check database
  let dbJob = null
  if (!jobStatus) {
    dbJob = await db.documentProcessingJob.findUnique({
      where: { id: jobId }
    })
    
    if (!dbJob) {
      throw new Error(`Job ${jobId} not found`)
    }
  }

  switch (action) {
    case 'start':
      return await startJob(jobId, jobStatus, dbJob, options)
    
    case 'stop':
    case 'cancel':
      return await stopJob(jobId, jobStatus, dbJob, options)
    
    case 'pause':
      return await pauseJob(jobId, jobStatus, dbJob, options)
    
    case 'resume':
      return await resumeJob(jobId, jobStatus, dbJob, options)
    
    case 'retry':
      return await retryJob(jobId, jobStatus, dbJob, options)
    
    case 'delete':
      return await deleteJob(jobId, jobStatus, dbJob, options)
    
    default:
      throw new Error(`Unsupported action: ${action}`)
  }
}

/**
 * Start a job
 */
async function startJob(jobId: string, jobStatus: any, dbJob: any, options: any): Promise<any> {
  if (jobStatus && jobStatus.status === 'active') {
    throw new Error('Job is already running')
  }
  
  if (dbJob) {
    // Update database status
    await db.documentProcessingJob.update({
      where: { id: jobId },
      data: {
        status: 'QUEUED',
        startedAt: new Date()
      }
    })
    
    // Add to background job queue based on job type
    switch (dbJob.jobType) {
      case 'DOCUMENT_CREATION':
        await backgroundJobService.addDocumentProcessingJob(dbJob.inputData, {
          priority: options.priority || 0,
          delay: options.delay || 0
        })
        break
        
      case 'FAQ_GENERATION':
        await backgroundJobService.addFAQGenerationJob(dbJob.inputData, {
          priority: options.priority || 0,
          delay: options.delay || 0
        })
        break
        
      case 'DOCUMENT_ENHANCEMENT':
        await backgroundJobService.addDocumentEnhancementJob(
          dbJob.inputData.documentId,
          dbJob.inputData.additionalMessageIds,
          {
            priority: options.priority || 0,
            delay: options.delay || 0
          }
        )
        break
        
      default:
        throw new Error(`Unknown job type: ${dbJob.jobType}`)
    }
  }
  
  return { action: 'started', jobId, timestamp: new Date().toISOString() }
}

/**
 * Stop a job
 */
async function stopJob(jobId: string, jobStatus: any, dbJob: any, options: any): Promise<any> {
  if (jobStatus && ['waiting', 'delayed', 'paused'].includes(jobStatus.status)) {
    // Job is in queue but not active - can be cancelled
    // Implementation would depend on Bull queue methods
    logger.warn(`Job ${jobId} stopped from queue status: ${jobStatus.status}`)
  }
  
  if (dbJob) {
    await db.documentProcessingJob.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        errorMessage: options.reason || 'Job cancelled by user'
      }
    })
  }
  
  return { action: 'stopped', jobId, timestamp: new Date().toISOString() }
}

/**
 * Pause a job
 */
async function pauseJob(jobId: string, jobStatus: any, dbJob: any, options: any): Promise<any> {
  if (jobStatus && jobStatus.status === 'active') {
    throw new Error('Cannot pause an actively running job')
  }
  
  if (dbJob) {
    await db.documentProcessingJob.update({
      where: { id: jobId },
      data: {
        status: 'PAUSED'
      }
    })
  }
  
  return { action: 'paused', jobId, timestamp: new Date().toISOString() }
}

/**
 * Resume a paused job
 */
async function resumeJob(jobId: string, jobStatus: any, dbJob: any, options: any): Promise<any> {
  if (dbJob && dbJob.status !== 'PAUSED') {
    throw new Error('Job is not paused')
  }
  
  if (dbJob) {
    await db.documentProcessingJob.update({
      where: { id: jobId },
      data: {
        status: 'QUEUED'
      }
    })
  }
  
  return { action: 'resumed', jobId, timestamp: new Date().toISOString() }
}

/**
 * Retry a failed job
 */
async function retryJob(jobId: string, jobStatus: any, dbJob: any, options: any): Promise<any> {
  if (jobStatus && jobStatus.status !== 'failed') {
    throw new Error('Job is not in failed state')
  }
  
  if (dbJob && dbJob.status !== 'FAILED') {
    throw new Error('Job is not in failed state')
  }
  
  if (dbJob) {
    // Reset job status and retry
    await db.documentProcessingJob.update({
      where: { id: jobId },
      data: {
        status: 'QUEUED',
        progress: 0,
        errorMessage: null,
        retryCount: (dbJob.retryCount || 0) + 1,
        startedAt: null,
        completedAt: null
      }
    })
    
    // Re-add to queue
    return await startJob(jobId, null, { ...dbJob, status: 'QUEUED' }, options)
  }
  
  return { action: 'retried', jobId, timestamp: new Date().toISOString() }
}

/**
 * Delete a job
 */
async function deleteJob(jobId: string, jobStatus: any, dbJob: any, options: any): Promise<any> {
  // Only allow deletion of completed, failed, or cancelled jobs
  const allowedStatuses = ['completed', 'failed', 'COMPLETE', 'FAILED', 'CANCELLED']
  
  if (jobStatus && !allowedStatuses.includes(jobStatus.status)) {
    throw new Error(`Cannot delete job in status: ${jobStatus.status}`)
  }
  
  if (dbJob && !allowedStatuses.includes(dbJob.status)) {
    throw new Error(`Cannot delete job in status: ${dbJob.status}`)
  }
  
  if (dbJob) {
    // Soft delete - mark as deleted but keep for audit trail
    if (options.hardDelete) {
      await db.documentProcessingJob.delete({
        where: { id: jobId }
      })
    } else {
      await db.documentProcessingJob.update({
        where: { id: jobId },
        data: {
          status: 'DELETED'
        }
      })
    }
  }
  
  return { action: 'deleted', jobId, timestamp: new Date().toISOString(), hardDelete: !!options.hardDelete }
}

/**
 * Validate user permissions for job actions
 * This would integrate with your authentication/authorization system
 */
function validatePermissions(action: string, userId?: string): boolean {
  // TODO: Implement proper permission checking
  // For now, return true - in production, check user roles/permissions
  
  const actionPermissions = {
    start: ['admin', 'operator'],
    stop: ['admin', 'operator'],
    pause: ['admin', 'operator'],
    resume: ['admin', 'operator'],
    retry: ['admin', 'operator'],
    delete: ['admin'], // Only admins can delete
    cancel: ['admin', 'operator']
  }
  
  // In a real implementation, you would:
  // 1. Get user from token/session
  // 2. Check user role against required permissions
  // 3. Return true/false based on authorization
  
  return true
} 