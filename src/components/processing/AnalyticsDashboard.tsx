/**
 * Analytics Dashboard Component
 * 
 * Purpose: Focused on understanding what's happening in the system
 * - Real-time system health monitoring
 * - Key performance metrics and statistics
 * - System activity trends and insights
 * - Performance analytics and alerting
 * 
 * Follows SOLID principles:
 * - Single Responsibility: Only handles analytics and monitoring
 * - Open/Closed: Extensible for new metrics without modification
 * - Interface Segregation: Uses specific analytics-focused interfaces
 * - Dependency Inversion: Depends on abstractions, not concrete implementations
 */

import React, { useState, useEffect, useCallback } from 'react'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  RefreshCw,
  BarChart3,
  PieChart,
  Timeline,
  Users
} from 'lucide-react'

// Import shared types and utilities (DRY principle)
import { AnalyticsData, DashboardProps } from '@/types'
import { 
  getServiceStatusStyle, 
  getSystemHealthSummary,
  formatServiceName,
  formatNumber,
  getHealthStatusIcon,
  formatTime
} from '@/lib/dashboardUtils'

interface AnalyticsDashboardProps extends DashboardProps {
  onNavigateToAutomation?: () => void
}

/**
 * Analytics Dashboard Component
 * Provides comprehensive system monitoring and performance insights
 */
export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  className = '',
  refreshInterval = 30000, // 30 seconds for real-time monitoring
  onNavigateToAutomation
}) => {
  // State management for analytics data
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  /**
   * Fetch Analytics Data
   * Retrieves system health, statistics, and performance metrics
   */
  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(data === null) // Only show loading on initial load
      setError(null)

      // Fetch analytics-specific data from API
      const response = await fetch('/api/processing/analytics')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics data: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch analytics data')
      }

      setData(result.data)
      setLastUpdated(new Date())

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
      setError(errorMessage)
      console.error('Failed to fetch analytics data:', err)
    } finally {
      setLoading(false)
    }
  }, [data])

  /**
   * Auto-refresh Effect
   * Handles real-time updates for monitoring
   */
  useEffect(() => {
    fetchAnalyticsData()

    if (autoRefresh) {
      const interval = setInterval(fetchAnalyticsData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchAnalyticsData, autoRefresh, refreshInterval])

  /**
   * Calculate Performance Metrics
   * Derives insights from raw data for better understanding
   */
  const getPerformanceInsights = useCallback(() => {
    if (!data) return null

    const healthSummary = getSystemHealthSummary(data.systemHealth.services)
    const processingEfficiency = data.jobStatistics.totalJobs > 0 
      ? Math.round((data.jobStatistics.completedJobs / data.jobStatistics.totalJobs) * 100)
      : 0

    const errorRate = data.jobStatistics.totalJobs > 0
      ? Math.round((data.jobStatistics.failedJobs / data.jobStatistics.totalJobs) * 100)
      : 0

    return {
      healthSummary,
      processingEfficiency,
      errorRate,
      avgProcessingTime: data.jobStatistics.avgProcessingTime,
      activeJobsCount: data.jobStatistics.processingJobs + data.jobStatistics.queuedJobs
    }
  }, [data])

  const insights = getPerformanceInsights()

  // Loading State
  if (loading && !data) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  // Error State
  if (error && !data) {
    return (
      <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <span className="text-sm font-medium text-red-800 dark:text-red-200">
            Failed to load analytics dashboard
          </span>
        </div>
        <p className="text-sm text-red-700 dark:text-red-300 mb-3">{error}</p>
        <button
          onClick={fetchAnalyticsData}
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
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            System Analytics
          </h1>
          {lastUpdated && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {/* Navigation to Automation */}
          <button
            onClick={onNavigateToAutomation}
            className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors duration-200"
          >
            Manage Automation
          </button>

          {/* Refresh Controls */}
          <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-600 pl-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Real-time</span>
            </label>
            
            <button
              onClick={fetchAnalyticsData}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Updating...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              System Health
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-lg">{getHealthStatusIcon(data.systemHealth.isHealthy).icon}</span>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              data.systemHealth.isHealthy 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {data.systemHealth.isHealthy ? 'All Systems Operational' : 'Issues Detected'}
            </div>
          </div>
        </div>

        {/* Health Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {Object.entries(data.systemHealth.services).map(([serviceName, service]) => (
            <div key={serviceName} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatServiceName(serviceName)}
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getServiceStatusStyle(service.status)}`}>
                  {service.status}
                </span>
              </div>
              {service.error && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-2">
                  {service.error}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Health Insights */}
        {insights && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-green-600">
                  {insights.healthSummary.healthPercentage}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">System Health</div>
              </div>
              <div>
                <div className="text-xl font-bold text-blue-600">
                  {insights.processingEfficiency}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Processing Success</div>
              </div>
              <div>
                <div className="text-xl font-bold text-orange-600">
                  {insights.avgProcessingTime}s
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Avg Processing</div>
              </div>
              <div>
                <div className="text-xl font-bold text-purple-600">
                  {insights.activeJobsCount}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Active Jobs</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Key Metrics Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Statistics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-6 h-6 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Content Statistics
            </h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(data.systemStats.totalDocuments)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Documents</div>
            </div>
            
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(data.systemStats.totalFAQs)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total FAQs</div>
            </div>
            
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(data.systemStats.totalMessages)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Messages</div>
            </div>
            
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {formatNumber(data.systemStats.pendingFAQReviews)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Pending Reviews</div>
            </div>
          </div>
        </div>

        {/* Today's Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Today's Activity
            </h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Documents Created</span>
              <span className="text-lg font-semibold text-blue-600">
                {formatNumber(data.systemStats.documentsCreatedToday)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">FAQs Generated</span>
              <span className="text-lg font-semibold text-green-600">
                {formatNumber(data.systemStats.faqsGeneratedToday)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">PII Detections</span>
              <span className="text-lg font-semibold text-red-600">
                {formatNumber(data.systemStats.piiDetectionsToday)}
              </span>
            </div>
            
            <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">Processing Jobs</span>
              <div className="text-right">
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatNumber(data.jobStatistics.totalJobs)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatNumber(data.jobStatistics.completedJobs)} completed
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Processing Performance */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <PieChart className="w-6 h-6 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Processing Performance
          </h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatNumber(data.jobStatistics.totalJobs)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Jobs</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-green-600">
              {formatNumber(data.jobStatistics.completedJobs)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-red-600">
              {formatNumber(data.jobStatistics.failedJobs)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {formatNumber(data.jobStatistics.processingJobs)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Processing</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-yellow-600">
              {formatNumber(data.jobStatistics.queuedJobs)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Queued</div>
          </div>
        </div>

        {/* Performance Insights */}
        {insights && insights.errorRate > 10 && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  High Error Rate Detected
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  Current error rate is {insights.errorRate}%. Consider reviewing automation settings.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalyticsDashboard 