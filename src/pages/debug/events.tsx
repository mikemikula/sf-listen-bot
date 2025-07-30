/**
 * Debug Events Page
 * Dedicated dark theme page for system debugging and health monitoring
 * 
 * Features:
 * - Dark theme design with modern UI components
 * - Real-time event monitoring and statistics
 * - Event filtering and detailed inspection
 * - System health indicators
 * - Error management and retry functionality
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useRealTimeMessages } from '@/hooks/useRealTimeMessages'
import { 
  Bug, 
  Activity, 
  Server, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowLeft,
  RefreshCw,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react'

// Type definitions for better type safety
interface EventStats {
  total: number
  byStatus: {
    PENDING?: number
    PROCESSING?: number
    SUCCESS?: number
    FAILED?: number
    SKIPPED?: number
  }
}

interface DebugEvent {
  id: string
  slackEventId: string | null
  eventType: string
  eventSubtype: string | null
  payload: any
  status: string
  attempts: number
  errorMessage: string | null
  channel: string | null
  createdAt: string
  lastAttemptAt: string | null
}

interface SystemInfo {
  environment: string
  nodeVersion: string
  timestamp: string
  environmentVariables: {
    databaseUrl: boolean
    directUrl: boolean
    nodeEnv: string
    vercelUrl?: string
  }
  prisma: {
    clientAvailable: boolean
    connectionTest?: boolean
    error?: string
  }
}

/**
 * Main Debug Events Page Component
 */
