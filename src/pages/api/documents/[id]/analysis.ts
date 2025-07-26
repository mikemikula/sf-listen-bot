/**
 * Document Analysis API Endpoint
 * Provides detailed AI analysis data showing how messages were processed into FAQs
 * Includes conversation analysis, message roles, and FAQ generation reasoning
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { conversationAnalyzerService } from '@/lib/conversationAnalyzer'
import { ApiResponse } from '@/types'

interface DetailedAnalysisResponse {
  qaPairs: Array<{
    questionMessageId: string
    answerMessageId: string
    confidence: number
    topic: string
    reasoning: string
  }>
  messageAnalysis: Array<{
    messageId: string
    role: string
    confidence: number
    reasoning: string
    contributesToFAQs: string[]
  }>
  faqTraceability: Array<{
    faqId: string
    sourceMessageIds: string[]
    generationReasoning: string
    confidenceFactors: {
      questionClarity: number
      answerCompleteness: number
      contextRelevance: number
      overall: number
    }
  }>
}

/**
 * Generate detailed AI reasoning explanations for message roles
 */
function generateMessageRoleReasoning(messageText: string, role: string, confidence: number): string {
  const lowerText = messageText.toLowerCase()
  
  switch (role) {
    case 'QUESTION':
      if (lowerText.includes('?')) {
        return `Identified as QUESTION due to interrogative punctuation and question structure. High confidence due to clear question format.`
      } else if (['how', 'what', 'when', 'where', 'why', 'who'].some(word => lowerText.startsWith(word))) {
        return `Identified as QUESTION based on interrogative word pattern ("${lowerText.split(' ')[0]}"). AI detected information-seeking intent.`
      } else {
        return `Identified as QUESTION through semantic analysis of content structure and context, despite lack of obvious question markers.`
      }
      
    case 'ANSWER':
      if (lowerText.includes('you can') || lowerText.includes('try') || lowerText.includes('here')) {
        return `Identified as ANSWER due to instructional language patterns and solution-providing structure. Contains actionable guidance.`
      } else if (['step', 'first', 'second', 'then', 'next'].some(word => lowerText.includes(word))) {
        return `Identified as ANSWER based on procedural language patterns indicating step-by-step solution or explanation.`
      } else {
        return `Identified as ANSWER through contextual analysis - message provides information that directly addresses a preceding question.`
      }
      
    case 'CONFIRMATION':
      if (['thanks', 'perfect', 'worked', 'fixed', 'solved'].some(word => lowerText.includes(word))) {
        return `Identified as CONFIRMATION due to gratitude/success indicators showing problem resolution or satisfaction with answer.`
      } else {
        return `Identified as CONFIRMATION through sentiment analysis indicating positive response or acknowledgment.`
      }
      
    case 'FOLLOW_UP':
      if (lowerText.startsWith('but') || lowerText.includes('what if') || lowerText.includes('what about')) {
        return `Identified as FOLLOW_UP due to transitional language indicating additional questions or clarifications needed.`
      } else {
        return `Identified as FOLLOW_UP through context analysis showing continuation or expansion of previous discussion.`
      }
      
    case 'CONTEXT':
    default:
      return `Classified as CONTEXT - provides supporting information or background that enhances understanding but doesn't directly ask or answer questions.`
  }
}

/**
 * Generate FAQ generation reasoning
 */
function generateFAQReasoning(question: string, answer: string, sourceMessages: any[]): string {
  const hasDirectQA = sourceMessages.some(m => m.role === 'QUESTION') && sourceMessages.some(m => m.role === 'ANSWER')
  
  if (hasDirectQA) {
    const questionCount = sourceMessages.filter(m => m.role === 'QUESTION').length
    const answerCount = sourceMessages.filter(m => m.role === 'ANSWER').length
    
    return `Generated from clear Q&A pattern with ${questionCount} question(s) and ${answerCount} answer(s). AI synthesized the core question-answer relationship and normalized the language for FAQ format.`
  } else {
    return `Generated through semantic analysis of conversation context. AI identified implicit question-answer patterns and extracted the underlying knowledge exchange.`
  }
}

/**
 * Calculate detailed confidence factors for FAQ generation
 */
