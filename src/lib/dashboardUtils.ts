/**
 * Dashboard Utilities
 * Shared utility functions for analytics and automation dashboards
 * Implements DRY principle by centralizing common dashboard logic
 */

import { ProcessingJob, JobSource } from '@/types'

/**
 * Service Status Styling Utility
 * Returns consistent CSS classes for service status indicators
 * 
 * @param status - The service status ('healthy' | 'error')
 * @returns CSS class string for styling
 */
export const getServiceStatusStyle = (status: 'healthy' | 'error'): string => {
  return status === 'healthy'
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
}

/**
 * Job Status Styling Utility
 * Returns consistent CSS classes for job status indicators
 * Provides visual consistency across all job displays
 * 
 * @param status - The job status string
 * @returns CSS class string for styling
 */
export const getJobStatusStyle = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'complete':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'processing':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 animate-pulse'
    case 'queued':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
}

/**
 * Time Formatting Utility
 * Formats date strings for consistent display across dashboards
 * 
 * @param dateString - ISO date string
 * @returns Formatted time string
 */
export const formatTime = (dateString: string): string => {
  return new Date(dateString).toLocaleTimeString()
}

/**
 * Duration Formatting Utility
 * Converts seconds to human-readable duration format
 * 
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "2m 30s", "1h 15m")
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

/**
 * Job Source Classification Utility
 * Determines the source type of a job based on its properties
 * Provides consistent job categorization across dashboards
 * 
 * @param job - The processing job object
 * @returns JobSource object with type, color, and label
 */
export const getJobSource = (job: ProcessingJob): JobSource => {
  // Manual jobs are created by identified users
  if (job.createdBy && job.createdBy !== 'system') {
    return { type: 'manual', color: 'blue', label: 'Manual' }
  }
  
  // Scheduled jobs contain 'SCHEDULED' in type or created by automation
  if (job.jobType.includes('SCHEDULED') || job.createdBy === 'automation') {
    return { type: 'scheduled', color: 'green', label: 'Scheduled' }
  }
  
  // Default to automated for system-generated jobs
  return { type: 'automated', color: 'purple', label: 'Automated' }
}

/**
 * Job Duration Calculator
 * Calculates job duration from start and completion times
 * 
 * @param job - The processing job object
 * @returns Duration in seconds, or null if calculation not possible
 */
export const calculateJobDuration = (job: ProcessingJob): number | null => {
  if (!job.completedAt || !job.startedAt) return null
  
  return Math.floor(
    (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000
  )
}

/**
 * System Health Summary
 * Aggregates service health into overall system status
 * 
 * @param services - Object containing service health statuses
 * @returns Object with overall health and summary counts
 */
export const getSystemHealthSummary = (services: Record<string, { status: 'healthy' | 'error' }>) => {
  const serviceEntries = Object.entries(services)
  const healthyCount = serviceEntries.filter(([_, service]) => service.status === 'healthy').length
  const totalCount = serviceEntries.length
  const isHealthy = healthyCount === totalCount
  
  return {
    isHealthy,
    healthyCount,
    totalCount,
    healthPercentage: Math.round((healthyCount / totalCount) * 100)
  }
}

/**
 * Format Service Name
 * Converts camelCase service names to readable format
 * 
 * @param serviceName - The camelCase service name
 * @returns Formatted service name for display
 */
export const formatServiceName = (serviceName: string): string => {
  return serviceName
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase())
}

/**
 * Number Formatting Utility
 * Formats numbers with locale-specific thousands separators
 * 
 * @param num - The number to format
 * @returns Formatted number string
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString()
}

/**
 * Health Status Icon
 * Returns appropriate icon based on health status
 * 
 * @param isHealthy - Boolean indicating system health
 * @returns Object with icon component and styling
 */
export const getHealthStatusIcon = (isHealthy: boolean) => {
  return {
    icon: isHealthy ? '✅' : '⚠️',
    className: isHealthy 
      ? 'text-green-600 dark:text-green-400' 
      : 'text-red-600 dark:text-red-400'
  }
} 