/**
 * ProcessingDashboard Component
 * Comprehensive system monitoring dashboard with real-time health checks,
 * job tracking, system statistics, and processing management capabilities
 */

import React, { useState, useEffect, useCallback } from 'react'
import { LoadingSpinner } from '@/components/LoadingSpinner'

// Types based on the API response structure
interface SystemHealth {
  isHealthy: boolean
  services: {
    database: { status: 'healthy' | 'error'; error?: string }
    documentProcessor: { status: 'healthy' | 'error'; error?: string; stats?: any }
    faqGenerator: { status: 'healthy' | 'error'; error?: string; stats?: any }
    piiDetector: { status: 'healthy' | 'error'; error?: string; stats?: any }
    pinecone: { status: 'healthy' | 'error'; error?: string; stats?: any }
    conversationAnalyzer: { status: 'healthy' | 'error'; error?: string }
  }
}

interface JobStatistics {
  totalJobs: number
  completedJobs: number
  failedJobs: number
  queuedJobs: number
  processingJobs: number
  avgProcessingTime: number
}

interface SystemStats {
  totalDocuments: number
  totalFAQs: number
  totalMessages: number
  pendingFAQReviews: number
  piiDetectionsToday: number
  documentsCreatedToday: number
  faqsGeneratedToday: number
}

interface ProcessingJob {
  id: string
  status: string
  jobType: string
  progress: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
}

interface ProcessingStatusData {
  systemHealth: SystemHealth
  processingJobs: {
    active: ProcessingJob[]
    recent: ProcessingJob[]
    statistics: JobStatistics
  }
  systemStats: SystemStats
}

interface ProcessingDashboardProps {
  className?: string
  refreshInterval?: number
  onTriggerProcessing?: (type: string, data: any) => void
}

/**
 * Comprehensive processing dashboard with real-time monitoring
 */
export const ProcessingDashboard: React.FC<ProcessingDashboardProps> = ({
  className = '',
  refreshInterval = 30000, // 30 seconds
  onTriggerProcessing
}) => {
  // State management
  const [data, setData] = useState<ProcessingStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  /**
   * Fetch processing status from API
   */
  const fetchProcessingStatus = useCallback(async () => {
    try {
      setLoading(data === null) // Only show loading on initial load
      setError(null)

      const response = await fetch('/api/processing/status')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch processing status: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch processing status')
      }

      setData(result.data)
      setLastUpdated(new Date())

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
      setError(errorMessage)
      console.error('Failed to fetch processing status:', err)
    } finally {
      setLoading(false)
    }
  }, [data])

  /**
   * Auto-refresh effect
   */
  useEffect(() => {
    fetchProcessingStatus()

    if (autoRefresh) {
      const interval = setInterval(fetchProcessingStatus, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchProcessingStatus, autoRefresh, refreshInterval])

  /**
   * Get service status styling
   */
  const getServiceStatusStyle = (status: 'healthy' | 'error') => {
    return status === 'healthy'
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  }

  /**
   * Get job status styling
   */
  const getJobStatusStyle = (status: string) => {
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
   * Format time for display
   */
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString()
  }

  /**
   * Format duration
   */
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  }

  if (loading && !data) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-2">
          <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-red-800 dark:text-red-200">Failed to load dashboard</span>
        </div>
        <p className="text-sm text-red-700 dark:text-red-300 mb-3">{error}</p>
        <button
          onClick={fetchProcessingStatus}
          className="text-sm bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded transition-colors duration-200"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Processing Dashboard</h1>
          {lastUpdated && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Auto-refresh</span>
          </label>
          
          <button
            onClick={fetchProcessingStatus}
            disabled={loading}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">System Health</h2>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            data.systemHealth.isHealthy 
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}>
            {data.systemHealth.isHealthy ? 'All Systems Operational' : 'System Issues Detected'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(data.systemHealth.services).map(([serviceName, service]) => (
            <div key={serviceName} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                  {serviceName.replace(/([A-Z])/g, ' $1').trim()}
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getServiceStatusStyle(service.status)}`}>
                  {service.status}
                </span>
              </div>
              {service.error && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{service.error}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* System Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Statistics</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {data.systemStats.totalDocuments.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Documents</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {data.systemStats.totalFAQs.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total FAQs</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {data.systemStats.totalMessages.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Messages</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {data.systemStats.pendingFAQReviews.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Pending Reviews</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {data.systemStats.documentsCreatedToday.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Docs Today</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {data.systemStats.faqsGeneratedToday.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">FAQs Today</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {data.systemStats.piiDetectionsToday.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">PII Today</div>
          </div>
        </div>
      </div>

      {/* Processing Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job Statistics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Job Statistics</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Jobs</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {data.processingJobs.statistics.totalJobs.toLocaleString()}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Completed</span>
              <span className="text-sm font-medium text-green-600">
                {data.processingJobs.statistics.completedJobs.toLocaleString()}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Failed</span>
              <span className="text-sm font-medium text-red-600">
                {data.processingJobs.statistics.failedJobs.toLocaleString()}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Processing</span>
              <span className="text-sm font-medium text-blue-600">
                {data.processingJobs.statistics.processingJobs.toLocaleString()}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Queued</span>
              <span className="text-sm font-medium text-yellow-600">
                {data.processingJobs.statistics.queuedJobs.toLocaleString()}
              </span>
            </div>
            
            <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">Avg Processing Time</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDuration(data.processingJobs.statistics.avgProcessingTime)}
              </span>
            </div>
          </div>
        </div>

        {/* Active Jobs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Jobs</h2>
          
          {data.processingJobs.active.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No active jobs</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.processingJobs.active.map((job) => (
                <div key={job.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {job.jobType.replace(/_/g, ' ')}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getJobStatusStyle(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${job.progress * 100}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Started: {formatTime(job.createdAt)}</span>
                    <span>{Math.round(job.progress * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Jobs</h2>
        
        {data.processingJobs.recent.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No recent jobs</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Job Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.processingJobs.recent.map((job) => {
                  const duration = job.completedAt && job.startedAt
                    ? Math.floor((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)
                    : null

                  return (
                    <tr key={job.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {job.jobType.replace(/_/g, ' ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getJobStatusStyle(job.status)}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatTime(job.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {duration ? formatDuration(duration) : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProcessingDashboard 