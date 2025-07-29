/**
 * MessageTableView Component
 * Displays messages in a structured table format with sortable columns
 */

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { MessageDisplay } from '@/types'
import { FileText, Eye } from 'lucide-react'

interface MessageTableViewProps {
  messages: MessageDisplay[]
  loading: boolean
  error?: string
  onLoadMore: () => void
  hasMore: boolean
}

type SortField = 'timestamp' | 'username' | 'channel' | 'text' | 'documentStatus'
type SortDirection = 'asc' | 'desc'

/**
 * MessageTableView component for structured data display
 */
export const MessageTableView: React.FC<MessageTableViewProps> = ({
  messages,
  loading,
  error,
  onLoadMore,
  hasMore
}) => {
  const [sortField, setSortField] = useState<SortField>('timestamp')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  /**
   * Handle column sorting
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  /**
   * Sort messages based on current sort settings
   */
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      let aVal: any, bVal: any

      switch (sortField) {
        case 'timestamp':
          aVal = new Date(a.timestamp).getTime()
          bVal = new Date(b.timestamp).getTime()
          break
        case 'username':
          aVal = a.username.toLowerCase()
          bVal = b.username.toLowerCase()
          break
        case 'channel':
          aVal = a.channel.toLowerCase()
          bVal = b.channel.toLowerCase()
          break
        case 'text':
          aVal = a.text.toLowerCase()
          bVal = b.text.toLowerCase()
          break
        case 'documentStatus':
          aVal = a.isProcessed ? 'processed' : 'unprocessed'
          bVal = b.isProcessed ? 'processed' : 'unprocessed'
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [messages, sortField, sortDirection])

  /**
   * Render sort icon
   */
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 ml-1 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }

    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 ml-1 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 ml-1 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }

  /**
   * Truncate text for table display
   */
  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  /**
   * Get message role and status info
   */
    const getMessageInfo = (message: MessageDisplay) => {
    if (!message.isProcessed) {
      return { 
        status: 'Unprocessed', 
        color: 'text-gray-500 dark:text-gray-400', 
        bg: 'bg-gray-100 dark:bg-gray-700',
        role: null 
      }
    }
    
    // Show the actual message role if available
    if (message.messageRole) {
             const roleInfo = {
        'QUESTION': { status: 'Question', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/30' },
        'ANSWER': { status: 'Answer', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-900/30' },
        'CONTEXT': { status: 'Context', color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-700' },
        'FOLLOW_UP': { status: 'Follow-up', color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-100 dark:bg-orange-900/30' },
        'CONFIRMATION': { status: 'Greeting', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-100 dark:bg-purple-900/30' }
      }
      
      const info = roleInfo[message.messageRole as keyof typeof roleInfo] || 
                   { status: 'Processed', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/30' }
      
      return {
        ...info,
        role: message.messageRole,
        documentId: message.documentId,
        documentTitle: message.documentTitle
      }
    }
    
    return { 
      status: 'Processed', 
      color: 'text-blue-700 dark:text-blue-300', 
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      role: null,
      documentId: message.documentId,
      documentTitle: message.documentTitle
    }
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 dark:text-red-400 mb-4">Error loading messages</div>
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Table Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Messages Table View</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {messages.length} messages • Click column headers to sort • Shows processing status and document relationships
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-100 dark:bg-blue-900"></span>
              <span className="text-gray-600 dark:text-gray-400">Questions</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-100 dark:bg-green-900"></span>
              <span className="text-gray-600 dark:text-gray-400">Answers</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-100 dark:bg-gray-600"></span>
              <span className="text-gray-600 dark:text-gray-400">Context</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th
                onClick={() => handleSort('timestamp')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center">
                  Date/Time
                  {renderSortIcon('timestamp')}
                </div>
              </th>
              <th
                onClick={() => handleSort('channel')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center">
                  Channel
                  {renderSortIcon('channel')}
                </div>
              </th>
              <th
                onClick={() => handleSort('username')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center">
                  User
                  {renderSortIcon('username')}
                </div>
              </th>
              <th
                onClick={() => handleSort('text')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center">
                  Message
                  {renderSortIcon('text')}
                </div>
              </th>
              <th
                onClick={() => handleSort('documentStatus')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center">
                  Status
                  {renderSortIcon('documentStatus')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedMessages.map((message) => {
              const { date, time } = formatTimestamp(message.timestamp)
              const messageInfo = getMessageInfo(message)
              
              return (
                <tr key={message.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{date}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{time}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                      {message.channelName || `#${message.channel}`}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                          <span className="text-sm font-medium text-white">
                            {message.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{message.username}</div>
                        {message.userId && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">ID: {message.userId.substring(0, 8)}...</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-gray-100 max-w-md">
                      {truncateText(message.text, 150)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${messageInfo.bg} ${messageInfo.color}`}>
                        {messageInfo.status}
                      </span>
                      {messageInfo.documentTitle && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 max-w-32 truncate flex items-center">
                          <FileText className="h-3 w-3 mr-1 flex-shrink-0" />
                          {messageInfo.documentTitle}
                        </div>
                      )}
                      {message.processingConfidence && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {Math.round(message.processingConfidence * 100)}% confidence
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex flex-col gap-1">
                      {messageInfo.documentId ? (
                        <Link
                          href={`/documents/${messageInfo.documentId}`}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 text-xs flex items-center"
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          View Document
                        </Link>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-xs">No Document</span>
                      )}
                      <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 text-xs text-left">
                        ℹ️ Message Details
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="px-6 py-8 text-center">
          <div className="inline-flex items-center text-gray-900 dark:text-gray-100">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading more messages...
          </div>
        </div>
      )}

      {/* Load More Button */}
      {!loading && hasMore && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-center">
          <button
            onClick={onLoadMore}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            Load More Messages
            <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && messages.length === 0 && (
        <div className="px-6 py-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17h6l1.5-6H7.5L9 17zM9 17v4a1 1 0 01-1 1H7a1 1 0 01-1-1v-4M9 17h6m0 0v4a1 1 0 001 1h1a1 1 0 001-1v-4" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Messages</h3>
          <p className="text-gray-500 dark:text-gray-400">No messages match your current filters.</p>
        </div>
      )}
    </div>
  )
} 