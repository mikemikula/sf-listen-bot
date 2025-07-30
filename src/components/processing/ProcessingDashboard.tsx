/**
 * ProcessingDashboard Component
 * Comprehensive system monitoring dashboard with real-time health checks,
 * job tracking, system statistics, processing management capabilities,
 * and advanced automation controls
 */

import React, { useState, useEffect, useCallback } from 'react'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Settings, 
  Users, 
  Calendar,
  AlertTriangle,
  XCircle,
  Clock,
  Activity,
  Zap,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Download,
  Upload
} from 'lucide-react'

// Types based on the API response structure
interface SystemHealth {
  isHealthy: boolean
  services: {
    database: { status: 'healthy' | 'error'; error?: string }
    documentProcessor: { status: 'healthy' | 'error'; error?: string; stats?: any }
    faqGenerator: { status: 'healthy' | 'error'; error?: string; stats?: any }
    piiDetector: { status: 'healthy' | 'error'; error?: string; stats?: any }
    pinecone: { status: 'healthy' | 'error'; error?: string; stats?: any }
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
  createdBy?: string
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

interface AutomationRule {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger: {
    type: 'schedule' | 'event' | 'manual'
    schedule?: string // cron expression
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
}

interface ProcessingSettings {
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

interface ProcessingDashboardProps {
  className?: string
  refreshInterval?: number
  onTriggerProcessing?: (type: string, data: any) => void
}

/**
 * Comprehensive processing dashboard with real-time monitoring and automation
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
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)
  const [showAutomationPanel, setShowAutomationPanel] = useState(false)
  const [showSettingsPanel, setShowSettingsPanel] = useState(false)

  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [jobFilter, setJobFilter] = useState<'all' | 'active' | 'failed' | 'completed'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([])
  const [processingSettings, setProcessingSettings] = useState<ProcessingSettings>({
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
  })

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

  /**
   * Job management actions
   */
  const handleJobAction = useCallback(async (action: string, jobIds: string[]) => {
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
      await fetchProcessingStatus()
      setSelectedJobs([])
      
    } catch (error) {
      console.error(`Failed to ${action} jobs:`, error)
      setError(error instanceof Error ? error.message : `Failed to ${action} jobs`)
    }
  }, [fetchProcessingStatus])

  /**
   * Automation rule management
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

      setAutomationRules(prev => 
        prev.map(rule => 
          rule.id === ruleId ? { ...rule, enabled } : rule
        )
      )
      
    } catch (error) {
      console.error('Failed to update automation rule:', error)
    }
  }, [])

  /**
   * Settings management
   */
  const handleSettingsUpdate = useCallback(async (newSettings: Partial<ProcessingSettings>) => {
    try {
      const response = await fetch('/api/processing/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })

      if (!response.ok) {
        throw new Error('Failed to update settings')
      }

      setProcessingSettings(prev => ({ ...prev, ...newSettings }))
      
    } catch (error) {
      console.error('Failed to update settings:', error)
    }
  }, [])

  /**
   * Load automation rules and settings
   */
  useEffect(() => {
    const loadAutomationData = async () => {
      try {
        const [rulesResponse, settingsResponse] = await Promise.all([
          fetch('/api/processing/automation/rules'),
          fetch('/api/processing/settings')
        ])

        if (rulesResponse.ok) {
          const rulesData = await rulesResponse.json()
          setAutomationRules(rulesData.data || [])
        }

        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json()
          setProcessingSettings(prev => ({ ...prev, ...settingsData.data }))
        }
      } catch (error) {
        console.error('Failed to load automation data:', error)
      }
    }

    loadAutomationData()
  }, [])

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
      {/* Enhanced Header with Controls */}
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
            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAutomationPanel(!showAutomationPanel)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors duration-200"
              >
                <Zap className="w-4 h-4" />
                Automation
              </button>
              
              <button
                onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors duration-200"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </div>

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
              onClick={fetchProcessingStatus}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Automation Rules Panel */}
      {showAutomationPanel && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Automation Rules</h2>
            <button className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors">
              Add Rule
            </button>
          </div>

          <div className="space-y-3">
            {automationRules.length === 0 ? (
              <div className="text-center py-8">
                <Zap className="mx-auto h-8 w-8 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No automation rules configured</p>
              </div>
            ) : (
              automationRules.map((rule) => (
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
                      >
                        {rule.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors">
                        <Settings className="w-4 h-4" />
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
      {showSettingsPanel && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Processing Settings</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">Job Management</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Concurrent Jobs
                  </label>
                  <input
                    type="number"
                    value={processingSettings.maxConcurrentJobs}
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
                    value={processingSettings.jobTimeoutMinutes}
                    onChange={(e) => handleSettingsUpdate({ jobTimeoutMinutes: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={processingSettings.autoRetryFailedJobs}
                    onChange={(e) => handleSettingsUpdate({ autoRetryFailedJobs: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Auto-retry failed jobs
                  </label>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">Notifications</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={processingSettings.notificationSettings.enableSlackAlerts}
                    onChange={(e) => handleSettingsUpdate({ 
                      notificationSettings: { 
                        ...processingSettings.notificationSettings, 
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
                    checked={processingSettings.notificationSettings.alertOnFailure}
                    onChange={(e) => handleSettingsUpdate({ 
                      notificationSettings: { 
                        ...processingSettings.notificationSettings, 
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
                    checked={processingSettings.enableAutoCleanup}
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
        </div>
      )}



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

      {/* Enhanced Job Management Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Job Management</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              All processing activities including manual document creation, automated jobs, and scheduled tasks
            </p>
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
            
            {/* Job Filters */}
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value as any)}
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

        {/* Enhanced Job List with Controls */}
        {data && (
          <div className="space-y-3">
            {data.processingJobs.recent
              .filter(job => {
                if (jobFilter !== 'all' && !job.status.toLowerCase().includes(jobFilter)) return false
                if (searchTerm && !job.jobType.toLowerCase().includes(searchTerm.toLowerCase())) return false
                return true
              })
              .map((job) => {
                // Determine job source based on createdBy and other factors
                const getJobSource = (job: any) => {
                  if (job.createdBy && job.createdBy !== 'system') {
                    return { type: 'manual', color: 'blue', label: 'Manual' }
                  } else if (job.jobType.includes('SCHEDULED') || job.createdBy === 'automation') {
                    return { type: 'scheduled', color: 'green', label: 'Scheduled' }
                  } else {
                    return { type: 'automated', color: 'purple', label: 'Automated' }
                  }
                }
                
                const jobSource = getJobSource(job)
                
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
                            {/* Job Source Indicator */}
                            <div className={`w-2 h-2 bg-${jobSource.color}-500 rounded-full`} title={`${jobSource.label} job`}></div>
                            
                            <span className="font-medium text-gray-900 dark:text-white">
                              {job.jobType.replace(/_/g, ' ')}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getJobStatusStyle(job.status)}`}>
                              {job.status}
                            </span>
                            
                            {/* Job Source Label */}
                            <span className={`px-2 py-1 rounded text-xs bg-${jobSource.color}-100 text-${jobSource.color}-800 dark:bg-${jobSource.color}-900 dark:text-${jobSource.color}-200`}>
                              {jobSource.label}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            <span>Created: {formatTime(job.createdAt)}</span>
                            {job.createdBy && job.createdBy !== 'system' && (
                              <span> • by {job.createdBy}</span>
                            )}
                            <span> • ID: {job.id}</span>
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
                          className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors"
                          title="View logs"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

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
              })}
          </div>
        )}
      </div>

      {/* Quick Start Templates */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Start Templates</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
  )
}

export default ProcessingDashboard 