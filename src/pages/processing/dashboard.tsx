/**
 * Processing Dashboard Page
 * Real-time system monitoring and management interface for the document processing system
 */

import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Header } from '@/components/Header'
import ProcessingDashboard from '@/components/processing/ProcessingDashboard'
import { useState, useEffect } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { FileText, Bot, Activity, Bug, ExternalLink } from 'lucide-react'

/**
 * Processing Dashboard Page Component
 */
const ProcessingDashboardPage: React.FC = () => {
  const [showDebug, setShowDebug] = useState(false)

  return (
    <>
      <Head>
        <title>Processing Dashboard - SF Listen Bot</title>
        <meta name="description" content="Real-time system monitoring and processing management" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
                    <p className="text-sm text-gray-600">Processed content</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Bot className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900">AI Processing</h3>
                    <p className="text-sm text-gray-600">Automated analysis</p>
                  </div>
                </div>
              </div>
              
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                <Link
                  href="/api/health"
                  target="_blank"
                  className="flex items-center justify-between px-6 py-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors group"
                >
                  <div className="flex items-center">
                    <Activity className="h-6 w-6 text-green-600 mr-3" />
                    <div>
                      <div className="text-sm font-medium text-green-700">Health Check API</div>
                      <div className="text-xs text-green-600">System health status</div>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-green-600 group-hover:text-green-700" />
                </Link>

                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="flex items-center justify-between px-6 py-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                >
                  <div className="flex items-center">
                    <Bug className="h-6 w-6 text-orange-600 mr-3" />
                    <div>
                      <div className="text-sm font-medium text-orange-700">Debug Events</div>
                      <div className="text-xs text-orange-600">View processing logs</div>
                    </div>
                  </div>
                </button>
              </div>
          </div>
        </main>
      </div>
    </>
  )
}

export default ProcessingDashboardPage 