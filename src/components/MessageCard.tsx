/**
 * MessageCard Component
 * Displays individual Slack message with metadata and thread support
 * Includes PII detection status indicators
 */

import React, { useState } from 'react'
import Link from 'next/link'
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Eye,
  EyeOff,
  X,
  MoreHorizontal
} from 'lucide-react'
import type { MessageCardProps, PIIDetection, PIIStatus } from '@/types'

/**
 * PII Status Indicator Props
 */
interface PIIStatusIndicatorProps {
  piiDetectionCount: number
  piiPendingReview: number
  piiWhitelisted: number
  piiAutoReplaced: number
}

/**
 * PII Status Indicator Component
 * Shows visual indicators for PII detection status
 */
const PIIStatusIndicator: React.FC<PIIStatusIndicatorProps> = ({
  piiDetectionCount,
  piiPendingReview,
  piiWhitelisted,
  piiAutoReplaced
}) => {
  // Determine primary status and styling
  const getPrimaryStatus = () => {
    if (piiPendingReview > 0) {
      return {
        icon: <Clock className="w-3 h-3" />,
        text: `${piiPendingReview} pending review`,
        className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700',
        iconClassName: 'text-yellow-600 dark:text-yellow-400'
      }
    } else if (piiAutoReplaced > 0) {
      return {
        icon: <EyeOff className="w-3 h-3" />,
        text: `${piiAutoReplaced} auto replaced`,
        className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700',
        iconClassName: 'text-blue-600 dark:text-blue-400'
      }
    } else if (piiWhitelisted > 0) {
      return {
        icon: <CheckCircle className="w-3 h-3" />,
        text: `${piiWhitelisted} not sensitive`,
        className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700',
        iconClassName: 'text-green-600 dark:text-green-400'
      }
    }
    return null
  }

  const status = getPrimaryStatus()

  return (
    <div className={`
      inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border
      ${status?.className}
      cursor-help
    `}
    title={`PII Detection: ${piiDetectionCount} total, ${piiPendingReview} pending review, ${piiWhitelisted} whitelisted, ${piiAutoReplaced} auto-replaced`}
    >
      <div className={status?.iconClassName}>
        {status?.icon}
      </div>
      <span>{status?.text}</span>
    </div>
  )
}

/**
 * PII Inline Actions Component - Mobile Optimized
 * Clean, obvious UX for PII management directly in the message feed
 */
interface PIIInlineActionsProps {
  messageId: string
  piiDetections: PIIDetection[]
  piiDetectionCount: number
  piiPendingReview: number
  piiWhitelisted: number
  piiAutoReplaced: number
  onPIIStatusUpdate?: () => void // Callback to refresh messages
}

