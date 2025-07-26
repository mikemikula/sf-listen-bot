/**
 * Main Dashboard Page
 * Displays Slack messages in a modern, responsive interface with real-time updates
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { MessageFeed } from '@/components/MessageFeed'
import { FilterBar } from '@/components/FilterBar'
import { Header } from '@/components/Header'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { DebugModal } from '@/components/DebugModal'
import { useRealTimeMessages } from '@/hooks/useRealTimeMessages'
import type { 
  MessageDisplay, 
  MessageFilters, 
  PaginatedMessages,
  ApiResponse 
} from '@/types'

/**
 * Dashboard page component
 */
const Dashboard: React.FC = () => {
  // State management
  const [messages, setMessages] = useState<MessageDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<MessageFilters>({
    channel: '',
    search: '',
    page: 1,
    limit: 50
  })
  const [pagination, setPagination] = useState({
    hasNext: false,
    hasPrev: false,
    total: 0,
    totalPages: 0
  })
  const [channels, setChannels] = useState<string[]>([])
  const [realTimeEnabled, setRealTimeEnabled] = useState(true)
  const [debugModalOpen, setDebugModalOpen] = useState(false)

  /**
   * Handle new real-time messages
   */
  const handleNewMessage = useCallback((newMessage: MessageDisplay): void => {
    console.log('📨 New message received via SSE:', newMessage)
    setMessages(prevMessages => {
             // Check if message already exists (prevent duplicates)  
       const messageExists = prevMessages.some(msg => (msg as any).id === (newMessage as any).id)
      if (messageExists) {
        console.log('⚠️ Duplicate message detected, skipping')
        return prevMessages
      }

      console.log('✅ Adding new message to UI')
      // Add new message to the beginning of the list
      const updatedMessages = [newMessage, ...prevMessages]
      
             // Update channels list if new channel appears
       setChannels(prevChannels => {
         const newChannel = (newMessage as any).channel
         const channelExists = prevChannels.includes(newChannel)
         if (!channelExists) {
           return [newChannel, ...prevChannels].sort()
         }
         return prevChannels
       })

      return updatedMessages
    })

    // Update pagination total count
    setPagination(prev => ({
      ...prev,
      total: prev.total + 1
    }))
  }, [])

  /**
   * Handle real-time connection errors
   */
  const handleRealTimeError = useCallback((errorMessage: string): void => {
    console.error('Real-time connection error:', errorMessage)
    // Could show a notification to user here
  }, [])

  /**
   * Fetch messages from API
   */
  const fetchMessages = useCallback(async (newFilters?: MessageFilters, isRealTimeUpdate = false): Promise<void> => {
    try {
      // Don't show loading spinner for real-time updates to prevent UI jumps
      if (!isRealTimeUpdate) {
        setLoading(true)
      }
      setError(null)

      const activeFilters = newFilters || filters
      const queryParams = new URLSearchParams()

      // Build query parameters
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (value && value !== '') {
          queryParams.append(key, value.toString())
        }
      })

      // Add cache-busting timestamp
      queryParams.append('_t', Date.now().toString())

      const response = await fetch(`/api/messages?${queryParams.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      const result: ApiResponse<PaginatedMessages> = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch messages')
      }

      if (result.data) {
        setMessages(result.data.messages)
        setPagination(result.data.pagination)

        // Extract unique channels for filter dropdown
        const uniqueChannels = Array.from(
          new Set(result.data.messages.map(msg => (msg as any).channel))
        ).sort()
        setChannels(uniqueChannels)
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('❌ Error fetching messages:', err)
    } finally {
      // Only clear loading if this wasn't a real-time update
      if (!isRealTimeUpdate) {
        setLoading(false)
      }
    }
  }, [filters])

  /**
   * Handle filter changes
   */
  const handleFiltersChange = useCallback((newFilters: MessageFilters): void => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1 // Reset to first page when filters change
    }))
  }, [])

  /**
   * Handle pagination
   */
  const handlePageChange = useCallback((page: number): void => {
    setFilters(prev => ({ ...prev, page }))
  }, [])

  /**
   * Load more messages (infinite scroll)
   */
  const handleLoadMore = useCallback((): void => {
    if (pagination.hasNext) {
      handlePageChange((filters.page || 1) + 1)
    }
  }, [pagination.hasNext, filters.page, handlePageChange])

  /**
   * Handle message edits with deduplication
   */
  const lastEditRef = useRef<{id: string, timestamp: number} | null>(null)
  const handleMessageEdited = useCallback((editedMessage: MessageDisplay): void => {
    const messageId = (editedMessage as any).id
    const now = Date.now()
    
    // Prevent duplicate edits within 5 seconds (increased window)
    if (lastEditRef.current && 
        lastEditRef.current.id === messageId && 
        (now - lastEditRef.current.timestamp) < 5000) {
      console.log('⚠️ Duplicate edit ignored (same message within 5s)')
      return
    }
    
    lastEditRef.current = { id: messageId, timestamp: now }
    console.log('✏️ Message edit received via SSE:', editedMessage)
    
    setMessages(prevMessages => {
      return prevMessages.map(msg => {
        // Match by the database ID or Slack ID to update the edited message
        if ((msg as any).id === (editedMessage as any).id || (msg as any).slackId === (editedMessage as any).slackId) {
          console.log('✅ Updating edited message in UI')
          return {
            ...editedMessage,
            // Update the timeAgo since the message was just edited
            timeAgo: 'just now (edited)'
          }
        }
        return msg
      })
    })
  }, [])

  /**
   * Handle message deletions
   */
  const handleMessagesDeleted = useCallback((): void => {
    console.log('🗑️ Messages deleted, refreshing list')
    // Simple approach: refresh the current page of messages
    fetchMessages(filters, true)
  }, [fetchMessages, filters])

  /**
   * Toggle real-time updates
   */
  const toggleRealTime = useCallback((): void => {
    setRealTimeEnabled(prev => !prev)
  }, [])

  // Handle thread reply updates
  const handleThreadReplyAdded = useCallback((data: { parentThreadTs: string, reply: any, channel: string }) => {
    console.log('🧵 Thread reply added, refreshing messages:', data)
    // Refresh the messages to get the updated parent with new reply (silent update)
    fetchMessages(filters, true)
  }, [fetchMessages, filters])

  // Setup real-time connection
  const { isConnected, disconnect, reconnect } = useRealTimeMessages({
    onNewMessage: handleNewMessage,
    onMessageEdited: handleMessageEdited,
    onMessagesDeleted: handleMessagesDeleted,
    onThreadReplyAdded: handleThreadReplyAdded,
    onError: handleRealTimeError,
    enabled: realTimeEnabled
  })

  // Debug connection status
  useEffect(() => {
    console.log('🔌 SSE Connection status:', isConnected ? 'CONNECTED' : 'DISCONNECTED')
  }, [isConnected])

  // Fetch messages when filters change
  useEffect(() => {
    fetchMessages(filters)
  }, [filters, fetchMessages])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <Header 
          isConnected={isConnected}
          onDebugClick={() => setDebugModalOpen(true)}
        />

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6 max-w-6xl">
          {/* Real-time Status & Controls */}
          <div className="mb-4 flex items-center justify-between bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div 
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className={`text-sm font-medium ${
                  isConnected ? 'text-green-700' : 'text-red-700'
                }`}>
                  {isConnected ? 'Live' : 'Disconnected'}
                </span>
              </div>
              <span className="text-gray-400 text-sm">
                {isConnected ? 'Messages appear instantly' : 'Real-time updates unavailable'}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleRealTime}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  realTimeEnabled
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {realTimeEnabled ? 'Live On' : 'Live Off'}
              </button>
              
              {!isConnected && realTimeEnabled && (
                <button
                  onClick={reconnect}
                  className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md text-sm font-medium transition-colors"
                >
                  Reconnect
                </button>
              )}
            </div>
          </div>

          {/* Debug Modal (opened from header menu) */}
          <DebugModal 
            isOpen={debugModalOpen}
            onClose={() => setDebugModalOpen(false)}
            isConnected={isConnected}
          />

          {/* Filter Bar */}
          <div className="mb-6">
            <FilterBar
              filters={filters}
              onFiltersChange={handleFiltersChange}
              channels={channels}
              loading={loading}
            />
          </div>

          {/* Message Feed */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {loading && messages.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="text-red-600 mb-4">
                  <svg 
                    className="mx-auto h-12 w-12 mb-4" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" 
                    />
                  </svg>
                  <h3 className="text-lg font-medium">Error Loading Messages</h3>
                  <p className="text-gray-500 mt-2">{error}</p>
                </div>
                <button
                  onClick={() => fetchMessages()}
                  className="bg-slack-blue text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <MessageFeed
                messages={messages}
                loading={loading}
                error={error || undefined}
                onLoadMore={handleLoadMore}
                hasMore={pagination.hasNext}
              />
            )}
          </div>

          {/* Pagination Info */}
          {!loading && messages.length > 0 && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Showing {messages.length} of {pagination.total} messages
              {pagination.totalPages > 1 && (
                <span className="ml-2">
                  (Page {filters.page} of {pagination.totalPages})
                </span>
              )}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg 
                  className="mx-auto h-12 w-12 mb-4" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1} 
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
                  />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Messages Found</h3>
                <p className="text-gray-500">
                  {Object.values(filters).some(v => v && v !== '' && v !== 1 && v !== 50)
                    ? 'Try adjusting your filters or search terms.'
                    : 'No messages have been received yet. Make sure your Slack bot is configured correctly.'
                  }
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  )
}

export default Dashboard 