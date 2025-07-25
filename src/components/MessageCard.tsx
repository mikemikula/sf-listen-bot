/**
 * MessageCard Component
 * Displays individual Slack message with metadata
 */

import React from 'react'
import type { MessageCardProps } from '@/types'

/**
 * MessageCard component for displaying individual messages
 */
export const MessageCard: React.FC<MessageCardProps> = ({
  message,
  showChannel = false,
  className = ''
}) => {
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

  return (
    <div className={`message-card ${className}`}>
      <div className="flex items-start space-x-3">
        {/* User Avatar */}
        <div className={`
          message-card__avatar
          flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm
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

          {/* Message Actions (Future Enhancement) */}
          {/* <div className="message-card__actions mt-2 flex items-center space-x-2">
            <button className="text-gray-400 hover:text-gray-600 text-xs">
              Reply
            </button>
            <button className="text-gray-400 hover:text-gray-600 text-xs">
              React
            </button>
          </div> */}
        </div>
      </div>
    </div>
  )
} 