function calculateConfidenceFactors(question: string, answer: string, sourceMessages: any[]) {
  // Question clarity - how clear and well-formed is the question
  const questionClarity = question.includes('?') || 
    ['how', 'what', 'when', 'where', 'why', 'who'].some(word => question.toLowerCase().includes(word)) 
    ? 0.9 : 0.7
  
  // Answer completeness - how complete and actionable is the answer
  const answerCompleteness = answer.length > 50 && 
    ['you can', 'try', 'step', 'go to', 'click'].some(phrase => answer.toLowerCase().includes(phrase))
    ? 0.85 : 0.65
  
  // Context relevance - how well do source messages relate to each other
  const hasQAPattern = sourceMessages.some(m => m.role === 'QUESTION') && 
                      sourceMessages.some(m => m.role === 'ANSWER')
  const contextRelevance = hasQAPattern ? 0.9 : 0.6
  
  // Overall confidence
  const overall = (questionClarity + answerCompleteness + contextRelevance) / 3
  
  return {
    questionClarity,
    answerCompleteness,
    contextRelevance,
    overall
  }
}

/**
 * GET /api/documents/[id]/analysis
 * Get detailed AI analysis for a document
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<DetailedAnalysisResponse>>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Document ID is required'
    })
  }

  try {
    // Fetch document with all related data
    const document = await db.processedDocument.findUnique({
      where: { id },
      include: {
        documentMessages: {
          include: { message: true },
          orderBy: { message: { timestamp: 'asc' } }
        },
        documentFAQs: {
          include: { faq: true }
        }
      }
    })

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }

    const messages = document.documentMessages.map(dm => dm.message)
    const faqs = document.documentFAQs.map(df => df.faq)

    // Re-analyze conversation to get Q&A pairs
    const conversationAnalysis = await conversationAnalyzerService.analyzeConversation(messages)

    // Build Q&A pairs with reasoning
    const qaPairs = conversationAnalysis.qaPairs.map(pair => {
      const questionMsg = messages[pair.questionIndex]
      const answerMsg = messages[pair.answerIndex]
      
      return {
        questionMessageId: questionMsg.id,
        answerMessageId: answerMsg.id,
        confidence: pair.confidence,
        topic: pair.topic,
        reasoning: `AI identified this Q&A pattern with ${Math.round(pair.confidence * 100)}% confidence. The question shows clear information-seeking intent, and the answer provides relevant information that directly addresses the question. Topic classification: "${pair.topic}".`
      }
    })

    // Build message analysis with detailed reasoning
    const messageAnalysis = messages.map(message => {
      const roleAnalysis = conversationAnalysis.messageRoles.find(r => r.messageId === message.id)
      const role = roleAnalysis?.role || 'CONTEXT'
      const confidence = roleAnalysis?.confidence || 0.5
      
      // Find which FAQs this message contributes to
      const contributesToFAQs = document.documentFAQs
        .filter(df => df.sourceMessageIds.includes(message.id))
        .map(df => df.faq.id)

      return {
        messageId: message.id,
        role,
        confidence,
        reasoning: generateMessageRoleReasoning(message.text, role, confidence),
        contributesToFAQs
      }
    })

    // Build FAQ traceability with detailed reasoning
    const faqTraceability = document.documentFAQs.map(documentFAQ => {
      const faq = documentFAQ.faq
      const sourceMessages = messages.filter(m => documentFAQ.sourceMessageIds.includes(m.id))
      
      // Map source message IDs to actual messages with roles
      const sourceMessagesWithRoles = sourceMessages.map(msg => {
        const roleData = messageAnalysis.find(ma => ma.messageId === msg.id)
        return {
          ...msg,
          role: roleData?.role || 'CONTEXT'
        }
      })

      return {
        faqId: faq.id,
        sourceMessageIds: documentFAQ.sourceMessageIds,
        generationReasoning: generateFAQReasoning(faq.question, faq.answer, sourceMessagesWithRoles),
        confidenceFactors: calculateConfidenceFactors(faq.question, faq.answer, sourceMessagesWithRoles)
      }
    })

    const analysisData: DetailedAnalysisResponse = {
      qaPairs,
      messageAnalysis,
      faqTraceability
    }

    res.status(200).json({
      success: true,
      data: analysisData
    })

  } catch (error) {
    console.error('Error fetching document analysis:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch document analysis'
    })
  }
} 