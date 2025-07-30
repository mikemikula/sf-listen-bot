/**
 * Automation Dashboard Component
 * 
 * Purpose: Focused on controlling how automated processes run
 * - Job management and control (active, recent, bulk actions)
 * - Automation rules configuration and scheduling
 * - Processing settings and preferences
 * - Manual job triggers and templates
 * - System automation monitoring and control
 * 
 * Follows SOLID principles:
 * - Single Responsibility: Only handles automation control and job management
 * - Open/Closed: Extensible for new automation features without modification
 * - Interface Segregation: Uses automation-specific interfaces
 * - Dependency Inversion: Depends on abstractions for job management
 */

import React, { useState, useEffect, useCallback } from 'react'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Settings, 
  Zap,
  Eye,
  Search,
  Filter,
  Users,
  Calendar,
  AlertTriangle,
  XCircle,
  Clock,
  Activity,
  Plus,
  Edit3,
  Trash2
} from 'lucide-react'

// Import shared types and utilities (DRY principle)
import { AutomationData, DashboardProps, JobAction, JobFilter, ProcessingJob, ProcessingSettings } from '@/types'
import { 
  getJobStatusStyle, 
  getJobSource,
  formatTime,
  formatDuration,
  calculateJobDuration
} from '@/lib/dashboardUtils'

interface AutomationDashboardProps extends DashboardProps {
  onNavigateToAnalytics?: () => void
  onTriggerProcessing?: (type: string, data: any) => void
}

/**
 * Automation Dashboard Component
 * Provides comprehensive automation control and job management
 */
