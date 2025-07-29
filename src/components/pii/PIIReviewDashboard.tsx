/**
 * PII Review Dashboard Component
 * Allows users to review and override PII detections
 * Implements modern UI/UX with batch operations and context display
 */

import React, { useState, useEffect, useCallback } from 'react'
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Eye, 
  EyeOff,
  Trash2,
  Filter,
  Search,
  RefreshCw,
  Clock,
  User,
  Mail,
  Phone,
  Link,
  FileText
} from 'lucide-react'
import { PIIDetection, PIIStatus, PIIType } from '@/types'
import { logger } from '@/lib/logger'

/**
 * Props for PIIReviewDashboard component
 */
interface PIIReviewDashboardProps {
  /** Current user performing reviews */
  currentUser: string
  /** Refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number
  /** Maximum items per page (default: 20) */
  pageSize?: number
}

/**
 * PII review item with UI state
 */
interface PIIReviewItem extends PIIDetection {
  isSelected: boolean
  isExpanded: boolean
  isUpdating: boolean
}

/**
 * Review stats for dashboard display
 */
interface ReviewStats {
  totalDetections: number
  pendingReview: number
  autoReplaced: number
  whitelisted: number
  flagged: number
  byType: Record<PIIType, number>
}

/**
 * Filter state for PII reviews
 */
interface FilterState {
  searchTerm: string
  piiType: PIIType | 'ALL'
  confidenceRange: [number, number]
  showOnlySelected: boolean
}

/**
 * PII Review Dashboard Component
 */
