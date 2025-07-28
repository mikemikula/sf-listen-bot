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
        className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        iconClassName: 'text-yellow-600'
      }
    } else if (piiAutoReplaced > 0) {
      return {
        icon: <EyeOff className="w-3 h-3" />,
        text: `${piiAutoReplaced} protected`,
        className: 'bg-blue-100 text-blue-800 border-blue-200',
        iconClassName: 'text-blue-600'
      }
    } else if (piiWhitelisted > 0) {
      return {
        icon: <CheckCircle className="w-3 h-3" />,
        text: `${piiWhitelisted} whitelisted`,
        className: 'bg-green-100 text-green-800 border-green-200',
        iconClassName: 'text-green-600'
      }
    } else {
      return {
        icon: <Shield className="w-3 h-3" />,
        text: `${piiDetectionCount} detected`,
        className: 'bg-gray-100 text-gray-800 border-gray-200',
        iconClassName: 'text-gray-600'
      }
    }
  }

  const status = getPrimaryStatus()

  return (
    <div className={`
      inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border
      ${status.className}
      cursor-help
    `}
    title={`PII Detection: ${piiDetectionCount} total, ${piiPendingReview} pending review, ${piiWhitelisted} whitelisted, ${piiAutoReplaced} auto-replaced`}
    >
      <div className={status.iconClassName}>
        {status.icon}
      </div>
      <span>{status.text}</span>
    </div>
  )
}

/**
 * PII Inline Actions Component
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

  // Show status with direct action button
  if (currentStatus.piiPendingReview > 0) {
    return (
      <div className="inline-flex items-center space-x-2">
        <div className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
          <Clock className="w-3 h-3 text-yellow-600" />
          <span>{currentStatus.piiPendingReview} needs review</span>
        </div>
        <button
          onClick={handleUnmarkProtected}
          disabled={isUpdating}
          className="inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <CheckCircle className="w-3 h-3" />
          <span>{isUpdating ? 'Updating...' : 'Not PII'}</span>
        </button>
      </div>
    )
  }

  if (currentStatus.piiAutoReplaced > 0) {
    return (
      <div className="inline-flex items-center space-x-2">
        <div className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
          <EyeOff className="w-3 h-3 text-blue-600" />
          <span>{currentStatus.piiAutoReplaced} protected</span>
        </div>
        <button
          onClick={handleUnmarkProtected}
          disabled={isUpdating}
          className="inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <X className="w-3 h-3" />
          <span>{isUpdating ? 'Updating...' : 'Unmark'}</span>
        </button>
      </div>
    )
  }

  if (currentStatus.piiWhitelisted > 0) {
    return (
      <div className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
        <CheckCircle className="w-3 h-3 text-green-600" />
        <span>{currentStatus.piiWhitelisted} not sensitive</span>
      </div>
    )
  }

  // Fallback
  return (
    <div className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
      <Shield className="w-3 h-3 text-gray-600" />
      <span>{piiDetectionCount} detected</span>
    </div>
  )
}

/**
 * Individual reply component with PII support
 */
