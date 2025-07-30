/**
 * DocumentCard Component
 * Displays document information in a card format with comprehensive metadata,
 * status indicators, and action buttons for document management
 */

import React from 'react'
import Link from 'next/link'
import { DocumentDisplay } from '@/types'

interface DocumentCardProps {
  document: DocumentDisplay
  className?: string
  showActions?: boolean
  onEdit?: (documentId: string) => void
  onDelete?: (documentId: string) => void
  onEnhance?: (documentId: string) => void
  onGenerateFAQs?: (documentId: string) => void
}

/**
 * Modern document card with comprehensive metadata display
 */
export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  className = '',
  showActions = true,
  onEdit,
  onDelete,
  onEnhance,
  onGenerateFAQs
}) => {
  /**
   * Get status badge styling based on document status
   */
  const getStatusStyle = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium'
    
    switch (status) {
      case 'COMPLETE':
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`
      case 'PROCESSING':
        return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 animate-pulse`
      case 'DRAFT':
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`
      case 'ERROR':
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`
    }
  }

  /**
   * Get confidence score styling and text
   */
  const getConfidenceDisplay = (score: number) => {
    const percentage = Math.round(score * 100)
    let textColor = 'text-gray-600'
    let bgColor = 'bg-gray-100'
    
    if (percentage >= 90) {
      textColor = 'text-green-600'
      bgColor = 'bg-green-50'
    } else if (percentage >= 70) {
      textColor = 'text-blue-600'
      bgColor = 'bg-blue-50'
    } else if (percentage >= 50) {
      textColor = 'text-yellow-600'
      bgColor = 'bg-yellow-50'
    } else {
      textColor = 'text-red-600'
      bgColor = 'bg-red-50'
    }

    return { percentage, textColor, bgColor }
  }

  /**
   * Format participant list for display
   */
  const formatParticipants = (participants: string[], max: number = 3) => {
    if (participants.length <= max) {
      return participants.join(', ')
    }
    
    const shown = participants.slice(0, max)
    const remaining = participants.length - max
    return `${shown.join(', ')} +${remaining} more`
  }

  const confidence = getConfidenceDisplay(document.confidenceScore)

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 ${className}`}>
      {/* Header Section - Mobile Optimized */}
      <div className="p-4 sm:p-6 pb-3 sm:pb-4">
        {/* Title and Status - Stack on Mobile */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <Link 
              href={`/documents/${document.id}`}
              className="text-base sm:text-lg font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200 block leading-tight"
            >
              {document.title}
            </Link>
            
            {document.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-3 sm:line-clamp-2">
                {document.description}
              </p>
            )}
          </div>
          
          {/* Status Badge - Top Right on Desktop, Below Title on Mobile */}
          <div className="flex-shrink-0">
            <span className={getStatusStyle(document.status)}>
              {document.status}
            </span>
          </div>
        </div>

        {/* Category and Confidence - Stack on Mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Category:</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {document.category}
            </span>
          </div>
          
          <div className={`flex items-center gap-2 px-2 py-1 rounded-full ${confidence.bgColor} w-fit`}>
            <span className="text-xs text-gray-500">Confidence:</span>
            <span className={`text-sm font-medium ${confidence.textColor}`}>
              {confidence.percentage}%
            </span>
          </div>
        </div>
      </div>

      {/* Statistics Section - Mobile Optimized Grid */}
      <div className="px-4 sm:px-6 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
            <div className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              {document.messageCount}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Messages</div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
            <div className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              {document.faqCount}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">FAQs</div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
            <div className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              {document.participantCount}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">People</div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
            <div className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              {document.channelNames.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Channels</div>
          </div>
        </div>
      </div>

      {/* Participants Section - Improved Mobile Layout */}
      {document.participants && document.participants.length > 0 && (
        <div className="px-4 sm:px-6 pb-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Participants:</div>
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {formatParticipants(document.participants)}
          </div>
        </div>
      )}

      {/* Channels Section - Mobile Friendly */}
      {document.channelNames && document.channelNames.length > 0 && (
        <div className="px-4 sm:px-6 pb-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Channels:</div>
          <div className="flex flex-wrap gap-1">
            {document.channelNames.slice(0, 3).map((channel: string) => (
              <span 
                key={channel}
                className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full"
              >
                #{channel}
              </span>
            ))}
            {document.channelNames.length > 3 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                +{document.channelNames.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer Section - Mobile-First Action Layout */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 dark:bg-gray-700 rounded-b-lg">
        {/* Timestamp and Author */}
        <div className="flex items-center justify-between mb-3 sm:mb-0">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {document.timeAgo}
            {document.createdBy && (
              <span className="block sm:inline sm:ml-2 mt-1 sm:mt-0">
                by <span className="font-medium">{document.createdBy}</span>
              </span>
            )}
          </div>
        </div>
        
        {/* Actions - Mobile Stacked, Desktop Row */}
        {showActions && (
          <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-end sm:gap-2">
            {/* Primary Action - Full Width on Mobile */}
            <Link 
              href={`/documents/${document.id}`}
              className="flex items-center justify-center gap-2 w-full sm:w-auto text-sm bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white px-4 py-2.5 sm:py-2 rounded-lg font-medium transition-all duration-200 touch-manipulation"
              title="View full document details"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Document
            </Link>
            
            {/* Secondary Actions - Responsive Grid */}
            <div className="grid grid-cols-2 sm:flex gap-2">
              <button
                onClick={() => onEnhance?.(document.id)}
                className="flex items-center justify-center gap-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2.5 sm:py-2 rounded-lg transition-colors duration-200 font-medium touch-manipulation"
                title="Add more messages to this document"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="hidden sm:inline">Enhance</span>
                <span className="sm:hidden">Add</span>
              </button>
              
              <button
                onClick={() => onGenerateFAQs?.(document.id)}
                className="flex items-center justify-center gap-1 text-sm bg-green-100 hover:bg-green-200 text-green-700 px-3 py-2.5 sm:py-2 rounded-lg transition-colors duration-200 font-medium touch-manipulation"
                title="Generate FAQs from this document"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden sm:inline">FAQs</span>
                <span className="sm:hidden">FAQ</span>
              </button>
            </div>
            
            {/* More Actions - Compact for Mobile */}
            <div className="flex items-center justify-center gap-2 sm:gap-1">
              <button
                onClick={() => onEdit?.(document.id)}
                className="flex items-center justify-center text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 p-2.5 sm:p-2 rounded-lg transition-colors duration-200 touch-manipulation"
                title="Edit document"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              
              <button
                onClick={() => onDelete?.(document.id)}
                className="flex items-center justify-center text-sm text-red-600 hover:text-red-800 hover:bg-red-100 p-2.5 sm:p-2 rounded-lg transition-colors duration-200 touch-manipulation"
                title="Delete document"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DocumentCard 