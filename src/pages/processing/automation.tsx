/**
 * Automation Control Page
 * 
 * Purpose: System automation control and job management interface
 * Focuses on controlling how automated processes run through:
 * - Job management and control (active, recent, bulk actions)
 * - Automation rules configuration and scheduling
 * - Processing settings and preferences
 * - Manual job triggers and templates
 * 
 * Follows SOC principle by separating automation control from analytics
 */

import React, { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Header } from '@/components/Header'
import { AutomationDashboard } from '@/components/processing/AutomationDashboard'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Settings, Activity, BarChart3, Zap, Bot } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Automation Control Page Component
 * Provides comprehensive automation control and job management
 */
const AutomationControlPage: React.FC = () => {
  const [showDebug, setShowDebug] = useState(false)
  const router = useRouter()

  /**
   * Navigate to Analytics Dashboard
   * Implements proper separation between automation and analytics concerns
   */
  const handleNavigateToAnalytics = () => {
    router.push('/processing/dashboard')
  }

  /**
   * Handle Processing Triggers
   * Manages manual job initiation and processing requests
   */
  const handleTriggerProcessing = async (type: string, data: any) => {
    // Show loading toast outside try-catch so it's accessible in both blocks
    const loadingToast = toast.loading(
      type === 'faq' ? 'Processing messages and generating FAQs...' : `Starting ${type} processing...`
    )
    
    try {
      console.log('Triggering processing:', type, data)
      
      // Call the appropriate API endpoint based on processing type
      const endpoint = getProcessingEndpoint(type)
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data })
      })

      if (!response.ok) {
        throw new Error(`Failed to trigger ${type} processing`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || `Failed to trigger ${type} processing`)
      }

      // Dismiss loading toast
      toast.dismiss(loadingToast)
      
      // Show success notification with meaningful feedback
      console.log(`Successfully triggered ${type} processing:`, result.data)
      
      // Show beautiful toast notifications based on results
      if (type === 'faq') {
        const { newDocumentsCreated, documentsProcessed, faqsGenerated, errors } = result.data
        
        if (faqsGenerated > 0) {
          toast.success(
            `Generated ${faqsGenerated} FAQs from ${documentsProcessed} documents. Created ${newDocumentsCreated} new documents.`,
            { duration: 4000 }
          )
        } else if (documentsProcessed === 0 && newDocumentsCreated === 0) {
          toast.error(
            'No processing occurred. No unprocessed messages or eligible documents found. Try pulling more Slack messages first.',
            { duration: 6000 }
          )
        } else if (newDocumentsCreated > 0) {
          toast.success(
            `Created ${newDocumentsCreated} documents from messages, but no FAQs generated. Documents may need time to process.`,
            { duration: 5000 }
          )
        } else {
          toast(
            `Job completed: ${documentsProcessed} documents processed, ${faqsGenerated} FAQs generated, ${newDocumentsCreated} documents created`,
            { 
              icon: 'ℹ️',
              duration: 4000 
            }
          )
        }
        
        if (errors && errors.length > 0) {
          toast.error(
            `Some errors occurred: ${errors.slice(0, 2).join(', ')}${errors.length > 2 ? ` and ${errors.length - 2} more` : ''}`,
            { duration: 6000 }
          )
        }
      } else {
        toast.success(`${type} processing completed successfully!`)
      }
      
    } catch (error) {
      // Dismiss loading toast
      toast.dismiss(loadingToast)
      
      console.error(`Failed to trigger ${type} processing:`, error)
      toast.error(
        error instanceof Error ? error.message : 'Unknown error occurred',
        { duration: 5000 }
      )
    }
  }

  /**
   * Get Processing Endpoint
   * Maps processing types to their respective API endpoints
   */
  const getProcessingEndpoint = (type: string): string => {
    switch (type) {
      case 'document':
        return '/api/documents/process-all'
      case 'faq':
        return '/api/faqs/generate-bulk'
      case 'cleanup':
        return '/api/processing/cleanup'
      default:
        return '/api/processing/trigger'
    }
  }

  return (
    <>
      <Head>
        <title>Automation Control - SF Listen Bot</title>
        <meta name="description" content="Automation control and job management for document processing system" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header 
          isConnected={true}
          onDebugClick={() => setShowDebug(!showDebug)}
        />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Automation Control</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage automated processes, job scheduling, and system automation settings
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <Link
                href="/processing/dashboard"
                className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 border border-green-300 dark:border-green-600 rounded-md hover:bg-green-50 dark:hover:bg-green-900 transition-colors duration-200"
              >
                <BarChart3 className="w-4 h-4" />
                View Analytics
              </Link>
              
              <Link
                href="/documents"
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors duration-200"
              >
                View Documents
              </Link>
              
              <Link
                href="/faqs"
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200"
              >
                Manage FAQs
              </Link>
            </div>
          </div>

          {/* Error Boundary for Automation Dashboard */}
          <ErrorBoundary>
            <AutomationDashboard 
              onNavigateToAnalytics={handleNavigateToAnalytics}
              onTriggerProcessing={handleTriggerProcessing}
            />
          </ErrorBoundary>

          {/* Automation Features Overview */}
          <div className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Automation Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg mx-auto mb-3">
                  <Zap className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Smart Rules</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Configure intelligent automation rules that trigger based on events, schedules, or conditions
                </p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg mx-auto mb-3">
                  <Settings className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Job Control</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Monitor, pause, resume, and manage all processing jobs with full control and visibility
                </p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg mx-auto mb-3">
                  <Bot className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">AI Processing</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Leverage AI for automatic document processing, FAQ generation, and content analysis
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions Guide */}
          <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900 dark:to-purple-900 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Getting Started</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">For New Users</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">1.</span>
                    Review your current system settings and job configurations
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">2.</span>
                    Create your first automation rule to process messages automatically
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">3.</span>
                    Test manual job triggers to understand the processing pipeline
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Best Practices</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">•</span>
                    Monitor job performance regularly and adjust concurrency limits
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">•</span>
                    Enable notifications for failed jobs to maintain system health
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">•</span>
                    Schedule cleanup jobs during low-traffic periods
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* System Integration Links */}
          <div className="mt-8 bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">System Integrations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/api/processing/automation/rules"
                target="_blank"
                className="flex items-center justify-between px-6 py-4 bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-800 transition-colors group"
              >
                <div className="flex items-center">
                  <Zap className="h-6 w-6 text-purple-600 mr-3" />
                  <div>
                    <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Automation API</div>
                    <div className="text-xs text-purple-600 dark:text-purple-400">Configure rules programmatically</div>
                  </div>
                </div>
              </Link>

              <Link
                href="/api/processing/jobs/manage"
                target="_blank"
                className="flex items-center justify-between px-6 py-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors group"
              >
                <div className="flex items-center">
                  <Settings className="h-6 w-6 text-blue-600 mr-3" />
                  <div>
                    <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Job Management API</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">Control jobs via API</div>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

export default AutomationControlPage 