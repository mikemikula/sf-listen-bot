/**
 * FilterBar Component
 * Provides search and filtering controls for messages
 */

import React, { useState, useCallback, useEffect } from 'react'
import type { FilterBarProps, MessageFilters } from '@/types'

/**
 * FilterBar component for message filtering and search
 */
export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
  channels,
  loading = false
}) => {
  // Local state for debounced search
  const [searchValue, setSearchValue] = useState(filters.search || '')

  /**
   * Debounced search handler
   */
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchValue !== filters.search) {
        onFiltersChange({ ...filters, search: searchValue, page: 1 })
      }
    }, 300)

    return () => clearTimeout(delayedSearch)
  }, [searchValue, filters, onFiltersChange])

  /**
   * Handle filter changes
   */
  const handleFilterChange = useCallback((
    key: keyof MessageFilters, 
    value: string | number
  ): void => {
    onFiltersChange({
      ...filters,
      [key]: value,
      page: 1 // Reset page when filters change
    })
  }, [filters, onFiltersChange])

  /**
   * Clear all filters
   */
  const clearFilters = useCallback((): void => {
    setSearchValue('')
    onFiltersChange({
      channel: '',
      search: '',
      userId: '',
      startDate: '',
      endDate: '',
      page: 1,
      limit: filters.limit || 50
    })
  }, [filters.limit, onFiltersChange])

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = Boolean(
    filters.channel || 
    filters.search || 
    filters.userId || 
    filters.startDate || 
    filters.endDate
  )

  return (
    <div className="filter-bar bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search Input */}
        <div className="filter-bar__search flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg 
                className="h-5 w-5 text-gray-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search messages..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              disabled={loading}
              className="
                w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md 
                focus:ring-2 focus:ring-slack-blue focus:border-slack-blue
                disabled:opacity-50 disabled:cursor-not-allowed
                text-sm
              "
            />
          </div>
        </div>

        {/* Channel Filter */}
        <div className="filter-bar__channel">
          <select
            value={filters.channel || ''}
            onChange={(e) => handleFilterChange('channel', e.target.value)}
            disabled={loading}
            className="
              w-full lg:w-48 px-3 py-2 border border-gray-300 rounded-md
              focus:ring-2 focus:ring-slack-blue focus:border-slack-blue
              disabled:opacity-50 disabled:cursor-not-allowed
              text-sm bg-white
            "
          >
            <option value="">All Channels</option>
            {channels.map(channel => (
              <option key={channel} value={channel}>
                {channel.startsWith('C') ? `#${channel.slice(1, 8)}` : channel}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Filters */}
        <div className="filter-bar__dates flex gap-2">
          <input
            type="date"
            placeholder="Start Date"
            value={filters.startDate || ''}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            disabled={loading}
            className="
              w-full lg:w-40 px-3 py-2 border border-gray-300 rounded-md
              focus:ring-2 focus:ring-slack-blue focus:border-slack-blue
              disabled:opacity-50 disabled:cursor-not-allowed
              text-sm
            "
          />
          <input
            type="date"
            placeholder="End Date"
            value={filters.endDate || ''}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            disabled={loading}
            className="
              w-full lg:w-40 px-3 py-2 border border-gray-300 rounded-md
              focus:ring-2 focus:ring-slack-blue focus:border-slack-blue
              disabled:opacity-50 disabled:cursor-not-allowed
              text-sm
            "
          />
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="filter-bar__actions">
            <button
              onClick={clearFilters}
              disabled={loading}
              className="
                px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 
                hover:bg-gray-200 rounded-md transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center space-x-1
              "
            >
              <svg 
                className="h-4 w-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
              <span>Clear</span>
            </button>
          </div>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="filter-bar__active-filters mt-3 pt-3 border-t border-gray-100">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 font-medium">Active filters:</span>
            
            {filters.channel && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slack-blue text-white">
                Channel: {filters.channel.startsWith('C') ? `#${filters.channel.slice(1, 8)}` : filters.channel}
              </span>
            )}
            
            {filters.search && (
                             <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                 Search: &ldquo;{filters.search}&rdquo;
               </span>
            )}
            
            {filters.startDate && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                From: {new Date(filters.startDate).toLocaleDateString()}
              </span>
            )}
            
            {filters.endDate && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                To: {new Date(filters.endDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 