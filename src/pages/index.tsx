/**
 * Main Dashboard Page
 * Displays Slack messages in a modern, responsive interface with real-time updates
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { MessageFeed } from '@/components/MessageFeed'
import { MessageTableView } from '@/components/MessageTableView'
import { MessageGroupedView } from '@/components/MessageGroupedView'
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
  ApiResponse,
  PaginationInfo
} from '@/types'
import { MessageSquare, Calendar, FileText } from 'lucide-react'

/**
 * Custom Dropdown Component for Group By Selection
 */
interface CustomDropdownProps {
  value: string
  onChange: (value: string) => void
  options: Array<{
    value: string
    label: string | React.ReactNode
    description: string
  }>
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors min-w-0"
      >
        <div className="truncate flex-1">
          {selectedOption?.label || 'Select option'}
        </div>
        <svg 
          className={`w-4 h-4 ml-2 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                  value === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                }`}
              >
                <div className="flex flex-col">
                  <div className="font-medium">{option.label}</div>
                  <span className="text-xs text-gray-500 mt-0.5">{option.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Dashboard page component
 */
const Dashboard: React.FC = () => {
  // State management
  const [messages, setMessages] = useState<MessageDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })
  const [filters, setFilters] = useState<MessageFilters>({
    channel: '',
    username: '',
    dateFrom: '',
    dateTo: '',
    search: '',
    page: 1,
    limit: 50
  })
  const [channels, setChannels] = useState<string[]>([])
  const [realTimeEnabled, setRealTimeEnabled] = useState(true)
  const [debugModalOpen, setDebugModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'feed' | 'table' | 'grouped'>('feed')
  const [groupBy, setGroupBy] = useState<'channel' | 'date' | 'document'>('channel')
  const [showFilters, setShowFilters] = useState(false)

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
    setPagination((prev: PaginationInfo) => ({
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

          {/* Page Header - Mobile Optimized */}
          <div className="flex flex-col gap-2 sm:gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">
                  Messages Dashboard
                </h1>
                <div className="mt-1 text-xs sm:text-sm text-gray-600">
                  <span>{pagination.total} total messages</span>
                  {loading && (
                    <>
                      <span className="hidden sm:inline"> • </span>
                      <div className="inline-flex sm:hidden items-center space-x-1 ml-2">
                        <LoadingSpinner size="sm" />
                      </div>
                      <div className="hidden sm:inline-flex items-center space-x-1">
                        <LoadingSpinner size="sm" />
                        <span>Loading...</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards - Mobile Optimized */}
          <div className="flex flex-wrap gap-2 sm:gap-4">
            {/* TransactionStats component is not defined in the original file,
                so this section is commented out or removed as per instructions. */}
            {/* <TransactionStats 
              totalSent={transactionStats.totalSent}
              totalReceived={transactionStats.totalReceived}
              successRate={transactionStats.successRate}
              className="text-xs sm:text-sm"
            /> */}
          </div>

          {/* Filters - Mobile Optimized */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Mobile Filter Toggle */}
            <div className="sm:hidden">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">
                    Filters
                    {(filters.search || filters.channel || filters.dateFrom || filters.dateTo) && (
                      <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Active
                      </span>
                    )}
                  </span>
                </div>
                <svg 
                  className={`w-4 h-4 text-gray-500 transition-transform ${showFilters ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Filter Content */}
            <div className={`${showFilters ? 'block' : 'hidden'} sm:block p-3 sm:p-4 ${showFilters ? 'border-t border-gray-200' : ''} sm:border-t-0`}>
              <FilterBar
                filters={filters}
                onFiltersChange={handleFiltersChange}
                loading={loading}
                channels={channels}
              />
            </div>
          </div>

          {/* View Controls - Mobile Optimized Segmented Control */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            {/* View Mode Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <span className="text-sm font-medium text-gray-700 hidden sm:block">View:</span>
              
              {/* Mobile: Segmented Control Style */}
              <div className="flex rounded-lg bg-gray-100 p-1 w-full sm:w-auto">
                <button
                  onClick={() => setViewMode('feed')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    viewMode === 'feed'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center justify-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span>Feed</span>
                  </span>
                </button>
                
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    viewMode === 'table'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center justify-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m5-8v8m-9-8V6a2 2 0 012-2h6a2 2 0 012 2v4" />
                    </svg>
                    <span>Table</span>
                  </span>
                </button>
                
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    viewMode === 'grouped'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center justify-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-4H5m14 8H5m14 4H5" />
                    </svg>
                    <span>Grouped</span>
                  </span>
                </button>
              </div>
            </div>

            {/* Group By Selector - Only show when grouped view is selected */}
            {viewMode === 'grouped' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Group by:</label>
                <div className="w-full sm:w-48">
                  <CustomDropdown
                    value={groupBy}
                    onChange={(value) => setGroupBy(value as 'channel' | 'date' | 'document')}
                    options={[
                      {
                        value: 'channel',
                        label: (
                          <div className="flex items-center space-x-2">
                            <MessageSquare className="w-4 h-4 text-blue-600" />
                            <span>Channel</span>
                          </div>
                        ),
                        description: 'Group by Slack channel'
                      },
                      {
                        value: 'date',
                        label: (
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-green-600" />
                            <span>Date</span>
                          </div>
                        ),
                        description: 'Group by day'
                      },
                      {
                        value: 'document',
                        label: (
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-purple-600" />
                            <span>Topic/Thread</span>
                          </div>
                        ),
                        description: 'Group by conversation topic'
                      }
                    ]}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Message Views */}
          {loading && messages.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 text-center py-12">
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
            <>
              {viewMode === 'feed' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <MessageFeed
                    messages={messages}
                    loading={loading}
                    error={error || undefined}
                    onLoadMore={handleLoadMore}
                    hasMore={pagination.hasNext}
                    onPIIStatusUpdate={() => fetchMessages(undefined, false)}
                  />
                </div>
              )}
              
              {viewMode === 'table' && (
                <MessageTableView
                  messages={messages}
                  loading={loading}
                  error={error || undefined}
                  onLoadMore={handleLoadMore}
                  hasMore={pagination.hasNext}
                />
              )}
              
              {viewMode === 'grouped' && (
                <MessageGroupedView
                  messages={messages}
                  loading={loading}
                  error={error || undefined}
                  onLoadMore={handleLoadMore}
                  hasMore={pagination.hasNext}
                  groupBy={groupBy}
                />
              )}
            </>
          )}

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