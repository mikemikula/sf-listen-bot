/**
 * AI Analysis Breakdown Component
 * Shows the AI's reasoning process for how messages were analyzed and FAQs were generated
 * Provides complete transparency into the conversation analysis and FAQ creation process
 */

import React, { useState } from 'react'
import { MessageDisplay, FAQDisplay } from '@/types'

interface QAPair {
  questionMessageId: string
  answerMessageId: string
  confidence: number
  topic: string
  reasoning: string
}

interface MessageAnalysis {
  messageId: string
  role: string
  confidence: number
  reasoning: string
  contributesToFAQs: string[]
}

interface FAQTraceability {
  faqId: string
  sourceMessageIds: string[]
  generationReasoning: string
  confidenceFactors: {
    questionClarity: number
    answerCompleteness: number
    contextRelevance: number
    overall: number
  }
}

interface AIAnalysisBreakdownProps {
  messages: MessageDisplay[]
  faqs: FAQDisplay[]
  documentId: string
}

/**
 * AI Analysis Breakdown Component
 * Shows the complete AI reasoning process from messages to FAQs
 */
export const AIAnalysisBreakdown: React.FC<AIAnalysisBreakdownProps> = ({
  messages,
  faqs,
  documentId
}) => {
  const [activeTab, setActiveTab] = useState<'conversation' | 'roles' | 'faqs' | 'traceability'>('conversation')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [analysisData, setAnalysisData] = useState<{
    qaPairs: QAPair[]
    messageAnalysis: MessageAnalysis[]
    faqTraceability: FAQTraceability[]
  } | null>(null)

  /**
   * Toggle expanded state for items
   */
  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  /**
   * Load detailed AI analysis data
   */
  const loadAnalysisData = React.useCallback(async () => {
    if (analysisData) return // Already loaded

    setLoading(true)
    try {
      const response = await fetch(`/api/documents/${documentId}/analysis`)
      const result = await response.json()
      
      if (result.success) {
        setAnalysisData(result.data)
      }
    } catch (error) {
      console.error('Failed to load analysis data:', error)
    } finally {
      setLoading(false)
    }
  }, [documentId, analysisData])

  // Load analysis data when component mounts
  React.useEffect(() => {
    loadAnalysisData()
  }, [loadAnalysisData])

  /**
   * Get message by ID
   */
  const getMessageById = (messageId: string) => {
    return messages.find(m => m.id === messageId)
  }

  /**
   * Get FAQ by ID
   */
  const getFAQById = (faqId: string) => {
    return faqs.find(f => f.id === faqId)
  }

  /**
   * Get role styling
   */
  const getRoleStyle = (role: string) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full'
    
    switch (role) {
      case 'QUESTION':
        return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`
      case 'ANSWER':
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`
      case 'CONTEXT':
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`
      case 'FOLLOW_UP':
        return `${baseClasses} bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200`
      case 'CONFIRMATION':
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`
    }
  }

  /**
   * Get confidence color styling
   */
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 dark:text-green-400'
    if (confidence >= 0.7) return 'text-blue-600 dark:text-blue-400'
    if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading AI analysis...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          AI Analysis Breakdown
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          How AI processed {messages.length} messages → {faqs.length} FAQs
        </span>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        {[
          { id: 'conversation', label: 'Conversation Analysis', icon: '💬' },
          { id: 'roles', label: 'Message Roles', icon: '🎭' },
          { id: 'faqs', label: 'FAQ Generation', icon: '❓' },
          { id: 'traceability', label: 'Full Traceability', icon: '🔗' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conversation Analysis Tab */}
      {activeTab === 'conversation' && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">🧠 AI Conversation Analysis</h3>
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-4">
              The AI analyzed the conversation flow and identified {analysisData?.qaPairs.length || 0} Q&A patterns:
            </p>
            
            {/* Q&A Pairs Found */}
            <div className="space-y-4">
              {analysisData?.qaPairs.map((qaPair, index) => {
                const questionMsg = getMessageById(qaPair.questionMessageId)
                const answerMsg = getMessageById(qaPair.answerMessageId)
                
                return (
                  <div key={`qa-${index}`} className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-gray-900 dark:text-white">
                        Q&A Pattern #{index + 1}: {qaPair.topic}
                      </span>
                      <span className={`text-sm font-medium ${getConfidenceColor(qaPair.confidence)}`}>
                        {Math.round(qaPair.confidence * 100)}% confidence
                      </span>
                    </div>
                    
                    {/* Question */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">QUESTION:</span>
                        <span className="text-xs text-gray-500">{questionMsg?.username}</span>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded border-l-4 border-blue-600">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          &ldquo;{questionMsg?.text}&rdquo;
                        </p>
                      </div>
                    </div>
                    
                    {/* Answer */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-green-600 dark:text-green-400">ANSWER:</span>
                        <span className="text-xs text-gray-500">{answerMsg?.username}</span>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded border-l-4 border-green-600">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          &ldquo;{answerMsg?.text}&rdquo;
                        </p>
                      </div>
                    </div>
                    
                    {/* AI Reasoning */}
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">AI REASONING:</div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                        {qaPair.reasoning}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Message Roles Tab */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-purple-900 dark:text-purple-200 mb-2">🎭 Message Role Analysis</h3>
            <p className="text-sm text-purple-800 dark:text-purple-300">
              How the AI classified each message&apos;s role in the conversation:
            </p>
          </div>

          {messages.map((message) => {
            const analysis = analysisData?.messageAnalysis.find(a => a.messageId === message.id)
            const isExpanded = expandedItems.has(message.id)
            
            return (
              <div key={message.id} className="border border-gray-200 dark:border-gray-600 rounded-lg">
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => toggleExpanded(message.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={getRoleStyle(message.role || 'CONTEXT')}>
                          {message.role || 'CONTEXT'}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {message.username}
                        </span>
                        <span className={`text-sm font-medium ${getConfidenceColor(analysis?.confidence || 0.5)}`}>
                          {Math.round((analysis?.confidence || 0.5) * 100)}%
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {message.timeAgo}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                        {message.text}
                      </p>
                    </div>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="pt-4 space-y-3">
                      {/* Full Message Text */}
                      <div>
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">FULL MESSAGE:</div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            &ldquo;{message.text}&rdquo;
                          </p>
                        </div>
                      </div>
                      
                      {/* AI Reasoning for Role Assignment */}
                      {analysis?.reasoning && (
                        <div>
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">AI REASONING FOR ROLE:</div>
                          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded">
                            <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                              {analysis.reasoning}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Contributes to FAQs */}
                      {analysis?.contributesToFAQs && analysis.contributesToFAQs.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">CONTRIBUTES TO FAQS:</div>
                          <div className="flex flex-wrap gap-2">
                            {analysis.contributesToFAQs.map(faqId => {
                              const faq = getFAQById(faqId)
                              return (
                                <span key={faqId} className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded text-xs">
                                  {faq?.question.substring(0, 50)}...
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* FAQ Generation Tab */}
      {activeTab === 'faqs' && (
        <div className="space-y-6">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h3 className="font-medium text-green-900 dark:text-green-200 mb-2">❓ FAQ Generation Process</h3>
            <p className="text-sm text-green-800 dark:text-green-300">
              How the AI transformed Q&A patterns into {faqs.length} structured FAQs:
            </p>
          </div>

          {faqs.map((faq) => {
            const traceability = analysisData?.faqTraceability.find(t => t.faqId === faq.id)
            const isExpanded = expandedItems.has(faq.id)
            
            return (
              <div key={faq.id} className="border border-gray-200 dark:border-gray-600 rounded-lg">
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => toggleExpanded(faq.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          faq.status === 'APPROVED' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {faq.status}
                        </span>
                        <span className={`text-sm font-medium ${getConfidenceColor(faq.confidenceScore)}`}>
                          {Math.round(faq.confidenceScore * 100)}% confidence
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {traceability?.sourceMessageIds.length || 0} source messages
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                        {faq.question}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {faq.answer}
                      </p>
                    </div>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                
                {isExpanded && traceability && (
                  <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="pt-4 space-y-4">
                      {/* Source Messages */}
                      <div>
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">SOURCE MESSAGES:</div>
                        <div className="space-y-2">
                          {traceability.sourceMessageIds.map(messageId => {
                            const message = getMessageById(messageId)
                            if (!message) return null
                            
                            return (
                              <div key={messageId} className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={getRoleStyle(message.role || 'CONTEXT')}>
                                    {message.role || 'CONTEXT'}
                                  </span>
                                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                    {message.username}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  &ldquo;{message.text}&rdquo;
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      
                      {/* AI Generation Reasoning */}
                      <div>
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">AI GENERATION REASONING:</div>
                        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded">
                          <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                            {traceability.generationReasoning}
                          </p>
                        </div>
                      </div>
                      
                      {/* Confidence Breakdown */}
                      <div>
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">CONFIDENCE BREAKDOWN:</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Question Clarity</div>
                            <div className={`text-sm font-medium ${getConfidenceColor(traceability.confidenceFactors.questionClarity)}`}>
                              {Math.round(traceability.confidenceFactors.questionClarity * 100)}%
                            </div>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Answer Completeness</div>
                            <div className={`text-sm font-medium ${getConfidenceColor(traceability.confidenceFactors.answerCompleteness)}`}>
                              {Math.round(traceability.confidenceFactors.answerCompleteness * 100)}%
                            </div>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Context Relevance</div>
                            <div className={`text-sm font-medium ${getConfidenceColor(traceability.confidenceFactors.contextRelevance)}`}>
                              {Math.round(traceability.confidenceFactors.contextRelevance * 100)}%
                            </div>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Overall Score</div>
                            <div className={`text-sm font-medium ${getConfidenceColor(traceability.confidenceFactors.overall)}`}>
                              {Math.round(traceability.confidenceFactors.overall * 100)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Full Traceability Tab */}
      {activeTab === 'traceability' && (
        <div className="space-y-6">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
            <h3 className="font-medium text-indigo-900 dark:text-indigo-200 mb-2">🔗 Complete Traceability Map</h3>
            <p className="text-sm text-indigo-800 dark:text-indigo-300">
              Visual flow showing exact connections between messages and FAQs:
            </p>
          </div>

          {/* Visual Flow Diagram */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 overflow-x-auto">
            <div className="min-w-full">
              {/* Flow visualization would go here - could be implemented with SVG or a library like React Flow */}
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                📊 Interactive traceability visualization coming soon...
                <br />
                <span className="text-sm">
                  This will show a visual flow diagram of message → analysis → FAQ connections
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Traceability Matrix */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Connected FAQs
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {messages.map((message) => {
                  const analysis = analysisData?.messageAnalysis.find(a => a.messageId === message.id)
                  
                  return (
                    <tr key={message.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {message.username}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {message.text}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={getRoleStyle(message.role || 'CONTEXT')}>
                          {message.role || 'CONTEXT'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-medium ${getConfidenceColor(analysis?.confidence || 0.5)}`}>
                          {Math.round((analysis?.confidence || 0.5) * 100)}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {analysis?.contributesToFAQs.map(faqId => {
                            const faq = getFAQById(faqId)
                            return (
                              <span key={faqId} className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded text-xs">
                                FAQ #{faqs.findIndex(f => f.id === faqId) + 1}
                              </span>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default AIAnalysisBreakdown 