const PIIReviewDashboard: React.FC<PIIReviewDashboardProps> = ({
  currentUser,
  refreshInterval = 30000,
  pageSize = 20
}) => {
  // State management
  const [reviewItems, setReviewItems] = useState<PIIReviewItem[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    piiType: 'ALL',
    confidenceRange: [0, 1],
    showOnlySelected: false
  })

  /**
   * Fetch pending PII reviews from API
   */
  const fetchPendingReviews = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (currentPage * pageSize).toString()
      })

      const response = await fetch(`/api/pii/review?${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch reviews: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Convert to review items with UI state
      const items: PIIReviewItem[] = data.detections.map((detection: PIIDetection) => ({
        ...detection,
        isSelected: false,
        isExpanded: false,
        isUpdating: false
      }))

      setReviewItems(items)
      setTotalItems(data.total)
      setStats(data.stats)
      
      logger.info(`Loaded ${items.length} PII review items`)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      logger.error('Failed to fetch PII reviews:', err)
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, pageSize])

  /**
   * Update single PII detection status
   */
  const updatePIIStatus = async (
    detectionId: string, 
    status: PIIStatus,
    customReplacement?: string,
    reviewNote?: string
  ): Promise<void> => {
    try {
      // Update UI state
      setReviewItems(prev => prev.map(item => 
        item.id === detectionId 
          ? { ...item, isUpdating: true }
          : item
      ))

      const response = await fetch('/api/pii/review', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          detectionId,
          status,
          reviewedBy: currentUser,
          customReplacement,
          reviewNote
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to update PII status: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (result.success) {
        // Remove item from list if status changed from PENDING_REVIEW
        setReviewItems(prev => prev.filter(item => item.id !== detectionId))
        setSelectedItems(prev => {
          const newSet = new Set(prev)
          newSet.delete(detectionId)
          return newSet
        })
        
        logger.info(`PII detection ${detectionId} updated to ${status}`)
        
        // Refresh stats
        await fetchPendingReviews()
      } else {
        throw new Error(result.message || 'Update failed')
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      logger.error(`Failed to update PII detection ${detectionId}:`, err)
      
      // Reset updating state
      setReviewItems(prev => prev.map(item => 
        item.id === detectionId 
          ? { ...item, isUpdating: false }
          : item
      ))
    }
  }

  /**
   * Bulk update selected PII detections
   */
  const bulkUpdatePII = async (status: PIIStatus): Promise<void> => {
    if (selectedItems.size === 0) return

    try {
      setIsBulkUpdating(true)
      setError(null)

      const updates = Array.from(selectedItems).map(detectionId => ({
        detectionId,
        status
      }))

      const response = await fetch('/api/pii/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          updates,
          reviewedBy: currentUser,
          reviewNote: `Bulk ${status.toLowerCase()} operation`
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to bulk update PII: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (result.success) {
        // Remove updated items from list
        setReviewItems(prev => 
          prev.filter(item => !selectedItems.has(item.id))
        )
        setSelectedItems(new Set())
        
        logger.info(`Bulk updated ${updates.length} PII detections to ${status}`)
        
        // Refresh data
        await fetchPendingReviews()
      } else {
        throw new Error(result.message || 'Bulk update failed')
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      logger.error('Failed to bulk update PII detections:', err)
    } finally {
      setIsBulkUpdating(false)
    }
  }

  /**
   * Toggle item selection
   */
  const toggleItemSelection = (detectionId: string): void => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(detectionId)) {
        newSet.delete(detectionId)
      } else {
        newSet.add(detectionId)
      }
      return newSet
    })
  }

  /**
   * Toggle item expansion
   */
  const toggleItemExpansion = (detectionId: string): void => {
    setReviewItems(prev => prev.map(item =>
      item.id === detectionId
        ? { ...item, isExpanded: !item.isExpanded }
        : item
    ))
  }

  /**
   * Get icon for PII type
   */
  const getPIITypeIcon = (type: string): React.ReactNode => {
    switch (type) {
      case PIIType.EMAIL:
        return <Mail className="w-4 h-4" />
      case PIIType.PHONE:
        return <Phone className="w-4 h-4" />
      case PIIType.URL:
        return <Link className="w-4 h-4" />
      case PIIType.NAME:
        return <User className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  /**
   * Get status color class
   */
  const getStatusColorClass = (status: string): string => {
    switch (status) {
      case PIIStatus.WHITELISTED:
        return 'text-green-600 dark:text-green-200 bg-green-50 dark:bg-green-800'
      case PIIStatus.FLAGGED:
        return 'text-red-600 dark:text-red-200 bg-red-50 dark:bg-red-800'
      case PIIStatus.AUTO_REPLACED:
        return 'text-blue-600 dark:text-blue-200 bg-blue-50 dark:bg-blue-800'
      case PIIStatus.PENDING_REVIEW:
      default:
        return 'text-yellow-600 dark:text-yellow-200 bg-yellow-50 dark:bg-yellow-800'
    }
  }

  /**
   * Filter items based on current filters
   */
  const filteredItems = reviewItems.filter(item => {
    // Search term filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase()
      if (!item.originalText.toLowerCase().includes(searchLower) && 
          !item.replacementText.toLowerCase().includes(searchLower)) {
        return false
      }
    }

    // PII type filter
    if (filters.piiType !== 'ALL' && item.piiType !== filters.piiType) {
      return false
    }

    // Confidence range filter
    if (item.confidence < filters.confidenceRange[0] || 
        item.confidence > filters.confidenceRange[1]) {
      return false
    }

    // Show only selected filter
    if (filters.showOnlySelected && !selectedItems.has(item.id)) {
      return false
    }

    return true
  })

  // Effects
  useEffect(() => {
    fetchPendingReviews()
  }, [fetchPendingReviews])

  useEffect(() => {
    const interval = setInterval(fetchPendingReviews, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchPendingReviews, refreshInterval])

  // Render loading state
  if (isLoading && reviewItems.length === 0) {
    return (
      <div className="pii-review__loading">
        <div className="flex items-center justify-center p-8 text-gray-900 dark:text-white">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Loading PII reviews...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="pii-review-dashboard">
      {/* Header */}
      <div className="pii-review__header bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <Shield className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" />
              PII Review Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {stats && stats.totalDetections > 0 && stats.pendingReview === 0
                ? `${stats.totalDetections} detections found, all have been reviewed`
                : 'Review and manage potentially sensitive information detections'}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={fetchPendingReviews}
              disabled={isLoading}
              className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Pending Review</p>
                  <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{stats.pendingReview}</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">Whitelisted</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.whitelisted}</p>
                </div>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900 p-4 rounded-lg">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">Flagged</p>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">{stats.flagged}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
              <div className="flex items-center">
                <EyeOff className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Auto Replaced</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.autoReplaced}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center">
                <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Total Detections</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalDetections}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 p-4 mx-6 mt-4 rounded-md">
          <div className="flex">
            <XCircle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto flex-shrink-0 text-red-400 hover:text-red-600 dark:hover:text-red-300"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Filters - Only show when there are items to filter */}
      {reviewItems.length > 0 && (
        <div className="pii-review__filters bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search PII detections..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
            </div>

            {/* PII Type Filter */}
            <select
              value={filters.piiType}
              onChange={(e) => setFilters(prev => ({ ...prev, piiType: e.target.value as PIIType | 'ALL' }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="ALL">All Types</option>
              <option value={PIIType.EMAIL}>Email</option>
              <option value={PIIType.PHONE}>Phone</option>
              <option value={PIIType.URL}>URL</option>
              <option value={PIIType.NAME}>Name</option>
              <option value={PIIType.CUSTOM}>Custom</option>
            </select>

            {/* Show Only Selected */}
            <label className="flex items-center text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={filters.showOnlySelected}
                onChange={(e) => setFilters(prev => ({ ...prev, showOnlySelected: e.target.checked }))}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
              />
              Show only selected
            </label>
          </div>
        </div>
      )}

      {/* Bulk Actions - Only show when there are items and selections */}
      {reviewItems.length > 0 && selectedItems.size > 0 && (
        <div className="pii-review__bulk-actions bg-blue-50 dark:bg-blue-900 border-b border-blue-200 dark:border-blue-700 p-4">
          <div className="flex items-center justify-between">
            <span className="text-blue-800 dark:text-blue-200 font-medium">
              {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => bulkUpdatePII(PIIStatus.WHITELISTED)}
                disabled={isBulkUpdating}
                className="flex items-center px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Whitelist
              </button>
              <button
                onClick={() => bulkUpdatePII(PIIStatus.FLAGGED)}
                disabled={isBulkUpdating}
                className="flex items-center px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <AlertTriangle className="w-4 h-4 mr-1" />
                Flag as Sensitive
              </button>
              <button
                onClick={() => setSelectedItems(new Set())}
                className="flex items-center px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Items List */}
      <div className="pii-review__list">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {reviewItems.length === 0 ? 'No PII detections found' : 'No items match filters'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {filters.searchTerm || filters.piiType !== 'ALL' || filters.showOnlySelected
                ? 'Try adjusting your filters to see more results.'
                : reviewItems.length === 0 
                  ? 'PII detections will appear here when the system identifies potentially sensitive information in your messages.'
                  : 'All PII detections have been reviewed.'}
            </p>
            
            {/* Development Test Data Button */}
            {process.env.NODE_ENV !== 'production' && reviewItems.length === 0 && (
              <div className="flex flex-col items-center space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4 max-w-md">
                  <div className="flex items-center mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Development Mode</span>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                    Want to see how the PII review interface works? Generate some sample data for testing.
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        setIsLoading(true)
                        const response = await fetch('/api/pii/test-data', { method: 'POST' })
                        if (response.ok) {
                          await fetchPendingReviews()
                        } else {
                          throw new Error('Failed to create test data')
                        }
                      } catch (err) {
                        setError('Failed to create test data. Please try again.')
                      } finally {
                        setIsLoading(false)
                      }
                    }}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        Generating...
                      </>
                    ) : (
                      'Generate Test PII Data'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredItems.map((item) => (
              <PIIReviewItem
                key={item.id}
                item={item}
                isSelected={selectedItems.has(item.id)}
                onToggleSelection={() => toggleItemSelection(item.id)}
                onToggleExpansion={() => toggleItemExpansion(item.id)}
                onUpdateStatus={updatePIIStatus}
                getPIITypeIcon={getPIITypeIcon}
                getStatusColorClass={getStatusColorClass}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalItems > pageSize && (
        <div className="pii-review__pagination bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalItems)} of {totalItems} results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                Page {currentPage + 1} of {Math.ceil(totalItems / pageSize)}
              </span>
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={(currentPage + 1) * pageSize >= totalItems}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Individual PII Review Item Component
 */
interface PIIReviewItemProps {
  item: PIIReviewItem
  isSelected: boolean
  onToggleSelection: () => void
  onToggleExpansion: () => void
  onUpdateStatus: (id: string, status: PIIStatus, customReplacement?: string, reviewNote?: string) => Promise<void>
  getPIITypeIcon: (type: string) => React.ReactNode
  getStatusColorClass: (status: string) => string
}

const PIIReviewItem: React.FC<PIIReviewItemProps> = ({
  item,
  isSelected,
  onToggleSelection,
  onToggleExpansion,
  onUpdateStatus,
  getPIITypeIcon,
  getStatusColorClass
}) => {
  const [customReplacement, setCustomReplacement] = useState(item.replacementText)
  const [reviewNote, setReviewNote] = useState('')

  const handleStatusUpdate = async (status: PIIStatus): Promise<void> => {
    await onUpdateStatus(
      item.id, 
      status, 
      customReplacement !== item.replacementText ? customReplacement : undefined,
      reviewNote || undefined
    )
  }

  return (
    <div className={`pii-review-item ${isSelected ? 'bg-blue-50 dark:bg-blue-900' : 'bg-white dark:bg-gray-800'}`}>
      <div className="p-6">
        <div className="flex items-start space-x-4">
          {/* Selection Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelection}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* PII Type Icon */}
                <div className="flex items-center space-x-2">
                  {getPIITypeIcon(item.piiType)}
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.piiType}
                  </span>
                </div>

                {/* Confidence Score */}
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  item.confidence > 0.8 ? 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200' :
                  item.confidence > 0.6 ? 'bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200' :
                  'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200'
                }`}>
                  {Math.round(item.confidence * 100)}% confident
                </div>

                {/* Status */}
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColorClass(item.status)}`}>
                  {item.status.replace('_', ' ')}
                </div>
              </div>

              <button
                onClick={onToggleExpansion}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {item.isExpanded ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Original Text Display */}
            <div className="mt-3">
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md">
                <div className="text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Detected: </span>
                  <span className="bg-yellow-200 dark:bg-yellow-600 px-1 rounded font-mono text-gray-900 dark:text-white">
                    {item.originalText}
                  </span>
                </div>
                <div className="text-sm mt-1">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Would replace with: </span>
                  <span className="text-gray-600 dark:text-gray-400 font-mono">
                    {item.replacementText}
                  </span>
                </div>
              </div>
            </div>

            {/* Message Context (if available) */}
            {item.message && (
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                <div className="font-medium">Context:</div>
                <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded mt-1 text-xs font-mono text-gray-900 dark:text-white">
                  {item.message.text.substring(0, 200)}
                  {item.message.text.length > 200 && '...'}
                </div>
                <div className="text-xs mt-1">
                  From: <span className="font-medium">{item.message.username}</span> in{' '}
                  <span className="font-medium">#{item.message.channel}</span>
                </div>
              </div>
            )}

            {/* Expanded Details */}
            {item.isExpanded && (
              <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Custom Replacement */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Custom Replacement
                    </label>
                    <input
                      type="text"
                      value={customReplacement}
                      onChange={(e) => setCustomReplacement(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="Enter custom replacement text"
                    />
                  </div>

                  {/* Review Note */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Review Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="Add a note about this decision"
                    />
                  </div>
                </div>

                {/* Metadata */}
                <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <div>Detection ID: {item.id}</div>
                  <div>Created: {new Date(item.createdAt).toLocaleString()}</div>
                  {item.reviewedBy && (
                    <div>
                      Reviewed by: {item.reviewedBy} on{' '}
                      {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : 'Unknown'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex items-center space-x-2">
              <button
                onClick={() => handleStatusUpdate(PIIStatus.WHITELISTED)}
                disabled={item.isUpdating}
                className="flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Not Sensitive
              </button>
              
              <button
                onClick={() => handleStatusUpdate(PIIStatus.FLAGGED)}
                disabled={item.isUpdating}
                className="flex items-center px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <AlertTriangle className="w-4 h-4 mr-1" />
                Flag as PII
              </button>

              <button
                onClick={() => handleStatusUpdate(PIIStatus.AUTO_REPLACED)}
                disabled={item.isUpdating}
                className="flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <EyeOff className="w-4 h-4 mr-1" />
                Auto Replace
              </button>

              {item.isUpdating && (
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                  Updating...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PIIReviewDashboard 