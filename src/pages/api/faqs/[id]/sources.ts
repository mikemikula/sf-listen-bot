/**
 * FAQ Sources API Endpoint
 * Fetches source messages and documents for a specific FAQ
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ApiResponse } from '@/types'

interface SourceData {
  faq: {
    id: string
    question: string
    answer: string
    category: string
  }
  documents: {
    id: string
    title: string
    content: string
    category: string
    createdAt: string
  }[]
  messages: {
    id: string
    content: string
    author: string
    timestamp: string
    channel: string
  }[]
}

/**
 * Handle GET /api/faqs/[id]/sources - Get source data for FAQ
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<SourceData>>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    const { id } = req.query

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'FAQ ID is required'
      })
    }

    // Fetch the FAQ with its relationships
    const faq = await db.fAQ.findUnique({
      where: { id },
      include: {
        documentFAQs: {
          include: {
            document: {
              include: {
                documentMessages: {
                  include: {
                    message: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!faq) {
      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      })
    }

    // Extract documents
    const documents = faq.documentFAQs.map(docFaq => ({
      id: docFaq.document.id,
      title: docFaq.document.title,
      content: docFaq.document.content,
      category: docFaq.document.category,
      createdAt: docFaq.document.createdAt.toISOString()
    }))

    // Extract unique messages from all documents
    const messagesMap = new Map()
    
    faq.documentFAQs.forEach(docFaq => {
      docFaq.document.documentMessages.forEach(docMsg => {
        const message = docMsg.message
        if (!messagesMap.has(message.id)) {
          messagesMap.set(message.id, {
            id: message.id,
            content: message.text,
            author: message.username,
            timestamp: message.timestamp.toISOString(),
            channel: message.channel
          })
        }
      })
    })

    const messages = Array.from(messagesMap.values()).sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    const sourceData: SourceData = {
      faq: {
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        category: faq.category
      },
      documents,
      messages
    }

    logger.info(`Fetched sources for FAQ ${id}: ${documents.length} documents, ${messages.length} messages`)

    return res.status(200).json({
      success: true,
      data: sourceData
    })

  } catch (error) {
    logger.error('Failed to fetch FAQ sources:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch source data'
    })
  }
} 