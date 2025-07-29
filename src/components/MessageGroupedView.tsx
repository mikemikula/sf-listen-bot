/**
 * MessageGroupedView Component
 * Displays messages grouped by document, channel, or date
 */

import React, { useState, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { MessageDisplay, MessageFilters } from '@/types'
import { MessageCard } from '@/components/MessageCard'
import { HelpCircle, MessageSquare, FileText, Eye } from 'lucide-react'

interface MessageGroupedViewProps {
  messages: MessageDisplay[]
  loading: boolean
  error?: string
  onLoadMore: () => void
  hasMore: boolean
  groupBy: 'document' | 'channel' | 'date'
}

interface MessageGroup {
  key: string
  title: string
  subtitle?: string
  messages: MessageDisplay[]
  count: number
  documentId?: string
}

/**
 * MessageGroupedView component for organized data display
 */
export const MessageGroupedView: React.FC<MessageGroupedViewProps> = ({
  messages,
  loading,
  error,
  onLoadMore,
  hasMore,
  groupBy
}) => {
  /**
   * Group messages based on the selected groupBy option
   */
  const groupedMessages = useMemo(() => {
    const groups = new Map<string, MessageGroup>()

    messages.forEach(message => {
      let groupKey: string
      let groupTitle: string
      let groupSubtitle: string | undefined
      let documentId: string | undefined

      switch (groupBy) {
        case 'document':
          if (message.isProcessed && message.documentId) {
            groupKey = message.documentId
            groupTitle = message.documentTitle || `Document ${message.documentId.substring(0, 8)}...`
            groupSubtitle = `Status: ${message.documentStatus}`
            documentId = message.documentId
          } else {
            groupKey = 'unprocessed'
            groupTitle = 'Unprocessed Messages'
            groupSubtitle = 'Not yet added to any document'
          }
          break
        
        case 'channel':
          groupKey = message.channel
          groupTitle = `#${message.channel}`
          groupSubtitle = `Channel messages`
          break
        
        case 'date':
          const date = new Date(message.timestamp)
          groupKey = date.toDateString()
          groupTitle = date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
          groupSubtitle = `Messages from this date`
          break
        
        default:
          groupKey = 'other'
          groupTitle = 'Other Messages'
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          title: groupTitle,
          subtitle: groupSubtitle,
          messages: [],
          count: 0,
          documentId
        })
      }

      const group = groups.get(groupKey)!
      group.messages.push(message)
      group.count++
    })

    // Sort groups by count (descending) and then by title
    return Array.from(groups.values()).sort((a, b) => {
      if (groupBy === 'document' && a.key === 'unprocessed') return 1
      if (groupBy === 'document' && b.key === 'unprocessed') return -1
      if (a.count !== b.count) return b.count - a.count
      return a.title.localeCompare(b.title)
    })
  }, [messages, groupBy])

  /**
   * Format timestamp for display
   */
  const formatTime = (timestamp: string | Date) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

     /**
    * Get message type and icon
    */
   const getMessageTypeInfo = (message: MessageDisplay) => {
     if (!message.isProcessed) {
       return { 
         icon: <MessageSquare className="h-6 w-6 text-gray-600" />, 
         label: 'Unprocessed', 
         color: 'text-gray-600',
         bg: 'bg-gray-50'
       }
     }
     
     if (message.messageRole) {
       const typeInfo = {
         'QUESTION': { icon: <HelpCircle className="h-6 w-6 text-blue-700" />, label: 'Question', color: 'text-blue-700', bg: 'bg-blue-50' },
         'ANSWER': { icon: <Eye className="h-6 w-6 text-green-700" />, label: 'Answer', color: 'text-green-700', bg: 'bg-green-50' },
         'CONTEXT': { icon: <MessageSquare className="h-6 w-6 text-gray-700" />, label: 'Discussion', color: 'text-gray-700', bg: 'bg-gray-50' },
         'FOLLOW_UP': { icon: <MessageSquare className="h-6 w-6 text-orange-700" />, label: 'Follow-up', color: 'text-orange-700', bg: 'bg-orange-50' },
         'CONFIRMATION': { icon: <Eye className="h-6 w-6 text-purple-700" />, label: 'Greeting', color: 'text-purple-700', bg: 'bg-purple-50' }
       }
       
       return typeInfo[message.messageRole as keyof typeof typeInfo] || 
              { icon: <MessageSquare className="h-6 w-6 text-gray-700" />, label: 'Message', color: 'text-gray-700', bg: 'bg-gray-50' }
     }
     
     return { icon: <MessageSquare className="h-6 w-6 text-gray-700" />, label: 'Message', color: 'text-gray-700', bg: 'bg-gray-50' }
   }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">Error loading messages</div>
        <p className="text-gray-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900">Messages Grouped by {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}</h3>
        <p className="text-sm text-gray-600 mt-1">
          {messages.length} messages in {groupedMessages.length} groups
        </p>
      </div>

      {/* Groups */}
      {groupedMessages.map((group) => (
        <div key={group.key} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                     {/* Group Header */}
           <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
             <div className="flex items-center justify-between">
               <div>
                 <h4 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                   {group.title}
                   {group.documentId && (
                     <Link
                       href={`/documents/${group.documentId}`}
                       className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline"
                     >
                       <FileText className="h-4 w-4 mr-1" />
                       View Document
                     </Link>
                   )}
                 </h4>
                 {group.subtitle && (
                   <p className="text-sm text-gray-600 mt-1">{group.subtitle}</p>
                 )}
               </div>
               <div className="text-right">
                 <div className="flex items-center gap-4">
                   {/* Message type breakdown */}
                   <div className="flex items-center gap-2 text-xs">
                     {(() => {
                       const questionCount = group.messages.filter(m => m.messageRole === 'QUESTION').length
                       const answerCount = group.messages.filter(m => m.messageRole === 'ANSWER').length
                       const followUpCount = group.messages.filter(m => m.messageRole === 'FOLLOW_UP').length
                       const confirmationCount = group.messages.filter(m => m.messageRole === 'CONFIRMATION').length
                       const contextCount = group.messages.filter(m => m.messageRole === 'CONTEXT').length
                       
                       return (
                         <>
                           {questionCount > 0 && (
                             <div className="flex items-center gap-1">
                               <span>{<HelpCircle className="h-4 w-4 text-blue-700" />}</span>
                               <span className="text-blue-700 font-medium">{questionCount}</span>
                             </div>
                           )}
                           {answerCount > 0 && (
                             <div className="flex items-center gap-1">
                               <span>{<Eye className="h-4 w-4 text-green-700" />}</span>
                               <span className="text-green-700 font-medium">{answerCount}</span>
                             </div>
                           )}
                           {followUpCount > 0 && (
                             <div className="flex items-center gap-1">
                               <span>{<MessageSquare className="h-4 w-4 text-orange-700" />}</span>
                               <span className="text-orange-700 font-medium">{followUpCount}</span>
                             </div>
                           )}
                           {confirmationCount > 0 && (
                             <div className="flex items-center gap-1">
                               <span>{<Eye className="h-4 w-4 text-purple-700" />}</span>
                               <span className="text-purple-700 font-medium">{confirmationCount}</span>
                             </div>
                           )}
                           {contextCount > 0 && (
                             <div className="flex items-center gap-1">
                               <span>{<MessageSquare className="h-4 w-4 text-gray-700" />}</span>
                               <span className="text-gray-700 font-medium">{contextCount}</span>
                             </div>
                           )}
                         </>
                       )
                     })()}
                   </div>
                   
                   <div className="text-right">
                     <div className="text-2xl font-bold text-gray-900">{group.count}</div>
                     <div className="text-sm text-gray-500">total</div>
                   </div>
                 </div>
               </div>
             </div>
           </div>

                     {/* Group Messages */}
           <div className="divide-y divide-gray-200">
             {group.messages.slice(0, 10).map((message) => {
               const messageType = getMessageTypeInfo(message)
               
               return (
                 <div key={message.id} className={`px-6 py-4 hover:bg-gray-50 transition-colors ${messageType.bg} border-l-4 ${
                   messageType.color === 'text-blue-700' ? 'border-blue-300' :
                   messageType.color === 'text-green-700' ? 'border-green-300' :
                   messageType.color === 'text-purple-700' ? 'border-purple-300' :
                   'border-gray-300'
                 }`}>
                   <div className="flex items-start gap-4">
                     <div className="flex-shrink-0">
                       <div className="flex items-center gap-2">
                         <span className="text-2xl">{messageType.icon}</span>
                         <div className="text-xs">
                           <div className={`font-medium ${messageType.color}`}>{messageType.label}</div>
                           <div className="text-gray-500">{formatTime(message.timestamp)}</div>
                         </div>
                       </div>
                     </div>
                     
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-2">
                         <div className="flex-shrink-0 h-6 w-6">
                           <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                             <span className="text-xs font-medium text-white">
                               {message.username.charAt(0).toUpperCase()}
                             </span>
                           </div>
                         </div>
                         <span className="font-medium text-gray-900 text-sm">{message.username}</span>
                         {groupBy !== 'channel' && (
                           <>
                             <span className="text-gray-400">•</span>
                             <span className="text-xs text-gray-500">{message.channelName || `#channel-${message.channel.slice(-4)}`}</span>
                           </>
                         )}
                       </div>
                       
                       <div className="text-gray-900 text-sm leading-relaxed">
                         {message.text.length > 300 ? `${message.text.substring(0, 300)}...` : message.text}
                       </div>
                     </div>
                   </div>
                 </div>
               )
             })}
             
             {/* Show more messages indicator */}
             {group.messages.length > 10 && (
               <div className="px-6 py-3 bg-gray-50 text-center border-t">
                 <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                   View all {group.messages.length} messages in this group →
                 </button>
               </div>
             )}
           </div>
        </div>
      ))}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="inline-flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading more messages...
          </div>
        </div>
      )}

      {/* Load More Button */}
      {!loading && hasMore && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <button
            onClick={onLoadMore}
            className="inline-flex items-center px-6 py-3 text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Messages</h3>
          <p className="text-gray-500">No messages match your current filters.</p>
        </div>
      )}
    </div>
  )
} 