/**
 * DocumentFeed Component
 * Comprehensive document listing with advanced filtering, search, pagination,
 * and bulk actions for efficient document management
 */

import React, { useState, useEffect, useCallback } from 'react'
import { DocumentDisplay, DocumentFilters, PaginatedDocuments } from '@/types'
import DocumentCard from './DocumentCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface DocumentFeedProps {
  className?: string
  initialFilters?: Partial<DocumentFilters>
  onDocumentEdit?: (documentId: string) => void
  onDocumentDelete?: (documentId: string) => void
  onDocumentEnhance?: (documentId: string) => void
  onDocumentGenerateFAQs?: (documentId: string) => void
  onBulkAction?: (action: string, documentIds: string[]) => void
}

/**
 * Advanced document feed with comprehensive filtering and management
 */
export const DocumentFeed: React.FC<DocumentFeedProps> = ({
  className = '',
  initialFilters = {},
  onDocumentEdit,
  onDocumentDelete,
  onDocumentEnhance,
  onDocumentGenerateFAQs,
  onBulkAction
}) => {
  // State management
  const [documents, setDocuments] = useState<DocumentDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })

  // Filter state
  const [filters, setFilters] = useState<DocumentFilters>({
    page: 1,
    limit: 20,
    ...initialFilters
  })

  // Selection state for bulk actions
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || '')
  const [statusFilter, setStatusFilter] = useState(initialFilters.status || '')
  const [categoryFilter, setCategoryFilter] = useState(initialFilters.category || '')

  /**
   * Fetch documents from API
   */
  const fetchDocuments = useCallback(async (currentFilters: DocumentFilters) => {
    try {
      setLoading(true)
      setError(null)

      const queryParams = new URLSearchParams()
      
      // Add all filter parameters
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value.toString())
        }
      })

      const response = await fetch(`/api/documents?${queryParams.toString()}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch documents')
      }

      const data: PaginatedDocuments = result.data
      setDocuments(data.documents || [])
      setPagination(data.pagination)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
      setError(errorMessage)
      console.error('Failed to fetch documents:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Update filters and refetch documents
   */
  const updateFilters = useCallback((newFilters: Partial<DocumentFilters>) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 }
    setFilters(updatedFilters)
    setSelectedDocuments(new Set()) // Clear selections when filters change
    setSelectAll(false)
  }, [filters])

  /**
   * Handle search with debouncing
   */
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchTerm !== filters.search) {
        updateFilters({ search: searchTerm })
      }
    }, 500)

    return () => clearTimeout(debounceTimer)
  }, [searchTerm, filters.search, updateFilters])

  /**
   * Handle pagination
   */
  const handlePageChange = useCallback((newPage: number) => {
    const updatedFilters = { ...filters, page: newPage }
    setFilters(updatedFilters)
  }, [filters])

  /**
   * Handle document selection
   */
  const handleDocumentSelect = useCallback((documentId: string, selected: boolean) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(documentId)
      } else {
        newSet.delete(documentId)
      }
      return newSet
    })
  }, [])

  /**
   * Handle select all toggle
   */
  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedDocuments(new Set())
    } else {
      setSelectedDocuments(new Set(documents.map(doc => doc.id)))
    }
    setSelectAll(!selectAll)
  }, [selectAll, documents])

  /**
   * Handle bulk actions
   */
  const handleBulkAction = useCallback((action: string) => {
    const selectedIds = Array.from(selectedDocuments)
    if (selectedIds.length > 0 && onBulkAction) {
      onBulkAction(action, selectedIds)
      setSelectedDocuments(new Set())
      setSelectAll(false)
    }
  }, [selectedDocuments, onBulkAction])

  // Fetch documents when filters change
  useEffect(() => {
    fetchDocuments(filters)
  }, [filters, fetchDocuments])

  // Update select all state based on selections
  useEffect(() => {
    if (documents.length > 0) {
      const allSelected = documents.every(doc => selectedDocuments.has(doc.id))
      const someSelected = documents.some(doc => selectedDocuments.has(doc.id))
      setSelectAll(allSelected && someSelected)
    }
  }, [selectedDocuments, documents])

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search and Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="min-w-0 md:w-40">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                updateFilters({ status: e.target.value || undefined })
              }}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="COMPLETE">Complete</option>
              <option value="PROCESSING">Processing</option>
              <option value="DRAFT">Draft</option>
              <option value="ERROR">Error</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="min-w-0 md:w-48">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                updateFilters({ category: e.target.value || undefined })
              }}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Categories</option>
              <option value="Support">Support</option>
              <option value="Technical">Technical</option>
              <option value="General">General</option>
              <option value="Documentation">Documentation</option>
            </select>
          </div>

          {/* Clear Filters */}
          <button
            onClick={() => {
              setSearchTerm('')
              setStatusFilter('')
              setCategoryFilter('')
              updateFilters({ search: undefined, status: undefined, category: undefined })
            }}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedDocuments.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-200">
                {selectedDocuments.size} document{selectedDocuments.size !== 1 ? 's' : ''} selected
              </span>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkAction('enhance')}
                  className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded transition-colors duration-200"
                >
                  Bulk Enhance
                </button>
                
                <button
                  onClick={() => handleBulkAction('generate-faqs')}
                  className="text-sm bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded transition-colors duration-200"
                >
                  Generate FAQs
                </button>
                
                <button
                  onClick={() => handleBulkAction('delete')}
                  className="text-sm bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded transition-colors duration-200"
                >
                  Delete Selected
                </button>
              </div>
            </div>
            
            <button
              onClick={() => {
                setSelectedDocuments(new Set())
                setSelectAll(false)
              }}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Documents
          </h2>
          
          {!loading && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {pagination.total} total results
            </span>
          )}
        </div>

        {documents.length > 0 && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={handleSelectAll}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label className="text-sm text-gray-600 dark:text-gray-400">
              Select all
            </label>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-red-800 dark:text-red-200">Error</span>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
          <button
            onClick={() => fetchDocuments(filters)}
            className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 mt-2 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && documents.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No documents found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by creating a document from your Slack messages.
          </p>
        </div>
      )}

      {/* Document Grid - Mobile Optimized */}
      {!loading && !error && documents.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          {documents.map((document) => (
            <div key={document.id} className="flex items-start gap-3 sm:gap-4">
              {/* Selection checkbox - Mobile optimized */}
              <div className="flex-shrink-0 pt-4 sm:pt-6">
                <input
                  type="checkbox"
                  checked={selectedDocuments.has(document.id)}
                  onChange={(e) => handleDocumentSelect(document.id, e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 touch-manipulation"
                />
              </div>
              
              {/* Document Card */}
              <div className="flex-1 min-w-0">
                <DocumentCard
                  document={document}
                  onEdit={onDocumentEdit}
                  onDelete={onDocumentDelete}
                  onEnhance={onDocumentEnhance}
                  onGenerateFAQs={onDocumentGenerateFAQs}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination - Mobile Optimized */}
      {!loading && !error && pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-gray-200 dark:border-gray-700 pt-4 sm:pt-6 mt-6 sm:mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-center sm:text-left">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              ({pagination.total} total documents)
            </span>
          </div>
          
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.hasPrev}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 touch-manipulation"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Previous</span>
            </button>
            
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasNext}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 touch-manipulation"
            >
              <span className="hidden sm:inline">Next</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentFeed 