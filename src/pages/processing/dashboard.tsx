/**
 * Analytics Dashboard Page
 * 
 * Purpose: System monitoring and analytics interface
 * Focuses on understanding what's happening in the system through:
 * - Real-time system health monitoring
 * - Performance metrics and statistics
 * - Activity trends and insights
 * 
 * Follows SOC principle by separating analytics from automation control
 */

import React, { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Header } from '@/components/Header'
import { AnalyticsDashboard } from '@/components/processing/AnalyticsDashboard'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Activity, Bug, ExternalLink, Settings, Search } from 'lucide-react'

/**
 * Analytics Dashboard Page Component
 * Provides comprehensive system monitoring and insights
 */
const AnalyticsDashboardPage: React.FC = () => {
  const [showDebug, setShowDebug] = useState(false)
  const router = useRouter()

  /**
   * Navigate to Automation Dashboard
   * Implements proper separation between analytics and automation concerns
   */
  const handleNavigateToAutomation = () => {
    router.push('/processing/automation')
  }

  return (
    <>
      <Head>
        <title>System Analytics - SF Listen Bot</title>
        <meta name="description" content="Real-time system monitoring and performance analytics" />
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Analytics</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Real-time monitoring and performance insights for your document processing system
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <Link
                href="/processing/automation"
                className="flex items-center gap-2 px-4 py-2 text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 border border-purple-300 dark:border-purple-600 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900 transition-colors duration-200"
              >
                <Settings className="w-4 h-4" />
                Automation Control
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

          {/* Error Boundary for Analytics Dashboard */}
          <ErrorBoundary>
            <AnalyticsDashboard 
              onNavigateToAutomation={handleNavigateToAutomation}
            />
          </ErrorBoundary>

          {/* System Resources */}
          <div className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Resources</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/api/health"
                target="_blank"
                className="flex items-center justify-between px-6 py-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-800 transition-colors group"
              >
                <div className="flex items-center">
                  <Activity className="h-6 w-6 text-green-600 mr-3" />
                  <div>
                    <div className="text-sm font-medium text-green-700 dark:text-green-300">Health Check API</div>
                    <div className="text-xs text-green-600 dark:text-green-400">System health status</div>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-green-600 group-hover:text-green-700" />
              </Link>

              <button
                onClick={() => setShowDebug(!showDebug)}
                className="flex items-center justify-between px-6 py-4 bg-orange-50 dark:bg-orange-900 border border-orange-200 dark:border-orange-700 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-800 transition-colors"
              >
                <div className="flex items-center">
                  <Bug className="h-6 w-6 text-orange-600 mr-3" />
                  <div>
                    <div className="text-sm font-medium text-orange-700 dark:text-orange-300">Debug Events</div>
                    <div className="text-xs text-orange-600 dark:text-orange-400">View processing logs</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="mt-8 bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Quick Navigation</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/messages/browse"
                className="flex items-center justify-center px-6 py-4 bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-800 transition-colors duration-200"
              >
                <div className="text-center">
                  <div className="mb-2">
                    <Search className="w-8 h-8 mx-auto text-purple-700 dark:text-purple-300" />
                  </div>
                  <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Browse Messages</div>
                  <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">Manual curation</div>
                </div>
              </Link>

              <Link
                href="/pii/review"
                className="flex items-center justify-center px-6 py-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-800 transition-colors duration-200"
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">🔒</div>
                  <div className="text-sm font-medium text-red-700 dark:text-red-300">PII Review</div>
                  <div className="text-xs text-red-600 dark:text-red-400 mt-1">Privacy monitoring</div>
                </div>
              </Link>

              <Link
                href="/processing/automation"
                className="flex items-center justify-center px-6 py-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors duration-200"
              >
                <div className="text-center">
                  <div className="mb-2">
                    <Settings className="w-8 h-8 mx-auto text-blue-700 dark:text-blue-300" />
                  </div>
                  <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Automation</div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">Control & settings</div>
                </div>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

export default AnalyticsDashboardPage 