export const AutomationDashboard: React.FC<AutomationDashboardProps> = ({
  className = '',
  refreshInterval = 15000, // 15 seconds for automation monitoring
  onNavigateToAnalytics,
  onTriggerProcessing
}) => {
  // State management for automation data
  const [data, setData] = useState<AutomationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Job management state
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [jobFilter, setJobFilter] = useState<JobFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Panel state
  const [showAutomationRules, setShowAutomationRules] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showJobDetails, setShowJobDetails] = useState<string | null>(null)

  /**
   * Fetch Automation Data
   * Retrieves job data, automation rules, and settings
   */
  const fetchAutomationData = useCallback(async () => {
    try {
      setLoading(data === null) // Only show loading on initial load
      setError(null)

      // Fetch automation-specific data from API
      const response = await fetch('/api/processing/automation')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch automation data: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch automation data')
      }

      setData(result.data)
      setLastUpdated(new Date())

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
      setError(errorMessage)
      console.error('Failed to fetch automation data:', err)
    } finally {
      setLoading(false)
    }
  }, []) // Remove 'data' dependency to prevent infinite loops

  /**
   * Auto-refresh Effect
   * Handles real-time updates for job monitoring
   */
  useEffect(() => {
    fetchAutomationData()

    if (autoRefresh) {
      const interval = setInterval(fetchAutomationData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval]) // Remove fetchAutomationData dependency

  /**
   * Job Management Actions
   * Handles bulk and individual job operations
   */
  const handleJobAction = useCallback(async (action: JobAction, jobIds: string[]) => {
    try {
      const response = await fetch('/api/processing/jobs/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, jobIds })
      })

      if (!response.ok) {
        throw new Error(`Failed to ${action} jobs`)
      }

      // Refresh data after action
      await fetchAutomationData()
      setSelectedJobs([])
      
    } catch (error) {
      console.error(`Failed to ${action} jobs:`, error)
      setError(error instanceof Error ? error.message : `Failed to ${action} jobs`)
    }
  }, [fetchAutomationData])

  /**
   * Automation Rule Management
   * Handles automation rule toggle and updates
   */
  const handleAutomationRuleToggle = useCallback(async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/processing/automation/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, enabled })
      })

      if (!response.ok) {
        throw new Error('Failed to update automation rule')
      }

      // Update local state
      if (data) {
        setData({
          ...data,
          automationRules: data.automationRules.map(rule => 
            rule.id === ruleId ? { ...rule, enabled } : rule
          )
        })
      }
      
    } catch (error) {
      console.error('Failed to update automation rule:', error)
      setError(error instanceof Error ? error.message : 'Failed to update automation rule')
    }
  }, [data])

  /**
   * Settings Management
   * Handles processing settings updates
   */
  const handleSettingsUpdate = useCallback(async (newSettings: Partial<ProcessingSettings>) => {
    if (!data) return

    try {
      const response = await fetch('/api/processing/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })

      if (!response.ok) {
        throw new Error('Failed to update settings')
      }

      setData({
        ...data,
        processingSettings: { ...data.processingSettings, ...newSettings }
      })
      
    } catch (error) {
      console.error('Failed to update settings:', error)
      setError(error instanceof Error ? error.message : 'Failed to update settings')
    }
  }, [data])

  /**
   * Filter Jobs
   * Applies search and filter criteria to job list
   */
  const getFilteredJobs = useCallback(() => {
    if (!data) return []

    return data.processingJobs.recent
      .filter(job => {
        // Status filter
        if (jobFilter !== 'all' && !job.status.toLowerCase().includes(jobFilter)) return false
        
        // Search filter
        if (searchTerm && !job.jobType.toLowerCase().includes(searchTerm.toLowerCase())) return false
        
        return true
      })
  }, [data, jobFilter, searchTerm])

  const filteredJobs = getFilteredJobs()

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
            Failed to load automation dashboard
          </span>
        </div>
        <p className="text-sm text-red-700 dark:text-red-300 mb-3">{error}</p>
        <button
          onClick={fetchAutomationData}
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
            Automation Control
          </h1>
          {lastUpdated && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {/* Navigation to Analytics */}
          <button
            onClick={onNavigateToAnalytics}
            className="px-4 py-2 text-sm text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 border border-green-300 dark:border-green-600 rounded-md hover:bg-green-50 dark:hover:bg-green-900 transition-colors duration-200"
          >
            View Analytics
          </button>

          {/* Main Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAutomationRules(!showAutomationRules)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors duration-200"
            >
              <Zap className="w-4 h-4" />
              Rules ({data.automationRules.filter(r => r.enabled).length})
            </button>
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors duration-200"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>

          {/* Refresh Controls */}
          <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-600 pl-4">
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
              onClick={fetchAutomationData}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-medium text-red-800 dark:text-red-200">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Automation Rules Panel */}
      {showAutomationRules && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Automation Rules
              </h2>
            </div>
            <button className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors">
              <Plus className="w-4 h-4" />
              Add Rule
            </button>
          </div>

          <div className="space-y-3">
            {data.automationRules.length === 0 ? (
              <div className="text-center py-8">
                <Zap className="mx-auto h-8 w-8 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  No automation rules configured
                </p>
                <button className="mt-4 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors">
                  Create Your First Rule
                </button>
              </div>
            ) : (
              data.automationRules.map((rule) => (
                <div key={rule.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">{rule.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          rule.enabled 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}>
                          {rule.enabled ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{rule.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>Trigger: {rule.trigger.type}</span>
                        <span>Action: {rule.action.type}</span>
                        <span>Runs: {rule.runCount}</span>
                        <span>Success: {Math.round(rule.successRate * 100)}%</span>
                        {rule.nextRun && <span>Next: {new Date(rule.nextRun).toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAutomationRuleToggle(rule.id, !rule.enabled)}
                        className={`p-2 rounded transition-colors ${
                          rule.enabled
                            ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title={rule.enabled ? 'Pause rule' : 'Resume rule'}
                      >
                        {rule.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-6 h-6 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Processing Settings</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Job Management Settings */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">Job Management</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Concurrent Jobs
                  </label>
                  <input
                    type="number"
                    value={data.processingSettings.maxConcurrentJobs}
                    onChange={(e) => handleSettingsUpdate({ maxConcurrentJobs: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Job Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    value={data.processingSettings.jobTimeoutMinutes}
                    onChange={(e) => handleSettingsUpdate({ jobTimeoutMinutes: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={data.processingSettings.autoRetryFailedJobs}
                      onChange={(e) => handleSettingsUpdate({ autoRetryFailedJobs: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Auto-retry failed jobs
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={data.processingSettings.enableScheduledProcessing}
                      onChange={(e) => handleSettingsUpdate({ enableScheduledProcessing: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Enable scheduled processing
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={data.processingSettings.enableAutoCleanup}
                      onChange={(e) => handleSettingsUpdate({ enableAutoCleanup: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Enable auto-cleanup
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Settings */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">Notifications</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={data.processingSettings.notificationSettings.enableSlackAlerts}
                    onChange={(e) => handleSettingsUpdate({ 
                      notificationSettings: { 
                        ...data.processingSettings.notificationSettings, 
                        enableSlackAlerts: e.target.checked 
                      }
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Enable Slack alerts
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={data.processingSettings.notificationSettings.enableEmailAlerts}
                    onChange={(e) => handleSettingsUpdate({ 
                      notificationSettings: { 
                        ...data.processingSettings.notificationSettings, 
                        enableEmailAlerts: e.target.checked 
                      }
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Enable email alerts
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={data.processingSettings.notificationSettings.alertOnFailure}
                    onChange={(e) => handleSettingsUpdate({ 
                      notificationSettings: { 
                        ...data.processingSettings.notificationSettings, 
                        alertOnFailure: e.target.checked 
                      }
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Alert on job failure
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={data.processingSettings.notificationSettings.alertOnSuccess}
                    onChange={(e) => handleSettingsUpdate({ 
                      notificationSettings: { 
                        ...data.processingSettings.notificationSettings, 
                        alertOnSuccess: e.target.checked 
                      }
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Alert on job success
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Jobs Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Jobs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Jobs</h2>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {data.processingJobs.active.length}
            </span>
          </div>
          
          {data.processingJobs.active.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="mx-auto h-8 w-8 text-gray-400" />
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
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getJobStatusStyle(job.status)}`}>
                        {job.status}
                      </span>
                      <button
                        onClick={() => handleJobAction('stop', [job.id])}
                        className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
                        title="Stop job"
                      >
                        <Square className="w-3 h-3" />
                      </button>
                    </div>
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

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-6 h-6 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => onTriggerProcessing?.('document', { template: 'quick-document' })}
              className="p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-900 dark:text-white">Process Documents</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Batch process recent messages into documents
              </p>
            </button>

            <button
              onClick={() => onTriggerProcessing?.('faq', { template: 'quick-faq' })}
              className="p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-gray-900 dark:text-white">Generate FAQs</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Generate FAQs from existing documents
              </p>
            </button>

            <button
              onClick={() => onTriggerProcessing?.('cleanup', { template: 'maintenance' })}
              className="p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <Settings className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900 dark:text-white">System Cleanup</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Clean up old jobs and optimize performance
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Job Management */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Job Management</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({filteredJobs.length} of {data.processingJobs.recent.length})
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Job Type Legend */}
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-400">Manual</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-400">Automated</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-400">Scheduled</span>
              </div>
            </div>
            
            {/* Filters */}
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value as JobFilter)}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Jobs</option>
              <option value="active">Active</option>
              <option value="failed">Failed</option>
              <option value="completed">Completed</option>
            </select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Bulk Actions */}
            {selectedJobs.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedJobs.length} selected
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleJobAction('retry', selectedJobs)}
                    className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 rounded transition-colors"
                    title="Retry selected jobs"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleJobAction('stop', selectedJobs)}
                    className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
                    title="Stop selected jobs"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleJobAction('delete', selectedJobs)}
                    className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Delete selected jobs"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-3">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-8">
              <Filter className="mx-auto h-8 w-8 text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                No jobs match the current filter
              </p>
            </div>
          ) : (
            filteredJobs.map((job) => {
              const jobSource = getJobSource(job)
              const duration = calculateJobDuration(job)
              
              return (
                <div key={job.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedJobs.includes(job.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedJobs(prev => [...prev, job.id])
                          } else {
                            setSelectedJobs(prev => prev.filter(id => id !== job.id))
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 bg-${jobSource.color}-500 rounded-full`} title={`${jobSource.label} job`}></div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {job.jobType.replace(/_/g, ' ')}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getJobStatusStyle(job.status)}`}>
                            {job.status}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs bg-${jobSource.color}-100 text-${jobSource.color}-800 dark:bg-${jobSource.color}-900 dark:text-${jobSource.color}-200`}>
                            {jobSource.label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          <span>Created: {formatTime(job.createdAt)}</span>
                          {job.createdBy && job.createdBy !== 'system' && (
                            <span> • by {job.createdBy}</span>
                          )}
                          {duration && <span> • Duration: {formatDuration(duration)}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {job.status.toLowerCase() === 'failed' && (
                        <button
                          onClick={() => handleJobAction('retry', [job.id])}
                          className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 rounded transition-colors"
                          title="Retry job"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      {['processing', 'queued'].includes(job.status.toLowerCase()) && (
                        <button
                          onClick={() => handleJobAction('stop', [job.id])}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
                          title="Stop job"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setShowJobDetails(showJobDetails === job.id ? null : job.id)}
                        className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Job Details */}
                  {showJobDetails === job.id && (
                    <div className="mt-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                      <div className="text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="font-medium text-gray-900 dark:text-white">Job ID:</span>
                            <span className="ml-2 text-gray-600 dark:text-gray-400 font-mono text-xs">{job.id}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-900 dark:text-white">Progress:</span>
                            <span className="ml-2 text-gray-600 dark:text-gray-400">{Math.round(job.progress * 100)}%</span>
                          </div>
                          {job.startedAt && (
                            <div>
                              <span className="font-medium text-gray-900 dark:text-white">Started:</span>
                              <span className="ml-2 text-gray-600 dark:text-gray-400">{formatTime(job.startedAt)}</span>
                            </div>
                          )}
                          {job.completedAt && (
                            <div>
                              <span className="font-medium text-gray-900 dark:text-white">Completed:</span>
                              <span className="ml-2 text-gray-600 dark:text-gray-400">{formatTime(job.completedAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {job.errorMessage && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-red-800 dark:text-red-200">Error</div>
                          <div className="text-sm text-red-700 dark:text-red-300">{job.errorMessage}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default AutomationDashboard 