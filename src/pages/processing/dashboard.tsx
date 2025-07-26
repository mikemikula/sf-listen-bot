/**
 * Processing Dashboard Page
 * Real-time system monitoring and management interface for the document processing system
 */

import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Header } from '@/components/Header'
import ProcessingDashboard from '@/components/processing/ProcessingDashboard'

/**
 * Processing Dashboard Page Component
 */
const ProcessingDashboardPage: React.FC = () => {
  return (
    <>
      <Head>
        <title>Processing Dashboard - SF Listen Bot</title>
        <meta name="description" content="Real-time system monitoring and processing management" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header isConnected={true} onDebugClick={() => {}} />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Processing Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Real-time monitoring of document processing and FAQ generation
              </p>
            </div>
            
            <div className="flex items-center gap-4">
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

          {/* Processing Dashboard Component */}
          <ProcessingDashboard />

          {/* Quick Actions Section */}
          <div className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/documents?action=create"
                className="flex items-center justify-center px-6 py-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors duration-200"
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">📄</div>
                  <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Create Document</div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">Process Slack messages</div>
                </div>
              </Link>
              
              <Link
                href="/faqs?action=generate"
                className="flex items-center justify-center px-6 py-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-800 transition-colors duration-200"
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">🤖</div>
                  <div className="text-sm font-medium text-green-700 dark:text-green-300">Generate FAQs</div>
                  <div className="text-xs text-green-600 dark:text-green-400 mt-1">AI-powered FAQ creation</div>
                </div>
              </Link>
              
              <Link
                href="/messages/browse"
                className="flex items-center justify-center px-6 py-4 bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-800 transition-colors duration-200"
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">🔍</div>
                  <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Browse Messages</div>
                  <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">Manual curation</div>
                </div>
              </Link>
            </div>
          </div>

          {/* System Health Links */}
          <div className="mt-8 bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">System Resources</h3>
            <div className="flex flex-wrap gap-4">
              <a
                href="/api/health"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                🩺 Health Check API
              </a>
              
              <Link
                href="/api/debug"
                className="inline-flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                🐛 Debug Events
              </Link>
              
              <Link
                href="/"
                className="inline-flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                📧 Back to Messages
              </Link>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

export default ProcessingDashboardPage 