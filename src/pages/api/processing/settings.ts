/**
 * Processing Settings API Endpoint
 * Manages system-wide processing configuration settings
 * Handles settings persistence, validation, and real-time updates
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ApiResponse, ValidationError, DatabaseError } from '@/types'

/**
 * Processing settings interface
 */
interface ProcessingSettings {
  // Job Management Settings
  maxConcurrentJobs: number
  defaultJobPriority: number
  jobTimeoutMinutes: number
  maxRetryAttempts: number
  autoRetryFailedJobs: boolean
  retryBackoffMultiplier: number
  
  // Processing Settings
  enableScheduledProcessing: boolean
  scheduledProcessingInterval: number // minutes
  batchProcessingSize: number
  enableParallelProcessing: boolean
  
  // Cleanup Settings
  enableAutoCleanup: boolean
  cleanupRetentionDays: number
  cleanupSchedule: string // cron expression
  deleteFailedJobsAfterDays: number
  
  // Notification Settings
  notificationSettings: {
    enableEmailAlerts: boolean
    enableSlackAlerts: boolean
    enableWebhookAlerts: boolean
    alertOnJobStart: boolean
    alertOnJobComplete: boolean
    alertOnJobFailure: boolean
    alertOnJobTimeout: boolean
    alertThresholdMinutes: number
    emailRecipients: string[]
    slackChannel: string
    webhookUrl: string
  }
  
  // Performance Settings
  resourceLimits: {
    maxMemoryMB: number
    maxCpuPercent: number
    maxDiskSpaceMB: number
  }
  
  // Feature Flags
  featureFlags: {
    enableAdvancedAnalytics: boolean
    enableRealTimeUpdates: boolean
    enableJobProfiling: boolean
    enableDebugMode: boolean
  }
  
  // Integration Settings
  integrationSettings: {
    geminiSettings: {
      enabled: boolean
      model: string
      temperature: number
      maxTokens: number
      rateLimitPerMinute: number
    }
    pineconeSettings: {
      enabled: boolean
      environment: string
      indexName: string
      dimension: number
    }
    slackSettings: {
      enabled: boolean
      botToken: string
      signingSecret: string
      defaultChannel: string
    }
  }
  
  // Metadata
  metadata: {
    lastUpdated: string
    updatedBy: string
    version: string
    environment: string
  }
}

/**
 * Default settings configuration
 */
const DEFAULT_SETTINGS: ProcessingSettings = {
  maxConcurrentJobs: 5,
  defaultJobPriority: 0,
  jobTimeoutMinutes: 30,
  maxRetryAttempts: 3,
  autoRetryFailedJobs: true,
  retryBackoffMultiplier: 2,
  
  enableScheduledProcessing: true,
  scheduledProcessingInterval: 15,
  batchProcessingSize: 10,
  enableParallelProcessing: true,
  
  enableAutoCleanup: true,
  cleanupRetentionDays: 30,
  cleanupSchedule: '0 2 * * *', // Daily at 2 AM
  deleteFailedJobsAfterDays: 7,
  
  notificationSettings: {
    enableEmailAlerts: false,
    enableSlackAlerts: true,
    enableWebhookAlerts: false,
    alertOnJobStart: false,
    alertOnJobComplete: false,
    alertOnJobFailure: true,
    alertOnJobTimeout: true,
    alertThresholdMinutes: 60,
    emailRecipients: [],
    slackChannel: '#processing-alerts',
    webhookUrl: ''
  },
  
  resourceLimits: {
    maxMemoryMB: 2048,
    maxCpuPercent: 80,
    maxDiskSpaceMB: 10240
  },
  
  featureFlags: {
    enableAdvancedAnalytics: true,
    enableRealTimeUpdates: true,
    enableJobProfiling: false,
    enableDebugMode: false
  },
  
  integrationSettings: {
    geminiSettings: {
      enabled: true,
      model: 'gemini-pro',
      temperature: 0.7,
      maxTokens: 4096,
      rateLimitPerMinute: 60
    },
    pineconeSettings: {
      enabled: true,
      environment: process.env.PINECONE_ENVIRONMENT || 'development',
      indexName: process.env.PINECONE_INDEX || 'sf-listen-bot',
      dimension: 1536
    },
    slackSettings: {
      enabled: true,
      botToken: process.env.SLACK_BOT_TOKEN || '',
      signingSecret: process.env.SLACK_SIGNING_SECRET || '',
      defaultChannel: '#general'
    }
  },
  
  metadata: {
    lastUpdated: new Date().toISOString(),
    updatedBy: 'system',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  }
}

