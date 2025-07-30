/**
 * Automation Help Page
 * 
 * Purpose: Documentation guide showing interface previews with explanations
 * Designed to look like help documentation, not functional interface
 */

import React, { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { 
  ArrowLeft, 
  Zap, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Settings,
  Play,
  Eye,
  BarChart3,
  Calendar,
  HelpCircle,
  Book,
  Info
} from 'lucide-react'

const AutomationHelpPage: React.FC = () => {
  const [showDocumentExample, setShowDocumentExample] = useState(false)
  const [showFAQExample, setShowFAQExample] = useState(false)

  return (
    <>
      <Head>
        <title>Automation Help - SF Listen Bot</title>
        <meta name="description" content="Complete guide to automation features and setup" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header isConnected={true} />
        
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header - Clear documentation styling */}
          <div className="mb-8">
            <Link
              href="/processing/automation"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Automation
            </Link>
            
            <div className="bg-blue-600 text-white rounded-lg p-6 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <Book className="w-8 h-8" />
                <div>
                  <h1 className="text-2xl font-bold">Automation Documentation</h1>
                  <p className="text-blue-100">Learn how to use the automation features</p>
                </div>
              </div>
              <div className="bg-blue-500 rounded p-3 text-sm">
                <strong>📖 This is a help guide.</strong> The interface previews below are for learning - they don&apos;t actually perform actions.
              </div>
            </div>
          </div>

          {/* What is Automation */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                What is Smart Automation?
              </h2>
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Smart automation helps you automatically convert your Slack conversations into organized documents and FAQs. 
              Instead of manually copying messages, the AI does the work for you.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Document Creation</h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Turns Slack conversations into searchable documents. Perfect for preserving important discussions and decisions.
                </p>
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <h3 className="font-medium text-purple-900 dark:text-purple-100 mb-2">FAQ Generation</h3>
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  Creates FAQ entries from your documents. Helps team members find answers to common questions quickly.
                </p>
              </div>
            </div>
          </div>

          {/* Interface Preview Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
            <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 px-6 py-4">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <Info className="w-5 h-5" />
                <span className="font-medium">Interface Preview</span>
                <span className="text-sm text-amber-600 dark:text-amber-400">- For learning purposes only</span>
              </div>
            </div>
            
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                What You&apos;ll See in the Automation Dashboard
              </h2>
              
              {/* Statistics Preview - Clearly labeled as preview */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Statistics Overview:</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 opacity-75 pointer-events-none">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                        <Activity className="w-3 h-3 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-700 dark:text-gray-300">3</div>
                        <div className="text-xs text-gray-500">Active Jobs</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-700 dark:text-gray-300">47</div>
                        <div className="text-xs text-gray-500">Completed Today</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-amber-600 rounded flex items-center justify-center">
                        <Clock className="w-3 h-3 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-700 dark:text-gray-300">2</div>
                        <div className="text-xs text-gray-500">Pending Review</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center">
                        <AlertTriangle className="w-3 h-3 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-700 dark:text-gray-300">1</div>
                        <div className="text-xs text-gray-500">Failed Jobs</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  <strong>What these numbers mean:</strong>
                  <ul className="mt-2 space-y-1 ml-4">
                    <li>• <strong>Active Jobs:</strong> Automation processes currently running</li>
                    <li>• <strong>Completed Today:</strong> Documents/FAQs created in the last 24 hours</li>
                    <li>• <strong>Pending Review:</strong> Items waiting for your review (usually duplicates)</li>
                    <li>• <strong>Failed Jobs:</strong> Processes that encountered errors</li>
                  </ul>
                </div>
              </div>

              {/* Document Processing Section */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Document Processing Controls:</h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 opacity-75">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Activity className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-700 dark:text-gray-300">Document Creation</h4>
                        <p className="text-sm text-gray-500">Turn Slack conversations into organized documents</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-500">Enabled</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <button className="px-3 py-1 bg-gray-400 text-white rounded text-sm cursor-not-allowed" disabled>
                      Disable
                    </button>
                    <button className="px-3 py-1 bg-blue-400 text-white rounded text-sm cursor-not-allowed" disabled>
                      Run Now
                    </button>
                    <button 
                      onClick={() => setShowDocumentExample(!showDocumentExample)}
                      className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                    >
                      {showDocumentExample ? 'Hide Example' : 'Show Advanced Options'}
                    </button>
                  </div>
                  
                  {showDocumentExample && (
                    <div className="border-t border-gray-300 dark:border-gray-600 pt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">When to run</label>
                          <select className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-gray-100 cursor-not-allowed" disabled>
                            <option>Manual - When I click &quot;Run Now&quot;</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Batch size</label>
                          <input type="number" value={25} className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-gray-100 cursor-not-allowed" disabled />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <input type="checkbox" checked disabled className="rounded cursor-not-allowed" />
                          Only process conversations with questions and answers
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <input type="checkbox" disabled className="rounded cursor-not-allowed" />
                          Include thread replies
                        </label>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  <strong>How to use these controls:</strong>
                  <ul className="mt-2 space-y-1 ml-4">
                    <li>• <strong>Enable/Disable:</strong> Turn automation on or off</li>
                    <li>• <strong>Run Now:</strong> Process messages immediately (doesn&apos;t wait for schedule)</li>
                    <li>• <strong>When to run:</strong> Set automatic schedule (hourly, daily) or keep manual</li>
                    <li>• <strong>Batch size:</strong> How many messages to process at once (smaller = higher quality)</li>
                  </ul>
                </div>
              </div>

              {/* FAQ Generation Section */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">FAQ Generation Controls:</h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 opacity-75">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                        <Eye className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-700 dark:text-gray-300">FAQ Generation</h4>
                        <p className="text-sm text-gray-500">Create FAQ entries from your documents</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-500">Enabled</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <button className="px-3 py-1 bg-gray-400 text-white rounded text-sm cursor-not-allowed" disabled>
                      Disable
                    </button>
                    <button className="px-3 py-1 bg-purple-400 text-white rounded text-sm cursor-not-allowed" disabled>
                      Run Now
                    </button>
                    <button 
                      onClick={() => setShowFAQExample(!showFAQExample)}
                      className="px-3 py-1 text-sm text-purple-600 hover:text-purple-800 border border-purple-300 rounded hover:bg-purple-50 transition-colors"
                    >
                      {showFAQExample ? 'Hide Example' : 'Show Advanced Options'}
                    </button>
                  </div>
                  
                  {showFAQExample && (
                    <div className="border-t border-gray-300 dark:border-gray-600 pt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">When to run</label>
                          <select className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-gray-100 cursor-not-allowed" disabled>
                            <option>Daily at 10 AM</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Max FAQs per run</label>
                          <input type="number" value={10} className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-gray-100 cursor-not-allowed" disabled />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <input type="checkbox" checked disabled className="rounded cursor-not-allowed" />
                        Require manual approval before publishing
                      </label>
                    </div>
                  )}
                </div>
                
                <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  <strong>FAQ Generation notes:</strong>
                  <ul className="mt-2 space-y-1 ml-4">
                    <li>• FAQs are created from existing documents, so enable document processing first</li>
                    <li>• FAQ generation typically runs less frequently than document creation</li>
                    <li>• Manual approval lets you review FAQs before they&apos;re published</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Getting Started Guide */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                How to Get Started
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold text-sm">1</span>
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Enable Document Processing</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Go to the automation page and turn on document creation. Start with manual mode to test it out.
                </p>
              </div>
              
              <div className="text-center bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold text-sm">2</span>
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Click &quot;Run Now&quot;</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Process some existing messages to see how it works. Review the generated documents.
                </p>
              </div>
              
              <div className="text-center bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold text-sm">3</span>
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Set Up Automation</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Once comfortable, enable automatic scheduling and optionally turn on FAQ generation.
                </p>
              </div>
            </div>
          </div>

          {/* Ready to Start */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold mb-2">Ready to Try It?</h2>
            <p className="mb-4 text-blue-100">
              Now that you understand how automation works, go to the actual automation page to set it up.
            </p>
            <Link
              href="/processing/automation"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              <Zap className="w-4 h-4" />
              Go to Automation
            </Link>
          </div>
        </main>
      </div>
    </>
  )
}

export default AutomationHelpPage 