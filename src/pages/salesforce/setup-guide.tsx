/**
 * Salesforce Setup Guide Page
 * Provides step-by-step instructions for setting up the Salesforce integration
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import React, { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { 
  ChevronRight, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  Copy,
  ArrowLeft
} from 'lucide-react'

export default function SalesforceSetupGuide(): JSX.Element {
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const copyToClipboard = async (text: string, label: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(label)
      setTimeout(() => setCopiedText(null), 2000)
    } catch (error) {
      console.error('Failed to copy text:', error)
    }
  }

  const steps = [
    {
      id: 1,
      title: "Create Connected App in Salesforce",
      description: "Set up OAuth authentication in your Salesforce org",
      substeps: [
        "Navigate to Setup → App Manager in Salesforce",
                 "Click &apos;New Connected App&apos;",
        "Fill in basic information (name, email, description)",
        "Enable OAuth Settings",
        "Set callback URL to your domain + /api/salesforce/oauth/callback",
        "Select required OAuth scopes",
        "Save and note the Consumer Key and Consumer Secret"
      ]
    },
    {
      id: 2,
      title: "Create Custom Objects",
      description: "Set up the Salesforce objects to store your data",
      substeps: [
        "Create Slack_Document__c custom object",
        "Create Slack_FAQ__c custom object",
        "Create Slack_Message__c custom object (optional)",
        "Add all required custom fields as specified in the guide",
        "Set appropriate permissions on objects"
      ]
    },
    {
      id: 3,
      title: "Configure Environment Variables",
      description: "Add Salesforce credentials to your application",
      substeps: [
        "Copy your Consumer Key and Consumer Secret from Salesforce",
        "Add environment variables to your .env.local file",
        "Configure callback URL for your domain",
        "Enable Salesforce integration"
      ]
    },
    {
      id: 4,
      title: "Test the Integration",
      description: "Verify everything is working correctly",
      substeps: [
        "Navigate to the Salesforce integration page",
        "Click 'Connect to Salesforce'",
        "Complete the OAuth authorization flow",
        "Test the connection",
        "Run a test sync operation"
      ]
    }
  ]

  const environmentVariables = `# Salesforce Connected App OAuth Configuration
SALESFORCE_CLIENT_ID="your_connected_app_consumer_key"
SALESFORCE_CLIENT_SECRET="your_connected_app_consumer_secret"
SALESFORCE_REDIRECT_URI="https://your-domain.com/api/salesforce/oauth/callback"
SALESFORCE_LOGIN_URL="https://login.salesforce.com"
SALESFORCE_API_VERSION="v59.0"

# Salesforce Integration Settings
SALESFORCE_ENABLED="true"
SALESFORCE_SYNC_DOCUMENTS="true"
SALESFORCE_SYNC_FAQS="true"
SALESFORCE_SYNC_MESSAGES="false"`

  const callbackUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/salesforce/oauth/callback`

  return (
    <>
      <Head>
        <title>Salesforce Setup Guide - Slack Listen Bot</title>
        <meta 
          name="description" 
          content="Step-by-step guide to set up Salesforce Connected App integration with OAuth authentication." 
        />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link
                  href="/salesforce"
                  className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Integration
                </Link>
              </div>
              
              <nav className="flex space-x-4">
                <a 
                  href="https://help.salesforce.com/s/articleView?id=sf.connected_app_overview.htm" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                >
                  Salesforce Docs
                  <ExternalLink className="w-4 h-4 ml-1" />
                </a>
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Introduction */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Salesforce Integration Setup Guide
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
              Follow these steps to connect your Salesforce organization and start syncing 
              your Slack conversations, documents, and FAQs.
            </p>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-blue-400 dark:text-blue-300 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Before You Start
                  </h3>
                  <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                    <p>You&apos;ll need System Administrator permissions in Salesforce to complete this setup.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-8">
            {steps.map((step, index) => (
              <div key={step.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-medium">
                      {step.id}
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {step.description}
                    </p>
                    
                    <ul className="space-y-2">
                      {step.substeps.map((substep, substepIndex) => (
                        <li key={substepIndex} className="flex items-start">
                          <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 mr-2 flex-shrink-0" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{substep}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Step-specific content */}
                    {step.id === 1 && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          OAuth Callback URL
                        </h4>
                        <div className="flex items-center space-x-2">
                          <code className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-white">
                            {callbackUrl}
                          </code>
                          <button
                            onClick={() => copyToClipboard(callbackUrl, 'callback')}
                            className="flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-600 rounded transition-colors"
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            {copiedText === 'callback' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Use this exact URL in your Connected App&apos;s Callback URL field
                        </p>
                      </div>
                    )}

                    {step.id === 3 && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Environment Variables (.env.local)
                        </h4>
                        <div className="relative">
                          <pre className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-3 overflow-x-auto">
                            <code className="text-gray-900 dark:text-white">{environmentVariables}</code>
                          </pre>
                          <button
                            onClick={() => copyToClipboard(environmentVariables, 'env')}
                            className="absolute top-2 right-2 flex items-center px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            {copiedText === 'env' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Replace the placeholder values with your actual Connected App credentials
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Custom Objects Guide */}
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Custom Objects Reference
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You&apos;ll need to create these custom objects in Salesforce to store your synced data:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Slack_Document__c</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Stores processed documents from Slack conversations</p>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <div>• Name (Auto Number)</div>
                  <div>• Description__c (Long Text)</div>
                  <div>• Category__c (Text)</div>
                  <div>• Status__c (Picklist)</div>
                  <div>• External_Id__c (External ID)</div>
                </div>
              </div>
              
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Slack_FAQ__c</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Stores FAQ entries generated from documents</p>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <div>• Name (Auto Number)</div>
                  <div>• Question__c (Long Text)</div>
                  <div>• Answer__c (Long Text)</div>
                  <div>• Category__c (Text)</div>
                  <div>• External_Id__c (External ID)</div>
                </div>
              </div>
              
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Slack_Message__c</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Stores individual Slack messages (optional)</p>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <div>• Name (Auto Number)</div>
                  <div>• Text__c (Long Text)</div>
                  <div>• Username__c (Text)</div>
                  <div>• Channel__c (Text)</div>
                  <div>• External_Id__c (External ID)</div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                📋 For complete field specifications and setup instructions, refer to the 
                <code className="mx-1 px-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-100 rounded">SALESFORCE_INTEGRATION_GUIDE.md</code> 
                file in your project root.
              </p>
            </div>
          </div>

          {/* Next Steps */}
          <div className="mt-8 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-400 dark:text-green-300 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                  Ready to Connect?
                </h3>
                <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                  <p className="mb-3">
                    Once you&apos;ve completed all the steps above, you&apos;re ready to connect to Salesforce!
                  </p>
                  <Link
                    href="/salesforce"
                    className="inline-flex items-center px-4 py-2 bg-green-600 dark:bg-green-700 text-white text-sm font-medium rounded-md hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                  >
                    Go to Integration Dashboard
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
} 