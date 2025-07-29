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
  FileText,
  ChevronUp,
  ChevronDown
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
  
  // Mobile UI state
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  /**
   * Get count of active filters for mobile UI
   */
  const getActiveFilterCount = (): number => {
    let count = 0
    if (filters.searchTerm) count++
    if (filters.piiType !== 'ALL') count++
    if (filters.showOnlySelected) count++
    return count
  }

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
        setSelectedItems((prev: Set<string>) => {
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
    setSelectedItems((prev: Set<string>) => {
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

  // Keyboard shortcuts for power users
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      const firstPendingItem = filteredItems.find(item => item.status === PIIStatus.PENDING_REVIEW)
      
      if (firstPendingItem && !firstPendingItem.isUpdating) {
        switch (event.key.toLowerCase()) {
          case '1':
          case 'k':
            event.preventDefault()
            updatePIIStatus(firstPendingItem.id, PIIStatus.WHITELISTED)
            break
          case '2':
          case 'r':
            event.preventDefault()
            updatePIIStatus(firstPendingItem.id, PIIStatus.AUTO_REPLACED)
            break
          case '3':
          case 'f':
            event.preventDefault()
            updatePIIStatus(firstPendingItem.id, PIIStatus.FLAGGED)
            break
          case 'x':
            event.preventDefault()
            toggleItemSelection(firstPendingItem.id)
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredItems, updatePIIStatus, toggleItemSelection])

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
    <div className="pii-review-dashboard bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="pii-review__header border-b border-gray-200 dark:border-gray-700 p-6">
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

        {/* Stats Summary */}
        {stats && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between text-sm">
              <div className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">{stats.pendingReview}</span> pending review
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                {stats.totalDetections} total detections
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

      {/* Simplified Filters */}
      {reviewItems.length > 0 && (
        <div className="pii-review__filters border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search PII detections..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center space-x-4">
              <select
                value={filters.piiType}
                onChange={(e) => setFilters(prev => ({ ...prev, piiType: e.target.value as PIIType | 'ALL' }))}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All Types</option>
                <option value="EMAIL">Email</option>
                <option value="PHONE">Phone</option>
                <option value="NAME">Name</option>
                <option value="URL">URL</option>
                <option value="CUSTOM">Custom</option>
              </select>

              {/* Show Selected Toggle */}
              <label className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={filters.showOnlySelected}
                  onChange={(e) => setFilters(prev => ({ ...prev, showOnlySelected: e.target.checked }))}
                  className="mr-2 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                Show only selected
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Simplified Bulk Actions */}
      {selectedItems.size > 0 && (
        <div className="pii-review__bulk-actions border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{selectedItems.size}</span> items selected
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => bulkUpdatePII(PIIStatus.WHITELISTED)}
                disabled={isBulkUpdating}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors text-gray-700 dark:text-gray-300"
              >
                Keep All
              </button>
              <button
                onClick={() => bulkUpdatePII(PIIStatus.AUTO_REPLACED)}
                disabled={isBulkUpdating}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors text-gray-700 dark:text-gray-300"
              >
                Replace All
              </button>
              <button
                onClick={() => bulkUpdatePII(PIIStatus.FLAGGED)}
                disabled={isBulkUpdating}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors text-gray-700 dark:text-gray-300"
              >
                Flag All
              </button>
              <button
                onClick={() => setSelectedItems(new Set())}
                className="px-3 py-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          
          {isBulkUpdating && (
            <div className="mt-3 flex items-center text-sm text-gray-500 dark:text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              <span>Updating selected items...</span>
            </div>
          )}
        </div>
      )}

      {/* Review Items List */}
      <div className="pii-review__list p-6">
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
            
            {/* Development Test Data Button - Mobile Optimized */}
            {process.env.NODE_ENV !== 'production' && reviewItems.length === 0 && (
              <div className="flex flex-col items-center px-4">
                <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-xl p-6 w-full max-w-md">
                  <div className="text-center">
                    <div className="flex justify-center items-center mb-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                      <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">Development Mode</span>
                    </div>
                    <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Try the PII Review System
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-4 leading-relaxed">
                      Generate sample PII detections to explore how the review interface works with different types of sensitive data.
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
                      className="w-full flex items-center justify-center px-6 py-4 bg-blue-600 text-white text-base font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors touch-manipulation shadow-sm"
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin mr-3" />
                          Generating Test Data...
                        </>
                      ) : (
                        <>
                          <span className="mr-2">🧪</span>
                          Generate Test PII Data
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="md:divide-y md:divide-gray-200 md:space-y-0 space-y-4">
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
        <div className="pii-review__pagination border-t border-gray-200 dark:border-gray-700 px-6 py-4">
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
    <div className={`${isSelected ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-white dark:bg-gray-800'} border border-gray-200 dark:border-gray-700 rounded-lg mb-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors`}>
      <div className="p-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelection}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {item.piiType}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {Math.round(item.confidence * 100)}% confidence
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Expand/Collapse Button */}
            <button
              onClick={onToggleExpansion}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {item.isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Essential Information - Always Visible */}
        <div className="mb-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 border-l-3 border-gray-300 dark:border-gray-600">
            <div className="text-sm text-gray-900 dark:text-white font-mono break-all">
              {item.originalText}
            </div>
            {item.replacementText !== item.originalText && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                → {item.replacementText}
              </div>
            )}
          </div>
        </div>

        {/* Quick Action Buttons - Always Visible */}
        <div className="flex space-x-2">
          <button
            onClick={() => handleStatusUpdate(PIIStatus.WHITELISTED)}
            disabled={item.isUpdating}
            className="flex-1 py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors text-gray-700 dark:text-gray-300"
          >
            Keep
          </button>
          <button
            onClick={() => handleStatusUpdate(PIIStatus.AUTO_REPLACED)}
            disabled={item.isUpdating}
            className="flex-1 py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors text-gray-700 dark:text-gray-300"
          >
            Replace
          </button>
          <button
            onClick={() => handleStatusUpdate(PIIStatus.FLAGGED)}
            disabled={item.isUpdating}
            className="flex-1 py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors text-gray-700 dark:text-gray-300"
          >
            Flag
          </button>
        </div>

        {/* Expanded Details - Only When Expanded */}
        {item.isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            {/* Message Context */}
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Message Context
              </div>
              {item.message ? (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    From {item.message.username} in #{item.message.channel}
                  </div>
                  <div className="text-sm text-gray-900 dark:text-white">
                    {item.message.text}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                  Message context not available
                </div>
              )}
            </div>

            {/* Detection Details */}
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Detection Details
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div>Type: {item.piiType}</div>
                <div>Confidence: {Math.round(item.confidence * 100)}%</div>
                <div>Detected: {new Date(item.createdAt).toLocaleString()}</div>
              </div>
            </div>

            {/* Custom Replacement (if expanded) */}
            {item.replacementText !== item.originalText && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Custom Replacement
                </label>
                <input
                  type="text"
                  value={customReplacement}
                  onChange={(e) => setCustomReplacement(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            {/* Review Note */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Review Note (Optional)
              </label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add a note about this decision..."
              />
            </div>
          </div>
        )}

        {/* Loading State */}
        {item.isUpdating && (
          <div className="mt-3 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 py-2">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            <span>Updating...</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default PIIReviewDashboard 