/**
 * Automation Rules API Endpoint
 * Manages automation rules for scheduled and event-driven processing
 * Supports CRUD operations, rule toggling, and execution scheduling
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { backgroundJobService } from '@/lib/backgroundJobs'
import { ApiResponse, ValidationError, DatabaseError } from '@/types'

/**
 * Automation rule interface
 */
interface AutomationRule {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger: {
    type: 'schedule' | 'event' | 'manual'
    schedule?: string // cron expression
    eventType?: string
    conditions?: Record<string, any>
  }
  action: {
    type: 'document' | 'faq' | 'cleanup' | 'batch' | 'custom'
    parameters: Record<string, any>
    timeout?: number
    retryPolicy?: {
      maxRetries: number
      backoffType: 'linear' | 'exponential'
      initialDelay: number
    }
  }
  permissions: string[]
  metadata: {
    createdBy: string
    createdAt: string
    updatedBy?: string
    updatedAt?: string
    lastRun?: string
    nextRun?: string
    runCount: number
    successCount: number
    failureCount: number
    avgExecutionTime: number
  }
}

/**
 * Automation Rules API handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) {
  try {
    switch (req.method) {
      case 'GET':
        return await handleGetRules(req, res)
      case 'POST':
        return await handleCreateRule(req, res)
      case 'PATCH':
        return await handleUpdateRule(req, res)
      case 'DELETE':
        return await handleDeleteRule(req, res)
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE'])
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        })
    }
  } catch (error) {
    logger.error('Automation rules API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Handle GET /api/processing/automation/rules - Get all automation rules
 */
async function handleGetRules(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<AutomationRule[]>>
) {
  try {
    const { enabled, type, search } = req.query

    // Build filter conditions
    const whereConditions: any = {}
    
    if (enabled !== undefined) {
      whereConditions.enabled = enabled === 'true'
    }
    
    if (type && typeof type === 'string') {
      whereConditions.actionType = type
    }

    // Get rules from database
    const dbRules = await db.automationRule.findMany({
      where: whereConditions,
      orderBy: { createdAt: 'desc' }
    })

    // Transform to API format
    const rules: AutomationRule[] = dbRules.map(transformDbRuleToApi)

    // Apply search filter if provided
    const filteredRules = search && typeof search === 'string'
      ? rules.filter(rule => 
          rule.name.toLowerCase().includes(search.toLowerCase()) ||
          rule.description.toLowerCase().includes(search.toLowerCase())
        )
      : rules

    logger.info(`Retrieved ${filteredRules.length} automation rules`)

    return res.status(200).json({
      success: true,
      data: filteredRules
    })

  } catch (error) {
    logger.error('Failed to get automation rules:', error)
    throw new DatabaseError('Failed to get automation rules', error)
  }
}

/**
 * Handle POST /api/processing/automation/rules - Create new automation rule
 */
async function handleCreateRule(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ ruleId: string }>>
) {
  try {
    const { name, description, trigger, action, permissions = [] } = req.body

    // Validate required fields
    if (!name || typeof name !== 'string') {
      throw new ValidationError('Rule name is required')
    }

    if (!description || typeof description !== 'string') {
      throw new ValidationError('Rule description is required')
    }

    if (!trigger || typeof trigger !== 'object') {
      throw new ValidationError('Rule trigger configuration is required')
    }

    if (!action || typeof action !== 'object') {
      throw new ValidationError('Rule action configuration is required')
    }

    // Validate trigger
    validateTrigger(trigger)
    
    // Validate action
    validateAction(action)

    // Create rule in database
    const dbRule = await db.automationRule.create({
      data: {
        name,
        description,
        enabled: true,
        jobConfig: {
          trigger: trigger,
          action: action,
          permissions: permissions,
          stats: {
            successCount: 0,
            avgExecutionTime: 0,
            failureCount: 0
          }
        },
        createdBy: 'system', // TODO: Get from auth context
        runCount: 0
      }
    })

    // Schedule the rule if it's a scheduled trigger
    if (trigger.type === 'schedule' && trigger.schedule) {
      await scheduleAutomationRule(dbRule.id, trigger.schedule)
    }

    logger.info(`Created automation rule: ${dbRule.id}`)

    return res.status(201).json({
      success: true,
      data: { ruleId: dbRule.id },
      message: 'Automation rule created successfully'
    })

  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message
      })
    }

    logger.error('Failed to create automation rule:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create automation rule'
    })
  }
}

