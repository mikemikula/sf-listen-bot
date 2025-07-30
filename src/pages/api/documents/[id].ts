/**
 * Individual Document API Endpoint
 * Handles GET, PUT, and DELETE operations for specific documents
 * Provides complete document data with source messages and generated FAQs
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ApiResponse, DocumentDisplay, MessageDisplay, FAQDisplay } from '@/types'

interface DocumentDetailResponse {
  document?: DocumentDisplay // Make optional since we're returning DocumentDisplay directly
  messages?: MessageDisplay[]
  faqs?: FAQDisplay[]
}

/**
 * Handle GET request - Fetch individual document with related data
 */
async function handleGetDocument(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<DocumentDetailResponse>>
) {
  try {
    const { id } = req.query

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      })
    }

    // Fetch document with all related data
    const document = await db.processedDocument.findUnique({
      where: { id },
      include: {
        documentMessages: {
          include: {
            message: true
          },
          orderBy: {
            addedAt: 'asc'
          }
        },
        documentFAQs: {
          include: {
            faq: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    // Debug logging to understand what's happening
    if (document) {
      console.log(`Document ${id} found:`)
      console.log(`- Title: ${document.title}`)
      console.log(`- Document messages count: ${document.documentMessages.length}`)
      console.log(`- Document FAQs count: ${document.documentFAQs.length}`)
      
      if (document.documentMessages.length > 0) {
        console.log('First message:', document.documentMessages[0].message?.text?.substring(0, 100))
      } else {
        console.log('No document messages found in relationships')
      }
    }

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }

    // Transform messages data
    const messages: MessageDisplay[] = document.documentMessages
      .filter((dm: any) => dm.message)
      .map((dm: any) => {
        const msg = dm.message!
        return {
          id: msg.id,
          slackId: msg.slackId,
          text: msg.text,
          userId: msg.userId,
          username: msg.username,
          channel: msg.channel,
          timestamp: msg.timestamp,
          threadTs: msg.threadTs,
          isThreadReply: msg.isThreadReply,
          parentMessageId: msg.parentMessageId,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
          timeAgo: getTimeAgo(msg.timestamp),
          channelName: msg.channel, // Using channel as channelName
          parentMessage: null, // TODO: Implement if needed
          threadReplies: [], // TODO: Implement thread replies if needed
          role: dm.messageRole || undefined,
          // Processing status information (always processed in document context)
          isProcessed: true,
          documentId: document.id,
          documentTitle: document.title,
          documentStatus: document.status,
          messageRole: dm.messageRole,
          processingConfidence: dm.processingConfidence,
          // PII detection status information (not loaded in document context)
          hasPIIDetections: false,
          piiDetectionCount: 0,
          piiPendingReview: 0,
          piiWhitelisted: 0,
          piiAutoReplaced: 0,
          piiDetections: []
        }
      })

    // Transform FAQs data
    const faqs: FAQDisplay[] = document.documentFAQs.map((df: any) => ({
      id: df.faq.id,
      question: df.faq.question,
      answer: df.faq.answer,
      category: df.faq.category,
      status: df.faq.status,
      confidenceScore: df.faq.confidenceScore,
      createdAt: df.faq.createdAt,
      updatedAt: df.faq.updatedAt,
      approvedBy: df.faq.approvedBy || undefined,
      approvedAt: df.faq.approvedAt || undefined,
      sourceDocumentCount: 1, // TODO: Calculate actual count
      sourceMessageCount: 1, // TODO: Calculate actual count
      timeAgo: getTimeAgo(df.faq.createdAt)
    }))

    // Transform document data
    const participants = Array.from(new Set(document.documentMessages.map((dm: any) => dm.message?.username).filter(Boolean))) as string[]
    const channelNames = Array.from(new Set(document.documentMessages.map((dm: any) => dm.message?.channel).filter(Boolean))) as string[]
    const lastActivity = document.updatedAt > document.createdAt ? document.updatedAt : document.createdAt

    const documentDisplay: DocumentDisplay = {
      id: document.id,
      title: document.title,
      description: document.description || '',
      category: document.category,
      status: document.status,
      automationJobId: document.automationJobId,
      confidenceScore: document.confidenceScore,
      createdBy: document.createdBy,
      messageCount: document.documentMessages.length,
      faqCount: document.documentFAQs.length,
      participantCount: participants.length,
      participants,
      channelNames,
      lastActivity,
      timeAgo: getTimeAgo(lastActivity),
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      // Include conversation analysis from database
      conversationAnalysis: (document as any).conversationAnalysis || undefined,
      // Include messages and FAQs directly in the document
      messages,
      faqs
    }

    return res.status(200).json({
      success: true,
      data: documentDisplay
    })

  } catch (error) {
    logger.error('Failed to fetch document details:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Handle PUT request - Update document
 */
async function handleUpdateDocument(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<DocumentDisplay>>
) {
  try {
    const { id } = req.query
    const { title, description, category } = req.body

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      })
    }

    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, and category are required'
      })
    }

    // Update document
    const updatedDocument = await db.processedDocument.update({
      where: { id },
      data: {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        updatedAt: new Date()
      },
      include: {
        documentMessages: {
          include: {
            message: true
          }
        }
      }
    })

    // Transform response
    const participants = Array.from(new Set(updatedDocument.documentMessages.map((dm: any) => dm.message?.username).filter(Boolean))) as string[]
    const channelNames = Array.from(new Set(updatedDocument.documentMessages.map((dm: any) => dm.message?.channel).filter(Boolean))) as string[]
    const lastActivity = updatedDocument.updatedAt > updatedDocument.createdAt ? updatedDocument.updatedAt : updatedDocument.createdAt
    
    const documentDisplay: DocumentDisplay = {
      id: updatedDocument.id,
      title: updatedDocument.title,
      description: updatedDocument.description || '',
      category: updatedDocument.category,
      status: updatedDocument.status,
      automationJobId: updatedDocument.automationJobId,
      confidenceScore: updatedDocument.confidenceScore,
      createdBy: updatedDocument.createdBy,
      messageCount: updatedDocument.documentMessages.length,
      faqCount: 0, // TODO: Include FAQ count if needed
      participantCount: participants.length,
      participants,
      channelNames,
      lastActivity,
      timeAgo: getTimeAgo(lastActivity),
      createdAt: updatedDocument.createdAt,
      updatedAt: updatedDocument.updatedAt
    }

    return res.status(200).json({
      success: true,
      data: documentDisplay
    })

  } catch (error) {
    logger.error('Failed to update document:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Handle DELETE request - Delete document and related data
 */
async function handleDeleteDocument(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ deleted: boolean }>>
) {
  try {
    const { id } = req.query

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      })
    }

    // Delete document and all related data (cascade delete)
    await db.$transaction(async (tx: any) => {
      // Delete junction table records first
      await tx.documentMessage.deleteMany({
        where: { documentId: id }
      })

      await tx.documentFAQ.deleteMany({
        where: { documentId: id }
      })

      // Delete the main document
      await tx.processedDocument.delete({
        where: { id }
      })
    })

    return res.status(200).json({
      success: true,
      data: { deleted: true }
    })

  } catch (error) {
    logger.error('Failed to delete document:', error)
    
    // Handle case where document doesn't exist
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Utility function to calculate time ago
 */
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) {
    return 'just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return date.toLocaleDateString()
  }
}

/**
 * Main API handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) {
  const { method } = req

  try {
    switch (method) {
      case 'GET':
        return await handleGetDocument(req, res)
        
      case 'PUT':
        return await handleUpdateDocument(req, res)
        
      case 'DELETE':
        return await handleDeleteDocument(req, res)
        
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
        return res.status(405).json({
          success: false,
          error: `Method ${method} not allowed`
        })
    }
  } catch (error) {
    logger.error('Document API handler error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
} 