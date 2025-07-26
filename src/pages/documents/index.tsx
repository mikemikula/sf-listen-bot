/**
 * Documents Index Page
 * Main interface for document management with comprehensive filtering,
 * creation workflows, bulk operations, and integration with processing APIs
 */

import React, { useState, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import DocumentFeed from '@/components/documents/DocumentFeed'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Header } from '@/components/Header'

/**
 * Simple one-click document processing interface
 */
interface ProcessAllModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (data: any) => void
}

const ProcessAllModal: React.FC<ProcessAllModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingMessage, setLoadingMessage] = useState('Initializing...')

  const handleProcessAll = async () => {
    setProcessing(true)
    setError(null)
    setLoadingMessage('Scanning for unprocessed messages...')
    
    // Track start time for minimum loading duration
    const startTime = Date.now()
    const MIN_LOADING_TIME = 1500 // 1.5 seconds minimum loading time
    
    // Update loading messages progressively
    const messageTimer1 = setTimeout(() => {
      setLoadingMessage('Analyzing message patterns...')
    }, 500)
    
    const messageTimer2 = setTimeout(() => {
      setLoadingMessage('Organizing conversations...')
    }, 1000)
    
    try {
      const response = await fetch('/api/documents/process-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          useBackgroundJob: false, // Process synchronously for immediate feedback
          batchSize: 20
        })
      })

      const data = await response.json()
      
      // Clear message timers
      clearTimeout(messageTimer1)
      clearTimeout(messageTimer2)
      setLoadingMessage('Finalizing results...')
      
      // Calculate remaining time to meet minimum loading duration
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime)
      
      // Wait for remaining time if needed to prevent jarring flash
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime))
      }
      
      if (data.success) {
        setResult(data.data)
        onSuccess(data.data)
      } else {
        // Handle rate limit errors specially
        if (response.status === 429) {
          setError(data.error || 'API quota exceeded. Please try again later.')
          // If some documents were processed before hitting limits, show partial results
          if (data.data && data.data.documents && data.data.documents.length > 0) {
            setResult({
              ...data.data,
              isPartialSuccess: true
            })
          }
        } else {
          setError(data.error || 'Failed to process messages')
        }
      }
    } catch (err) {
      // Clear message timers
      clearTimeout(messageTimer1)
      clearTimeout(messageTimer2)
      
      // Still respect minimum loading time even for errors
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime)
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime))
      }
      
      setError('Network error occurred')
      console.error('Process all error:', err)
    } finally {
      setProcessing(false)
    }
  }

  const handleClose = () => {
    setResult(null)
    setError(null)
    setLoadingMessage('Initializing...') // Reset loading message
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Process All Unprocessed Messages
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {!result && !error && (
            <div className="text-center">
              <div className="mb-6 transition-all duration-300 ease-in-out">
                <svg className="w-16 h-16 mx-auto text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg text-gray-900 dark:text-white mb-2">
                  {processing ? 'Processing...' : 'Ready to create documents automatically!'}
                </p>
                <p className="text-gray-600 dark:text-gray-400 min-h-[2.5rem] flex items-center justify-center">
                  {processing ? (
                    <span className="inline-flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {loadingMessage}
                    </span>
                  ) : (
                    'AI will find all unprocessed Slack messages and create structured documents with smart titles, categories, and descriptions.'
                  )}
                </p>
              </div>

              <button
                onClick={handleProcessAll}
                disabled={processing}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {processing ? (
                  'Processing...'
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Process All Messages
                  </>
                )}
              </button>
            </div>
          )}

          {error && !result && (
            <div className="text-center">
              <div className="mb-4">
                {error.includes('quota') || error.includes('rate limit') ? (
                  <>
                    <svg className="w-12 h-12 mx-auto text-yellow-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      API Quota Exceeded ⚠️
                    </p>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                        <strong>You&apos;ve hit the Gemini free tier limits.</strong>
                      </p>
                      <div className="text-left text-sm text-yellow-700 dark:text-yellow-300 space-y-2">
                        <p>📅 <strong>Daily Reset:</strong> Quotas typically reset every 24 hours</p>
                        <p>⚡ <strong>Upgrade Option:</strong> Get higher limits with a paid Gemini API plan</p>
                        <p>🔄 <strong>Alternative:</strong> Try processing fewer messages at once</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <svg className="w-12 h-12 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                  </>
                )}
                
                <button
                  onClick={handleProcessAll}
                  disabled={error.includes('quota') || error.includes('rate limit')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {error.includes('quota') || error.includes('rate limit') ? 'Wait for Reset' : 'Try Again'}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="text-center">
              <div className="mb-4">
                {/* Special handling for when no messages were found */}
                {result.stats.totalMessages === 0 ? (
                  <>
                    <svg className="w-12 h-12 mx-auto text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      All Messages Processed! ✅
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      No unprocessed messages found. All your Slack messages have already been organized into documents.
                    </p>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-center mb-2">
                        <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                          What&apos;s Next?
                        </p>
                      </div>
                      <ul className="text-sm text-blue-700 dark:text-blue-300 text-left space-y-1">
                        <li>• Review existing documents below</li>
                        <li>• Generate FAQs from your documents</li>
                        <li>• New messages will be processed automatically</li>
                      </ul>
                    </div>
                  </>
                ) : result.isPartialSuccess ? (
                  <>
                    <svg className="w-12 h-12 mx-auto text-yellow-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Partial Success! ⚠️
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {result.message}
                    </p>
                  </>
                ) : (
                  <>
                    <svg className="w-12 h-12 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Success! 🎉
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {result.message}
                    </p>
                  </>
                )}
                
                {result.isPartialSuccess && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      💡 <strong>API Quota Exceeded:</strong> Processing stopped due to rate limits. 
                      The Gemini free tier has daily limits. Consider upgrading for higher quotas or try again tomorrow.
                    </p>
                  </div>
                )}
                
                {/* Only show stats if there were actually messages to process */}
                {result.stats.totalMessages > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{result.stats.totalMessages}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Messages Found</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{result.stats.documentsCreated}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Documents Created</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-600">{result.stats.messagesProcessed}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Messages Processed</div>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                  {result.stats.totalMessages === 0 ? 'Close' : 'View Documents'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Main Documents Page
 */
const DocumentsPage: React.FC = () => {
  const router = useRouter()
  const [showCreateModal, setShowCreateModal] = useState(false)
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
   * Handle successful processing of all messages
   */
  const handleProcessSuccess = useCallback((data: any) => {
    showNotification('success', data.message)
    
    // Close modal and refresh the document feed
    setShowCreateModal(false)
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }, [showNotification])

  /**
   * Handle document editing
   */
  const handleEditDocument = useCallback((documentId: string) => {
    router.push(`/documents/${documentId}`)
  }, [router])

  /**
   * Handle document deletion
   */
  const handleDeleteDocument = useCallback(async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return
    }

    try {
      setProcessing(true)
      
      const response = await fetch('/api/documents', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: documentId }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete document')
      }

      showNotification('success', 'Document deleted successfully')
      
      // Refresh the document feed
      window.location.reload()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete document'
      showNotification('error', errorMessage)
      console.error('Failed to delete document:', error)
    } finally {
      setProcessing(false)
    }
  }, [showNotification])

  /**
   * Handle document enhancement
   */
  const handleEnhanceDocument = useCallback((documentId: string) => {
    router.push(`/documents/${documentId}/enhance`)
  }, [router])

  /**
   * Handle FAQ generation
   */
  const handleGenerateFAQs = useCallback(async (documentId: string) => {
    try {
      setProcessing(true)
      
      const response = await fetch('/api/faqs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'generate',
          documentId,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to generate FAQs')
      }

      const faqCount = result.data.faqs.length
      showNotification('success', `Generated ${faqCount} FAQ${faqCount !== 1 ? 's' : ''} successfully!`)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate FAQs'
      showNotification('error', errorMessage)
      console.error('Failed to generate FAQs:', error)
    } finally {
      setProcessing(false)
    }
  }, [showNotification])

  /**
   * Handle bulk actions
   */
  const handleBulkAction = useCallback(async (action: string, documentIds: string[]) => {
    if (!confirm(`Are you sure you want to ${action} ${documentIds.length} document${documentIds.length !== 1 ? 's' : ''}?`)) {
      return
    }

    try {
      setProcessing(true)

      switch (action) {
        case 'delete':
          // Delete documents one by one (could be optimized with batch API)
          for (const documentId of documentIds) {
            const response = await fetch('/api/documents', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ id: documentId }),
            })

            if (!response.ok) {
              throw new Error(`Failed to delete document ${documentId}`)
            }
          }
          
          showNotification('success', `Deleted ${documentIds.length} document${documentIds.length !== 1 ? 's' : ''} successfully`)
          break

        case 'generate-faqs':
          // Generate FAQs for each document
          let totalFAQs = 0
          for (const documentId of documentIds) {
            const response = await fetch('/api/faqs', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'generate',
                documentId,
              }),
            })

            if (response.ok) {
              const result = await response.json()
              if (result.success) {
                totalFAQs += result.data.faqs.length
              }
            }
          }
          
          showNotification('success', `Generated ${totalFAQs} FAQ${totalFAQs !== 1 ? 's' : ''} from ${documentIds.length} document${documentIds.length !== 1 ? 's' : ''}`)
          break

        default:
          showNotification('error', `Unknown action: ${action}`)
          return
      }

      // Refresh the document feed
      window.location.reload()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `Failed to ${action} documents`
      showNotification('error', errorMessage)
      console.error(`Failed to ${action} documents:`, error)
    } finally {
      setProcessing(false)
    }
  }, [showNotification])

  return (
    <>
      <Head>
        <title>Documents - SF Listen Bot</title>
        <meta name="description" content="Manage and organize processed documents from Slack conversations" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header isConnected={true} onDebugClick={() => {}} />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Documents</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage processed documents from your Slack conversations
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <Link
                href="/processing/dashboard"
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors duration-200"
              >
                Processing Dashboard
              </Link>
              
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-md transition-all duration-200 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Process All Messages
              </button>
            </div>
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

          {/* Document Feed */}
          <DocumentFeed
            onDocumentEdit={handleEditDocument}
            onDocumentDelete={handleDeleteDocument}
            onDocumentEnhance={handleEnhanceDocument}
            onDocumentGenerateFAQs={handleGenerateFAQs}
            onBulkAction={handleBulkAction}
          />
        </main>

        {/* Process All Modal */}
        <ProcessAllModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleProcessSuccess}
        />
      </div>
    </>
  )
}

export default DocumentsPage 