/**
 * Handle PATCH /api/processing/automation/rules - Update automation rule
 */
async function handleUpdateRule(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<AutomationRule>>
) {
  try {
    const { ruleId, enabled, name, description, trigger, action, permissions, schedule, settings } = req.body

    logger.info('PATCH automation rules called with:', { ruleId, enabled, name, description, schedule, settings })

    if (!ruleId || typeof ruleId !== 'string') {
      throw new ValidationError('Rule ID is required')
    }

    // Handle automation rule updates with persistent state storage
    if (ruleId === 'doc-automation' || ruleId === 'faq-automation') {
      logger.info(`Updating automation rule ${ruleId}: enabled = ${enabled}`)
      
      // Build update data
      const updateData: any = {
        updatedBy: 'system',
        updatedAt: new Date()
      }

      if (enabled !== undefined) {
        updateData.enabled = enabled
      }

      // Update trigger config if schedule is provided
      if (schedule !== undefined) {
        updateData.triggerConfig = schedule
      }

      // Update action config if settings is provided
      if (settings !== undefined) {
        updateData.actionConfig = settings
      }
      
      // Update the automation rule in the database
      await db.automationRule.update({
        where: { id: ruleId },
        data: updateData
      })
      
      // Build and return the updated automation rule
      const automationRule: AutomationRule = {
        id: ruleId,
        name: ruleId === 'doc-automation' ? 'Document Processing Automation' : 'FAQ Generation Automation',
        description: ruleId === 'doc-automation' 
          ? 'Automatically process messages into documents' 
          : 'Automatically generate FAQs from documents',
        enabled: enabled,
        trigger: {
          type: 'manual'
        },
        action: {
          type: ruleId === 'doc-automation' ? 'document' : 'faq',
          parameters: {}
        },
        permissions: [],
        metadata: {
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          runCount: 0,
          successCount: 0,
          failureCount: 0,
          avgExecutionTime: 0
        }
      }

      return res.status(200).json({
        success: true,
        data: automationRule,
        message: 'Automation rule updated successfully'
      })
    }

    // Try database operations for full rule management
    try {
      // Find existing rule
      const existingRule = await db.automationRule.findUnique({
        where: { id: ruleId }
      })

      if (!existingRule) {
        return res.status(404).json({
          success: false,
          error: 'Automation rule not found'
        })
      }

      // Build update data
      const updateData: any = {
        updatedBy: 'system', // TODO: Get from auth context
        updatedAt: new Date()
      }

      if (enabled !== undefined) {
        updateData.enabled = enabled
      }

      if (name !== undefined) {
        updateData.name = name
      }

      if (description !== undefined) {
        updateData.description = description
      }

      if (trigger !== undefined) {
        validateTrigger(trigger)
        updateData.triggerType = trigger.type
        updateData.triggerConfig = trigger
      }

      if (action !== undefined) {
        validateAction(action)
        updateData.actionType = action.type
        updateData.actionConfig = action
      }

      if (permissions !== undefined) {
        updateData.permissions = permissions
      }

      // Update rule in database
      const updatedRule = await db.automationRule.update({
        where: { id: ruleId },
        data: updateData
      })

      // Handle scheduling changes
      if (trigger && trigger.type === 'schedule') {
        await scheduleAutomationRule(ruleId, trigger.schedule)
      } else if (enabled === false) {
        await unscheduleAutomationRule(ruleId)
      }

      const apiRule = transformDbRuleToApi(updatedRule)

      logger.info(`Updated automation rule: ${ruleId}`)

      return res.status(200).json({
        success: true,
        data: apiRule,
        message: 'Automation rule updated successfully'
      })

    } catch (dbError) {
      logger.error('Database operation failed:', dbError)
      
      // If database fails, return error for now
      return res.status(500).json({
        success: false,
        error: 'Database operation failed - automation rules need database setup'
      })
    }

  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error('Validation error:', error.message)
      return res.status(400).json({
        success: false,
        error: error.message
      })
    }

    logger.error('Failed to update automation rule:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update automation rule'
    })
  }
}

