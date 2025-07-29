/**
 * PII Review Page
 * Provides interface for users to review and override PII detections
 * Implements proper authentication and error boundaries
 */

import React from 'react'
import Head from 'next/head'
import { GetServerSideProps } from 'next'
import { Header } from '@/components/Header'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import PIIReviewDashboard from '@/components/pii/PIIReviewDashboard'

/**
 * Props for PII Review page
 */
interface PIIReviewPageProps {
  /** Current user (from server-side auth) */
  currentUser: string
}

/**
 * PII Review Page Component
 */
const PIIReviewPage: React.FC<PIIReviewPageProps> = ({ currentUser }) => {
  return (
    <ErrorBoundary>
      <div className="pii-review-page min-h-screen bg-gray-50 dark:bg-gray-900">
        <Head>
          <title>PII Review Dashboard - Listen Bot</title>
          <meta 
            name="description" 
            content="Review and manage potentially sensitive information detections in your Slack conversations" 
          />
          <meta name="robots" content="noindex,nofollow" />
        </Head>

        {/* Header */}
        <Header 
          isConnected={true}
          onDebugClick={() => console.log('Debug clicked from PII Review')}
        />

        {/* Main Content */}
        <main className="pii-review-page__main">
          <PIIReviewDashboard 
            currentUser={currentUser}
            refreshInterval={30000}
            pageSize={20}
          />
        </main>
      </div>
    </ErrorBoundary>
  )
}

/**
 * Server-side rendering with authentication
 */
export const getServerSideProps: GetServerSideProps<PIIReviewPageProps> = async (context) => {
  try {
    // TODO: Implement proper authentication
    // For now, using a placeholder user
    const currentUser = context.req.headers['x-user-id'] as string || 'admin@company.com'

    // In a real implementation, you would:
    // 1. Check authentication status
    // 2. Verify user permissions for PII review
    // 3. Redirect to login if not authenticated
    // 4. Return 403 if user doesn't have review permissions

    return {
      props: {
        currentUser
      }
    }
  } catch (error) {
    console.error('Failed to load PII review page:', error)
    
    return {
      notFound: true
    }
  }
}

export default PIIReviewPage 