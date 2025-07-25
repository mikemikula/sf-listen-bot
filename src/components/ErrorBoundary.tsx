/**
 * ErrorBoundary Component
 * Catches and displays React errors gracefully
 */

import React, { Component, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

/**
 * ErrorBoundary class component for error handling
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  /**
   * Update state when error occurs
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  /**
   * Log error information
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('❌ ErrorBoundary caught an error:', error, errorInfo)
    
    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Send to error reporting service (e.g., Sentry)
      // reportError(error, errorInfo)
    }
  }

  /**
   * Reset error state
   */
  resetError = (): void => {
    this.setState({ hasError: false, error: undefined })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="error-boundary min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-red-600 mb-4">
              <svg 
                className="mx-auto h-12 w-12 mb-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" 
                />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Something went wrong
              </h2>
              <p className="text-gray-600 mb-4">
                We encountered an unexpected error. Please try refreshing the page.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left mt-4 p-3 bg-red-50 rounded border">
                  <summary className="cursor-pointer font-medium text-red-800">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 text-xs text-red-700 whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
            
            <div className="flex space-x-3 justify-center">
              <button
                onClick={this.resetError}
                className="px-4 py-2 bg-slack-blue text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
} 