const DebugEventsPage: React.FC = () => {
  const router = useRouter()
  
  // State management
  const [stats, setStats] = useState<EventStats | null>(null)
  const [allEvents, setAllEvents] = useState<DebugEvent[]>([])
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Handle real-time transaction updates
  const handleTransactionUpdate = useCallback((data: { stats: EventStats, newEvents: DebugEvent[] }) => {
    console.log('📊 Transaction update received:', data)
    
    setStats(data.stats)
    
    if (data.newEvents.length > 0) {
      console.log(`✅ Adding ${data.newEvents.length} new transaction events`)
      setAllEvents(prev => [...data.newEvents, ...prev])
    }
  }, [])

  // Set up real-time updates
  const { isConnected } = useRealTimeMessages({
    onTransactionUpdate: handleTransactionUpdate
  })

  /**
   * Fetch system information from debug endpoint
   */
  const fetchSystemInfo = async (): Promise<void> => {
    try {
      const response = await fetch('/api/debug')
      const result = await response.json()
      
      if (result.success) {
        setSystemInfo(result.data)
      }
    } catch (error) {
      console.error('❌ Error fetching system info:', error)
      setError('Failed to load system information')
    }
  }

  /**
   * Fetch event statistics
   */
  const fetchStats = async (): Promise<void> => {
    try {
      const response = await fetch('/api/admin/events?action=stats')
      const result = await response.json()
      
      if (result.success) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('❌ Error fetching stats:', error)
      setError('Failed to load event statistics')
    }
  }

  /**
   * Fetch all events with pagination and optional status filter
   */
  const fetchAllEvents = async (pageNum = 1, append = false, status?: string | null): Promise<void> => {
    try {
      const statusParam = status ? `&status=${status}` : ''
      const response = await fetch(`/api/admin/events?action=list&limit=50&page=${pageNum}${statusParam}`)
      const result = await response.json()
      
      if (result.success && result.data) {
        const events = result.data.events || result.data || []
        if (append) {
          setAllEvents(prev => [...prev, ...events])
        } else {
          setAllEvents(events)
        }
        
        const pagination = result.data.pagination
        setHasMore(pagination ? pageNum < pagination.totalPages : events.length === 50)
      }
    } catch (error) {
      console.error('❌ Error fetching events:', error)
      setError('Failed to load events')
    }
  }

  /**
   * Load more events
   */
  const loadMore = () => {
    if (hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchAllEvents(nextPage, true, statusFilter)
    }
  }

  /**
   * Handle status filter changes
   */
  const handleStatusFilter = (status: string | null) => {
    setStatusFilter(status)
    setPage(1)
    setAllEvents([])
    fetchAllEvents(1, false, status)
  }

  /**
   * Retry all failed events
   */
  const handleRetryAll = async (): Promise<void> => {
    if (retrying) return
    
    try {
      setRetrying(true)
      console.log('🔄 Retrying all failed events...')
      
      const response = await fetch('/api/admin/events?action=retry', {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (result.success) {
        console.log('✅ Retry request successful')
        await fetchAllEvents(1, false)
        setPage(1)
      } else {
        console.error('❌ Retry failed:', result.error)
        setError('Failed to retry events')
      }
    } catch (error) {
      console.error('❌ Error during retry:', error)
      setError('Error occurred while retrying events')
    } finally {
      setRetrying(false)
    }
  }

  /**
   * Initialize data on component mount
   */
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        await Promise.all([
          fetchSystemInfo(),
          fetchStats(),
          fetchAllEvents(1, false, null)
        ])
      } catch (err) {
        setError('Failed to load debug data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  /**
   * Parse message content from event payload for display
   */
  const parseMessageContent = (payload: any): string => {
    if (!payload || typeof payload !== 'object') {
      return 'No content'
    }

    const event = payload.event || payload
    
    if (event.type === 'message') {
      if (event.subtype === 'message_deleted') {
        const deletedMessage = event.previous_message || event.message
        return `🗑️ Deleted: "${deletedMessage?.text || 'Unknown message'}"`
      } else if (event.subtype === 'message_changed') {
        const newMessage = event.message?.text || 'Unknown'
        const oldMessage = event.previous_message?.text || 'Unknown'
        return `✏️ Edited: "${oldMessage}" → "${newMessage}"`
      } else {
        return `💬 Message: "${event.text || 'No text'}"`
      }
    }
    
    return event.text || event.type || 'Unknown event'
  }

  /**
   * Expandable event row component with dark theme
   */
  const EventRow: React.FC<{ event: DebugEvent }> = ({ event }) => {
    const [expanded, setExpanded] = useState(false)

    const getStatusConfig = (status: string) => {
      switch (status) {
        case 'SUCCESS': 
          return { 
            bg: 'bg-emerald-900/30', 
            text: 'text-emerald-300', 
            icon: CheckCircle 
          }
        case 'FAILED': 
          return { 
            bg: 'bg-red-900/30', 
            text: 'text-red-300', 
            icon: XCircle 
          }
        case 'PENDING': 
          return { 
            bg: 'bg-amber-900/30', 
            text: 'text-amber-300', 
            icon: Clock 
          }
        case 'PROCESSING': 
          return { 
            bg: 'bg-blue-900/30', 
            text: 'text-blue-300', 
            icon: RefreshCw 
          }
        default: 
          return { 
            bg: 'bg-gray-700/30', 
            text: 'text-gray-300', 
            icon: Activity 
          }
      }
    }

    const statusConfig = getStatusConfig(event.status)
    const StatusIcon = statusConfig.icon
    const messageContent = parseMessageContent(event.payload)

    return (
      <div className="border border-gray-600 rounded-lg p-4 bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-200">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {event.status}
            </span>
            <span className="text-sm font-medium text-gray-200 truncate">
              {event.eventType}
            </span>
            {event.eventSubtype && (
              <span className="text-sm text-gray-400 truncate">
                {event.eventSubtype}
              </span>
            )}
            <span className="text-sm text-gray-400 truncate">
              {event.channel || 'No channel'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">
              {new Date(event.createdAt).toLocaleString()}
            </span>
            {expanded ? (
              <EyeOff className="w-4 h-4 text-gray-400" />
            ) : (
              <Eye className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-600 space-y-3">
            <div>
              <h4 className="text-sm font-medium text-gray-200 mb-2">💬 Message Content:</h4>
              <p className="text-sm text-gray-300 bg-gray-700/50 p-3 rounded-md">
                {messageContent}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-200">User:</span>
                <span className="ml-2 text-gray-400">{event.payload?.event?.user || 'Unknown'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-200">Event ID:</span>
                <span className="ml-2 text-gray-400 font-mono text-xs">{event.id}</span>
              </div>
              <div>
                <span className="font-medium text-gray-200">Slack Event ID:</span>
                <span className="ml-2 text-gray-400 font-mono text-xs">{event.slackEventId || 'None'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-200">Created:</span>
                <span className="ml-2 text-gray-400">{new Date(event.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="font-medium text-gray-200">Last Attempt:</span>
                <span className="ml-2 text-gray-400">
                  {event.lastAttemptAt ? new Date(event.lastAttemptAt).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>

            {event.errorMessage && (
              <div>
                <h4 className="text-sm font-medium text-red-300 mb-2">Error Message:</h4>
                <p className="text-sm text-red-300 bg-red-900/20 p-3 rounded-md font-mono">
                  {event.errorMessage}
                </p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-gray-200 mb-2">
                🔍 Raw Payload ({Object.keys(event.payload || {}).length} keys)
              </h4>
              <details className="bg-gray-700/50 rounded-md">
                <summary className="p-3 cursor-pointer text-sm text-gray-300 hover:bg-gray-600/50">
                  Click to expand raw payload
                </summary>
                <pre className="p-3 text-xs text-gray-300 overflow-x-auto border-t border-gray-600">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}
      </div>
    )
  }

  const failedEventsCount = allEvents.filter(event => event.status === 'FAILED').length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Loading debug information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
                  <Bug className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">System Debug & Health</h1>
                  <p className="text-sm text-gray-400">Real-time monitoring and diagnostics</p>
                </div>
              </div>
            </div>
            
            {/* Connection Status */}
            <div className={`inline-flex items-center space-x-2 rounded-full px-3 py-1.5 text-sm font-medium ${
              isConnected 
                ? 'bg-green-900/30 text-green-300' 
                : 'bg-red-900/30 text-red-300'
            }`}>
              <div className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-green-400' : 'bg-red-400'
              } ${isConnected ? 'animate-pulse' : ''}`} />
              <span>{isConnected ? 'Live' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-900/20 border border-red-700 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-400 mr-2" />
              <p className="text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* System Information */}
        {systemInfo && (
          <div className="mb-6 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Server className="w-5 h-5 mr-2" />
              System Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-200">Environment:</span>
                <span className="ml-2 text-gray-400">{systemInfo.environment}</span>
              </div>
              <div>
                <span className="font-medium text-gray-200">Node Version:</span>
                <span className="ml-2 text-gray-400">{systemInfo.nodeVersion}</span>
              </div>
              <div>
                <span className="font-medium text-gray-200">Database:</span>
                <span className={`ml-2 ${systemInfo.prisma.connectionTest ? 'text-green-400' : 'text-red-400'}`}>
                  {systemInfo.prisma.connectionTest ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            {systemInfo.prisma.error && (
              <div className="mt-3 p-3 bg-red-900/20 border border-red-700 rounded text-red-300 text-sm">
                <strong>Database Error:</strong> {systemInfo.prisma.error}
              </div>
            )}
          </div>
        )}

        {/* Event Statistics */}
        {stats && (
          <div className="mb-6 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Event Statistics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Total Events */}
              <button
                onClick={() => handleStatusFilter(null)}
                className={`p-4 rounded-lg text-left transition-all duration-200 transform hover:scale-105 ${
                  statusFilter === null 
                    ? 'bg-blue-900/30 ring-2 ring-blue-500 shadow-lg' 
                    : 'bg-blue-900/20 hover:bg-blue-900/30'
                }`}
              >
                <h4 className="text-sm font-medium text-blue-300 mb-1">Total Events</h4>
                <p className="text-2xl font-bold text-blue-200">{stats.total}</p>
                {statusFilter === null && (
                  <p className="text-xs text-blue-400 mt-1 font-medium">• Showing all events</p>
                )}
              </button>

              {/* Successful Events */}
              <button
                onClick={() => handleStatusFilter('SUCCESS')}
                className={`p-4 rounded-lg text-left transition-all duration-200 transform hover:scale-105 ${
                  statusFilter === 'SUCCESS' 
                    ? 'bg-emerald-900/30 ring-2 ring-emerald-500 shadow-lg' 
                    : 'bg-emerald-900/20 hover:bg-emerald-900/30'
                }`}
              >
                <h4 className="text-sm font-medium text-emerald-300 mb-1">Successful</h4>
                <p className="text-2xl font-bold text-emerald-200">{stats.byStatus.SUCCESS || 0}</p>
                {statusFilter === 'SUCCESS' && (
                  <p className="text-xs text-emerald-400 mt-1 font-medium">• Filtering active</p>
                )}
              </button>

              {/* Failed Events */}
              <button
                onClick={() => handleStatusFilter('FAILED')}
                className={`p-4 rounded-lg text-left transition-all duration-200 transform hover:scale-105 ${
                  statusFilter === 'FAILED' 
                    ? 'bg-red-900/30 ring-2 ring-red-500 shadow-lg' 
                    : 'bg-red-900/20 hover:bg-red-900/30'
                }`}
              >
                <h4 className="text-sm font-medium text-red-300 mb-1">Failed</h4>
                <p className="text-2xl font-bold text-red-200">{stats.byStatus.FAILED || 0}</p>
                {statusFilter === 'FAILED' && (
                  <p className="text-xs text-red-400 mt-1 font-medium">• Filtering active</p>
                )}
              </button>

              {/* Success Rate */}
              <button
                onClick={() => handleStatusFilter('SUCCESS')}
                className={`p-4 rounded-lg text-left transition-all duration-200 transform hover:scale-105 ${
                  statusFilter === 'SUCCESS' 
                    ? 'bg-purple-900/30 ring-2 ring-purple-500 shadow-lg' 
                    : 'bg-purple-900/20 hover:bg-purple-900/30'
                }`}
              >
                <h4 className="text-sm font-medium text-purple-300 mb-1">Success Rate</h4>
                <p className="text-2xl font-bold text-purple-200">
                  {stats.total > 0 ? Math.round((stats.byStatus.SUCCESS || 0) / stats.total * 100) : 0}%
                </p>
                <p className="text-xs text-purple-400 mt-1">Click to show successful</p>
              </button>
            </div>
          </div>
        )}

        {/* Events List */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              Recent Events
            </h2>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                Showing {allEvents.length} events
              </div>
              {failedEventsCount > 0 && (
                <button
                  onClick={handleRetryAll}
                  disabled={retrying}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors disabled:bg-red-400 flex items-center space-x-2"
                >
                  <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                  <span>{retrying ? 'Retrying...' : `Retry Failed (${failedEventsCount})`}</span>
                </button>
              )}
            </div>
          </div>

          {allEvents.length > 0 ? (
            <div className="space-y-2">
              {allEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
              
              {/* Load More Button */}
              {hasMore && (
                <div className="text-center pt-4">
                  <button
                    onClick={loadMore}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 font-medium flex items-center space-x-2 mx-auto"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Load More Events (50)</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">
                {statusFilter === 'FAILED' ? '❌' : statusFilter === 'SUCCESS' ? '✅' : '📝'}
              </div>
              <div className="font-medium">
                {statusFilter 
                  ? `No ${statusFilter.toLowerCase()} events found` 
                  : 'No events found'
                }
              </div>
              {statusFilter && (
                <button
                  onClick={() => handleStatusFilter(null)}
                  className="text-sm text-blue-400 hover:text-blue-300 mt-2"
                >
                  View all events
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DebugEventsPage 