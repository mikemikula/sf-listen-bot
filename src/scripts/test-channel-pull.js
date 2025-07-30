/**
 * Test Script for Slack Channel Pull Feature
 * 
 * This script demonstrates how to use the Channel Pull API endpoints
 * Run with: node src/scripts/test-channel-pull.js
 * 
 * Prerequisites:
 * - App must be running on localhost:3000
 * - Slack bot token must be configured
 * - At least one channel must be available
 */

const baseUrl = 'http://localhost:3000/api/slack/channel-pull'

// Helper function to make API requests
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })
    
    const data = await response.json()
    
    console.log(`📡 ${options.method || 'GET'} ${url}`)
    console.log(`📊 Status: ${response.status}`)
    console.log(`📋 Response:`, JSON.stringify(data, null, 2))
    console.log('---')
    
    return { response, data }
  } catch (error) {
    console.error(`❌ Error making request to ${url}:`, error.message)
    return { error }
  }
}

// Wait function for delays
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function demonstrateChannelPull() {
  console.log('🚀 Starting Channel Pull API Demonstration\n')
  
  try {
    // Step 1: List available channels
    console.log('📋 Step 1: Listing available channels')
    const { data: channelsData, error: channelsError } = await apiRequest(
      `${baseUrl}?action=list-channels`
    )
    
    if (channelsError || !channelsData.success) {
      console.error('❌ Failed to list channels:', channelsData?.error || channelsError)
      return
    }
    
    const channels = channelsData.data.channels
    if (channels.length === 0) {
      console.error('❌ No channels available. Make sure your Slack bot has access to channels.')
      return
    }
    
    console.log(`✅ Found ${channels.length} channels`)
    
    // Step 2: Select a channel for testing (use the first available)
    const testChannel = channels[0]
    console.log(`\n🎯 Step 2: Selected channel for testing: #${testChannel.name} (${testChannel.id})`)
    
    // Step 3: Start a channel pull
    console.log('\n🔄 Step 3: Starting channel pull')
    const pullConfig = {
      channelId: testChannel.id,
      channelName: testChannel.name,
      includeThreads: true,
      batchSize: 50, // Small batch for testing
      delayBetweenRequests: 2000, // 2 second delay to be gentle
      // Optional: Add date range for testing
      // startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
      // endDate: new Date().toISOString()
    }
    
    const { data: pullData, error: pullError } = await apiRequest(baseUrl, {
      method: 'POST',
      body: JSON.stringify(pullConfig)
    })
    
    if (pullError || !pullData.success) {
      console.error('❌ Failed to start channel pull:', pullData?.error || pullError)
      return
    }
    
    const progressId = pullData.data.progress.id
    console.log(`✅ Channel pull started with ID: ${progressId}`)
    console.log(`⏱️ Estimated time: ${Math.round(pullData.data.estimatedTimeMs / 1000)} seconds`)
    
    // Step 4: Monitor progress
    console.log('\n📊 Step 4: Monitoring progress (will check for 2 minutes)')
    let attempts = 0
    const maxAttempts = 24 // 2 minutes with 5-second intervals
    
    while (attempts < maxAttempts) {
      await wait(5000) // Wait 5 seconds between checks
      attempts++
      
      const { data: progressData, error: progressError } = await apiRequest(
        `${baseUrl}?progressId=${progressId}`
      )
      
      if (progressError || !progressData.success) {
        console.error('❌ Failed to get progress:', progressData?.error || progressError)
        break
      }
      
      const progress = progressData.data.progress
      console.log(`📈 Progress: ${progress.progress}% | Status: ${progress.status} | Messages: ${progress.processedMessages}/${progress.totalMessages}`)
      
      if (progress.status === 'COMPLETED') {
        console.log('\n🎉 Channel pull completed successfully!')
        console.log('📊 Final Statistics:')
        console.log(`   • Total Messages: ${progress.totalMessages}`)
        console.log(`   • Processed Messages: ${progress.processedMessages}`)
        console.log(`   • Threads Processed: ${progress.threadsProcessed}`)
        console.log(`   • New Messages: ${progress.stats.newMessages}`)
        console.log(`   • Duplicate Messages: ${progress.stats.duplicateMessages}`)
        console.log(`   • Thread Replies: ${progress.stats.threadRepliesFetched}`)
        console.log(`   • Documents Created: ${progress.stats.documentsCreated}`)
        console.log(`   • FAQs Generated: ${progress.stats.faqsGenerated}`)
        console.log(`   • PII Detected: ${progress.stats.piiDetected}`)
        
        const duration = new Date(progress.completedAt) - new Date(progress.startedAt)
        console.log(`   • Duration: ${Math.round(duration / 1000)} seconds`)
        break
      }
      
      if (progress.status === 'FAILED') {
        console.error(`❌ Channel pull failed: ${progress.errorMessage}`)
        break
      }
      
      if (progress.status === 'CANCELLED') {
        console.log('🛑 Channel pull was cancelled')
        break
      }
    }
    
    if (attempts >= maxAttempts) {
      console.log('\n⏰ Monitoring timeout reached. You can continue checking progress in the UI.')
      console.log(`🔗 Visit: http://localhost:3000/slack/channel-pull`)
    }
    
  } catch (error) {
    console.error('❌ Unexpected error during demonstration:', error)
  }
}

