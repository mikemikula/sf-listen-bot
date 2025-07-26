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
  const [allEvents, setAllEvents] = useState<FailedEvent[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  // Handle real-time transaction updates
  const handleTransactionUpdate = useCallback((data: { stats: EventStats, newEvents: FailedEvent[] }) => {
    console.log('📊 Transaction update received:', data)
    
    // Always update stats
    setStats(data.stats)
    
    // Add new events to the beginning of the list
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
        
        // Check if there are more events
        const pagination = result.data.pagination
        setHasMore(pagination ? pageNum < pagination.totalPages : events.length === 50)
      }
    } catch (error) {
      console.error('❌ Error fetching events:', error)
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
        // Refresh the events list
        await fetchAllEvents(1, false)
        setPage(1)
      } else {
        console.error('❌ Retry failed:', result.error)
      }
    } catch (error) {
      console.error('❌ Error during retry:', error)
    } finally {
      setRetrying(false)
    }
  }

  // Fetch data on component mount
  useEffect(() => {
    fetchStats()
    fetchAllEvents(1, false, null) // Always start with no filter
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Parse message content from event payload for display
   */
  const parseMessageContent = (payload: any): string => {
    if (!payload || typeof payload !== 'object') {
      return 'No content'
    }

    console.log('🔍 Parsing payload:', payload)
    
    // Extract the event object
    const event = payload.event || payload
    console.log('🔍 Event extracted:', event)
    
    if (event.type === 'message') {
      // Handle different message subtypes
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
    
    console.log('❌ No message content found in payload')
    return event.text || event.type || 'Unknown event'
  }

  /**
   * Expandable event row component
   */
  const EventRow: React.FC<{ event: FailedEvent }> = ({ event }) => {
    const [expanded, setExpanded] = useState(false)

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'SUCCESS': return 'bg-green-100 text-green-800'
        case 'FAILED': return 'bg-red-100 text-red-800'
        case 'PENDING': return 'bg-yellow-100 text-yellow-800'
        case 'PROCESSING': return 'bg-blue-100 text-blue-800'
        default: return 'bg-gray-100 text-gray-800'
      }
    }

    const messageContent = parseMessageContent(event.payload)

    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
              {event.status}
            </span>
            <span className="text-sm font-medium text-gray-900 truncate">
              {event.eventType}
            </span>
            {event.eventSubtype && (
              <span className="text-sm text-gray-500 truncate">
                {event.eventSubtype}
              </span>
            )}
            <span className="text-sm text-gray-500 truncate">
              {event.channel || 'No channel'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">
              {new Date(event.createdAt).toLocaleString()}
            </span>
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

        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">💬 Message Content:</h4>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                {messageContent}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-900">User:</span>
                <span className="ml-2 text-gray-600">{event.payload?.event?.user || 'Unknown'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-900">Event ID:</span>
                <span className="ml-2 text-gray-600 font-mono text-xs">{event.id}</span>
              </div>
              <div>
                <span className="font-medium text-gray-900">Slack Event ID:</span>
                <span className="ml-2 text-gray-600 font-mono text-xs">{event.slackEventId || 'None'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-900">Created:</span>
                <span className="ml-2 text-gray-600">{new Date(event.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="font-medium text-gray-900">Last Attempt:</span>
                <span className="ml-2 text-gray-600">
                  {event.lastAttemptAt ? new Date(event.lastAttemptAt).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>

            {event.errorMessage && (
              <div>
                <h4 className="text-sm font-medium text-red-900 mb-2">Error Message:</h4>
                <p className="text-sm text-red-700 bg-red-50 p-3 rounded-md font-mono">
                  {event.errorMessage}
                </p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                🔍 View Raw Payload ({Object.keys(event.payload || {}).length} keys)
              </h4>
              <details className="bg-gray-50 rounded-md">
                <summary className="p-3 cursor-pointer text-sm text-gray-700 hover:bg-gray-100">
                  Click to expand raw payload
                </summary>
                <pre className="p-3 text-xs text-gray-800 overflow-x-auto border-t border-gray-200">
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

  return (
    <div className="transaction-stats bg-white">
      {/* Stats Overview - Always Visible */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Statistics</h3>
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total Events - Clickable to show all */}
            <button
              onClick={() => handleStatusFilter(null)}
              className={`p-4 rounded-lg text-left transition-all duration-200 transform hover:scale-105 ${
                statusFilter === null 
                  ? 'bg-blue-100 ring-2 ring-blue-500 shadow-lg' 
                  : 'bg-blue-50 hover:bg-blue-100'
              }`}
            >
              <h4 className="text-sm font-medium text-blue-800 mb-1">Total Events</h4>
              <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
              {statusFilter === null && (
                <p className="text-xs text-blue-700 mt-1 font-medium">• Showing all events</p>
              )}
            </button>

            {/* Successful Events - Clickable to filter */}
            <button
              onClick={() => handleStatusFilter('SUCCESS')}
              className={`p-4 rounded-lg text-left transition-all duration-200 transform hover:scale-105 ${
                statusFilter === 'SUCCESS' 
                  ? 'bg-green-100 ring-2 ring-green-500 shadow-lg' 
                  : 'bg-green-50 hover:bg-green-100'
              }`}
            >
              <h4 className="text-sm font-medium text-green-800 mb-1">Successful</h4>
              <p className="text-2xl font-bold text-green-900">{stats.byStatus.SUCCESS || 0}</p>
              {statusFilter === 'SUCCESS' && (
                <p className="text-xs text-green-700 mt-1 font-medium">• Filtering active</p>
              )}
            </button>

            {/* Failed Events - Clickable to filter */}
            <button
              onClick={() => handleStatusFilter('FAILED')}
              className={`p-4 rounded-lg text-left transition-all duration-200 transform hover:scale-105 ${
                statusFilter === 'FAILED' 
                  ? 'bg-red-100 ring-2 ring-red-500 shadow-lg' 
                  : 'bg-red-50 hover:bg-red-100'
              }`}
            >
              <h4 className="text-sm font-medium text-red-800 mb-1">Failed</h4>
              <p className="text-2xl font-bold text-red-900">{stats.byStatus.FAILED || 0}</p>
              {statusFilter === 'FAILED' && (
                <p className="text-xs text-red-700 mt-1 font-medium">• Filtering active</p>
              )}
            </button>

            {/* Success Rate - Clickable to show successful */}
            <button
              onClick={() => handleStatusFilter('SUCCESS')}
              className={`p-4 rounded-lg text-left transition-all duration-200 transform hover:scale-105 ${
                statusFilter === 'SUCCESS' 
                  ? 'bg-purple-100 ring-2 ring-purple-500 shadow-lg' 
                  : 'bg-purple-50 hover:bg-purple-100'
              }`}
            >
              <h4 className="text-sm font-medium text-purple-800 mb-1">Success Rate</h4>
              <p className="text-2xl font-bold text-purple-900">
                {stats.total > 0 ? Math.round((stats.byStatus.SUCCESS || 0) / stats.total * 100) : 0}%
              </p>
              <p className="text-xs text-purple-700 mt-1">Click to show successful</p>
            </button>
          </div>
        )}
      </div>

      {/* All Events List - Always Visible */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Events</h3>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              Showing {allEvents.length} events
            </div>
            {failedEventsCount > 0 && (
              <button
                onClick={handleRetryAll}
                disabled={retrying}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors disabled:bg-red-400"
              >
                {retrying ? 'Retrying...' : `Retry Failed (${failedEventsCount})`}
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
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 font-medium"
                >
                  Load More Events (50)
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
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
                className="text-sm text-blue-600 hover:text-blue-800 mt-2"
              >
                View all events
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 