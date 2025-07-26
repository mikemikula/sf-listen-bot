/**
 * MessageCard Component
 * Displays individual Slack message with metadata and thread support
 */

import React, { useState } from 'react'
import type { MessageCardProps } from '@/types'

/**
 * Individual reply component
 */
const ThreadReply: React.FC<{ reply: any, getUserAvatar: (username: string) => string, formatMessageText: (text: string) => string }> = ({ 
  reply, 
  getUserAvatar, 
  formatMessageText 
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
      </div>
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
  className = ''
}) => {
  const [threadsExpanded, setThreadsExpanded] = useState(false)

  /**
   * Format message text to handle basic Slack formatting
   */
  const formatMessageText = (text: string): string => {
    // Handle basic Slack formatting
    return text
      .replace(/\*([^*]+)\*/g, '<strong>$1</strong>') // Bold
      .replace(/_([^_]+)_/g, '<em>$1</em>') // Italic
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>') // Code
      .replace(/\n/g, '<br>') // Line breaks
  }

  /**
   * Get user avatar placeholder
   */
  const getUserAvatar = (username: string): string => {
    // Generate a simple avatar based on username
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-indigo-500', 'bg-pink-500', 'bg-gray-500'
    ]
    const colorIndex = username.length % colors.length
    return colors[colorIndex]
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
          </div>

          {/* Message Text */}
          <div className="message-card__text">
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