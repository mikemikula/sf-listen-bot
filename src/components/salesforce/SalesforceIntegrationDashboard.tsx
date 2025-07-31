/**
 * Salesforce Integration Dashboard Component
 * Provides a comprehensive interface for managing Salesforce integration
 * 
 * Features:
 * - Connection setup and OAuth flow
 * - Sync operation management
 * - Connection status monitoring
 * - API usage tracking
 * - Error handling and user feedback
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import type {
  SalesforceConnectionStatus,
  SalesforceSyncJob,
  SalesforceStartSyncRequest,
  ApiResponse
} from '@/types'

interface SalesforceIntegrationDashboardProps {
  className?: string
}

interface SyncJobWithStatus extends SalesforceSyncJob {
  startTime?: Date
  isComplete?: boolean
}

export default function SalesforceIntegrationDashboard({ 
  className = '' 
}: SalesforceIntegrationDashboardProps): JSX.Element {
  // State management
  const [connectionStatus, setConnectionStatus] = useState<SalesforceConnectionStatus | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [currentSyncJob, setCurrentSyncJob] = useState<SyncJobWithStatus | null>(null)
  const [recentJobs, setRecentJobs] = useState<SyncJobWithStatus[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [schemaStatus, setSchemaStatus] = useState<any>(null)
  const [isDeployingSchema, setIsDeployingSchema] = useState<boolean>(false)
  const [isRemovingSchema, setIsRemovingSchema] = useState<boolean>(false)

  /**
   * Clear session data from state and server
   */
  const clearSession = useCallback(async (): Promise<void> => {
    setSessionId(null)
    setConnectionStatus(null)
    setRecentJobs([])
    
    // Clear server-side session cookie
    try {
      await fetch('/api/salesforce/session', {
        method: 'DELETE',
        credentials: 'include'
      })
    } catch (error) {
      console.warn('Failed to clear server session:', error)
    }
  }, [])

  // Check for existing session from server on mount
  useEffect(() => {
    const checkServerSession = async (): Promise<void> => {
      try {
        // Check for success parameter from OAuth redirect
        const urlParams = new URLSearchParams(window.location.search)
        const sfSuccess = urlParams.get('sf_success')
        
        // Always check server for current session status
        const response = await fetch('/api/salesforce/session', {
          method: 'GET',
          credentials: 'include' // Include cookies
        })
        
        if (response.ok) {
          const result = await response.json()
          
          if (result.success && result.data?.isAuthenticated) {
            // Server confirms we have a valid session
            setSessionId(result.data.sessionId || 'authenticated')
            
            // Show success toast only on OAuth redirect
            if (sfSuccess === 'true') {
              toast.success('Successfully connected to Salesforce!')
            }
          } else {
            // No valid session on server
            setSessionId(null)
          }
        }
        
        // Clean up URL parameters
        if (sfSuccess) {
          setTimeout(() => {
            const newUrl = window.location.pathname
            window.history.replaceState({}, document.title, newUrl)
          }, 100)
        }
        
      } catch (error) {
        console.error('Failed to check server session:', error)
        setSessionId(null)
      }
    }
    
    checkServerSession()
  }, [])



  /**
   * Load current connection status from API
   */
  const loadConnectionStatus = useCallback(async (): Promise<void> => {

    try {
      const response = await fetch('/api/salesforce/connection', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.status === 401) {
        // Session is invalid/expired, clear it
        clearSession()
        return
      }

      const result = await response.json() as ApiResponse<SalesforceConnectionStatus>
      
      if (result.success && result.data) {
        setConnectionStatus(result.data)
      } else {
        console.error('Failed to load connection status:', result.error)
        
        // If error indicates session issue, clear session
        if (result.error?.includes('session') || result.error?.includes('expired')) {
          clearSession()
        }
      }
    } catch (error) {
      console.error('Error loading connection status:', error)
    }
  }, [clearSession])

  /**
   * Load sync history from API
   */
  const loadSyncHistory = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/salesforce/sync?history=true', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.status === 401) {
        // Session is invalid/expired, clear it
        clearSession()
        return
      }

      const result = await response.json()
      
      if (result.success && result.data?.jobs) {
        setRecentJobs(result.data.jobs)
      } else {
        console.error('Failed to load sync history:', result.error || 'Unknown error')
        
        // If error indicates session issue, clear session
        if (result.error?.includes('session') || result.error?.includes('expired')) {
          clearSession()
        }
      }
    } catch (error) {
      console.error('Error loading sync history:', error)
    }
  }, [clearSession])

  // This useEffect will be moved after function definitions to avoid linting errors

  /**
   * Initiate OAuth connection to Salesforce
   */
  const handleConnect = async (): Promise<void> => {
    setIsConnecting(true)
    
    try {
      const response = await fetch('/api/salesforce/oauth/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          redirectTo: window.location.pathname
        })
      })

      const result = await response.json()
      
      if (result.success && result.data?.authUrl) {
        // Redirect to Salesforce OAuth
        window.location.href = result.data.authUrl
      } else {
        throw new Error(result.error || 'Failed to initiate OAuth flow')
      }
    } catch (error) {
      console.error('Connection error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to connect to Salesforce')
    } finally {
      setIsConnecting(false)
    }
  }

  /**
   * Disconnect from Salesforce
   */
  const handleDisconnect = async (): Promise<void> => {
    setIsDisconnecting(true)
    
    try {
      const response = await fetch('/api/salesforce/connection', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()
      
      if (result.success) {
        clearSession() // This will clear both state and localStorage
        toast.success('Successfully disconnected from Salesforce')
      } else {
        throw new Error(result.error || 'Failed to disconnect')
      }
    } catch (error) {
      console.error('Disconnect error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to disconnect from Salesforce')
    } finally {
      setIsDisconnecting(false)
    }
  }

  /**
   * Test Salesforce connection
   */
  const handleTestConnection = async (): Promise<void> => {
    if (!sessionId) return

    setIsTestingConnection(true)
    
    try {
      const response = await fetch('/api/salesforce/connection', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()
      
      if (result.success && result.data?.success) {
        // Check for warnings about missing custom objects
        if (result.data.warning) {
          toast.success('Connection successful!')
          toast('⚠️ ' + result.data.warning, {
            duration: 8000,
            style: {
              background: '#fbbf24',
              color: '#92400e',
            },
          })
        } else {
          toast.success('Connection test successful!')
        }
        loadConnectionStatus() // Refresh status
      } else {
        throw new Error(result.data?.error || result.error || 'Connection test failed')
      }
    } catch (error) {
      console.error('Connection test error:', error)
      toast.error(error instanceof Error ? error.message : 'Connection test failed')
    } finally {
      setIsTestingConnection(false)
    }
  }

  /**
   * Start sync operation
   */
  const handleStartSync = async (syncType: 'full' | 'incremental' = 'full'): Promise<void> => {
    if (!sessionId) return

    setIsSyncing(true)
    
    try {
      const syncRequest: SalesforceStartSyncRequest = {
        syncType,
        recordTypes: ['documents', 'faqs'],
        filters: {
          // Add any default filters here
        }
      }

      const response = await fetch('/api/salesforce/sync', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(syncRequest)
      })

      const result = await response.json()
      
      if (result.success && result.data?.jobId) {
        toast.success(`Sync operation started (Job ID: ${result.data.jobId})`)
        
        // Start polling for job status
        pollSyncJob(result.data.jobId)
      } else {
        throw new Error(result.error || 'Failed to start sync operation')
      }
    } catch (error) {
      console.error('Sync error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to start sync operation')
      setIsSyncing(false)
    }
  }

  /**
   * Poll sync job status until completion
   */
  const pollSyncJob = async (jobId: string): Promise<void> => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/salesforce/sync?jobId=${jobId}`, {
          method: 'GET',
          headers: {
            'X-SF-Session': sessionId!,
            'Content-Type': 'application/json'
          }
        })

        const result = await response.json()
        
        if (result.success && result.data?.job) {
          const job = result.data.job as SyncJobWithStatus
          setCurrentSyncJob(job)

          if (result.data.isComplete) {
            clearInterval(pollInterval)
            setIsSyncing(false)
            
            if (job.status === 'COMPLETED') {
              toast.success(`Sync completed! Processed ${job.recordsProcessed} records`)
            } else {
              toast.error(`Sync failed: ${job.errorDetails?.[0]?.error || 'Unknown error'}`)
            }
            
            // Refresh sync history
            loadSyncHistory()
          }
        }
      } catch (error) {
        console.error('Error polling sync job:', error)
        clearInterval(pollInterval)
        setIsSyncing(false)
      }
    }, 2000) // Poll every 2 seconds
  }

  /**
   * Format sync job status for display
   */
  const formatSyncStatus = (status: string): { text: string; color: string } => {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return { text: 'Completed', color: 'text-green-600' }
      case 'FAILED':
        return { text: 'Failed', color: 'text-red-600' }
      case 'RUNNING':
        return { text: 'Running', color: 'text-blue-600' }
      case 'QUEUED':
        return { text: 'Queued', color: 'text-yellow-600' }
      default:
        return { text: status, color: 'text-gray-600' }
    }
  }

  /**
   * Format date for display
   */
  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString()
  }

  /**
   * Load schema status from API
   */
  const loadSchemaStatus = useCallback(async (): Promise<void> => {
    if (!sessionId) return

    try {
      const response = await fetch('/api/salesforce/schema', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setSchemaStatus(result.data)
        } else {
          console.error('Failed to load schema status:', result.error)
        }
      }
    } catch (error) {
      console.error('Error loading schema status:', error)
    }
  }, [sessionId])

  /**
   * Deploy custom objects to Salesforce
   */
  const handleDeploySchema = async (): Promise<void> => {
    if (!sessionId) return

    setIsDeployingSchema(true)
    
    try {
      const response = await fetch('/api/salesforce/schema', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          useEnhancedDeployment: true
        })
      })

      const result = await response.json()
      
      if (result.success) {
        toast.success('Schema deployed successfully! 🎉')
        await loadSchemaStatus() // Refresh status
        await loadConnectionStatus() // Refresh connection status
      } else {
        const errorMsg = result.error || 'Schema deployment failed'
        console.error('Schema deployment error:', errorMsg)
        toast.error(errorMsg)
      }
    } catch (error) { 
      console.error('Schema deployment error:', error)
      toast.error(error instanceof Error ? error.message : 'Schema deployment failed')
    } finally {
      setIsDeployingSchema(false)
    }
  }

  /**
   * Remove custom objects from Salesforce
   */
  const handleRemoveSchema = async (): Promise<void> => {
    if (!sessionId) return

    // Confirm deletion
    const confirmed = window.confirm(
      'Are you sure you want to remove all custom objects?\n\n' +
      'This will delete:\n' +
      '• Slack_Document__c (and all data)\n' +
      '• Slack_FAQ__c (and all data)\n\n' +
      'This action cannot be undone!'
    )

    if (!confirmed) return

    setIsRemovingSchema(true)
    
    try {
      const response = await fetch('/api/salesforce/schema', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          confirm: 'DELETE_SCHEMA'
        })
      })

      const result = await response.json()
      
      if (result.success) {
        toast.success('Schema removed successfully')
        await loadSchemaStatus() // Refresh status
        await loadConnectionStatus() // Refresh connection status
      } else {
        const errorMsg = result.error || 'Schema removal failed'
        console.error('Schema removal error:', errorMsg)
        toast.error(errorMsg)
      }
    } catch (error) {
      console.error('Schema removal error:', error)
      toast.error(error instanceof Error ? error.message : 'Schema removal failed')
    } finally {
      setIsRemovingSchema(false)
    }
  }

  // Load connection status and sync data when session changes
  useEffect(() => {
    if (sessionId) {
      loadConnectionStatus()
      loadSyncHistory()
      loadSchemaStatus()
    }
  }, [sessionId, loadConnectionStatus, loadSyncHistory, loadSchemaStatus])

  return (
    <div className={`salesforce-integration-dashboard ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Salesforce Integration
          </h2>
          
          {connectionStatus?.isConnected && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Connected</span>
            </div>
          )}
        </div>

        {!sessionId || !connectionStatus ? (
          // Connection Setup Section
          <div className="text-center py-8">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Connect to Salesforce
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Connect your Salesforce organization to sync documents and FAQs.
            </p>
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Connecting...
                </>
              ) : (
                'Connect to Salesforce'
              )}
            </button>
          </div>
        ) : (
          // Connected Dashboard
          <div className="space-y-6">
            {/* Connection Status */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Connection Status</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
                  >
                    {isTestingConnection ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
                  >
                    {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Organization</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{connectionStatus.userInfo?.organization_id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">User</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{connectionStatus.userInfo?.display_name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Instance URL</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{connectionStatus.instanceUrl}</dd>
                </div>
                {connectionStatus.limits && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">API Usage</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {connectionStatus.limits.dailyApiCalls.used} / {connectionStatus.limits.dailyApiCalls.limit}
                    </dd>
                  </div>
                )}
              </div>
            </div>

            {/* Schema Management */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Schema Management</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={handleDeploySchema}
                    disabled={isDeployingSchema || (schemaStatus?.schemaDeployed === true)}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:bg-gray-400"
                  >
                    {isDeployingSchema ? 'Deploying...' : 
                     schemaStatus?.schemaDeployed ? 'Schema Deployed' : 'Deploy Schema'}
                  </button>
                  <button
                    onClick={handleRemoveSchema}
                    disabled={isRemovingSchema || !schemaStatus?.schemaDeployed}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
                  >
                    {isRemovingSchema ? 'Removing...' : 'Remove Schema'}
                  </button>
                </div>
              </div>
              
              {schemaStatus && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                    <dd className="mt-1 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        schemaStatus.summary?.status === 'Complete' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : schemaStatus.summary?.status === 'Partial'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {schemaStatus.summary?.status || 'Unknown'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Objects</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {schemaStatus.summary?.totalObjects || 0} / {schemaStatus.summary?.totalExpected || 2}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Documents</dt>
                    <dd className="mt-1 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        schemaStatus.objects?.documents?.exists 
                          ? schemaStatus.objects.documents.deployedFields === schemaStatus.objects.documents.totalFields
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {schemaStatus.objects?.documents?.exists ? (
                          <>
                            {schemaStatus.objects.documents.deployedFields === schemaStatus.objects.documents.totalFields && '✓ '}
                            {schemaStatus.objects.documents.deployedFields || 0}/{schemaStatus.objects.documents.totalFields || 12} fields
                          </>
                        ) : 
                          '✗ Not deployed'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">FAQs</dt>
                    <dd className="mt-1 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        schemaStatus.objects?.faqs?.exists 
                          ? schemaStatus.objects.faqs.deployedFields === schemaStatus.objects.faqs.totalFields
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {schemaStatus.objects?.faqs?.exists ? (
                          <>
                            {schemaStatus.objects.faqs.deployedFields === schemaStatus.objects.faqs.totalFields && '✓ '}
                            {schemaStatus.objects.faqs.deployedFields || 0}/{schemaStatus.objects.faqs.totalFields || 9} fields
                          </>
                        ) : 
                          '✗ Not deployed'}
                      </span>
                    </dd>
                  </div>
                </div>
              )}
              
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Schema deployment</strong> creates custom objects in your Salesforce org:
                      <br />• <code className="font-mono text-xs">Slack_Document__c</code> - Stores processed documents (12 custom fields)
                      <br />• <code className="font-mono text-xs">Slack_FAQ__c</code> - Stores generated FAQs (9 custom fields)
                      <br />This enables data synchronization between your Slack channels and Salesforce.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sync Operations */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Sync Operations</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleStartSync('incremental')}
                    disabled={isSyncing}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
                  >
                    Incremental Sync
                  </button>
                  <button
                    onClick={() => handleStartSync('full')}
                    disabled={isSyncing}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
                  >
                    {isSyncing ? 'Syncing...' : 'Full Sync'}
                  </button>
                </div>
              </div>

              {/* Current Sync Job */}
              {currentSyncJob && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                        Current Sync: {currentSyncJob.jobType}
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Status: <span className={formatSyncStatus(currentSyncJob.status).color}>
                          {formatSyncStatus(currentSyncJob.status).text}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {currentSyncJob.recordsProcessed} records processed
                      </p>
                      {currentSyncJob.recordsSucceeded > 0 && (
                        <p className="text-sm text-green-600 dark:text-green-400">
                          {currentSyncJob.recordsSucceeded} succeeded
                        </p>
                      )}
                      {currentSyncJob.recordsFailed > 0 && (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          {currentSyncJob.recordsFailed} failed
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sync History */}
            {recentJobs.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Recent Sync Jobs</h3>
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
                          Records
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Started
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Completed
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {recentJobs.slice(0, 10).map((job) => {
                        const status = formatSyncStatus(job.status)
                        return (
                          <tr key={job.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {job.jobType}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`text-sm ${status.color}`}>
                                {status.text}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {job.recordsProcessed}
                              {job.recordsSucceeded > 0 && (
                                <span className="text-green-600 dark:text-green-400"> ({job.recordsSucceeded} ✓)</span>
                              )}
                              {job.recordsFailed > 0 && (
                                <span className="text-red-600 dark:text-red-400"> ({job.recordsFailed} ✗)</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {job.startedAt ? formatDate(job.startedAt) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {job.completedAt ? formatDate(job.completedAt) : '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 