/**
 * Processing Settings API handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) {
  try {
    switch (req.method) {
      case 'GET':
        return await handleGetSettings(req, res)
      case 'PATCH':
        return await handleUpdateSettings(req, res)
      case 'POST':
        return await handleResetSettings(req, res)
      default:
        res.setHeader('Allow', ['GET', 'PATCH', 'POST'])
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        })
    }
  } catch (error) {
    logger.error('Processing settings API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Handle GET /api/processing/settings - Get current settings
 */
async function handleGetSettings(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ProcessingSettings>>
) {
  try {
    const settings = await getCurrentSettings()
    
    logger.info('Retrieved processing settings')
    
    return res.status(200).json({
      success: true,
      data: settings
    })

  } catch (error) {
    logger.error('Failed to get processing settings:', error)
    throw new DatabaseError('Failed to get processing settings', error)
  }
}

/**
 * Handle PATCH /api/processing/settings - Update settings
 */
async function handleUpdateSettings(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ updated: boolean }>>
) {
  try {
    const updates = req.body

    if (!updates || typeof updates !== 'object') {
      throw new ValidationError('Settings updates are required')
    }

    // Get current settings
    const currentSettings = await getCurrentSettings()
    
    // Validate updates
    const validatedUpdates = validateSettingsUpdates(updates, currentSettings)
    
    // Merge updates with current settings
    const newSettings = mergeSettings(currentSettings, validatedUpdates)
    
    // Update metadata
    newSettings.metadata = {
      ...newSettings.metadata,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'system' // TODO: Get from auth context
    }
    
    // Save settings
    await saveSettings(newSettings)
    
    // Apply runtime changes
    await applySettingsChanges(validatedUpdates, currentSettings)
    
    logger.info('Updated processing settings', { updatedFields: Object.keys(validatedUpdates) })
    
    return res.status(200).json({
      success: true,
      data: { updated: true },
      message: 'Settings updated successfully'
    })

  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message
      })
    }

    logger.error('Failed to update processing settings:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update processing settings'
    })
  }
}

/**
 * Handle POST /api/processing/settings - Reset to defaults
 */
async function handleResetSettings(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ reset: boolean }>>
) {
  try {
    const { confirmReset } = req.body

    if (!confirmReset) {
      throw new ValidationError('Reset confirmation is required')
    }

    // Reset to default settings
    const defaultSettings = {
      ...DEFAULT_SETTINGS,
      metadata: {
        ...DEFAULT_SETTINGS.metadata,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'system' // TODO: Get from auth context
      }
    }
    
    await saveSettings(defaultSettings)
    
    logger.info('Reset processing settings to defaults')
    
    return res.status(200).json({
      success: true,
      data: { reset: true },
      message: 'Settings reset to defaults successfully'
    })

  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message
      })
    }

    logger.error('Failed to reset processing settings:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to reset processing settings'
    })
  }
}

/**
 * Get current processing settings
 */
async function getCurrentSettings(): Promise<ProcessingSettings> {
  try {
    // Try to get settings from database
    const dbSettings = await db.processingSettings.findFirst({
      orderBy: { updatedAt: 'desc' }
    })

    if (dbSettings && dbSettings.settings) {
      // Merge with defaults to ensure all properties exist
      return mergeSettings(DEFAULT_SETTINGS, dbSettings.settings as any)
    }

    // Return defaults if no settings exist
    return DEFAULT_SETTINGS

  } catch (error) {
    logger.warn('Failed to load settings from database, using defaults:', error)
    return DEFAULT_SETTINGS
  }
}

