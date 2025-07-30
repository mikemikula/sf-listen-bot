/**
 * FAQCard Component
 * Displays FAQ information with comprehensive metadata, approval workflows,
 * source traceability, and similarity indicators for FAQ management
 */

import React, { useState } from 'react'
import Link from 'next/link'
import { FAQDisplay } from '@/types'

interface FAQCardProps {
  faq: FAQDisplay
  className?: string
  showActions?: boolean
  showSimilarity?: boolean
  similarity?: number
  onApprove?: (faqId: string) => void
  onReject?: (faqId: string) => void
  onEdit?: (faqId: string) => void
  onDelete?: (faqId: string) => void
  onViewSources?: (faqId: string) => void
  showBulkSelect?: boolean
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
}

/**
 * Modern FAQ card with comprehensive metadata and workflow management
 */
export const FAQCard: React.FC<FAQCardProps> = ({
  faq,
  className = '',
  showActions = true,
  showSimilarity = false,
  similarity,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  onViewSources,
  showBulkSelect = false,
  isSelected = false,
  onSelect
}) => {
  const [cardExpanded, setCardExpanded] = useState(false)
  const [answerExpanded, setAnswerExpanded] = useState(false)
  const [processing, setProcessing] = useState(false)

  /**
   * Get status badge styling based on FAQ status
   */
  const getStatusStyle = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium'
    
    switch (status) {
      case 'APPROVED':
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`
      case 'PENDING':
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 animate-pulse`
      case 'REJECTED':
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`
      case 'ARCHIVED':
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`
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
   * Get similarity score styling for search results
   */
  const getSimilarityDisplay = (score: number) => {
    const percentage = Math.round(score * 100)
    let textColor = 'text-gray-600'
    let bgColor = 'bg-gray-100'
    
    if (percentage >= 95) {
      textColor = 'text-red-600'
      bgColor = 'bg-red-50'
    } else if (percentage >= 85) {
      textColor = 'text-orange-600'
      bgColor = 'bg-orange-50'
    } else if (percentage >= 70) {
      textColor = 'text-blue-600'
      bgColor = 'bg-blue-50'
    } else {
      textColor = 'text-gray-600'
      bgColor = 'bg-gray-50'
    }

    return { percentage, textColor, bgColor }
  }

  /**
   * Handle approval action
   */
  const handleApprove = async () => {
    if (!onApprove) return
    
    setProcessing(true)
    try {
      await onApprove(faq.id)
    } finally {
      setProcessing(false)
    }
  }

  /**
   * Handle rejection action
   */
  const handleReject = async () => {
    if (!onReject) return
    
    setProcessing(true)
    try {
      await onReject(faq.id)
    } finally {
      setProcessing(false)
    }
  }

  const confidence = getConfidenceDisplay(faq.confidenceScore)
  const similarityDisplay = similarity ? getSimilarityDisplay(similarity) : null

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 ${className}`}>
      {/* Compact Header - Always Visible */}
      <div className="p-4 pb-5">
        <div className="flex items-start justify-between gap-3">
          {/* Bulk Selection Checkbox */}
          {showBulkSelect && (
            <div className="flex-shrink-0 pt-1">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onSelect?.(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className={getStatusStyle(faq.status)}>
                {faq.status}
              </span>
              
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                {faq.category}
              </span>
              
              {showSimilarity && similarityDisplay && (
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${similarityDisplay.bgColor}`}>
                  <span className="text-xs text-gray-500">Similarity:</span>
                  <span className={`text-xs font-medium ${similarityDisplay.textColor}`}>
                    {similarityDisplay.percentage}%
                  </span>
                </div>
              )}
              
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${confidence.bgColor}`}>
                <span className="text-xs text-gray-500">Confidence:</span>
                <span className={`text-xs font-medium ${confidence.textColor}`}>
                  {confidence.percentage}%
                </span>
              </div>
            </div>
            
            <div 
              className="cursor-pointer"
              onClick={() => setCardExpanded(!cardExpanded)}
            >
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white leading-tight hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-2">
                {faq.question}
              </h3>
              
              {!cardExpanded && (
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">
                  {faq.answer}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setCardExpanded(!cardExpanded)
              }}
              className="flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title={cardExpanded ? 'Collapse' : 'Expand'}
            >
              <svg 
                className={`w-4 h-4 transform transition-transform duration-200 ${cardExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {cardExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-4">
          {/* Full Answer */}
          <div className="mb-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {answerExpanded ? (
                <div className="whitespace-pre-wrap">{faq.answer}</div>
              ) : (
                <div className="line-clamp-3">{faq.answer}</div>
              )}
              
              {faq.answer.length > 200 && (
                <button
                  onClick={() => setAnswerExpanded(!answerExpanded)}
                  className="mt-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                >
                  {answerExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          </div>

          {/* Source Information Section */}
          <div className="mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 text-center">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2.5 sm:p-3">
            <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              {faq.sourceDocumentCount}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Documents</div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2.5 sm:p-3">
            <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              {faq.sourceMessageCount}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Messages</div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2.5 sm:p-3 col-span-2 sm:col-span-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {faq.primarySourceDocument ? (
                <Link 
                  href={`/documents/${faq.primarySourceDocument.id}`}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {faq.primarySourceDocument.title}
                </Link>
              ) : (
                <span className="text-gray-500">Manual FAQ</span>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Primary Source</div>
          </div>
        </div>
        
          {/* View Sources Button */}
          {(faq.sourceDocumentCount > 0 || faq.sourceMessageCount > 0) && (
            <div className="mt-3 text-center">
              <button
                onClick={() => onViewSources?.(faq.id)}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                View all sources →
              </button>
            </div>
          )}
          </div>

          {/* Approval Section for Pending FAQs */}
          {faq.status === 'PENDING' && showActions && (onApprove || onReject) && (
            <div className="mb-4">
              <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5C4.312 18.333 5.27 20 6.81 20z" />
                    </svg>
                    <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Pending Review
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleReject}
                      disabled={processing}
                      className="flex-1 sm:flex-none px-4 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing ? 'Processing...' : 'Reject'}
                    </button>
                    
                    <button
                      onClick={handleApprove}
                      disabled={processing}
                      className="flex-1 sm:flex-none px-4 py-2 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing ? 'Processing...' : 'Approve'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {faq.timeAgo}
                {faq.approvedBy && faq.status === 'APPROVED' && (
                  <span className="block sm:inline sm:ml-2">
                    approved by <span className="font-medium">{faq.approvedBy}</span>
                  </span>
                )}
              </div>
              
              {showActions && (
                <div className="flex items-center justify-center sm:justify-end gap-3">
                  {faq.status !== 'PENDING' && (
                    <button
                      onClick={() => onEdit?.(faq.id)}
                      className="flex items-center justify-center p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
                      title="Edit FAQ"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                  
                  <button
                    onClick={() => onDelete?.(faq.id)}
                    className="flex items-center justify-center p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors duration-200"
                    title="Delete FAQ"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={() => navigator.clipboard.writeText(`Q: ${faq.question}\nA: ${faq.answer}`)}
                    className="flex items-center justify-center p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
                    title="Copy FAQ"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions for Pending FAQs - Always Visible (when collapsed) */}
      {!cardExpanded && faq.status === 'PENDING' && showActions && (onApprove || onReject) && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 pt-3">
            <button
              onClick={handleReject}
              disabled={processing}
              className="flex-1 px-3 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Reject'}
            </button>
            
            <button
              onClick={handleApprove}
              disabled={processing}
              className="flex-1 px-3 py-2 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Approve'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default FAQCard 