const PIIInlineActions: React.FC<PIIInlineActionsProps> = ({
  messageId,
  piiDetections,
  piiDetectionCount,
  piiPendingReview,
  piiWhitelisted,
  piiAutoReplaced,
  onPIIStatusUpdate
}) => {
  const [isUpdating, setIsUpdating] = useState(false)
  const [currentStatus, setCurrentStatus] = useState({
    piiPendingReview,
    piiWhitelisted,
    piiAutoReplaced
  })

  /**
   * Bulk whitelist all detections for this message (optimistic update)
   */
  const handleUnmarkProtected = async () => {
    // Optimistic update
    setCurrentStatus({
      piiPendingReview: 0,
      piiWhitelisted: currentStatus.piiWhitelisted + currentStatus.piiPendingReview + currentStatus.piiAutoReplaced,
      piiAutoReplaced: 0
    })

    setIsUpdating(true)
    try {
      const updates = piiDetections
        .filter(d => d.status === 'PENDING_REVIEW' || d.status === 'AUTO_REPLACED')
        .map(detection => ({
          detectionId: detection.id,
          status: 'WHITELISTED' as PIIStatus
        }))

      if (updates.length === 0) return

      const response = await fetch('/api/pii/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          updates,
          reviewedBy: 'user', // TODO: Get actual user
          reviewNote: 'Unmarked as protected from message feed'
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to unmark PII: ${response.statusText}`)
      }

      // Trigger targeted refresh instead of full page reload
      if (onPIIStatusUpdate) {
        onPIIStatusUpdate()
      }

    } catch (error) {
      console.error('Failed to unmark PII:', error)
      // Revert optimistic update
      setCurrentStatus({ piiPendingReview, piiWhitelisted, piiAutoReplaced })
      alert('Failed to unmark as protected. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  // Show status with direct action button - Mobile Optimized
  if (currentStatus.piiPendingReview > 0) {
    return (
      <div className="inline-flex items-center space-x-1 sm:space-x-2">
        <div className="inline-flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700">
          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-600 dark:text-yellow-400" />
          <span className="hidden sm:inline">{currentStatus.piiPendingReview} needs review</span>
          <span className="sm:hidden">{currentStatus.piiPendingReview}</span>
        </div>
        <button
          onClick={handleUnmarkProtected}
          disabled={isUpdating}
          className="inline-flex items-center space-x-0.5 sm:space-x-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium bg-green-600 dark:bg-green-700 text-white hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 transition-colors"
        >
          <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          <span className="hidden sm:inline">{isUpdating ? 'Updating...' : 'Not PII'}</span>
          <span className="sm:hidden">✓</span>
        </button>
      </div>
    )
  }

  if (currentStatus.piiAutoReplaced > 0) {
    return (
      <div className="inline-flex items-center space-x-1 sm:space-x-2">
        <div className="inline-flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
          <EyeOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">{currentStatus.piiAutoReplaced} auto replaced</span>
          <span className="sm:hidden">{currentStatus.piiAutoReplaced}</span>
        </div>
        <button
          onClick={handleUnmarkProtected}
          disabled={isUpdating}
          className="inline-flex items-center space-x-0.5 sm:space-x-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium bg-green-600 dark:bg-green-700 text-white hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 transition-colors"
        >
          <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          <span className="hidden sm:inline">{isUpdating ? 'Updating...' : 'Not PII'}</span>
          <span className="sm:hidden">✓</span>
        </button>
      </div>
    )
  }

  if (currentStatus.piiWhitelisted > 0) {
    return (
      <div className="inline-flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700">
        <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-600 dark:text-green-400" />
        <span className="hidden sm:inline">{currentStatus.piiWhitelisted} not sensitive</span>
        <span className="sm:hidden">{currentStatus.piiWhitelisted}</span>
      </div>
    )
  }

  // Fallback
  return (
    <div className="inline-flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
      <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-600" />
      <span className="hidden sm:inline">{piiDetectionCount} detected</span>
      <span className="sm:hidden">{piiDetectionCount}</span>
    </div>
  )
}

/**
 * Individual reply component with PII support - Mobile Optimized
 */
const ThreadReply: React.FC<{ reply: any, getUserAvatar: (username: string) => string, formatMessageText: (text: string) => string, onPIIStatusUpdate?: () => void }> = ({ 
  reply, 
  getUserAvatar, 
  formatMessageText,
  onPIIStatusUpdate
}) => (
  <div className="flex items-start space-x-2 sm:space-x-3 mt-2 pl-3 sm:pl-6 border-l-2 border-gray-200 dark:border-gray-600">
    <div className={`
      flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white font-medium text-xs
      ${getUserAvatar(reply.username)}
    `}>
      {reply.username.charAt(0).toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
        <span className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white truncate">{reply.username}</span>
        <time className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap" title={new Date(reply.timestamp).toLocaleString()}>
          {reply.timeAgo}
        </time>
        
        {/* PII Detection Status for Thread Replies - Mobile Optimized */}
        {reply.hasPIIDetections && (
          <>
            <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">•</span>
            <div className="flex-shrink-0">
              <PIIInlineActions
                messageId={reply.id}
                piiDetections={reply.piiDetections || []}
                piiDetectionCount={reply.piiDetectionCount}
                piiPendingReview={reply.piiPendingReview}
                piiWhitelisted={reply.piiWhitelisted}
                piiAutoReplaced={reply.piiAutoReplaced}
                onPIIStatusUpdate={onPIIStatusUpdate}
              />
            </div>
          </>
        )}
      </div>
      
      {/* PII Alert Banner for Thread Replies - Mobile Optimized */}
      {reply.piiPendingReview > 0 && (
        <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-3 h-3 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            <div className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-300 min-w-0">
              <span className="font-medium block sm:inline">
                {reply.piiPendingReview} potential PII detection{reply.piiPendingReview !== 1 ? 's' : ''} need review
              </span>
              <Link 
                href="/pii/review" 
                className="underline hover:no-underline block sm:inline sm:ml-2"
              >
                Review now →
              </Link>
            </div>
          </div>
        </div>
      )}
      
      <div 
        className="text-gray-900 dark:text-gray-100 text-sm leading-relaxed prose prose-sm max-w-none break-words"
        dangerouslySetInnerHTML={{ __html: formatMessageText(reply.text) }}
      />
    </div>
  </div>
)

/**
 * MessageCard component for displaying individual messages with thread support
 */
export const MessageCard: React.FC<MessageCardProps> = ({
  message,
  showChannel = false,
  className = '',
  showChannelName = true,
  showDocumentBadge = true,
  showTimestamp = true,
  getUserAvatar,
  onPIIStatusUpdate
}) => {
  const [threadsExpanded, setThreadsExpanded] = useState(false)

  /**
   * Format message text to handle basic Slack formatting and clean PII replacements
   */
  const formatMessageText = (text: string): string => {
    // Handle basic Slack formatting
    let formattedText = text
      // Clean up Slack email formatting first
      .replace(/<mailto:([^|>]+)\|([^>]+)>/g, '$2') // <mailto:email|display> -> display
      .replace(/<mailto:([^>]+)>/g, '$1') // <mailto:email> -> email
      // Then apply other Slack formatting
      .replace(/\*([^*]+)\*/g, '<strong>$1</strong>') // Bold
      .replace(/_([^_]+)_/g, '<em>$1</em>') // Italic
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-1 py-0.5 rounded text-sm">$1</code>') // Code
      .replace(/\n/g, '<br>') // Line breaks

    return formattedText
  }

  /**
   * Get channel display name
   */
  const getChannelDisplay = (channel: string): string => {
    if (channel.startsWith('C')) {
      return `#${channel.slice(1, 8)}`
    }
    return channel
  }

  return (
    <div className={`message-card bg-white dark:bg-gray-800 ${className}`}>
      <div className="message-card__container px-3 sm:px-4 py-3 sm:py-4">
        {/* Parent Message Reference (for thread replies) */}
        {message.parentMessage && (
          <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md border-l-4 border-blue-400 dark:border-blue-500">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Replying to:</div>
            <div 
              className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed line-clamp-2"
              dangerouslySetInnerHTML={{ __html: formatMessageText(message.parentMessage.text) }}
            />
          </div>
        )}

        <div className="flex items-start space-x-2 sm:space-x-3">
          {/* Thread Indicator */}
          {message.isThreadReply && (
            <div className="flex-shrink-0 w-4 h-4 sm:w-6 sm:h-6 flex items-center justify-center">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 dark:bg-blue-500 rounded-full"></div>
            </div>
          )}

          {/* User Avatar */}
          <div className={`
            message-card__avatar flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-medium text-xs sm:text-sm
            ${getUserAvatar ? getUserAvatar(message.username) : 'bg-gray-500'}
          `}>
            {message.username.charAt(0).toUpperCase()}
          </div>

          {/* Message Content */}
          <div className="flex-1 min-w-0">
            {/* Message Header */}
            <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
              <span className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                {message.username}
              </span>
              
              {showChannelName && (
                <>
                  <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">•</span>
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                    {getChannelDisplay(message.channel)}
                  </span>
                </>
              )}
              
              {showTimestamp && (
                <>
                  <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">•</span>
                  <time className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap" title={new Date(message.timestamp).toLocaleString()}>
                    {message.timeAgo}
                  </time>
                </>
              )}

              {/* PII Detection Status - Mobile Optimized */}
              {message.hasPIIDetections && (
                <>
                  <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">•</span>
                  <div className="flex-shrink-0">
                    <PIIInlineActions
                      messageId={message.id}
                      piiDetections={message.piiDetections || []}
                      piiDetectionCount={message.piiDetectionCount}
                      piiPendingReview={message.piiPendingReview}
                      piiWhitelisted={message.piiWhitelisted}
                      piiAutoReplaced={message.piiAutoReplaced}
                      onPIIStatusUpdate={onPIIStatusUpdate}
                    />
                  </div>
                </>
              )}
            </div>

            {/* PII Alert Banner - Mobile Optimized */}
            {message.piiPendingReview > 0 && (
              <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  <div className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-300 min-w-0">
                    <span className="font-medium block sm:inline">
                      {message.piiPendingReview} potential PII detection{message.piiPendingReview !== 1 ? 's' : ''} need review
                    </span>
                    <Link 
                      href="/pii/review" 
                      className="underline hover:no-underline block sm:inline sm:ml-2"
                    >
                      Review now →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Message Text */}
            <div className="message-card__text">
              <div 
                className="text-gray-900 dark:text-gray-100 text-sm sm:text-base leading-relaxed prose prose-sm max-w-none break-words"
                dangerouslySetInnerHTML={{ __html: formatMessageText(message.text) }}
              />

              {/* Document Badge */}
              {showDocumentBadge && message.documentStatus && (
                <div className="mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  <span className="hidden sm:inline">Document: </span>
                  <span className="capitalize">{message.documentStatus.toLowerCase()}</span>
                </div>
              )}

              {/* Thread Replies */}
              {message.threadReplies && message.threadReplies.length > 0 && (
                <div className="mt-3 sm:mt-4">
                  <button
                    onClick={() => setThreadsExpanded(!threadsExpanded)}
                    className="text-sm sm:text-base text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    {threadsExpanded ? '▼ Hide' : '▶ Show'} {message.threadReplies.length} {message.threadReplies.length === 1 ? 'reply' : 'replies'}
                  </button>

                  {threadsExpanded && (
                    <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                      {message.threadReplies.map((reply) => (
                        <ThreadReply 
                          key={reply.id} 
                          reply={reply} 
                          getUserAvatar={getUserAvatar} 
                          formatMessageText={formatMessageText}
                          onPIIStatusUpdate={onPIIStatusUpdate}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 