/**
 * Save processing settings
 */
async function saveSettings(settings: ProcessingSettings): Promise<void> {
  try {
    // Upsert settings in database
    await db.processingSettings.upsert({
      where: {
        id: 'default' // Single settings record
      },
      update: {
        settings: settings as any,
        updatedAt: new Date()
      },
      create: {
        id: 'default',
        settings: settings as any,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

  } catch (error) {
    logger.error('Failed to save settings to database:', error)
    throw new DatabaseError('Failed to save settings', error)
  }
}

/**
 * Validate settings updates
 */
function validateSettingsUpdates(updates: any, currentSettings: ProcessingSettings): Partial<ProcessingSettings> {
  const validatedUpdates: any = {}

  // Validate numeric settings
  const numericSettings = [
    'maxConcurrentJobs',
    'defaultJobPriority',
    'jobTimeoutMinutes',
    'maxRetryAttempts',
    'retryBackoffMultiplier',
    'scheduledProcessingInterval',
    'batchProcessingSize',
    'cleanupRetentionDays',
    'deleteFailedJobsAfterDays'
  ]

  for (const setting of numericSettings) {
    if (updates[setting] !== undefined) {
      const value = Number(updates[setting])
      if (isNaN(value) || value < 0) {
        throw new ValidationError(`${setting} must be a positive number`)
      }
      validatedUpdates[setting] = value
    }
  }

  // Validate boolean settings
  const booleanSettings = [
    'autoRetryFailedJobs',
    'enableScheduledProcessing',
    'enableParallelProcessing',
    'enableAutoCleanup'
  ]

  for (const setting of booleanSettings) {
    if (updates[setting] !== undefined) {
      validatedUpdates[setting] = Boolean(updates[setting])
    }
  }

  // Validate nested objects with specific validation
  if (updates.notificationSettings) {
    validatedUpdates.notificationSettings = validateNotificationSettings(updates.notificationSettings)
  }

  if (updates.resourceLimits) {
    validatedUpdates.resourceLimits = validateResourceLimits(updates.resourceLimits)
  }

  if (updates.featureFlags) {
    validatedUpdates.featureFlags = validateFeatureFlags(updates.featureFlags)
  }

  if (updates.integrationSettings) {
    validatedUpdates.integrationSettings = validateIntegrationSettings(updates.integrationSettings)
  }

  return validatedUpdates
}

/**
 * Validate notification settings
 */
function validateNotificationSettings(notifications: any): any {
  const validated: any = {}

  const booleanFields = [
    'enableEmailAlerts',
    'enableSlackAlerts',
    'enableWebhookAlerts',
    'alertOnJobStart',
    'alertOnJobComplete',
    'alertOnJobFailure',
    'alertOnJobTimeout'
  ]

  for (const field of booleanFields) {
    if (notifications[field] !== undefined) {
      validated[field] = Boolean(notifications[field])
    }
  }

  if (notifications.alertThresholdMinutes !== undefined) {
    const value = Number(notifications.alertThresholdMinutes)
    if (isNaN(value) || value < 0) {
      throw new ValidationError('Alert threshold must be a positive number')
    }
    validated.alertThresholdMinutes = value
  }

  if (notifications.emailRecipients !== undefined) {
    if (!Array.isArray(notifications.emailRecipients)) {
      throw new ValidationError('Email recipients must be an array')
    }
    validated.emailRecipients = notifications.emailRecipients
  }

  if (notifications.slackChannel !== undefined) {
    validated.slackChannel = String(notifications.slackChannel)
  }

  if (notifications.webhookUrl !== undefined) {
    validated.webhookUrl = String(notifications.webhookUrl)
  }

  return validated
}

/**
 * Validate resource limits
 */
function validateResourceLimits(limits: any): any {
  const validated: any = {}

  const numericFields = ['maxMemoryMB', 'maxCpuPercent', 'maxDiskSpaceMB']

  for (const field of numericFields) {
    if (limits[field] !== undefined) {
      const value = Number(limits[field])
      if (isNaN(value) || value <= 0) {
        throw new ValidationError(`${field} must be a positive number`)
      }
      validated[field] = value
    }
  }

  return validated
}

/**
 * Validate feature flags
 */
function validateFeatureFlags(flags: any): any {
  const validated: any = {}

  const booleanFields = [
    'enableAdvancedAnalytics',
    'enableRealTimeUpdates',
    'enableJobProfiling',
    'enableDebugMode'
  ]

  for (const field of booleanFields) {
    if (flags[field] !== undefined) {
      validated[field] = Boolean(flags[field])
    }
  }

  return validated
}

/**
 * Validate integration settings
 */
function validateIntegrationSettings(integrations: any): any {
  const validated: any = {}

  if (integrations.geminiSettings) {
    validated.geminiSettings = {}
    const gemini = integrations.geminiSettings

    if (gemini.enabled !== undefined) {
      validated.geminiSettings.enabled = Boolean(gemini.enabled)
    }

    if (gemini.model !== undefined) {
      validated.geminiSettings.model = String(gemini.model)
    }

    if (gemini.temperature !== undefined) {
      const temp = Number(gemini.temperature)
      if (isNaN(temp) || temp < 0 || temp > 2) {
        throw new ValidationError('Temperature must be between 0 and 2')
      }
      validated.geminiSettings.temperature = temp
    }

    if (gemini.maxTokens !== undefined) {
      const tokens = Number(gemini.maxTokens)
      if (isNaN(tokens) || tokens <= 0) {
        throw new ValidationError('Max tokens must be a positive number')
      }
      validated.geminiSettings.maxTokens = tokens
    }

    if (gemini.rateLimitPerMinute !== undefined) {
      const rate = Number(gemini.rateLimitPerMinute)
      if (isNaN(rate) || rate <= 0) {
        throw new ValidationError('Rate limit must be a positive number')
      }
      validated.geminiSettings.rateLimitPerMinute = rate
    }
  }

  // Similar validation for other integration settings...

  return validated
}

/**
 * Merge settings objects, preserving structure
 */
function mergeSettings(base: ProcessingSettings, updates: Partial<ProcessingSettings>): ProcessingSettings {
  const merged = { ...base } as any

  for (const [key, value] of Object.entries(updates)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Deep merge objects
      merged[key] = {
        ...(merged[key] || {}),
        ...value
      }
    } else {
      // Direct assignment for primitives and arrays
      merged[key] = value
    }
  }

  return merged as ProcessingSettings
}

/**
 * Apply runtime changes based on settings updates
 */
async function applySettingsChanges(updates: Partial<ProcessingSettings>, current: ProcessingSettings): Promise<void> {
  try {
    // Apply job queue configuration changes
    if (updates.maxConcurrentJobs && updates.maxConcurrentJobs !== current.maxConcurrentJobs) {
      logger.info(`Updating max concurrent jobs: ${current.maxConcurrentJobs} -> ${updates.maxConcurrentJobs}`)
      // TODO: Update background job service concurrency
    }

    // Apply cleanup schedule changes
    if (updates.enableAutoCleanup !== undefined || updates.cleanupSchedule) {
      logger.info('Updating cleanup schedule configuration')
      // TODO: Update cleanup job scheduling
    }

    // Apply notification changes
    if (updates.notificationSettings) {
      logger.info('Updating notification configuration')
      // TODO: Update notification service configuration
    }

    logger.info('Applied runtime settings changes')

  } catch (error) {
    logger.error('Failed to apply runtime settings changes:', error)
    // Don't throw here - settings were saved successfully
  }
} 