/**
 * Salesforce OAuth Error Page
 * Displays error messages when Salesforce OAuth flow fails
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function SalesforceErrorPage(): JSX.Element {
  const router = useRouter()
  const [errorInfo, setErrorInfo] = useState<{
    error: string
    message: string
  } | null>(null)

  // Extract error information from URL parameters
  useEffect(() => {
    const { error, message } = router.query
    
    if (error && message) {
      setErrorInfo({
        error: error as string,
        message: message as string
      })
    }
  }, [router.query])

  const handleRetry = (): void => {
    router.push('/salesforce')
  }

  return (
    <>
      <Head>
        <title>Salesforce Connection Error - Slack Listen Bot</title>
        <meta 
          name="description" 
          content="Error occurred during Salesforce OAuth connection process." 
        />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
          {/* Error Icon */}
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full">
            <svg 
              className="w-8 h-8 text-red-600 dark:text-red-400" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.582 16.5c-.77.833.192 2.5 1.732 2.5z" 
              />
            </svg>
          </div>

          {/* Error Title */}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">
            Connection Failed
          </h1>

          {/* Error Message */}
          <div className="text-center mb-6">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              We encountered an issue while connecting to Salesforce:
            </p>
            
            {errorInfo && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-left">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                  Error Details:
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 font-mono break-words">
                  {errorInfo.message}
                </p>
                {errorInfo.error !== 'oauth_callback_failed' && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Error Code: {errorInfo.error}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Common Solutions */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Common Solutions:
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                Check that your Salesforce Connected App is configured correctly
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                Verify your environment variables are set properly
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                Ensure you have the necessary permissions in Salesforce
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                Try clearing your browser cache and cookies
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleRetry}
              className="flex-1 bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
            
            <Link
              href="/salesforce/setup-guide"
              className="flex-1 bg-gray-600 dark:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium text-center hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
            >
              Setup Guide
            </Link>
          </div>

          {/* Back to Dashboard */}
          <div className="mt-4 text-center">
            <Link
              href="/"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </>
  )
} 