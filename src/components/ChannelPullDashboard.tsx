/**
 * Channel Pull Dashboard Component
 * 
 * Comprehensive UI for managing Slack channel data pulls
 * Features:
 * - Channel selection with search and filtering
 * - Pull configuration options (date range, threads, batch size)
 * - Real-time progress tracking with visual indicators
 * - Pull history and results overview
 * - Error handling and retry mechanisms
 * 
 * Follows modern React patterns with hooks and TypeScript
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Search, Download, Play, Pause, RefreshCw, AlertCircle, CheckCircle, Clock, Settings } from 'lucide-react'
import { logger } from '@/lib/logger'

// ===== TYPES =====

interface Channel {
  id: string
  name: string
  memberCount?: number
  isMember?: boolean
}

interface PullConfig {
  channelId: string
  channelName?: string
  startDate?: string
  endDate?: string
  includeThreads: boolean
  batchSize: number
  delayBetweenRequests: number
  skipPIIDetection: boolean
}

interface PullProgress {
  id: string
  channelId: string
  channelName: string
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  progress: number
  totalMessages: number
  processedMessages: number
  threadsProcessed: number
  startedAt: Date | null
  completedAt: Date | null
  errorMessage: string | null
  userId: string | null
  stats: {
    newMessages: number
    duplicateMessages: number
    threadRepliesFetched: number
    documentsCreated: number
    faqsGenerated: number
    piiDetected: number
  }
}

interface PullHistoryItem {
  id: string
  channelName: string
  status: string
  progress: number
  completedAt: Date | null
  stats: PullProgress['stats']
}

// ===== MAIN COMPONENT =====

export const ChannelPullDashboard: React.FC = () => {
  // State management
  const [channels, setChannels] = useState<Channel[]>([])
  const [filteredChannels, setFilteredChannels] = useState<Channel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoadingChannels, setIsLoadingChannels] = useState(false)
  const [showAllChannels, setShowAllChannels] = useState(false)
  const [activePulls, setActivePulls] = useState<Map<string, PullProgress>>(new Map())
  const [pullHistory, setPullHistory] = useState<PullHistoryItem[]>([])
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  
  // Pull configuration state
  const [pullConfig, setPullConfig] = useState<PullConfig>({
    channelId: '',
    channelName: '',
    startDate: '',
    endDate: '',
    includeThreads: true,
    batchSize: 200,
    delayBetweenRequests: 500,
    skipPIIDetection: true // Default to true for faster historical imports
  })

  // UI state
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // ===== EFFECTS =====

  // Load channels on component mount
  useEffect(() => {
    loadChannels()
  }, [])

  // Reload channels when show all toggle changes
  useEffect(() => {
    loadChannels()
  }, [showAllChannels])

  // Filter channels based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredChannels(channels)
    } else {
      const filtered = channels.filter(channel =>
        channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        channel.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredChannels(filtered)
    }
  }, [channels, searchTerm])

  // Update pull config when channel is selected
  useEffect(() => {
    if (selectedChannel) {
      setPullConfig(prev => ({
        ...prev,
        channelId: selectedChannel.id,
        channelName: selectedChannel.name
      }))
    }
  }, [selectedChannel])

  // Poll for progress updates on active pulls
  useEffect(() => {
    if (activePulls.size === 0) return

    const pollInterval = setInterval(() => {
      activePulls.forEach(async (pull) => {
        if (pull.status === 'RUNNING' || pull.status === 'QUEUED') {
          try {
            const response = await fetch(`/api/slack/channel-pull?progressId=${pull.id}`)
            if (response.ok) {
              const data = await response.json()
              if (data.success && data.data?.progress) {
                setActivePulls(prev => new Map(prev.set(pull.id, data.data.progress)))
                
                // Move to history if completed
                if (data.data.progress.status === 'COMPLETED' || data.data.progress.status === 'FAILED') {
                  setTimeout(() => {
                    setActivePulls(prev => {
                      const newMap = new Map(prev)
                      newMap.delete(pull.id)
                      return newMap
                    })
                    addToPullHistory(data.data.progress)
                  }, 2000)
                }
              }
            }
          } catch (error) {
            logger.error('Error polling progress', error)
          }
        }
      })
            }, 5000) // Poll every 5 seconds (reduced frequency)

    return () => clearInterval(pollInterval)
  }, [activePulls])

  // ===== API FUNCTIONS =====

  /**
   * Load available channels from the API
   */
  const loadChannels = useCallback(async () => {
    setIsLoadingChannels(true)
    setError(null)
    
    try {
      const url = showAllChannels 
        ? '/api/slack/channel-pull?action=list-channels&all=true'
        : '/api/slack/channel-pull?action=list-channels'
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        setChannels(data.data.channels)
        clearMessages()
        
        // If showing all channels and current selection is not accessible, clear it
        if (showAllChannels && selectedChannel && !data.data.channels.find((c: Channel) => c.id === selectedChannel.id)?.isMember) {
          setSelectedChannel(null)
        }
      } else {
        setError(data.error || 'Failed to load channels')
      }
    } catch (error) {
      setError('Network error while loading channels')
      logger.error('Error loading channels', error)
    } finally {
      setIsLoadingChannels(false)
    }
  }, [showAllChannels, selectedChannel])

  /**
   * Start a channel pull operation
   */
  const startChannelPull = useCallback(async () => {
    if (!selectedChannel) {
      setError('Please select a channel first')
      return
    }

    if (selectedChannel.isMember === false) {
      setError('Bot is not a member of this channel. Please invite the bot first: /invite @Listen Bot')
      return
    }

    setError(null)
    
    try {
      const response = await fetch('/api/slack/channel-pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pullConfig)
      })
      
      const data = await response.json()
      
      if (data.success) {
        const progress = data.data.progress
        setActivePulls(prev => new Map(prev.set(progress.id, progress)))
        setSuccessMessage(`Channel pull started for ${selectedChannel.name}`)
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(data.error || 'Failed to start channel pull')
      }
    } catch (error) {
      setError('Network error while starting pull')
      logger.error('Error starting channel pull', error)
    }
  }, [selectedChannel, pullConfig])

  /**
   * Cancel an active pull
   */
  const cancelPull = useCallback(async (progressId: string) => {
    try {
      const response = await fetch(`/api/slack/channel-pull?progressId=${progressId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setActivePulls(prev => {
          const newMap = new Map(prev)
          const pull = newMap.get(progressId)
          if (pull) {
            pull.status = 'CANCELLED'
            newMap.set(progressId, pull)
          }
          return newMap
        })
        setSuccessMessage('Pull cancelled successfully')
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(data.error || 'Failed to cancel pull')
      }
    } catch (error) {
      setError('Network error while cancelling pull')
      logger.error('Error cancelling pull', error)
    }
  }, [])

  // ===== HELPER FUNCTIONS =====

  const clearMessages = () => {
    setError(null)
    setSuccessMessage(null)
  }

  const addToPullHistory = (progress: PullProgress) => {
    const historyItem: PullHistoryItem = {
      id: progress.id,
      channelName: progress.channelName,
      status: progress.status,
      progress: progress.progress,
      completedAt: progress.completedAt,
      stats: progress.stats
    }
    
    setPullHistory(prev => [historyItem, ...prev.slice(0, 9)]) // Keep last 10 items
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A'
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'RUNNING':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'FAILED':
      case 'CANCELLED':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return 'bg-yellow-100 text-yellow-800'
      case 'RUNNING':
        return 'bg-blue-100 text-blue-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // ===== RENDER =====

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Slack Channel Data Pull</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Pull all historical data from Slack channels</p>
        </div>
        <button
          onClick={loadChannels}
          disabled={isLoadingChannels}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingChannels ? 'animate-spin' : ''}`} />
          Refresh Channels
        </button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
          <span className="text-red-700 dark:text-red-300">{error}</span>
          <button
            onClick={clearMessages}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center">
          <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
          <span className="text-green-700 dark:text-green-300">{successMessage}</span>
          <button
            onClick={clearMessages}
            className="ml-auto text-green-500 hover:text-green-700"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Channel Search and Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Select Channel</h2>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search channels..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>

            {/* Show All Channels Toggle */}
            <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showAllChannels}
                    onChange={(e) => setShowAllChannels(e.target.checked)}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show all channels</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  {showAllChannels 
                    ? 'Showing all channels (bot needs to be invited to access non-member channels)'
                    : 'Showing only channels where the bot is a member'
                  }
                </p>
              </div>
            </div>

            {/* Channel List */}
            <div className="max-h-64 overflow-y-auto space-y-2">
              {isLoadingChannels ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-gray-600 dark:text-gray-400">Loading channels...</span>
                </div>
              ) : filteredChannels.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {searchTerm ? 'No channels match your search' : 'No channels available'}
                </div>
              ) : (
                filteredChannels.map((channel) => {
                  const isAccessible = channel.isMember !== false
                  const isSelected = selectedChannel?.id === channel.id
                  
                  return (
                    <div
                      key={channel.id}
                      onClick={() => isAccessible ? setSelectedChannel(channel) : null}
                      className={`p-3 rounded-lg border transition-colors ${
                        !isAccessible
                          ? 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 cursor-not-allowed opacity-60'
                          : isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 cursor-pointer'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-gray-900 dark:text-gray-100">#{channel.name}</div>
                            {showAllChannels && (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                isAccessible 
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                              }`}>
                                {isAccessible ? '✓ Member' : '⚠ Invite needed'}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{channel.id}</div>
                          {!isAccessible && showAllChannels && (
                            <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              Run: <code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">/invite @Listen Bot</code> in this channel
                            </div>
                          )}
                        </div>
                        {channel.memberCount && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {channel.memberCount} members
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Pull Configuration */}
          {selectedChannel && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Pull Configuration</h2>
                <button
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                >
                  <Settings className="w-4 h-4 mr-1" />
                  {showAdvancedSettings ? 'Hide' : 'Show'} Advanced
                </button>
              </div>

              <div className="space-y-4">
                {/* Include Threads */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="includeThreads"
                    checked={pullConfig.includeThreads}
                    onChange={(e) => setPullConfig(prev => ({ ...prev, includeThreads: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 bg-white dark:bg-gray-700"
                  />
                  <label htmlFor="includeThreads" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Include thread replies (recommended)
                  </label>
                </div>

                {/* Skip PII Detection */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="skipPIIDetection"
                    checked={pullConfig.skipPIIDetection}
                    onChange={(e) => setPullConfig(prev => ({ ...prev, skipPIIDetection: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 bg-white dark:bg-gray-700"
                  />
                  <label htmlFor="skipPIIDetection" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Skip PII detection (⚡ faster imports)
                  </label>
                </div>

                {/* Advanced Settings */}
                {showAdvancedSettings && (
                  <div className="border-t pt-4 space-y-4">
                    {/* Date Range */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range (Optional)</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={pullConfig.startDate}
                            onChange={(e) => setPullConfig(prev => ({ ...prev, startDate: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            End Date
                          </label>
                          <input
                            type="date"
                            value={pullConfig.endDate}
                            onChange={(e) => setPullConfig(prev => ({ ...prev, endDate: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Leave empty to pull all historical messages</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Batch Size
                        </label>
                                                  <input
                            type="number"
                            min="50"
                            max="500"
                            value={pullConfig.batchSize}
                            onChange={(e) => setPullConfig(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 200 }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Messages per API request (50-500)</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Delay (ms)
                        </label>
                                                  <input
                            type="number"
                            min="200"
                            max="3000"
                            step="100"
                            value={pullConfig.delayBetweenRequests}
                            onChange={(e) => setPullConfig(prev => ({ ...prev, delayBetweenRequests: parseInt(e.target.value) || 500 }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Delay between requests (200-3000ms)</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Start Pull Button */}
                <button
                  onClick={startChannelPull}
                  disabled={!selectedChannel || activePulls.has(selectedChannel.id)}
                  className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Download className="w-5 h-5 mr-2" />
                  {activePulls.has(selectedChannel.id) ? 'Pull in Progress' : 'Start Channel Pull'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Progress and History Sidebar */}
        <div className="space-y-6">
          {/* Active Pulls */}
          {activePulls.size > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Active Pulls</h2>
              <div className="space-y-4">
                {Array.from(activePulls.values()).map((pull) => (
                  <div key={pull.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-gray-900 dark:text-gray-100">#{pull.channelName}</div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(pull.status)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(pull.status)}`}>
                          {pull.status}
                        </span>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-1">
                        <span>Progress</span>
                        <span>{pull.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${pull.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300 mb-3">
                      <div>Messages: {pull.processedMessages}/{pull.totalMessages}</div>
                      <div>Threads: {pull.threadsProcessed}</div>
                      <div>New: {pull.stats.newMessages}</div>
                      <div>Duplicates: {pull.stats.duplicateMessages}</div>
                    </div>

                    {/* Actions */}
                    {(pull.status === 'RUNNING' || pull.status === 'QUEUED') && (
                      <button
                        onClick={() => cancelPull(pull.id)}
                        className="w-full px-3 py-2 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
                      >
                        Cancel Pull
                      </button>
                    )}

                    {pull.errorMessage && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        {pull.errorMessage}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pull History */}
          {pullHistory.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Recent Pulls</h2>
              <div className="space-y-3">
                {pullHistory.map((item) => (
                  <div key={item.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">#{item.channelName}</div>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(item.status)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                      <div>Completed: {formatDate(item.completedAt)}</div>
                      <div className="grid grid-cols-2 gap-1">
                        <div>New: {item.stats.newMessages}</div>
                        <div>Threads: {item.stats.threadRepliesFetched}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Help Text */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">How it works</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Select a channel to pull data from</li>
              <li>• Configure date range and options</li>
              <li>• Data is processed through existing pipelines</li>
              <li>• Progress is tracked in real-time</li>
              <li>• Results appear in your dashboard</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChannelPullDashboard 