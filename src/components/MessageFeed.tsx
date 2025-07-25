/**
 * MessageFeed Component
 * Displays a feed of Slack messages with infinite scroll
 */

import React, { useRef, useCallback, useEffect } from 'react'
import { MessageCard } from './MessageCard'
import { LoadingSpinner } from './LoadingSpinner'
import type { MessageFeedProps } from '@/types'

/**
 * MessageFeed component with infinite scroll
 */
export const MessageFeed: React.FC<MessageFeedProps> = ({
  messages,
  loading = false,
  error,
  onLoadMore,
  hasMore = false
}) => {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const lastMessageRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return
    
    if (observerRef.current) {
      observerRef.current.disconnect()
    }
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && onLoadMore) {
        onLoadMore()
      }
    })
    
    if (node) {
      observerRef.current.observe(node)
    }
  }, [loading, hasMore, onLoadMore])

  // Cleanup observer on unmount
  useEffect(() => {
    const observer = observerRef.current
    return () => {
      if (observer) {
        observer.disconnect()
      }
    }
  }, [])

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-600">
          <p className="font-medium">Error loading messages</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (messages.length === 0 && !loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>No messages found</p>
      </div>
    )
  }

  return (
    <div className="message-feed">
      {/* Message List */}
      <div className="divide-y divide-gray-100">
        {messages.map((message, index) => {
          const isLast = index === messages.length - 1
          
          return (
            <div
              key={message.id}
              ref={isLast ? lastMessageRef : null}
              className="message-feed__item"
            >
              <MessageCard 
                message={message} 
                showChannel={true}
                className="p-4 hover:bg-gray-50 transition-colors"
              />
            </div>
          )
        })}
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner size="md" />
          <span className="ml-2 text-sm text-gray-500">Loading messages...</span>
        </div>
      )}

      {/* End of Messages Indicator */}
      {!hasMore && messages.length > 0 && (
        <div className="text-center py-4 text-sm text-gray-400 border-t">
          <p>You've reached the end of the messages</p>
        </div>
      )}
    </div>
  )
} 