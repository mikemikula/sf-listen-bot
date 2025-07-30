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
import Link from 'next/link'
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
  Trash2,
  Bot,
  MessageSquare,
  FileText,
  HelpCircle,
  Globe
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

  // New state for advanced document settings
  const [showDocumentAdvanced, setShowDocumentAdvanced] = useState(false)
  // New state for advanced FAQ settings
  const [showFAQAdvanced, setShowFAQAdvanced] = useState(false)
  // State for simulating pending duplicate reviews
  const [pendingDuplicateReviews, setPendingDuplicateReviews] = useState(0)
  
  // Local state for pending settings changes
  const [pendingFAQChanges, setPendingFAQChanges] = useState<any>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false)
  const [savingChanges, setSavingChanges] = useState<boolean>(false)
  
  // Get user's timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timezoneAbbr = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ')[2]

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
        const updatedAutomationRules = { ...data.automationRules }
        
        if (ruleId === 'doc-automation' && updatedAutomationRules.documentProcessing) {
          updatedAutomationRules.documentProcessing = {
            ...updatedAutomationRules.documentProcessing,
            enabled
          }
        } else if (ruleId === 'faq-automation' && updatedAutomationRules.faqGeneration) {
          updatedAutomationRules.faqGeneration = {
            ...updatedAutomationRules.faqGeneration,
            enabled
          }
        }

        setData({
          ...data,
          automationRules: updatedAutomationRules
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
   * Update Document Processing Settings
   * Handles updates to document processing automation configuration
   */
  const handleDocumentSettingsUpdate = useCallback(async (updates: any) => {
    if (!data?.automationRules.documentProcessing) return

    try {
      // Update local state immediately for better UX
      const updatedDocProcessing = {
        ...data.automationRules.documentProcessing,
        schedule: {
          ...data.automationRules.documentProcessing.schedule,
          ...updates.schedule
        },
        settings: {
          ...data.automationRules.documentProcessing.settings,
          ...updates.settings
        }
      }

      setData({
        ...data,
        automationRules: {
          ...data.automationRules,
          documentProcessing: updatedDocProcessing
        }
      })

      // TODO: Send to API to persist changes
      console.log('Document processing settings updated:', updates)
      
    } catch (error) {
      console.error('Failed to update document processing settings:', error)
      setError('Failed to update document processing settings')
    }
  }, [data])

  /**
   * Update FAQ Generation Settings (Local State Only)
   * Handles updates to FAQ generation automation configuration
   * Changes are staged locally until explicitly saved
   */
  const handleFAQSettingsUpdate = useCallback((key: string, value: any) => {
    if (!data?.automationRules.faqGeneration) return

    try {
      // Get current state (either pending changes or original data)
      const currentFAQGeneration = pendingFAQChanges || data.automationRules.faqGeneration
      
      // Create updated FAQ generation config
      const updatedFAQGeneration = {
        ...currentFAQGeneration,
        schedule: {
          ...currentFAQGeneration.schedule,
          ...(key === 'frequency' ? { frequency: value } : {}),
          ...(key === 'customInterval' ? { customInterval: value } : {}),
          ...(key === 'customUnit' ? { customUnit: value } : {}),
          ...(key === 'customTime' ? { customTime: value } : {}),
          ...(key === 'customDayOfWeek' ? { customDayOfWeek: value } : {})
        },
        settings: {
          ...currentFAQGeneration.settings,
          ...(key === 'maxFAQsPerRun' ? { maxFAQsPerRun: parseInt(value) } : {}),
          ...(key === 'qualityThreshold' ? { qualityThreshold: parseFloat(value) } : {}),
          ...(key === 'requireApproval' ? { requireApproval: value } : {})
        }
      }

      // Update pending changes
      setPendingFAQChanges(updatedFAQGeneration)
      setHasUnsavedChanges(true)
      
      console.log('FAQ generation settings staged locally:', key, value)
      
    } catch (error) {
      console.error('Failed to stage FAQ generation settings:', error)
      setError('Failed to update FAQ generation settings')
    }
  }, [data, pendingFAQChanges])

  /**
   * Save Pending FAQ Settings Changes
   * Sends staged changes to the API and updates the main data state
   */
  const saveFAQSettings = useCallback(async () => {
    if (!pendingFAQChanges || !data) return

    setSavingChanges(true)
    setError(null)

    try {
      // Send to API to persist changes
      const response = await fetch('/api/processing/automation/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleId: 'faq-automation',
          enabled: pendingFAQChanges.enabled,
          schedule: pendingFAQChanges.schedule,
          settings: pendingFAQChanges.settings
        })
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Failed to save settings: ${response.status} ${errorData}`)
      }

      // Update main data state with saved changes
      setData({
        ...data,
        automationRules: {
          ...data.automationRules,
          faqGeneration: pendingFAQChanges
        }
      })

      // Clear pending changes
      setPendingFAQChanges(null)
      setHasUnsavedChanges(false)
      
      console.log('FAQ settings saved successfully')
      
    } catch (error) {
      console.error('Failed to save FAQ settings:', error)
      setError(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setSavingChanges(false)
    }
  }, [pendingFAQChanges, data])

  /**
   * Cancel Pending FAQ Settings Changes
   * Discards staged changes and reverts to saved state
   */
  const cancelFAQSettings = useCallback(() => {
    setPendingFAQChanges(null)
    setHasUnsavedChanges(false)
    console.log('FAQ settings changes cancelled')
  }, [])

  /**
   * Get Current FAQ Data
   * Returns pending changes if available, otherwise returns actual data
   */
  const getCurrentFAQData = useCallback(() => {
    return pendingFAQChanges || data?.automationRules.faqGeneration
  }, [pendingFAQChanges, data])

  /**
   * Format time with timezone for display
   */
  const formatTimeWithTimezone = useCallback((time: string) => {
    return `${time} ${timezoneAbbr}`
  }, [timezoneAbbr])

  /**
   * Get next scheduled run time (for future enhancement)
   */
  const getNextRunTime = useCallback(() => {
    const faqData = getCurrentFAQData()
    if (!faqData?.enabled || faqData?.schedule?.frequency === 'manual') {
      return 'Manual only'
    }
    
    // For now, just show that it's scheduled
    // In the future, this could calculate the actual next run time
    return `Scheduled (${userTimezone})`
  }, [getCurrentFAQData, userTimezone])

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
                     <h1 className="text-2xl font-bold text-white">Automation Control</h1>
           <p className="text-gray-400 text-sm">
             Last updated: {new Date().toLocaleTimeString()} {timezoneAbbr}
           </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/processing/dashboard">
            <button className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">
              View Analytics
            </button>
          </Link>
          <Link href="/processing/automation/help">
            <button className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">
              Help
            </button>
          </Link>
                               <div className="bg-purple-900/50 px-3 py-2 rounded-lg border border-purple-500/30">
            <span className="text-purple-300 text-sm font-medium flex items-center gap-1">
              <Zap className="w-4 h-4" />
              Automation ({getCurrentFAQData()?.enabled ? 1 : 0}/1)
            </span>
          </div>
          <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
            <Settings className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              id="auto-refresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="auto-refresh" className="text-gray-300">Auto-refresh</label>
          </div>
          <button
            onClick={fetchAutomationData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Main Automation Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Smart FAQ Generation</h2>
            <p className="text-gray-400">
              Automatically turn your Slack conversations into searchable FAQs
            </p>
          </div>
        </div>

        {/* Unified Automation Control */}
        <div className="bg-gray-700/50 rounded-lg p-6 border border-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white">FAQ Automation</h3>
                <p className="text-gray-400 text-sm">
                  Process messages → documents → FAQs automatically
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
                             <button
                 onClick={() => handleAutomationRuleToggle('faq-automation', !getCurrentFAQData()?.enabled)}
                 className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                   getCurrentFAQData()?.enabled
                     ? 'bg-purple-600 hover:bg-purple-700 text-white'
                     : 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                 }`}
               >
                 {getCurrentFAQData()?.enabled ? 'Enabled' : 'Enable'}
               </button>
              <button
                onClick={() => onTriggerProcessing?.('faq', { 
                  template: 'automation',
                  ...data.automationRules.faqGeneration?.settings 
                })}
                disabled={loading}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  loading
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {loading ? 'Running...' : 'Run Now'}
              </button>
            </div>
          </div>

                     {/* Status */}
           <div className="flex items-center gap-6 mb-4 text-sm">
             <div className="flex items-center gap-2">
               <div className={`w-2 h-2 rounded-full ${
                 getCurrentFAQData()?.enabled ? 'bg-green-500' : 'bg-gray-500'
               }`}></div>
               <span className="text-gray-300">
                 {getCurrentFAQData()?.enabled ? 'Active' : 'Inactive'}
               </span>
               {hasUnsavedChanges && (
                 <div className="flex items-center gap-1 text-yellow-400 text-sm">
                   <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>
                   <span>Unsaved changes</span>
                 </div>
               )}
             </div>
             <span className="text-gray-400">
               {getCurrentFAQData()?.stats?.faqsGenerated || 0} FAQs created
             </span>
             <span className="text-gray-400">
               {Math.round((getCurrentFAQData()?.stats?.successfulRuns / getCurrentFAQData()?.stats?.totalRuns) * 100) || 0}% success rate
             </span>
                         <div className="flex items-center gap-1 text-gray-400">
              <Globe className="w-3 h-3" />
              <span className="text-xs">{getNextRunTime()}</span>
            </div>
           </div>

                     {/* Configuration */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <div>
               <label className="block text-sm font-medium text-gray-300 mb-2">
                 Runs:
               </label>
               <select
                 value={getCurrentFAQData()?.schedule?.frequency || 'manual'}
                 onChange={(e) => handleFAQSettingsUpdate('frequency', e.target.value)}
                 className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
               >
                 <option value="manual">When I click &quot;Run Now&quot;</option>
                 <option value="hourly">Every hour</option>
                 <option value="daily">Daily at 9:00 AM {timezoneAbbr}</option>
                 <option value="weekly">Weekly on Monday at 9:00 AM {timezoneAbbr}</option>
                 <option value="custom">Custom schedule...</option>
               </select>
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-300 mb-2">
                 Process:
               </label>
               <select
                 value={getCurrentFAQData()?.settings?.maxFAQsPerRun || 25}
                 onChange={(e) => handleFAQSettingsUpdate('maxFAQsPerRun', parseInt(e.target.value))}
                 className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
               >
                 <option value="5">Up to 5 FAQs at once</option>
                 <option value="10">Up to 10 FAQs at once</option>
                 <option value="20">Up to 20 FAQs at once</option>
               </select>
             </div>
           </div>

                       {/* Custom Schedule Configuration */}
            {getCurrentFAQData()?.schedule?.frequency === 'custom' && (
             <div className="mb-4 p-4 bg-gray-800/50 rounded-lg border border-gray-600">
               <h4 className="text-white font-medium mb-3">Custom Schedule</h4>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {/* Frequency Type */}
                 <div>
                   <label className="block text-sm font-medium text-gray-300 mb-2">
                     Repeat Every:
                   </label>
                   <div className="flex gap-2">
                     <input
                       type="number"
                       min="1"
                       max="24"
                       value={getCurrentFAQData()?.schedule?.customInterval || 1}
                       onChange={(e) => handleFAQSettingsUpdate('customInterval', parseInt(e.target.value))}
                       className="w-20 bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                     />
                     <select
                       value={getCurrentFAQData()?.schedule?.customUnit || 'hours'}
                       onChange={(e) => handleFAQSettingsUpdate('customUnit', e.target.value)}
                       className="flex-1 bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                     >
                       <option value="minutes">Minutes</option>
                       <option value="hours">Hours</option>
                       <option value="days">Days</option>
                       <option value="weeks">Weeks</option>
                     </select>
                   </div>
                 </div>

                 {/* Time of Day */}
                 <div>
                   <label className="block text-sm font-medium text-gray-300 mb-2">
                     Time ({timezoneAbbr}):
                   </label>
                   <div className="relative">
                     <input
                       type="time"
                       value={getCurrentFAQData()?.schedule?.customTime || '09:00'}
                       onChange={(e) => handleFAQSettingsUpdate('customTime', e.target.value)}
                       className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 pr-16 text-white focus:ring-2 focus:ring-purple-500"
                     />
                     <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                       {timezoneAbbr}
                     </div>
                   </div>
                   <p className="text-xs text-gray-400 mt-1">
                     Your timezone: {userTimezone}
                   </p>
                 </div>

                 {/* Day of Week (for weekly) */}
                 {getCurrentFAQData()?.schedule?.customUnit === 'weeks' && (
                   <div>
                     <label className="block text-sm font-medium text-gray-300 mb-2">
                       Day of Week:
                     </label>
                     <select
                       value={getCurrentFAQData()?.schedule?.customDayOfWeek || 1}
                       onChange={(e) => handleFAQSettingsUpdate('customDayOfWeek', parseInt(e.target.value))}
                       className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                     >
                       <option value={1}>Monday</option>
                       <option value={2}>Tuesday</option>
                       <option value={3}>Wednesday</option>
                       <option value={4}>Thursday</option>
                       <option value={5}>Friday</option>
                       <option value={6}>Saturday</option>
                       <option value={0}>Sunday</option>
                     </select>
                   </div>
                 )}
               </div>

               {/* Schedule Preview */}
               <div className="mt-3 p-3 bg-blue-900/20 rounded-lg border border-blue-500/30">
                 <div className="flex items-center gap-2">
                   <span className="text-blue-300 text-sm font-medium flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Schedule Preview:
              </span>
                                        <span className="text-blue-200 text-sm">
                       {(() => {
                         const currentData = getCurrentFAQData()?.schedule;
                         const interval = currentData?.customInterval || 1;
                         const unit = currentData?.customUnit || 'hours';
                         const time = currentData?.customTime || '09:00';
                         const dayOfWeek = currentData?.customDayOfWeek || 1;
                         const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                         
                         if (unit === 'minutes') {
                           return `Every ${interval} minute${interval > 1 ? 's' : ''}`;
                         } else if (unit === 'hours') {
                           return `Every ${interval} hour${interval > 1 ? 's' : ''} at :${time.split(':')[1]} ${timezoneAbbr}`;
                         } else if (unit === 'days') {
                           return `Every ${interval} day${interval > 1 ? 's' : ''} at ${time} ${timezoneAbbr}`;
                         } else if (unit === 'weeks') {
                           return `Every ${interval} week${interval > 1 ? 's' : ''} on ${dayNames[dayOfWeek]} at ${time} ${timezoneAbbr}`;
                         }
                         return '';
                       })()}
                     </span>
                 </div>
               </div>
             </div>
           )}

          {/* Advanced Options */}
          <div className="text-right">
            <button
              onClick={() => setShowFAQAdvanced(!showFAQAdvanced)}
              className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
            >
              {showFAQAdvanced ? 'Hide' : 'Show'} Advanced Options
            </button>
          </div>

          {showFAQAdvanced && (
            <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-600">
              <h4 className="text-white font-medium mb-3">Advanced Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Quality Filter:
                  </label>
                                     <select
                     value={getCurrentFAQData()?.settings?.qualityThreshold || 'medium'}
                     onChange={(e) => handleFAQSettingsUpdate('qualityThreshold', e.target.value)}
                     className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                   >
                     <option value="low">Process all conversations</option>
                     <option value="medium">Skip low-quality conversations</option>
                     <option value="high">Only high-quality conversations</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-300 mb-2">
                     Approval Required:
                   </label>
                   <div className="flex items-center">
                     <input
                       type="checkbox"
                       checked={getCurrentFAQData()?.settings?.requireApproval ?? false}
                       onChange={(e) => handleFAQSettingsUpdate('requireApproval', e.target.checked)}
                       className="rounded mr-2"
                     />
                     <span className="text-gray-300 text-sm">Require manual approval before publishing FAQs</span>
                   </div>
                 </div>
              </div>
            </div>
                     )}

           {/* Save/Cancel Buttons */}
           {hasUnsavedChanges && (
             <div className="mt-4 p-4 bg-yellow-900/20 rounded-lg border border-yellow-500/30">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2 text-yellow-300">
                   <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                   <span className="text-sm font-medium">You have unsaved changes</span>
                 </div>
                 <div className="flex items-center gap-3">
                   <button
                     onClick={cancelFAQSettings}
                     disabled={savingChanges}
                     className="px-4 py-2 text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     Cancel
                   </button>
                   <button
                     onClick={saveFAQSettings}
                     disabled={savingChanges}
                     className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                   >
                     {savingChanges ? (
                       <>
                         <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                         Saving...
                       </>
                     ) : (
                       <>
                         <span>💾</span>
                         Save Changes
                       </>
                     )}
                   </button>
                 </div>
               </div>
             </div>
           )}
         </div>

                  {/* How It Works */}
         <div className="mt-6 p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
                     <h4 className="text-blue-300 font-medium mb-2">How This Works:</h4>
          <div className="flex items-center gap-4 text-sm text-blue-200">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              Slack Messages
            </span>
            <span>→</span>
            <span className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              Documents
            </span>
            <span>→</span>
            <span className="flex items-center gap-1">
              <HelpCircle className="w-4 h-4" />
              Searchable FAQs
            </span>
          </div>
           <p className="text-blue-200/80 text-sm mt-2">
             The system automatically processes your Slack conversations, creates organized documents, 
             then generates searchable FAQ entries that your team can easily find and reference.
           </p>
           <div className="mt-3 pt-3 border-t border-blue-500/30">
                         <div className="flex items-center gap-2 text-xs text-blue-300">
              <Globe className="w-3 h-3" />
              <span>All scheduled times are in your local timezone: <strong>{userTimezone}</strong></span>
            </div>
           </div>
         </div>
      </div>

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