const ThreadReply: React.FC<{ reply: any, getUserAvatar: (username: string) => string, formatMessageText: (text: string) => string, onPIIStatusUpdate?: () => void }> = ({ 
  reply, 
  getUserAvatar, 
  formatMessageText,
  onPIIStatusUpdate
}) => (
  <div className="flex items-start space-x-3 mt-2 pl-6 border-l-2 border-gray-200">
    <div className={`
      flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-xs
      ${getUserAvatar(reply.username)}
    `}>
      {reply.username.charAt(0).toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center space-x-2 mb-1">
        <span className="font-semibold text-xs text-gray-900">{reply.username}</span>
        <time className="text-xs text-gray-500" title={new Date(reply.timestamp).toLocaleString()}>
          {reply.timeAgo}
        </time>
        
        {/* PII Detection Status for Thread Replies */}
        {reply.hasPIIDetections && (
          <>
            <span className="text-gray-400">•</span>
                         <PIIInlineActions
               messageId={reply.id}
               piiDetections={reply.piiDetections || []}
               piiDetectionCount={reply.piiDetectionCount}
               piiPendingReview={reply.piiPendingReview}
               piiWhitelisted={reply.piiWhitelisted}
               piiAutoReplaced={reply.piiAutoReplaced}
               onPIIStatusUpdate={onPIIStatusUpdate}
             />
          </>
        )}
      </div>
      
      {/* PII Alert Banner for Thread Replies */}
      {reply.piiPendingReview > 0 && (
        <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-3 h-3 text-yellow-600" />
            <div className="text-xs text-yellow-800">
              <span className="font-medium">
                {reply.piiPendingReview} potential PII detection{reply.piiPendingReview !== 1 ? 's' : ''} need review
              </span>
              <Link 
                href="/pii/review" 
                className="ml-2 underline hover:no-underline"
              >
                Review now →
              </Link>
            </div>
          </div>
        </div>
      )}
      
      <div 
        className="text-gray-900 text-sm leading-relaxed prose prose-sm max-w-none"
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
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>') // Code
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
    if (channel.startsWith('D')) {
      return 'DM'
    }
    return channel
  }

  const hasReplies = message.threadReplies && message.threadReplies.length > 0

  return (
    <div className={`message-card ${className} ${message.isThreadReply ? 'ml-6 border-l-4 border-blue-200 pl-4' : ''}`}>
      {/* Parent Message Context for Thread Replies */}
      {message.isThreadReply && message.parentMessage && (
        <div className="mb-3 p-2 bg-gray-50 rounded border-l-4 border-gray-300">
          <div className="text-xs text-gray-600 mb-1">↳ Replying to:</div>
          <div className="text-sm text-gray-800 font-medium">{message.parentMessage.username}</div>
          <div 
            className="text-sm text-gray-700 line-clamp-2"
            dangerouslySetInnerHTML={{ __html: formatMessageText(message.parentMessage.text) }}
          />
        </div>
      )}

      <div className="flex items-start space-x-3">
        {/* Thread Indicator */}
        {message.isThreadReply && (
          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
          </div>
        )}

        {/* User Avatar */}
        <div className={`
          message-card__avatar
          flex-shrink-0 ${message.isThreadReply ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'} rounded-full flex items-center justify-center text-white font-medium
          ${getUserAvatar(message.username)}
        `}>
          {message.username.charAt(0).toUpperCase()}
        </div>

        {/* Message Content */}
        <div className="message-card__content flex-1 min-w-0">
          {/* Message Header */}
          <div className="message-card__header flex items-center space-x-2 mb-1">
            <span className="message-card__username font-semibold text-sm text-gray-900">
              {message.username}
            </span>
            
            {showChannel && (
              <>
                <span className="text-gray-400">•</span>
                <span className="message-card__channel text-sm text-slack-blue font-medium">
                  {getChannelDisplay(message.channel)}
                </span>
              </>
            )}
            
            <span className="text-gray-400">•</span>
            <time 
              className="message-card__timestamp text-sm text-gray-500"
              dateTime={message.timestamp.toString()}
              title={new Date(message.timestamp).toLocaleString()}
            >
              {message.timeAgo}
            </time>

            {/* Thread Badge */}
            {hasReplies && !message.isThreadReply && (
              <>
                <span className="text-gray-400">•</span>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  🧵 {message.threadReplies.length} {message.threadReplies.length === 1 ? 'reply' : 'replies'}
                </span>
              </>
            )}

            {/* PII Detection Status */}
            {message.hasPIIDetections && (
              <>
                <span className="text-gray-400">•</span>
                <PIIInlineActions
                  messageId={message.id}
                  piiDetections={message.piiDetections || []}
                  piiDetectionCount={message.piiDetectionCount}
                  piiPendingReview={message.piiPendingReview}
                  piiWhitelisted={message.piiWhitelisted}
                  piiAutoReplaced={message.piiAutoReplaced}
                  onPIIStatusUpdate={onPIIStatusUpdate}
                />
              </>
            )}
          </div>

          {/* Message Text */}
          <div className="message-card__text">
            {/* PII Alert Banner */}
            {message.piiPendingReview > 0 && (
              <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <div className="text-xs text-yellow-800">
                    <span className="font-medium">
                      {message.piiPendingReview} potential PII detection{message.piiPendingReview !== 1 ? 's' : ''} need review
                    </span>
                    <Link 
                      href="/pii/review" 
                      className="ml-2 underline hover:no-underline"
                    >
                      Review now →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <div 
              className="text-gray-900 text-sm leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: formatMessageText(message.text) 
              }}
            />
          </div>

          {/* Thread Replies */}
          {hasReplies && !message.isThreadReply && (
            <div className="mt-3">
              <button 
                onClick={() => setThreadsExpanded(!threadsExpanded)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center space-x-1"
              >
                <span>{threadsExpanded ? '▼' : '▶'}</span>
                <span>
                  {threadsExpanded ? 'Hide' : 'Show'} {message.threadReplies.length} {message.threadReplies.length === 1 ? 'reply' : 'replies'}
                </span>
              </button>
              
              {threadsExpanded && (
                <div className="mt-2 space-y-2 border-l-2 border-blue-200 pl-4">
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
  )
} 