/**
 * Handle DELETE /api/processing/automation/rules - Delete automation rule
 */
async function handleDeleteRule(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ deleted: boolean }>>
) {
  try {
    const { ruleId } = req.query

    if (!ruleId || typeof ruleId !== 'string') {
      throw new ValidationError('Rule ID is required')
    }

    // Check if rule exists
    const existingRule = await db.automationRule.findUnique({
      where: { id: ruleId }
    })

    if (!existingRule) {
      return res.status(404).json({
        success: false,
        error: 'Automation rule not found'
      })
    }

    // Unschedule if it's a scheduled rule
    await unscheduleAutomationRule(ruleId)

    // Delete rule from database
    await db.automationRule.delete({
      where: { id: ruleId }
    })

    logger.info(`Deleted automation rule: ${ruleId}`)

    return res.status(200).json({
      success: true,
      data: { deleted: true },
      message: 'Automation rule deleted successfully'
    })

  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message
      })
    }

    logger.error('Failed to delete automation rule:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete automation rule'
    })
  }
}

/**
 * Transform database rule to API format
 */
function transformDbRuleToApi(dbRule: any): AutomationRule {
  return {
    id: dbRule.id,
    name: dbRule.name,
    description: dbRule.description,
    enabled: dbRule.enabled,
    trigger: dbRule.triggerConfig || {
      type: dbRule.triggerType || 'manual'
    },
    action: dbRule.actionConfig || {
      type: dbRule.actionType || 'custom',
      parameters: {}
    },
    permissions: dbRule.permissions || [],
    metadata: {
      createdBy: dbRule.createdBy,
      createdAt: dbRule.createdAt.toISOString(),
      updatedBy: dbRule.updatedBy,
      updatedAt: dbRule.updatedAt?.toISOString(),
      lastRun: dbRule.lastRun?.toISOString(),
      nextRun: dbRule.nextRun?.toISOString(),
      runCount: dbRule.runCount || 0,
      successCount: dbRule.successCount || 0,
      failureCount: dbRule.failureCount || 0,
      avgExecutionTime: dbRule.avgExecutionTime || 0
    }
  }
}

/**
 * Validate trigger configuration
 */
function validateTrigger(trigger: any): void {
  const validTriggerTypes = ['schedule', 'event', 'manual']
  
  if (!validTriggerTypes.includes(trigger.type)) {
    throw new ValidationError(`Invalid trigger type: ${trigger.type}`)
  }

  if (trigger.type === 'schedule') {
    if (!trigger.schedule || typeof trigger.schedule !== 'string') {
      throw new ValidationError('Schedule trigger requires a cron expression')
    }
    
    // Validate cron expression format (basic validation)
    const cronParts = trigger.schedule.split(' ')
    if (cronParts.length !== 5 && cronParts.length !== 6) {
      throw new ValidationError('Invalid cron expression format')
    }
  }

  if (trigger.type === 'event') {
    if (!trigger.eventType || typeof trigger.eventType !== 'string') {
      throw new ValidationError('Event trigger requires an event type')
    }
  }
}

/**
 * Validate action configuration
 */
function validateAction(action: any): void {
  const validActionTypes = ['document', 'faq', 'cleanup', 'batch', 'custom']
  
  if (!validActionTypes.includes(action.type)) {
    throw new ValidationError(`Invalid action type: ${action.type}`)
  }

  if (!action.parameters || typeof action.parameters !== 'object') {
    throw new ValidationError('Action requires parameters object')
  }
}

/**
 * Schedule an automation rule with cron scheduling
 */
