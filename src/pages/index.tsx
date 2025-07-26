/**
 * Main Dashboard Page
 * Displays Slack messages in a modern, responsive interface
 */

import React, { useState, useEffect, useCallback } from 'react'
import { MessageFeed } from '@/components/MessageFeed'
import { FilterBar } from '@/components/FilterBar'
import { Header } from '@/components/Header'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
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

  /**
   * Fetch messages from API
   */
  const fetchMessages = useCallback(async (newFilters?: MessageFilters): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      const activeFilters = newFilters || filters
      const queryParams = new URLSearchParams()

      // Build query parameters
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (value && value !== '') {
          queryParams.append(key, value.toString())
        }
      })

      const response = await fetch(`/api/messages?${queryParams.toString()}`)
      const result: ApiResponse<PaginatedMessages> = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch messages')
      }

      if (result.data) {
        setMessages(result.data.messages)
        setPagination(result.data.pagination)

        // Extract unique channels for filter dropdown
        const uniqueChannels = Array.from(
          new Set(result.data.messages.map(msg => msg.channel))
        ).sort()
        setChannels(uniqueChannels)
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('❌ Error fetching messages:', err)
    } finally {
      setLoading(false)
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

  // Fetch messages when filters change
  useEffect(() => {
    fetchMessages(filters)
  }, [filters, fetchMessages])

  // Auto-refresh messages every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        fetchMessages()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [loading, fetchMessages])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <Header />

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6 max-w-6xl">
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
                  {Object.values(filters).some(v => v && v !== '' && v !== 1 && v !== 20)
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