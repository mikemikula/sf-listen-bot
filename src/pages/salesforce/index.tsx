/**
 * Salesforce Integration Page
 * Main page for managing Salesforce Connected App integration
 * 
 * Features:
 * - Connect/disconnect from Salesforce
 * - Configure sync settings
 * - Monitor sync operations
 * - View connection status and API usage
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react'
import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { SalesforceIntegrationDashboard } from '@/components/salesforce'

interface SalesforcePageProps {
  salesforceEnabled: boolean
}

export default function SalesforcePage({ salesforceEnabled }: SalesforcePageProps): JSX.Element {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Check for error parameters in URL
  useEffect(() => {
    const { error, message } = router.query
    
    if (error && message) {
      setErrorMessage(message as string)
      
      // Clean up URL parameters after showing error
      const cleanUrl = router.asPath.split('?')[0]
      router.replace(cleanUrl, undefined, { shallow: true })
    }
  }, [router])

  // Auto-dismiss error message after 10 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null)
      }, 10000)
      
      return () => clearTimeout(timer)
    }
  }, [errorMessage])

  return (
    <>
      <Head>
        <title>Salesforce Integration - Slack Listen Bot</title>
        <meta 
          name="description" 
          content="Connect and sync your Slack conversations, documents, and FAQs with Salesforce using OAuth Connected App integration." 
        />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Salesforce Integration
                </h1>
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm font-medium rounded-full">
                  OAuth Connected App
                </span>
              </div>
              
              <nav className="flex space-x-4">
                <Link 
                  href="/" 
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  ← Back to Dashboard
                </Link>
                <Link 
                  href="/processing/dashboard" 
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Processing
                </Link>
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400 dark:text-red-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                      Connection Failed
                    </h3>
                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                      <p>{errorMessage}</p>
                    </div>
                    <div className="mt-3">
                      <button
                        onClick={() => setErrorMessage(null)}
                        className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400 dark:text-blue-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.894A1 1 0 0018 16V3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    About Salesforce Integration
                  </h3>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    <p>
                      Connect your Salesforce organization to automatically sync processed documents, 
                      FAQs, and messages from Slack conversations. This integration uses OAuth 2.0 
                      with Connected Apps for secure authentication.
                    </p>
                  </div>
                  <div className="mt-3">
                    <div className="-ml-2 -mt-2 flex flex-wrap">
                      <a
                        href="https://help.salesforce.com/s/articleView?id=sf.connected_app_overview.htm"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 mt-2 whitespace-nowrap inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
                      >
                        Learn about Connected Apps
                        <svg className="ml-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Integration Dashboard or Setup Message */}
          {salesforceEnabled ? (
            <SalesforceIntegrationDashboard />
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400 dark:text-yellow-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Salesforce Integration Not Enabled
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                    <p className="mb-4">
                      To use the Salesforce integration, you need to enable it in your environment configuration.
                    </p>
                    <div className="bg-white dark:bg-gray-800 border border-yellow-300 dark:border-yellow-600 rounded p-3 mb-4">
                      <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                        Add to your .env.local file:
                      </h4>
                      <code className="block text-xs font-mono text-yellow-900 dark:text-yellow-100 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded">
                        SALESFORCE_ENABLED=true
                      </code>
                    </div>
                    <p className="text-sm">
                      After adding this environment variable, restart your development server and return to this page.
                    </p>
                  </div>
                  <div className="mt-4">
                    <Link
                      href="/salesforce/setup-guide"
                      className="inline-flex items-center px-4 py-2 bg-yellow-600 dark:bg-yellow-700 text-white text-sm font-medium rounded-md hover:bg-yellow-700 dark:hover:bg-yellow-600 transition-colors"
                    >
                      View Complete Setup Guide
                      <svg className="ml-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Help Section */}
          <div className="mt-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Need Help?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Setup Guide
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Follow our comprehensive guide to set up your Salesforce Connected App 
                    and configure the integration.
                  </p>
                  <Link
                    href="/salesforce/setup-guide"
                    className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
                  >
                    View Setup Guide
                    <svg className="ml-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Troubleshooting
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Having issues with the integration? Check our troubleshooting guide 
                    for common problems and solutions.
                  </p>
                  <a
                    href="/salesforce/troubleshooting"
                    className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
                  >
                    Troubleshooting Guide
                    <svg className="ml-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  // Pass server-side configuration to the component
  const salesforceEnabled = process.env.SALESFORCE_ENABLED === 'true'
  
  return {
    props: {
      salesforceEnabled,
    },
  }
} 