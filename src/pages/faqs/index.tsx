/**
 * FAQs Index Page
 * Main interface for FAQ management with comprehensive filtering, approval workflows,
 * creation capabilities, and integration with processing APIs
 */

import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { FAQCard, FAQFilterBar } from '@/components/faqs'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Header } from '@/components/Header'
import { FAQDisplay, PaginatedFAQs } from '@/types'

/**
 * FAQ creation modal interface
 */
interface CreateFAQModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => void
}

const CreateFAQModal: React.FC<CreateFAQModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [category, setCategory] = useState('Support')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim() || !answer.trim()) return

    setSubmitting(true)
    try {
      await onSubmit({
        question: question.trim(),
        answer: answer.trim(),
        category: category.trim()
      })
      
      // Reset form
      setQuestion('')
      setAnswer('')
      setCategory('Support')
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Create New FAQ
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Question *
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter the question..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Support">Support</option>
                <option value="Technical">Technical</option>
                <option value="General">General</option>
                <option value="Documentation">Documentation</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Answer *
              </label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                required
                rows={6}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter the answer..."
              />
            </div>

            <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !question.trim() || !answer.trim()}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating...' : 'Create FAQ'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/**
 * Main FAQs Page
 */
const FAQsPage: React.FC = () => {
  const router = useRouter()
  const [faqs, setFAQs] = useState<FAQDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  // Filter state
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Bulk operations state
  const [selectedFAQs, setSelectedFAQs] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)

  /**
   * Show notification temporarily
   */
  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }, [])

  /**
   * Fetch FAQs from API
   */
  const fetchFAQs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const queryParams = new URLSearchParams()
      if (statusFilter) queryParams.append('status', statusFilter)
      if (categoryFilter) queryParams.append('category', categoryFilter)
      if (searchTerm) queryParams.append('search', searchTerm)

      const response = await fetch(`/api/faqs?${queryParams.toString()}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch FAQs: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch FAQs')
      }

      const data: PaginatedFAQs = result.data
      setFAQs(data.faqs || [])

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
      setError(errorMessage)
      console.error('Failed to fetch FAQs:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter, searchTerm])

  // Fetch FAQs on component mount and when filters change
  useEffect(() => {
    fetchFAQs()
  }, [fetchFAQs])

  /**
   * Handle FAQ creation
   */
  const handleCreateFAQ = useCallback(async (data: any) => {
    try {
      setProcessing(true)
      
      const response = await fetch('/api/faqs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create FAQ')
      }

      showNotification('success', 'FAQ created successfully!')
      fetchFAQs() // Refresh the FAQ list

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create FAQ'
      showNotification('error', errorMessage)
      console.error('Failed to create FAQ:', error)
    } finally {
      setProcessing(false)
    }
  }, [showNotification, fetchFAQs])

  /**
   * Handle cleaning duplicate FAQs
   */
  const handleCleanDuplicates = useCallback(async () => {
    if (!confirm('Are you sure you want to clean duplicate FAQs? This will remove FAQs with similar questions and keep only the oldest version of each.')) {
      return
    }

    try {
      setProcessing(true)
      showNotification('success', 'Cleaning duplicate FAQs...')
      
      const response = await fetch('/api/faqs/clean-duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to clean duplicates')
      }

      const { duplicatesRemoved, totalFAQs } = result.data
      showNotification('success', `Successfully cleaned ${duplicatesRemoved} duplicate FAQs! ${totalFAQs} unique FAQs remain.`)
      fetchFAQs() // Refresh the FAQ list

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clean duplicates'
      showNotification('error', errorMessage)
      console.error('Failed to clean duplicates:', error)
    } finally {
      setProcessing(false)
    }
  }, [showNotification, fetchFAQs])

  /**
   * Handle FAQ approval
   */
  const handleApproveFAQ = useCallback(async (faqId: string) => {
    try {
      setProcessing(true)
      
      const response = await fetch('/api/faqs', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: faqId,
          action: 'approve',
          reviewedBy: 'current-user' // TODO: Get from auth context
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to approve FAQ')
      }

      showNotification('success', 'FAQ approved successfully!')
      fetchFAQs() // Refresh the FAQ list

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to approve FAQ'
      showNotification('error', errorMessage)
      console.error('Failed to approve FAQ:', error)
    } finally {
      setProcessing(false)
    }
  }, [showNotification, fetchFAQs])

  /**
   * Handle FAQ rejection
   */
  const handleRejectFAQ = useCallback(async (faqId: string) => {
    try {
      setProcessing(true)
      
      const response = await fetch('/api/faqs', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: faqId,
          action: 'reject',
          reviewedBy: 'current-user' // TODO: Get from auth context
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to reject FAQ')
      }

      showNotification('success', 'FAQ rejected successfully!')
      fetchFAQs() // Refresh the FAQ list

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reject FAQ'
      showNotification('error', errorMessage)
      console.error('Failed to reject FAQ:', error)
    } finally {
      setProcessing(false)
    }
  }, [showNotification, fetchFAQs])

  /**
   * Handle FAQ deletion
   */
  const handleDeleteFAQ = useCallback(async (faqId: string) => {
    if (!confirm('Are you sure you want to delete this FAQ? This action cannot be undone.')) {
      return
    }

    try {
      setProcessing(true)
      
      const response = await fetch('/api/faqs', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: faqId }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete FAQ')
      }

      showNotification('success', 'FAQ deleted successfully!')
      fetchFAQs() // Refresh the FAQ list

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete FAQ'
      showNotification('error', errorMessage)
      console.error('Failed to delete FAQ:', error)
    } finally {
      setProcessing(false)
    }
  }, [showNotification, fetchFAQs])

  /**
   * Handle selecting/deselecting FAQs for bulk operations
   */
  const handleSelectFAQ = useCallback((faqId: string, selected: boolean) => {
    setSelectedFAQs(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(faqId)
      } else {
        newSet.delete(faqId)
      }
      return newSet
    })
  }, [])

  /**
   * Handle select all/none toggle
   */
  const handleSelectAll = useCallback((selectAll: boolean) => {
    if (selectAll) {
      setSelectedFAQs(new Set(faqs.map(faq => faq.id)))
    } else {
      setSelectedFAQs(new Set())
    }
  }, [faqs])

  /**
   * Handle bulk delete operation
   */
  const handleBulkDelete = useCallback(async () => {
    if (selectedFAQs.size === 0) return
    
    const confirmed = confirm(`Are you sure you want to delete ${selectedFAQs.size} FAQ(s)? This action cannot be undone.`)
    if (!confirmed) return

    setBulkProcessing(true)
    
    try {
      const deletePromises = Array.from(selectedFAQs).map(async (faqId) => {
        const response = await fetch(`/api/faqs/${faqId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        })

        if (!response.ok) {
          const result = await response.json()
          throw new Error(result.error || `Failed to delete FAQ ${faqId}`)
        }
      })

      await Promise.all(deletePromises)
      
      showNotification('success', `Successfully deleted ${selectedFAQs.size} FAQ(s)!`)
      setSelectedFAQs(new Set()) // Clear selection
      fetchFAQs() // Refresh the FAQ list

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete FAQs'
      showNotification('error', errorMessage)
      console.error('Failed to delete FAQs:', error)
    } finally {
      setBulkProcessing(false)
    }
  }, [selectedFAQs, showNotification, fetchFAQs])

  return (
    <>
      <Head>
        <title>FAQs - SF Listen Bot</title>
        <meta name="description" content="Manage and review AI-generated FAQs from Slack conversations" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header isConnected={true} onDebugClick={() => {}} />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">FAQs</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1 sm:mt-2 text-sm sm:text-base">
                  Manage AI-generated FAQs from your Slack conversations
                </p>
              </div>
              
              {/* Desktop Actions */}
              <div className="hidden sm:flex items-center gap-4">
                <Link
                  href="/documents"
                  className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors duration-200"
                >
                  View Documents
                </Link>
                
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200"
                >
                  Create FAQ
                </button>
                
                <button
                  onClick={handleCleanDuplicates}
                  disabled={processing}
                  className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors duration-200"
                >
                  {processing ? 'Cleaning...' : 'Clean Duplicates'}
                </button>
                
                <button
                  onClick={() => handleSelectAll(true)}
                  disabled={faqs.length === 0}
                  className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors duration-200"
                >
                  Select All
                </button>
              </div>
            </div>

            {/* Bulk Operations Bar */}
            {selectedFAQs.size > 0 && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {selectedFAQs.size} FAQ(s) selected
                    </span>
                    <button
                      onClick={() => setSelectedFAQs(new Set())}
                      className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                    >
                      Clear selection
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkProcessing}
                      className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors duration-200"
                    >
                      {bulkProcessing ? 'Deleting...' : 'Delete Selected'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Actions */}
            <div className="sm:hidden mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full flex items-center justify-center px-4 py-3 text-base bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create FAQ
                </button>
                
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/documents"
                    className="flex items-center justify-center px-4 py-2.5 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Documents
                  </Link>
                  
                  <button
                    onClick={handleCleanDuplicates}
                    disabled={processing}
                    className="flex items-center justify-center px-4 py-2.5 text-sm bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {processing ? 'Cleaning...' : 'Clean'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <FAQFilterBar
              searchTerm={searchTerm}
              statusFilter={statusFilter}
              categoryFilter={categoryFilter}
              onSearchChange={setSearchTerm}
              onStatusChange={setStatusFilter}
              onCategoryChange={setCategoryFilter}
              loading={loading}
            />
          </div>

          {/* Notification */}
          {notification && (
            <div className={`mb-6 p-4 rounded-lg border ${
              notification.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900 dark:border-green-700 dark:text-green-200'
                : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {notification.type === 'success' ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className="text-sm font-medium">{notification.message}</span>
              </div>
            </div>
          )}

          {/* Processing Overlay */}
          {processing && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl">
                <div className="flex items-center gap-4">
                  <LoadingSpinner />
                  <span className="text-gray-900 dark:text-white">Processing...</span>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-red-800 dark:text-red-200">Error</span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
              <button
                onClick={fetchFAQs}
                className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 mt-2 underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && faqs.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No FAQs found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Get started by creating a FAQ or generating them from documents.
              </p>
            </div>
          )}

          {/* FAQ Grid */}
          {!loading && !error && faqs.length > 0 && (
            <div className="space-y-6">
              {/* Bulk Selection Header */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedFAQs.size === faqs.length && faqs.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                        Select All ({faqs.length})
                      </span>
                    </label>
                    {selectedFAQs.size > 0 && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {selectedFAQs.size} selected
                      </span>
                    )}
                  </div>
                  {selectedFAQs.size > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkProcessing}
                      className="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors duration-200"
                    >
                      Delete {selectedFAQs.size} FAQ{selectedFAQs.size !== 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </div>

              {/* FAQ List */}
              {faqs.map((faq) => (
                <FAQCard
                  key={faq.id}
                  faq={faq}
                  onApprove={handleApproveFAQ}
                  onReject={handleRejectFAQ}
                  onDelete={handleDeleteFAQ}
                  showBulkSelect={true}
                  isSelected={selectedFAQs.has(faq.id)}
                  onSelect={(selected) => handleSelectFAQ(faq.id, selected)}
                />
              ))}
            </div>
          )}
        </main>

        {/* Create FAQ Modal */}
        <CreateFAQModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateFAQ}
        />
      </div>
    </>
  )
}

export default FAQsPage 