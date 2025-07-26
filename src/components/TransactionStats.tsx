/**
 * TransactionStats Component
 * Displays Slack event processing statistics and system health
 */

import React, { useState, useEffect, useCallback } from 'react'
import { logger } from '@/lib/logger'
import { useRealTimeMessages } from '@/hooks/useRealTimeMessages'

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

interface FailedEvent {
  id: string
  slackEventId: string | null
  eventType: string
  eventSubtype: string | null
  payload: any // JSON payload from Slack
  status: string
  attempts: number
  errorMessage: string | null
  channel: string | null
  createdAt: string
  lastAttemptAt: string | null
}

export const TransactionStats: React.FC = () => {
  const [stats, setStats] = useState<EventStats | null>(null)
  const [failedEvents, setFailedEvents] = useState<FailedEvent[]>([])
  const [allEvents, setAllEvents] = useState<FailedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'all' | 'failed'>('overview')

  // Handle real-time transaction updates (optimized to prevent UI jumps)
  const handleTransactionUpdate = useCallback((data: { stats: EventStats, newEvents: FailedEvent[] }) => {
    console.log('📊 Transaction update received:', data)
    
    // Always update stats (was too restrictive before)
    setStats(data.stats)
    
    // Add new events silently without causing UI jumps
    if (data.newEvents.length > 0) {
      console.log(`✅ Adding ${data.newEvents.length} new transaction events`)
      setAllEvents(prev => [...data.newEvents, ...prev])
      
      const newFailedEvents = data.newEvents.filter(event => event.status === 'FAILED')
      if (newFailedEvents.length > 0) {
        console.log(`❌ ${newFailedEvents.length} new failed events`)
        setFailedEvents(prev => [...newFailedEvents, ...prev])
      }
    }
  }, [])

  // Set up real-time updates (throttled to prevent UI jumps)
  const { isConnected } = useRealTimeMessages({
    onTransactionUpdate: handleTransactionUpdate
  })

  /**
   * Fetch event statistics
   */
  const fetchStats = async (): Promise<void> => {
    try {
    
      const response = await fetch('/api/admin/events?action=stats')
      console.log('📡 Stats response status:', response.status)
      
      const result = await response.json()
      console.log('📊 Stats result:', result)
      
      if (result.success) {
        setStats(result.data)
        console.log('✅ Stats set successfully:', result.data)
      } else {
        console.error('❌ Stats API returned error:', result.error)
      }
    } catch (error) {
      console.error('❌ Failed to fetch event stats:', error)
      logger.error('Failed to fetch event stats:', error)
    }
  }

  /**
   * Fetch failed events
   */
  const fetchFailedEvents = async (): Promise<void> => {
    try {
      console.log('🔍 Fetching failed events from /api/admin/events?action=list&status=FAILED&limit=10')
      const response = await fetch('/api/admin/events?action=list&status=FAILED&limit=10')
      console.log('📡 Failed events response status:', response.status)
      
      const result = await response.json()
      console.log('❌ Failed events result:', result)
      
      if (result.success && result.data && result.data.events) {
        setFailedEvents(result.data.events)
        console.log(`✅ Fetched ${result.data.events.length} failed events`)
      } else {
        console.log('ℹ️ No failed events or API error:', result)
        setFailedEvents([])
      }
    } catch (error) {
      console.error('❌ Failed to fetch failed events:', error)
      logger.error('Failed to fetch failed events:', error)
      setFailedEvents([])
    }
  }

  /**
   * Fetch all recent events
   */
  const fetchAllEvents = async (): Promise<void> => {
    try {
      console.log('🔍 Fetching all events from /api/admin/events?action=list&limit=100')
      const response = await fetch('/api/admin/events?action=list&limit=100')
      console.log('📡 All events response status:', response.status)
      
      const result = await response.json()
      console.log('📋 All events result:', result)
      
      if (result.success && result.data && result.data.events) {
        setAllEvents(result.data.events)
        console.log(`✅ Fetched ${result.data.events.length} events from API`)
        console.log(`📊 Total events in database: ${result.data.pagination?.total || 'unknown'}`)
      } else {
        console.error('❌ All events API failed or returned no events:', result)
        setAllEvents([])
      }
    } catch (error) {
      console.error('❌ Failed to fetch all events:', error)
      logger.error('Failed to fetch all events:', error)
      setAllEvents([])
    }
  }

  /**
   * Retry failed events
   */
  const retryFailedEvents = async (): Promise<void> => {
    setRetrying(true)
    try {
      const response = await fetch('/api/admin/events?action=retry', {
        method: 'POST'
      })
      const result = await response.json()
      
             if (result.success) {
         // Refresh data after retry
         await fetchStats()
         await fetchFailedEvents()
         await fetchAllEvents()
       }
    } catch (error) {
      logger.error('Failed to retry events:', error)
    } finally {
      setRetrying(false)
    }
  }

  // Load data on mount and refresh periodically
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchStats(), fetchFailedEvents(), fetchAllEvents()])
      setLoading(false)
    }

    loadData()

    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-full"></div>
        </div>
          </div>
  )
}

