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
  loading,
  channels
}) => {
  const handleFilterChange = (key: keyof MessageFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value,
      page: 1 // Reset to first page when filters change
    })
  }

  const clearFilters = () => {
    onFiltersChange({
      channel: '',
      username: '',
      dateFrom: '',
      dateTo: '',
      search: '',
      page: 1,
      limit: filters.limit
    })
  }

  const hasActiveFilters = filters.search || filters.channel || filters.username || filters.dateFrom || filters.dateTo

  return (
    <div className="filter-bar space-y-3 sm:space-y-4">
      {/* Search Bar - Full Width on Mobile */}
      <div className="w-full">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg 
              className="h-4 w-4 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search messages..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
        </div>
      </div>

      {/* Filters Grid - Stack on Mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Channel Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Channel</label>
          <select
            value={filters.channel}
            onChange={(e) => handleFilterChange('channel', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          >
            <option value="">All Channels</option>
            {channels.map(channel => (
              <option key={channel} value={channel}>
                {channel.startsWith('C') ? `#${channel.slice(1, 8)}` : channel}
              </option>
            ))}
          </select>
        </div>

        {/* Username Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">User</label>
          <input
            type="text"
            placeholder="Username..."
            value={filters.username}
            onChange={(e) => handleFilterChange('username', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
        </div>

        {/* Date From */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
        </div>
      </div>

      {/* Clear Filters - Mobile Optimized */}
      {hasActiveFilters && (
        <div className="flex justify-center sm:justify-end">
          <button
            onClick={clearFilters}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            disabled={loading}
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear Filters
          </button>
        </div>
      )}
    </div>
  )
} 