/**
 * Individual Document Detail Page
 * Comprehensive view of a single processed document with full traceability,
 * source message display, FAQ management, and editing capabilities
 */

import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Header } from '@/components/Header'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { AIAnalysisBreakdown } from '@/components/documents/AIAnalysisBreakdown'
import { DocumentDisplay, MessageDisplay, FAQDisplay, ApiResponse } from '@/types'

/**
 * Document metadata component
 */
interface DocumentMetadataProps {
  document: DocumentDisplay
  onEdit: (data: any) => void
  onDelete: () => void
  editing: boolean
  setEditing: (editing: boolean) => void
}

const DocumentMetadata: React.FC<DocumentMetadataProps> = ({
  document,
  onEdit,
  onDelete,
  editing,
  setEditing
}) => {
  const [title, setTitle] = useState(document.title)
  const [description, setDescription] = useState(document.description)
  const [category, setCategory] = useState(document.category)

  const handleSave = () => {
    onEdit({
      title: title.trim(),
      description: description.trim(),
      category: category.trim()
    })
    setEditing(false)
  }

  const handleCancel = () => {
    setTitle(document.title)
    setDescription(document.description)
    setCategory(document.category)
    setEditing(false)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Document Details</h2>
        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={onDelete}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-800 dark:text-red-400 border border-red-300 dark:border-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900 transition-colors"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {editing ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{document.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{document.description}</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Category</div>
                <div className="font-medium text-gray-900 dark:text-white">{document.category}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Status</div>
                <div className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  document.status === 'COMPLETE' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : document.status === 'PROCESSING'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                }`}>
                  {document.status}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Confidence</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {Math.round(document.confidenceScore * 100)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Created</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {new Date(document.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Source messages component
 */
interface SourceMessagesProps {
  messages: MessageDisplay[]
  onRemoveMessage: (messageId: string) => void
  onAddMessages: () => void
}

const SourceMessages: React.FC<SourceMessagesProps> = ({
  messages,
  onRemoveMessage,
  onAddMessages
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Source Messages ({messages.length})
        </h2>
        <button
          onClick={onAddMessages}
          className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          Add Messages
        </button>
      </div>

      <div className="space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {message.username}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {message.channel}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {message.timeAgo}
                  </span>
                  {message.role && (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      message.role === 'QUESTION'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : message.role === 'ANSWER'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {message.role}
                    </span>
                  )}
                </div>
                <p className="text-gray-900 dark:text-white">{message.text}</p>
                {message.threadReplies && message.threadReplies.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {message.threadReplies.length} replies in thread
                  </div>
                )}
              </div>
              <button
                onClick={() => onRemoveMessage(message.id)}
                className="ml-4 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-500 dark:text-gray-400 mb-4">
              ⚠️ No source messages found for this document.
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-500 mb-4">
              This document was created but the conversation messages aren&apos;t linked properly.
              This might be a database relationship issue.
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors mr-2"
            >
              🔄 Reload Page
            </button>
            <button
              onClick={onAddMessages}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              ➕ Add Messages
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Generated FAQs component
 */
interface GeneratedFAQsProps {
  faqs: FAQDisplay[]
  onGenerateFAQs: () => void
  onDeleteFAQ: (faqId: string) => void
}

const GeneratedFAQs: React.FC<GeneratedFAQsProps> = ({
  faqs,
  onGenerateFAQs,
  onDeleteFAQ
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Generated FAQs ({faqs.length})
        </h2>
        <button
          onClick={onGenerateFAQs}
          className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
        >
          Generate FAQs
        </button>
      </div>

      <div className="space-y-4">
        {faqs.map((faq) => (
          <div
            key={faq.id}
            className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {faq.question}
                  </h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    faq.status === 'APPROVED'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : faq.status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {faq.status}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {Math.round(faq.confidenceScore * 100)}% confidence
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-2">{faq.answer}</p>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Category: {faq.category}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Link
                  href={`/faqs?highlight=${faq.id}`}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Link>
                <button
                  onClick={() => onDeleteFAQ(faq.id)}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}

        {faqs.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No FAQs generated yet. Click &quot;Generate FAQs&quot; to create FAQs from this document.
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Main Document Detail Page
 */
const DocumentDetailPage: React.FC = () => {
  const router = useRouter()
  const { id } = router.query

  // State
  const [document, setDocument] = useState<DocumentDisplay | null>(null)
  const [messages, setMessages] = useState<MessageDisplay[]>([])
  const [faqs, setFAQs] = useState<FAQDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  /**
   * Show notification temporarily
   */
  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }, [])

  /**
   * Fetch document data
   */
  const fetchDocument = useCallback(async () => {
    if (!id || typeof id !== 'string') return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/documents/${id}`)
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch document')
      }

      setDocument(result.data.document)
      setMessages(result.data.messages || [])
      setFAQs(result.data.faqs || [])

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
      setError(errorMessage)
      console.error('Failed to fetch document:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  // Fetch document on mount and when ID changes
  useEffect(() => {
    fetchDocument()
  }, [fetchDocument])

  /**
   * Handle document editing
   */
  const handleEditDocument = useCallback(async (data: any) => {
    if (!document) return

    try {
      setProcessing(true)

      const response = await fetch(`/api/documents/${document.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update document')
      }

      setDocument(result.data)
      showNotification('success', 'Document updated successfully!')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update document'
      showNotification('error', errorMessage)
      console.error('Failed to update document:', error)
    } finally {
      setProcessing(false)
    }
  }, [document, showNotification])

  /**
   * Handle document deletion
   */
  const handleDeleteDocument = useCallback(async () => {
    if (!document) return
    
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return
    }

    try {
      setProcessing(true)

      const response = await fetch(`/api/documents/${document.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete document')
      }

      showNotification('success', 'Document deleted successfully!')
      setTimeout(() => {
        router.push('/documents')
      }, 1000)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete document'
      showNotification('error', errorMessage)
      console.error('Failed to delete document:', error)
    } finally {
      setProcessing(false)
    }
  }, [document, showNotification, router])

  /**
   * Handle FAQ generation
   */
  const handleGenerateFAQs = useCallback(async () => {
    if (!document) return

    try {
      setProcessing(true)

      const response = await fetch('/api/faqs/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: document.id,
          useBackgroundJob: false
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to generate FAQs')
      }

      const faqCount = result.data?.faqs?.length || 0
      showNotification('success', `Generated ${faqCount} FAQs successfully!`)
      fetchDocument() // Refresh to show new FAQs

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate FAQs'
      showNotification('error', errorMessage)
      console.error('Failed to generate FAQs:', error)
    } finally {
      setProcessing(false)
    }
  }, [document, showNotification, fetchDocument])

  /**
   * Handle FAQ deletion
   */
  const handleDeleteFAQ = useCallback(async (faqId: string) => {
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
      fetchDocument() // Refresh to update FAQ list

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete FAQ'
      showNotification('error', errorMessage)
      console.error('Failed to delete FAQ:', error)
    } finally {
      setProcessing(false)
    }
  }, [showNotification, fetchDocument])

  // Placeholder functions for features to be implemented
  const handleRemoveMessage = (messageId: string) => {
    showNotification('error', 'Message removal not implemented yet')
  }

  const handleAddMessages = () => {
    showNotification('error', 'Add messages feature not implemented yet')
  }

  if (loading) {
    return (
      <>
        <Head>
          <title>Loading Document - SF Listen Bot</title>
        </Head>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Header isConnected={true} onDebugClick={() => {}} />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          </main>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Head>
          <title>Error - SF Listen Bot</title>
        </Head>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Header isConnected={true} onDebugClick={() => {}} />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-red-800 dark:text-red-200">Error</span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={fetchDocument}
                  className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 underline"
                >
                  Try again
                </button>
                <Link
                  href="/documents"
                  className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 underline"
                >
                  Back to documents
                </Link>
              </div>
            </div>
          </main>
        </div>
      </>
    )
  }

  if (!document) {
    return (
      <>
        <Head>
          <title>Document Not Found - SF Listen Bot</title>
        </Head>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Header isConnected={true} onDebugClick={() => {}} />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Document Not Found</h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                The requested document could not be found.
              </p>
              <Link
                href="/documents"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 underline"
              >
                Back to documents
              </Link>
            </div>
          </main>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>{document.title} - SF Listen Bot</title>
        <meta name="description" content={`Document: ${document.description}`} />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header isConnected={true} onDebugClick={() => {}} />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
            <Link href="/documents" className="hover:text-gray-900 dark:hover:text-white">
              Documents
            </Link>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-900 dark:text-white">{document.title}</span>
          </nav>

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

          {/* Debug Info */}
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm">
              <div className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">🐛 Debug Info:</div>
              <div className="text-yellow-700 dark:text-yellow-300 space-y-1">
                <div>Document ID: {document.id}</div>
                <div>Messages loaded: {messages.length}</div>
                <div>FAQs loaded: {faqs.length}</div>
                <div>Message count in document: {document.messageCount}</div>
              </div>
            </div>
          )}

          {/* Document Content */}
          <div className="space-y-8">
            {/* Document Metadata */}
            <DocumentMetadata
              document={document}
              onEdit={handleEditDocument}
              onDelete={handleDeleteDocument}
              editing={editing}
              setEditing={setEditing}
            />

            {/* Source Messages */}
            <SourceMessages
              messages={messages}
              onRemoveMessage={handleRemoveMessage}
              onAddMessages={handleAddMessages}
            />

            {/* AI Analysis Breakdown */}
            <AIAnalysisBreakdown
              messages={messages}
              faqs={faqs}
              documentId={document.id}
            />

            {/* Generated FAQs */}
            <GeneratedFAQs
              faqs={faqs}
              onGenerateFAQs={handleGenerateFAQs}
              onDeleteFAQ={handleDeleteFAQ}
            />
          </div>
        </main>
      </div>
    </>
  )
}

export default DocumentDetailPage 