// Function to test cancellation
async function testCancellation() {
  console.log('\n🧪 Testing cancellation functionality')
  
  try {
    // List channels
    const { data: channelsData } = await apiRequest(`${baseUrl}?action=list-channels`)
    if (!channelsData.success || channelsData.data.channels.length === 0) {
      console.log('❌ No channels available for cancellation test')
      return
    }
    
    const testChannel = channelsData.data.channels[0]
    
    // Start a pull
    const pullConfig = {
      channelId: testChannel.id,
      channelName: testChannel.name,
      includeThreads: true,
      batchSize: 10,
      delayBetweenRequests: 5000 // Long delay to allow cancellation
    }
    
    const { data: pullData } = await apiRequest(baseUrl, {
      method: 'POST',
      body: JSON.stringify(pullConfig)
    })
    
    if (!pullData.success) {
      console.log('❌ Failed to start pull for cancellation test')
      return
    }
    
    const progressId = pullData.data.progress.id
    console.log(`✅ Started pull ${progressId} for cancellation test`)
    
    // Wait a moment then cancel
    await wait(3000)
    
    const { data: cancelData } = await apiRequest(`${baseUrl}?progressId=${progressId}`, {
      method: 'DELETE'
    })
    
    if (cancelData.success) {
      console.log('✅ Successfully cancelled the pull')
    } else {
      console.log('❌ Failed to cancel pull:', cancelData.error)
    }
    
  } catch (error) {
    console.error('❌ Error during cancellation test:', error)
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔧 Slack Channel Pull Test Script

Usage:
  node src/scripts/test-channel-pull.js [options]

Options:
  --demo          Run full demonstration (default)
  --cancel        Test cancellation functionality
  --list          List available channels only
  --help, -h      Show this help message

Examples:
  node src/scripts/test-channel-pull.js --demo
  node src/scripts/test-channel-pull.js --cancel
  node src/scripts/test-channel-pull.js --list
`)
    return
  }
  
  if (args.includes('--list')) {
    console.log('📋 Listing available channels')
    const { data } = await apiRequest(`${baseUrl}?action=list-channels`)
    if (data.success) {
      console.log(`✅ Found ${data.data.channels.length} channels:`)
      data.data.channels.forEach((channel, index) => {
        console.log(`   ${index + 1}. #${channel.name} (${channel.id})${channel.memberCount ? ` - ${channel.memberCount} members` : ''}`)
      })
    }
    return
  }
  
  if (args.includes('--cancel')) {
    await testCancellation()
    return
  }
  
  // Default: run full demonstration
  await demonstrateChannelPull()
}

// Check if we're running in Node.js environment
if (typeof window === 'undefined') {
  // Import fetch for Node.js (if using Node.js < 18)
  try {
    global.fetch = require('node-fetch')
  } catch (e) {
    // fetch is built-in in Node.js 18+
    if (typeof fetch === 'undefined') {
      console.error('❌ fetch is not available. Please install node-fetch or use Node.js 18+')
      process.exit(1)
    }
  }
  
  // Run the script
  main().catch(error => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
} 