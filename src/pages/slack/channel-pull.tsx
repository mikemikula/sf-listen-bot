/**
 * Slack Channel Pull Page
 * 
 * Dedicated page for the Slack channel data pull feature
 * Provides a clean interface for users to pull historical data from Slack channels
 * 
 * Features:
 * - Full-screen dashboard layout
 * - Navigation integration
 * - Proper SEO and metadata
 * - Error boundary protection
 */

import { NextPage } from 'next'
import Head from 'next/head'
import { Header } from '@/components/Header'
import ChannelPullDashboard from '@/components/ChannelPullDashboard'
import { ErrorBoundary } from '@/components/ErrorBoundary'

/**
 * Channel Pull Page Component
 */
const ChannelPullPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Slack Channel Pull - SF Listen Bot</title>
        <meta 
          name="description" 
          content="Pull all historical data from Slack channels. Configure date ranges, include threads, and track progress in real-time." 
        />
        <meta name="keywords" content="slack, channel, data, pull, historical, messages, threads" />
        <meta name="robots" content="noindex, nofollow" /> {/* Internal tool */}
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Header Navigation */}
        <Header isConnected={true} />
        
        {/* Main Content */}
        <main className="pt-16"> {/* Offset for fixed header */}
          <ErrorBoundary>
            <ChannelPullDashboard />
          </ErrorBoundary>
        </main>
      </div>
    </>
  )
}

export default ChannelPullPage 