/**
 * Individual event row component
 */
const EventRow: React.FC<{ 
  event: FailedEvent
  showDetails?: boolean
  isError?: boolean 
}> = ({ event, showDetails = false, isError = false }) => {
  const [expanded, setExpanded] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'bg-green-100 text-green-800'
      case 'FAILED': return 'bg-red-100 text-red-800'
      case 'PENDING': return 'bg-blue-100 text-blue-800'
      case 'PROCESSING': return 'bg-purple-100 text-purple-800'
      case 'SKIPPED': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS': return '✅'
      case 'FAILED': return '❌'
      case 'PENDING': return '⏳'
      case 'PROCESSING': return '🔄'
      case 'SKIPPED': return '⏭️'
      default: return '❓'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  const parseMessageContent = (payload: any) => {
    try {
      // Handle different payload structures
      if (typeof payload === 'string') {
        payload = JSON.parse(payload)
      }

      console.log('🔍 Parsing payload:', payload)
      const event = payload.event || payload
      console.log('🔍 Event extracted:', event)
      
      // For message deletions
      if (event.subtype === 'message_deleted') {
        return {
          type: 'deleted',
          originalText: event.previous_message?.text || event.deleted_ts ? 'Message deleted' : null,
          user: event.previous_message?.user || event.user,
          timestamp: event.deleted_ts
        }
      }
      
      // For message edits  
      if (event.subtype === 'message_changed') {
        return {
          type: 'edited',
          originalText: event.previous_message?.text || null,
          newText: event.message?.text || null,
          user: event.message?.user || event.user,
          timestamp: event.message?.ts || event.ts
        }
      }
      
      // For regular messages - try multiple possible structures
      if (event.type === 'message' && event.text) {
        return {
          type: 'message',
          text: event.text,
          user: event.user,
          timestamp: event.ts
        }
      }
      
      // Check if it's nested deeper
      if (event.type === 'event_callback' && event.event) {
        const innerEvent = event.event
        if (innerEvent.type === 'message' && innerEvent.text) {
          return {
            type: 'message',
            text: innerEvent.text,
            user: innerEvent.user,
            timestamp: innerEvent.ts
          }
        }
      }
      
      // Last resort - look for any text field
      if (event.text) {
        return {
          type: 'message',
          text: event.text,
          user: event.user || 'Unknown',
          timestamp: event.ts || event.timestamp
        }
      }
      
      console.log('❌ No message content found in payload')
      return null
    } catch (error) {
      console.warn('Failed to parse message content:', error, payload)
      return null
    }
  }

  return (
    <div className={`rounded-lg border ${
      isError 
        ? 'bg-red-50 border-red-200' 
        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
    } transition-colors`}>
      {/* Main Row */}
      <div 
        className="p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
              {getStatusIcon(event.status)} {event.status}
            </span>
            
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className={`font-medium ${isError ? 'text-red-900' : 'text-gray-900'}`}>
                  {event.eventType}
                  {event.eventSubtype && ` (${event.eventSubtype})`}
                </span>
                
                {event.channel && (
                  <span className={`text-xs px-2 py-1 rounded ${isError ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {event.channel}
                  </span>
                )}
              </div>
              
              <div className={`text-xs mt-1 ${isError ? 'text-red-600' : 'text-gray-500'}`}>
                {formatTimestamp(event.createdAt)}
                {event.attempts > 0 && ` • ${event.attempts} attempts`}
                {event.slackEventId && ` • ${event.slackEventId}`}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {event.errorMessage && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                Error
              </span>
            )}
            <svg 
              className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-200 p-3 space-y-3">
          {/* Message Content */}
          {(() => {
            const messageContent = parseMessageContent(event.payload)
            if (!messageContent) return null

            return (
              <div className="space-y-3">
                {messageContent.type === 'deleted' && (
                  <div>
                    <span className="font-medium text-red-700">🗑️ Deleted Message:</span>
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                      <div className="text-sm text-red-800">
                        {messageContent.originalText || 'Content not available'}
                      </div>
                      {messageContent.user && (
                        <div className="text-xs text-red-600 mt-2">
                          User: {messageContent.user}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {messageContent.type === 'edited' && (
                  <div>
                    <span className="font-medium text-orange-700">✏️ Message Edited:</span>
                    <div className="mt-2 space-y-2">
                      {messageContent.originalText && (
                        <div>
                          <div className="text-xs font-medium text-gray-600 mb-1">BEFORE:</div>
                          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800 line-through">
                            {messageContent.originalText}
                          </div>
                        </div>
                      )}
                      {messageContent.newText && (
                        <div>
                          <div className="text-xs font-medium text-gray-600 mb-1">AFTER:</div>
                          <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                            {messageContent.newText}
                          </div>
                        </div>
                      )}
                      {messageContent.user && (
                        <div className="text-xs text-gray-600">
                          User: {messageContent.user}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {messageContent.type === 'message' && (
                  <div>
                    <span className="font-medium text-blue-700">💬 Message Content:</span>
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                      <div className="text-sm text-blue-800">
                        {messageContent.text}
                      </div>
                      {messageContent.user && (
                        <div className="text-xs text-blue-600 mt-2">
                          User: {messageContent.user}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Basic Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Event ID:</span>
              <div className="text-gray-600 font-mono text-xs mt-1">{event.id}</div>
            </div>
            <div>
              <span className="font-medium text-gray-700">Slack Event ID:</span>
              <div className="text-gray-600 font-mono text-xs mt-1">{event.slackEventId || 'N/A'}</div>
            </div>
            <div>
              <span className="font-medium text-gray-700">Created:</span>
              <div className="text-gray-600 text-xs mt-1">{new Date(event.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <span className="font-medium text-gray-700">Last Attempt:</span>
              <div className="text-gray-600 text-xs mt-1">
                {event.lastAttemptAt ? new Date(event.lastAttemptAt).toLocaleString() : 'N/A'}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {event.errorMessage && (
            <div>
              <span className="font-medium text-red-700">Error Message:</span>
              <div className="text-red-600 text-sm mt-1 p-2 bg-red-50 rounded border border-red-200">
                {event.errorMessage}
              </div>
            </div>
          )}

          {/* Raw Payload (Collapsible) */}
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium">
              🔍 View Raw Payload {event.payload ? `(${Object.keys(event.payload).length} keys)` : '(empty)'}
            </summary>
            <div className="mt-2 p-2 bg-gray-100 rounded border overflow-auto max-h-40">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                {event.payload ? JSON.stringify(event.payload, null, 2) : 'No payload data available'}
              </pre>
            </div>
          </details>

          {/* Processing Info */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
            <span>Status: {event.status}</span>
            <span>Attempts: {event.attempts}</span>
            <span>Type: {event.eventType}</span>
            {event.eventSubtype && <span>Subtype: {event.eventSubtype}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

  const healthColor = (stats?.byStatus.FAILED || 0) > 0 ? 'text-yellow-600' : 'text-green-600'
  const healthStatus = (stats?.byStatus.FAILED || 0) > 0 ? 'Warning' : 'Healthy'

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div 
        className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
          <span className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-yellow-600'}`}>
            {isConnected ? 'Live' : 'Connecting...'}
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          {stats && (
            <div className="text-sm text-gray-500">
              {stats.total} events processed
            </div>
          )}
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'overview'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Events ({allEvents.length})
            </button>
            <button
              onClick={() => setActiveTab('failed')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'failed'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Failed ({failedEvents.length})
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {stats.byStatus.SUCCESS || 0}
                </div>
                <div className="text-sm text-green-700">Success</div>
              </div>
              
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.byStatus.FAILED || 0}
                </div>
                <div className="text-sm text-yellow-700">Failed</div>
              </div>
              
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.byStatus.PENDING || 0}
                </div>
                <div className="text-sm text-blue-700">Pending</div>
              </div>
              
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.byStatus.PROCESSING || 0}
                </div>
                <div className="text-sm text-purple-700">Processing</div>
              </div>
              
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                  {stats.byStatus.SKIPPED || 0}
                </div>
                <div className="text-sm text-gray-700">Skipped</div>
              </div>
            </div>
          )}

          {/* All Events Tab */}
          {activeTab === 'all' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Recent Events</h4>
                <div className="text-sm text-gray-500">
                  Showing last {allEvents.length} events
                </div>
              </div>
              
              {allEvents.length > 0 ? (
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {allEvents.map((event) => (
                    <EventRow key={event.id} event={event} showDetails={true} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📝</div>
                  <div className="font-medium">No events yet</div>
                  <div className="text-sm mt-1">Events will appear here as they are processed</div>
                </div>
              )}
            </div>
          )}

          {/* Failed Events Tab */}
          {activeTab === 'failed' && (
            <div className="space-y-3">
              {failedEvents.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">Failed Events</h4>
                    <button
                      onClick={retryFailedEvents}
                      disabled={retrying}
                      className="px-3 py-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {retrying ? 'Retrying...' : 'Retry All'}
                    </button>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {failedEvents.map((event) => (
                      <EventRow key={event.id} event={event} showDetails={true} isError={true} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-green-600">
                  <div className="text-4xl mb-2">✅</div>
                  <div className="font-medium">All events processed successfully!</div>
                  <div className="text-sm text-gray-500 mt-1">No failed transactions to display</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
} 