async function scheduleAutomationRule(ruleId: string, cronExpression: string): Promise<void> {
  try {
    // This would integrate with a job scheduler like node-cron or Bull
    // For now, we'll log the scheduling action
    logger.info(`Scheduling automation rule ${ruleId} with cron: ${cronExpression}`)
    
    // TODO: Implement actual scheduling with your preferred scheduler
    // Example with node-cron:
    // cron.schedule(cronExpression, async () => {
    //   await executeAutomationRule(ruleId)
    // })
    
    // Update next run time in database
    const nextRun = calculateNextRun(cronExpression)
    await db.automationRule.update({
      where: { id: ruleId },
      data: { nextRun }
    })
    
  } catch (error) {
    logger.error(`Failed to schedule automation rule ${ruleId}:`, error)
    throw error
  }
}

/**
 * Unschedule an automation rule
 */
async function unscheduleAutomationRule(ruleId: string): Promise<void> {
  try {
    logger.info(`Unscheduling automation rule ${ruleId}`)
    
    // TODO: Remove from scheduler
    
    // Clear next run time
    await db.automationRule.update({
      where: { id: ruleId },
      data: { nextRun: null }
    })
    
  } catch (error) {
    logger.error(`Failed to unschedule automation rule ${ruleId}:`, error)
    throw error
  }
}

/**
 * Calculate next run time from cron expression
 */
function calculateNextRun(cronExpression: string): Date {
  // This is a simplified implementation
  // In production, use a proper cron parser like 'cron-parser'
  const now = new Date()
  const nextRun = new Date(now.getTime() + 60 * 60 * 1000) // Add 1 hour as placeholder
  return nextRun
}

/**
 * Execute an automation rule
 */
async function executeAutomationRule(ruleId: string): Promise<void> {
  let rule = null
  
  try {
    rule = await db.automationRule.findUnique({
      where: { id: ruleId }
    })

    if (!rule || !rule.enabled) {
      return
    }

    logger.info(`Executing automation rule: ${ruleId}`)

    const startTime = Date.now()
    
    // Update run count
    await db.automationRule.update({
      where: { id: ruleId },
      data: {
        runCount: rule.runCount + 1,
        lastRun: new Date()
      }
    })

    // Execute the action based on rule configuration
    await executeRuleAction(rule)

    const executionTime = Date.now() - startTime
    
    // Update success metrics
    const currentStats = (rule.jobConfig as any)?.stats || { successCount: 0, avgExecutionTime: 0, failureCount: 0 }
    const newJobConfig = {
      ...(rule.jobConfig as any),
      stats: {
        ...currentStats,
        successCount: currentStats.successCount + 1,
        avgExecutionTime: Math.round(
          (currentStats.avgExecutionTime * rule.runCount + executionTime) / (rule.runCount + 1)
        )
      }
    }
    
    await db.automationRule.update({
      where: { id: ruleId },
      data: {
        jobConfig: newJobConfig
      }
    })

    logger.info(`Successfully executed automation rule: ${ruleId}`)

  } catch (error) {
    // Update failure count if rule exists
    if (rule) {
      const currentStats = (rule.jobConfig as any)?.stats || { successCount: 0, avgExecutionTime: 0, failureCount: 0 }
      const newJobConfig = {
        ...(rule.jobConfig as any),
        stats: {
          ...currentStats,
          failureCount: currentStats.failureCount + 1
        }
      }
      
      await db.automationRule.update({
        where: { id: ruleId },
        data: { jobConfig: newJobConfig }
      })
    }

    logger.error(`Failed to execute automation rule ${ruleId}:`, error)
    throw error
  }
}

/**
 * Execute the specific action defined in a rule
 */
async function executeRuleAction(rule: any): Promise<void> {
  const actionConfig = rule.actionConfig || {}
  
  switch (rule.actionType) {
    case 'document':
      await backgroundJobService.addDocumentProcessingJob(actionConfig.parameters)
      break
      
    case 'faq':
      await backgroundJobService.addFAQGenerationJob(actionConfig.parameters)
      break
      
    case 'cleanup':
      // Add cleanup job
      break
      
    case 'batch':
      // Execute batch processing
      break
      
    default:
      logger.warn(`Unknown action type: ${rule.actionType}`)
  }
} 