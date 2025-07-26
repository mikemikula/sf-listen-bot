/**
 * Individual Document Detail Page
 * Comprehensive view of a single processed document with full traceability,
 * source message display, FAQ management, and editing capabilities
 */

import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Header } from '@/components/Header'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { DocumentDisplay, MessageDisplay, FAQDisplay, ApiResponse } from '@/types'
import { logger } from '@/lib/logger'
import DuplicateReviewModal from '@/components/documents/DuplicateReviewModal'

/**
 * Document metadata component
 */
interface DocumentMetadataProps {
  document: DocumentDisplay
  onEdit: (data: any) => void
  onDelete: () => void
  editing: boolean
  setEditing: (editing: boolean) => void
}

const DocumentMetadata: React.FC<DocumentMetadataProps> = ({
  document,
  onEdit,
  onDelete,
  editing,
  setEditing
}) => {
  const [title, setTitle] = useState(document.title)
  const [description, setDescription] = useState(document.description)
  const [category, setCategory] = useState(document.category)

  const handleSave = () => {
    onEdit({
      title: title.trim(),
      description: description.trim(),
      category: category.trim()
    })
    setEditing(false)
  }

  const handleCancel = () => {
    setTitle(document.title)
    setDescription(document.description)
    setCategory(document.category)
    setEditing(false)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Document Details</h2>
        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={onDelete}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-800 dark:text-red-400 border border-red-300 dark:border-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900 transition-colors"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {editing ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Support">Support</option>
                <option value="Technical">Technical</option>
                <option value="General">General</option>
                <option value="Documentation">Documentation</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{document.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{document.description}</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Category</div>
                <div className="font-medium text-gray-900 dark:text-white">{document.category}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Status</div>
                <div className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  document.status === 'COMPLETE' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : document.status === 'PROCESSING'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                }`}>
                  {document.status}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Confidence</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {Math.round(document.confidenceScore * 100)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Created</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {new Date(document.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Source messages component - now uses AI-powered conversation analysis
 */
interface SourceMessagesProps {
  messages: MessageDisplay[]
  conversationAnalysis: ConversationAnalysis | null
  onRemoveMessage: (messageId: string) => void
  onAddMessages: () => void
}

interface ConversationMessage {
  id: string
  text: string
  username: string
  timestamp: string
  channel?: string
}

// Define the conversation analysis type structure
interface ConversationAnalysis {
  patterns: Array<{
    type: 'qa_pair' | 'question_only' | 'answer_only' | 'context' | 'greeting'
    messageIds: string[]
    confidence: number
    reasoning: string
    topics: string[]
  }>
  overallTopics: string[]
  conversationFlow: string
  faqPotential: number
}

const SourceMessages: React.FC<SourceMessagesProps> = ({
  messages,
  conversationAnalysis,
  onRemoveMessage,
  onAddMessages
}) => {
  
  // Create message lookup for efficient access
  const messageMap = messages.reduce((map, message) => {
    map[message.id] = message
    return map
  }, {} as Record<string, MessageDisplay>)

  // Use AI analysis if available, otherwise fall back to simple detection
  const getConversationPatterns = () => {
    if (conversationAnalysis && conversationAnalysis.patterns.length > 0) {
      return conversationAnalysis.patterns.map((pattern: any) => ({
        ...pattern,
        id: `ai_${pattern.messageIds.join('_')}`,
        messages: pattern.messageIds.map((id: string) => messageMap[id]).filter(Boolean)
      }))
    }
    
    // Fallback: basic pattern detection (simplified)
    return messages.map(message => ({
      type: 'context' as const,
      id: `basic_${message.id}`,
      messages: [message],
      confidence: 0.5,
      reasoning: 'Basic fallback classification',
      topics: [],
      messageIds: [message.id]
    }))
  }

  const patterns = getConversationPatterns()
  const qaCount = patterns.filter((p: any) => p.type === 'qa_pair').length
  const questionCount = patterns.filter((p: any) => p.type === 'question_only').length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Conversation Messages ({messages.length})
          </h2>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {conversationAnalysis ? (
              <div className="space-y-1">
                <div>
                  {qaCount > 0 && `${qaCount} Q&A pairs found`}
                  {qaCount > 0 && questionCount > 0 && ', '}
                  {questionCount > 0 && `${questionCount} additional questions`}
                  {qaCount === 0 && questionCount === 0 && 'General conversation messages'}
                </div>
                <div className="text-xs">
                  AI Analysis: {conversationAnalysis.conversationFlow}
                  {conversationAnalysis.faqPotential > 0.7 && (
                    <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-xs">
                      High FAQ Potential ({Math.round(conversationAnalysis.faqPotential * 100)}%)
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {conversationAnalysis?.overallTopics?.map((topic: string) => (
                    <span key={topic} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <span className="text-yellow-600 dark:text-yellow-400">
                ⚠️ Using basic pattern detection (AI analysis failed)
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onAddMessages}
          className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          Add Messages
        </button>
      </div>

      {qaCount > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-green-800 dark:text-green-200">
              {conversationAnalysis ? 'AI-Verified' : 'Detected'} FAQ Potential!
            </span>
            <span className="text-green-700 dark:text-green-300">
              These patterns will create {qaCount} high-quality FAQ{qaCount !== 1 ? 's' : ''}.
            </span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {patterns.map((pattern: any) => {
          if (pattern.type === 'qa_pair') {
            // Q&A pair: should have 2 messages (question and answer)
            const [questionMsg, answerMsg] = pattern.messages
            if (!questionMsg || !answerMsg) return null
            
            return (
              <div key={pattern.id} className="border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/30 dark:bg-blue-900/10">
                {/* Question Message */}
                <div className="p-4 border-b border-blue-200 dark:border-blue-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Q</span>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {questionMsg.username}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {questionMsg.channel}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {questionMsg.timeAgo}
                        </span>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Question
                        </span>
                        {conversationAnalysis && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            {Math.round(pattern.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>
                      <p className="text-gray-900 dark:text-white font-medium">{questionMsg.text}</p>
                      {conversationAnalysis && pattern.reasoning && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                          AI: {pattern.reasoning}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => onRemoveMessage(questionMsg.id)}
                      className="ml-4 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Answer Message */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <span className="text-xs font-bold text-green-600 dark:text-green-400">A</span>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {answerMsg.username}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {answerMsg.channel}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {answerMsg.timeAgo}
                        </span>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Answer
                        </span>
                      </div>
                      <p className="text-gray-900 dark:text-white">{answerMsg.text}</p>
                    </div>
                    <button
                      onClick={() => onRemoveMessage(answerMsg.id)}
                      className="ml-4 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          } else if (pattern.type === 'question_only') {
            const message = pattern.messages[0]
            if (!message) return null
            
            return (
              <div key={pattern.id} className="border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50/30 dark:bg-yellow-900/10 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                        <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">?</span>
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {message.username}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {message.channel}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {message.timeAgo}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        Unanswered Question
                      </span>
                      {conversationAnalysis && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          {Math.round(pattern.confidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                    <p className="text-gray-900 dark:text-white">{message.text}</p>
                    {conversationAnalysis && pattern.reasoning && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                        AI: {pattern.reasoning}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveMessage(message.id)}
                    className="ml-4 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          } else {
            // Answer only, context, or greeting messages
            const message = pattern.messages[0]
            if (!message) return null
            
            const getDisplayInfo = (type: string) => {
              switch (type) {
                case 'answer_only':
                  return { label: 'Standalone Answer', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' }
                case 'greeting':
                  return { label: 'Greeting', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' }
                default:
                  return { label: 'Context', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' }
              }
            }
            
            const displayInfo = getDisplayInfo(pattern.type)
            
            return (
              <div key={pattern.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-500 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {message.username}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {message.channel}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {message.timeAgo}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${displayInfo.color}`}>
                        {displayInfo.label}
                      </span>
                      {conversationAnalysis && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          {Math.round(pattern.confidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                    <p className="text-gray-900 dark:text-white">{message.text}</p>
                    {conversationAnalysis && pattern.reasoning && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                        AI: {pattern.reasoning}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveMessage(message.id)}
                    className="ml-4 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          }
        })}

        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-500 dark:text-gray-400 mb-4">
              ⚠️ No source messages found for this document.
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-500 mb-4">
              This document was created but the conversation messages aren&apos;t linked properly.
              This might be a database relationship issue.
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors mr-2"
            >
              🔄 Reload Page
            </button>
            <button
              onClick={onAddMessages}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              ➕ Add Messages
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Generated FAQs component
 */
interface GeneratedFAQsProps {
  faqs: FAQDisplay[]
  onGenerateFAQs: () => void
  onDeleteFAQ: (faqId: string) => void
}

const GeneratedFAQs: React.FC<GeneratedFAQsProps> = ({
  faqs,
  onGenerateFAQs,
  onDeleteFAQ
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Generated FAQs ({faqs.length})
        </h2>
        <button
          onClick={onGenerateFAQs}
          className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
        >
          Generate FAQs
        </button>
      </div>

      <div className="space-y-4">
        {faqs.map((faq) => (
          <div
            key={faq.id}
            className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {faq.question}
                  </h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    faq.status === 'APPROVED'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : faq.status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {faq.status}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {Math.round(faq.confidenceScore * 100)}% confidence
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-2">{faq.answer}</p>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Category: {faq.category}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Link
                  href={`/faqs?highlight=${faq.id}`}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Link>
                <button
                  onClick={() => onDeleteFAQ(faq.id)}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}

        {faqs.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No FAQs generated yet. Click &quot;Generate FAQs&quot; to create FAQs from this document.
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Main Document Detail Page
 */
export default function DocumentDetailPage(): JSX.Element {
  const router = useRouter()
  const { id } = router.query

  const [document, setDocument] = useState<DocumentDisplay | null>(null)
  const [messages, setMessages] = useState<MessageDisplay[]>([])
  const [faqs, setFaqs] = useState<FAQDisplay[]>([])
  const [conversationAnalysis, setConversationAnalysis] = useState<ConversationAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)

  /**
   * Show notification temporarily
   */
  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification(message)
    setTimeout(() => setNotification(null), 5000)
  }, [])

  /**
   * Fetch document details including pre-computed conversation analysis
   */
  const fetchDocument = useCallback(async () => {
    if (!id) return

    try {
      setLoading(true)
      const response = await fetch(`/api/documents/${id}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`)
      }

      const result: ApiResponse<DocumentDisplay> = await response.json()
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Document not found')
      }

      logger.info('Document fetched successfully:', { documentId: id, title: result.data.title })
      
      setDocument(result.data)
      setMessages(result.data.messages || [])
      setFaqs(result.data.faqs || [])
      
      // Use pre-computed conversation analysis from database
      if (result.data.conversationAnalysis) {
        setConversationAnalysis(result.data.conversationAnalysis as ConversationAnalysis)
        logger.info('Using pre-computed conversation analysis:', { 
          patterns: result.data.conversationAnalysis.patterns?.length || 0 
        })
      } else {
        logger.warn('No conversation analysis found for document - this document may have been created before AI analysis was implemented')
        setConversationAnalysis(null)
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      logger.error('Failed to fetch document:', { error: errorMessage, documentId: id })
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [id])

  // Fetch document on mount and when ID changes
  useEffect(() => {
    fetchDocument()
  }, [fetchDocument])

  /**
   * Handle document editing
   */
  const handleEditDocument = useCallback(async (data: any) => {
    if (!document) return

    try {
      setProcessing(true)

      const response = await fetch(`/api/documents/${document.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update document')
      }

      setDocument(result.data)
      showNotification('success', 'Document updated successfully!')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update document'
      showNotification('error', errorMessage)
      console.error('Failed to update document:', error)
    } finally {
      setProcessing(false)
    }
  }, [document, showNotification])

  /**
   * Handle document deletion
   */
  const handleDeleteDocument = useCallback(async () => {
    if (!document) return
    
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return
    }

    try {
      setProcessing(true)

      const response = await fetch(`/api/documents/${document.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete document')
      }

      showNotification('success', 'Document deleted successfully!')
      setTimeout(() => {
        router.push('/documents')
      }, 1000)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete document'
      showNotification('error', errorMessage)
      console.error('Failed to delete document:', error)
    } finally {
      setProcessing(false)
    }
  }, [document, showNotification, router])

  // State for duplicate review modal
  const [showDuplicateModal, setShowDuplicateModal] = React.useState(false)
  const [potentialDuplicates, setPotentialDuplicates] = React.useState<any[]>([])

  /**
   * Handle FAQ generation with duplicate checking
   */
  const handleGenerateFAQs = useCallback(async () => {
    if (!document) return

    try {
      setProcessing(true)
      showNotification('success', 'Checking for potential duplicates...')

      // First, check for potential duplicates
      const duplicateCheckResponse = await fetch('/api/faqs/generate-with-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: document.id,
          userId: 'system'
        }),
      })

      const duplicateResult = await duplicateCheckResponse.json()

      if (!duplicateCheckResponse.ok || !duplicateResult.success) {
        throw new Error(duplicateResult.error || 'Failed to check for duplicates')
      }

      // If there are potential duplicates, show the review modal
      if (duplicateResult.data?.potentialDuplicates && duplicateResult.data.potentialDuplicates.length > 0) {
        setPotentialDuplicates(duplicateResult.data.potentialDuplicates)
        setShowDuplicateModal(true)
        setProcessing(false) // Stop processing, wait for user decision
        return
      }

      // No duplicates found, proceed with normal FAQ generation
      showNotification('success', 'Generating FAQs from your Q&A pairs...')

      const response = await fetch(`/api/faqs/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: document.id,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to generate FAQs')
      }

      // Show success message
      showNotification('success', 'Successfully generated FAQs! 🎉')
      
      // Refresh the document data to show new FAQs
      await fetchDocument()
      
      // Always scroll to FAQs section after generation
      setTimeout(() => {
        const faqSection = window.document.getElementById('generated-faqs-section')
        if (faqSection) {
          faqSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 500)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate FAQs'
      logger.error('FAQ generation failed:', err)
      showNotification('error', errorMessage)
    } finally {
      setProcessing(false)
    }
  }, [document, fetchDocument, showNotification])

  /**
   * Handle duplicate review decisions
   */
  const handleDuplicateDecisions = useCallback(async (decisions: Array<{
    candidateIndex: number
    action: 'skip' | 'create' | 'enhance'
    targetFAQId?: string
  }>) => {
    try {
      setProcessing(true)
      setShowDuplicateModal(false)
      showNotification('success', 'Processing your decisions...')

      // TODO: Implement API endpoint to handle user decisions
      // For now, we'll just proceed with normal FAQ generation for 'create' actions
      const createActions = decisions.filter(d => d.action === 'create')
      
      if (createActions.length > 0 && document) {
        const response = await fetch(`/api/faqs/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId: document.id,
            skipDuplicateCheck: true // Skip duplicate check since user already reviewed
          }),
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to generate FAQs')
        }

        showNotification('success', 'Successfully processed decisions and generated FAQs! 🎉')
        
        await fetchDocument()
        
        setTimeout(() => {
          const faqSection = window.document.getElementById('generated-faqs-section')
          if (faqSection) {
            faqSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }, 500)
      } else {
        showNotification('success', 'All FAQ candidates were skipped or enhanced existing FAQs.')
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process decisions'
      logger.error('Duplicate decision processing failed:', err)
      showNotification('error', errorMessage)
    } finally {
      setProcessing(false)
    }
  }, [document, fetchDocument, showNotification])

  /**
   * Handle FAQ deletion
   */
  const handleDeleteFAQ = useCallback(async (faqId: string) => {
    try {
      setProcessing(true)

      const response = await fetch('/api/faqs', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: faqId }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete FAQ')
      }

      showNotification('success', 'FAQ deleted successfully!')
      fetchDocument() // Refresh to update FAQ list

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete FAQ'
      showNotification('error', errorMessage)
      console.error('Failed to delete FAQ:', error)
    } finally {
      setProcessing(false)
    }
  }, [showNotification, fetchDocument])

  // Placeholder functions for features to be implemented
  const handleRemoveMessage = (messageId: string) => {
    showNotification('error', 'Message removal not implemented yet')
  }

  const handleAddMessages = () => {
    showNotification('error', 'Add messages feature not implemented yet')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header isConnected={true} onDebugClick={() => {}} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </main>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header isConnected={true} onDebugClick={() => {}} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              Document Not Found
            </h2>
            <p className="text-red-700 dark:text-red-300">
              {error || 'The requested document could not be found.'}
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header isConnected={true} onDebugClick={() => {}} />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-8">
          <Link href="/documents" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            Documents
          </Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
          </svg>
          <span className="text-gray-900 dark:text-white font-medium">{document.title}</span>
        </nav>

        <div className="space-y-8">
          {/* Document Header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {document.title}
                  </h1>
                  <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed">
                    {document.description}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-6">
                  <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    Edit
                  </button>
                  <button className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    Delete
                  </button>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{messages.length}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Messages</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {conversationAnalysis?.patterns?.filter(p => p.type === 'qa_pair').length || 0}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Q&A Pairs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {document.category}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Category</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {conversationAnalysis?.patterns?.filter(p => p.type === 'qa_pair').length || 0 > 0 ? 'Ready' : 'Needs More'}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">FAQ Status</div>
                </div>
              </div>

              {/* Topics */}
              {conversationAnalysis?.overallTopics && conversationAnalysis.overallTopics.length > 0 && (
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700 mt-6">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Topics</div>
                  <div className="flex flex-wrap gap-2">
                    {conversationAnalysis.overallTopics.map((topic: string) => (
                      <span
                        key={topic}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Generate FAQs</h3>
                  <p className="text-green-100 text-sm">
                    Ready to create {conversationAnalysis?.patterns?.filter(p => p.type === 'qa_pair').length || 0} high-quality FAQs
                  </p>
                </div>
                <button 
                  onClick={handleGenerateFAQs}
                  disabled={processing}
                  className="bg-white text-green-600 px-4 py-2 rounded-lg font-medium hover:bg-green-50 transition-colors disabled:opacity-50"
                >
                  {processing ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Add Messages</h3>
                  <p className="text-blue-100 text-sm">
                    Expand this document with more conversations
                  </p>
                </div>
                <button 
                  onClick={handleAddMessages}
                  className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Q&A Pairs Preview */}
          <QAPairsPreview 
            messages={messages}
            conversationAnalysis={conversationAnalysis}
            onRemoveMessage={handleRemoveMessage}
          />

          {/* All Messages Overview */}
          <AllMessagesOverview 
            messages={messages}
            conversationAnalysis={conversationAnalysis}
          />

          {/* Generated FAQs */}
          <div id="generated-faqs-section">
            <GeneratedFAQsSection 
              faqs={faqs}
              onGenerateFAQs={handleGenerateFAQs}
              isProcessing={processing}
            />
          </div>
        </div>

        {/* Success/Error Notifications */}
        {notification && (
          <div className={`fixed bottom-4 right-4 px-6 py-4 rounded-lg shadow-lg text-white font-medium max-w-md ${
            notification.includes('error') || notification.includes('Failed') 
              ? 'bg-red-500' 
              : 'bg-green-500'
          }`}>
            <div className="flex items-center gap-2">
              {notification.includes('error') || notification.includes('Failed') ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              )}
              <span>{notification}</span>
            </div>
          </div>
        )}

        {/* Duplicate Review Modal */}
        <DuplicateReviewModal
          isOpen={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          duplicates={potentialDuplicates}
          onResolve={handleDuplicateDecisions}
        />
      </main>
    </div>
  )
}

/**
 * Q&A Pairs Preview Component - Shows the actual conversation value
 */
interface QAPairsPreviewProps {
  messages: MessageDisplay[]
  conversationAnalysis: ConversationAnalysis | null
  onRemoveMessage: (messageId: string) => void
}

const QAPairsPreview: React.FC<QAPairsPreviewProps> = ({
  messages,
  conversationAnalysis,
  onRemoveMessage
}) => {
  const [showAll, setShowAll] = useState(false)

  const messageMap = messages.reduce((map, message) => {
    map[message.id] = message
    return map
  }, {} as Record<string, MessageDisplay>)

  const getQAPairs = () => {
    if (conversationAnalysis && conversationAnalysis.patterns.length > 0) {
      return conversationAnalysis.patterns
        .filter((pattern: any) => pattern.type === 'qa_pair')
        .map((pattern: any) => ({
          ...pattern,
          id: `ai_${pattern.messageIds.join('_')}`,
          messages: pattern.messageIds.map((id: string) => messageMap[id]).filter(Boolean)
        }))
    }
    return []
  }

  const qaPairs = getQAPairs()
  const displayedPairs = showAll ? qaPairs : qaPairs.slice(0, 3)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Q&A Pairs Found ({qaPairs.length})
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {qaPairs.length > 0 
                ? `These will become ${qaPairs.length} helpful FAQs`
                : 'No clear questions and answers found in this conversation'
              }
            </p>
          </div>
          {qaPairs.length > 0 && (
            <div className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-full text-sm font-medium">
              Ready for FAQs
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        {qaPairs.length > 0 ? (
          <>
            {/* AI Analysis Summary */}
            {conversationAnalysis && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">AI Analysis</h3>
                <p className="text-blue-800 dark:text-blue-300 text-sm leading-relaxed">
                  {conversationAnalysis.conversationFlow}
                </p>
              </div>
            )}

            {/* Q&A Pairs */}
            <div className="space-y-4">
              {displayedPairs.map((pattern: any) => (
                <QAPairCard 
                  key={pattern.id}
                  pattern={pattern}
                  onRemoveMessage={onRemoveMessage}
                />
              ))}
            </div>

            {/* Show More Button */}
            {qaPairs.length > 3 && (
              <div className="text-center mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                >
                  {showAll ? (
                    <>
                      Show Less
                      <svg className="w-4 h-4 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
                      </svg>
                    </>
                  ) : (
                    <>
                      Show {qaPairs.length - 3} More Q&A Pairs
                      <svg className="w-4 h-4 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.476L3 21l2.524-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"></path>
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Q&A Patterns Found</h3>
            <p className="text-gray-600 dark:text-gray-400">
              This conversation doesn&apos;t contain clear question-answer patterns. Try adding more conversational messages.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Clean Q&A Pair Card Component
 */
interface QAPairCardProps {
  pattern: any
  onRemoveMessage: (messageId: string) => void
}

const QAPairCard: React.FC<QAPairCardProps> = ({ pattern, onRemoveMessage }) => {
  const [showReasoning, setShowReasoning] = useState(false)
  
  if (pattern.messages.length < 2) return null

  const question = pattern.messages[0]
  const answer = pattern.messages[1]

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Question */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">Q</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-gray-900 dark:text-white">{question.username}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{question.timeAgo}</span>
            </div>
            <p className="text-gray-900 dark:text-white font-medium">{question.text}</p>
          </div>
        </div>
      </div>

      {/* Answer */}
      <div className="bg-green-50 dark:bg-green-900/20 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-green-600 dark:text-green-400">A</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-gray-900 dark:text-white">{answer.username}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{answer.timeAgo}</span>
              {pattern.topics && pattern.topics.length > 0 && (
                <div className="flex gap-1">
                  {pattern.topics.slice(0, 2).map((topic: string) => (
                    <span key={topic} className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <p className="text-gray-900 dark:text-white">{answer.text}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Generated FAQs Section Component
 */
interface GeneratedFAQsSectionProps {
  faqs: FAQDisplay[]
  onGenerateFAQs: () => void
  isProcessing: boolean
}

const GeneratedFAQsSection: React.FC<GeneratedFAQsSectionProps> = ({
  faqs,
  onGenerateFAQs,
  isProcessing
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Generated FAQs ({faqs.length})
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {faqs.length === 0 
                ? 'Click "Generate" above to create FAQs from your Q&A pairs'
                : 'Your generated frequently asked questions from the conversation'
              }
            </p>
          </div>
          {faqs.length === 0 && !isProcessing && (
            <button
              onClick={onGenerateFAQs}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              Generate FAQs
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {isProcessing ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
              <span className="text-gray-600 dark:text-gray-400">Generating FAQs from your Q&A pairs...</span>
            </div>
          </div>
        ) : faqs.length > 0 ? (
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">{faq.question}</h4>
                <p className="text-gray-700 dark:text-gray-300">{faq.answer}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {faq.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Ready to Generate FAQs</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your Q&A pairs are ready to be converted into helpful FAQs. Click the green &quot;Generate&quot; button above to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * All Messages Overview Component - Shows sampling decisions
 */
interface AllMessagesOverviewProps {
  messages: MessageDisplay[]
  conversationAnalysis: ConversationAnalysis | null
}

const AllMessagesOverview: React.FC<AllMessagesOverviewProps> = ({
  messages,
  conversationAnalysis
}) => {
  const [filter, setFilter] = useState<'questions' | 'answers' | 'ignored' | 'all'>('questions')

  // Get all message IDs that were used in Q&A pairs
  const usedMessageIds = new Set<string>()
  const questionIds = new Set<string>()
  const answerIds = new Set<string>()
  
  if (conversationAnalysis?.patterns) {
    conversationAnalysis.patterns
      .filter(pattern => pattern.type === 'qa_pair')
      .forEach(pattern => {
        pattern.messageIds.forEach((id, index) => {
          usedMessageIds.add(id)
          if (index === 0) questionIds.add(id) // First message is question
          if (index === 1) answerIds.add(id)   // Second message is answer
        })
      })
  }

  const getFilteredMessages = () => {
    switch (filter) {
      case 'questions':
        return messages.filter(msg => questionIds.has(msg.id))
      case 'answers':
        return messages.filter(msg => answerIds.has(msg.id))
      case 'ignored':
        return messages.filter(msg => !usedMessageIds.has(msg.id))
      case 'all':
      default:
        return messages
    }
  }

  const filteredMessages = getFilteredMessages()
  const questionCount = messages.filter(msg => questionIds.has(msg.id)).length
  const answerCount = messages.filter(msg => answerIds.has(msg.id)).length
  const ignoredCount = messages.filter(msg => !usedMessageIds.has(msg.id)).length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              All Messages ({messages.length})
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {questionCount} questions • {answerCount} answers • {ignoredCount} ignored
            </p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('questions')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === 'questions'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Questions ({questionCount})
          </button>
          <button
            onClick={() => setFilter('answers')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === 'answers'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Answers ({answerCount})
          </button>
          <button
            onClick={() => setFilter('ignored')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === 'ignored'
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Ignored ({ignoredCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            All ({messages.length})
          </button>
        </div>
      </div>

      <div className="p-6">
        {filteredMessages.length > 0 ? (
          <div className="space-y-3">
            {filteredMessages.map((message) => {
              const isQuestion = questionIds.has(message.id)
              const isAnswer = answerIds.has(message.id)
              const isUsed = usedMessageIds.has(message.id)
              const isIgnored = !isUsed
              
              return (
                <div 
                  key={message.id} 
                  className={`flex items-start gap-3 p-4 rounded-lg border ${
                    isQuestion 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : isAnswer
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : isIgnored
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isQuestion 
                      ? 'bg-blue-100 dark:bg-blue-900'
                      : isAnswer
                      ? 'bg-green-100 dark:bg-green-900'
                      : isIgnored
                      ? 'bg-orange-100 dark:bg-orange-900'
                      : 'bg-gray-200 dark:bg-gray-600'
                  }`}>
                    <span className={`text-sm font-bold ${
                      isQuestion 
                        ? 'text-blue-600 dark:text-blue-400'
                        : isAnswer
                        ? 'text-green-600 dark:text-green-400'
                        : isIgnored
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {isQuestion ? 'Q' : isAnswer ? 'A' : isIgnored ? '!' : '•'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">{message.username}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{message.timeAgo}</span>
                      {isIgnored && (
                        <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 rounded">
                          {message.text.toLowerCase().includes('hi') || message.text.toLowerCase().includes('hello') 
                            ? 'Greeting' 
                            : message.text.includes('?') 
                            ? 'Unanswered question' 
                            : 'Context only'}
                        </span>
                      )}
                    </div>
                    <p className={`${
                      isQuestion || isAnswer 
                        ? 'text-gray-900 dark:text-white font-medium'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {message.text}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No {filter} found in this conversation.</p>
          </div>
        )}
      </div>
    </div>
  )
} 