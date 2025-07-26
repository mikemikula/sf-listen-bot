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
  onViewSources
}) => {
  const [expanded, setExpanded] = useState(false)
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
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 ${className}`}>
      {/* Header Section */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={getStatusStyle(faq.status)}>
                {faq.status}
              </span>
              
              {showSimilarity && similarityDisplay && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${similarityDisplay.bgColor}`}>
                  <span className="text-xs text-gray-500">Similarity:</span>
                  <span className={`text-xs font-medium ${similarityDisplay.textColor}`}>
                    {similarityDisplay.percentage}%
                  </span>
                </div>
              )}
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 leading-tight">
              {faq.question}
            </h3>
            
            {/* Answer Preview */}
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {expanded ? (
                <div className="whitespace-pre-wrap">{faq.answer}</div>
              ) : (
                <div className="line-clamp-3">{faq.answer}</div>
              )}
              
              {faq.answer.length > 200 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category and Confidence */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">Category:</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {faq.category}
            </span>
          </div>
          
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${confidence.bgColor}`}>
            <span className="text-xs text-gray-500">Confidence:</span>
            <span className={`text-sm font-medium ${confidence.textColor}`}>
              {confidence.percentage}%
            </span>
          </div>
        </div>
      </div>

      {/* Source Information Section */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {faq.sourceDocumentCount}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Documents</div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {faq.sourceMessageCount}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Messages</div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 col-span-2 md:col-span-1">
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
        <div className="px-6 pb-4">
          <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5C4.312 18.333 5.27 20 6.81 20z" />
                </svg>
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Pending Review
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReject}
                  disabled={processing}
                  className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Processing...' : 'Reject'}
                </button>
                
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Processing...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Section */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 rounded-b-lg">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {faq.timeAgo}
            {faq.approvedBy && faq.status === 'APPROVED' && (
              <span className="ml-2">
                approved by <span className="font-medium">{faq.approvedBy}</span>
              </span>
            )}
          </div>
          
          {showActions && (
            <div className="flex items-center gap-2">
              {faq.status !== 'PENDING' && (
                <button
                  onClick={() => onEdit?.(faq.id)}
                  className="text-xs text-gray-600 hover:text-gray-800 p-1 rounded transition-colors duration-200"
                  title="Edit FAQ"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              
              <button
                onClick={() => onDelete?.(faq.id)}
                className="text-xs text-red-600 hover:text-red-800 p-1 rounded transition-colors duration-200"
                title="Delete FAQ"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              
              <button
                onClick={() => navigator.clipboard.writeText(`Q: ${faq.question}\nA: ${faq.answer}`)}
                className="text-xs text-gray-600 hover:text-gray-800 p-1 rounded transition-colors duration-200"
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
  )
}

export default FAQCard 