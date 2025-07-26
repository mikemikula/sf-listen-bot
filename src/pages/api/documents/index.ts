/**
 * Documents API Endpoint
 * Handles CRUD operations for processed documents with full pagination and filtering
 * Supports document creation, retrieval, updating, and deletion
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { documentProcessorService } from '@/lib/documentProcessor'
import { 
  ApiResponse, 
  PaginatedDocuments, 
  DocumentDisplay,
  DocumentFilters,
  DocumentProcessingInput,
  ValidationError,
  DatabaseError
} from '@/types'

/**
 * Documents API handler with full CRUD support
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) {
  try {
    switch (req.method) {
      case 'GET':
        return await handleGetDocuments(req, res)
      case 'POST':
        return await handleCreateDocument(req, res)
      case 'PUT':
        return await handleUpdateDocument(req, res)
      case 'DELETE':
        return await handleDeleteDocument(req, res)
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        })
    }
  } catch (error) {
    logger.error('Documents API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Handle GET /api/documents - Retrieve documents with pagination and filtering
 */
async function handleGetDocuments(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<PaginatedDocuments>>
) {
  try {
    const {
      page = '1',
      limit = '20',
      category,
      status,
      search,
      startDate,
      endDate,
      createdBy,
      minConfidence
    } = req.query as DocumentFilters & { [key: string]: string }

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page.toString(), 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit.toString(), 10) || 20))
    const offset = (pageNum - 1) * limitNum

    // Build filter conditions
    const where: any = {}

    if (category) where.category = category
    if (status) where.status = status
    if (createdBy) where.createdBy = createdBy
    if (minConfidence) where.confidenceScore = { gte: parseFloat(minConfidence.toString()) }
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    // Fetch documents with related data
    const [documents, totalCount] = await Promise.all([
      db.processedDocument.findMany({
        where,
        include: {
          documentMessages: {
            include: { message: true }
          },
          documentFAQs: {
            include: { faq: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limitNum
      }),
      db.processedDocument.count({ where })
    ])

    // Transform to display format with enriched data
    const documentsDisplay: DocumentDisplay[] = await Promise.all(
      documents.map(async (doc: any) => {
        const messages = doc.documentMessages.map((dm: any) => dm.message)
        const participants = new Set(messages.map((m: any) => m.username))
        const channels = new Set(messages.map((m: any) => m.channel))

        return {
          id: doc.id,
          title: doc.title,
          description: doc.description,
          category: doc.category,
          status: doc.status,
          processingJobId: doc.processingJobId,
          confidenceScore: doc.confidenceScore,
          createdBy: doc.createdBy,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          messageCount: messages.length,
          faqCount: doc.documentFAQs.length,
          participantCount: participants.size,
          participants: Array.from(participants) as string[],
          channelNames: Array.from(channels) as string[],
          lastActivity: doc.updatedAt,
          timeAgo: getTimeAgo(doc.updatedAt)
        }
      })
    )

    const totalPages = Math.ceil(totalCount / limitNum)

    const result: PaginatedDocuments = {
      documents: documentsDisplay,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    }

    logger.info(`Retrieved ${documents.length} documents (page ${pageNum}/${totalPages})`)

    return res.status(200).json({
      success: true,
      data: result
    })

  } catch (error) {
    logger.error('Failed to retrieve documents:', error)
    throw new DatabaseError('Failed to retrieve documents', error)
  }
}

/**
 * Handle POST /api/documents - Create new document from messages
 */
async function handleCreateDocument(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ documentId: string }>>
) {
  try {
    const { messageIds, title, category, userId } = req.body as DocumentProcessingInput

    // Validate required fields
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      throw new ValidationError('messageIds array is required and cannot be empty')
    }

    // Title and category are now optional - they will be AI-generated if not provided
    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      throw new ValidationError('title cannot be empty string (omit for AI generation)')
    }

    if (category !== undefined && (typeof category !== 'string' || category.trim().length === 0)) {
      throw new ValidationError('category cannot be empty string (omit for AI generation)')
    }

    // Process messages into document
    const input: DocumentProcessingInput = {
      messageIds,
      title: title?.trim(),
      category: category?.trim(),
      userId
    }

    const result = await documentProcessorService.processDocument(input)

    logger.info(`Created document ${result.document.id} from ${messageIds.length} messages`)

    return res.status(201).json({
      success: true,
      data: { documentId: result.document.id },
      message: `Document created successfully with ${result.messagesProcessed} messages processed`
    })

  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message
      })
    }

    logger.error('Failed to create document:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create document'
    })
  }
}

/**
 * Handle PUT /api/documents - Update existing document
 */
async function handleUpdateDocument(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<DocumentDisplay>>
) {
  try {
    const { id, title, description, category, status } = req.body

    if (!id) {
      throw new ValidationError('Document ID is required')
    }

    // Build update data
    const updateData: any = {}
    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description.trim()
    if (category !== undefined) updateData.category = category.trim()
    if (status !== undefined) updateData.status = status

    const updatedDoc = await db.processedDocument.update({
      where: { id },
      data: updateData,
      include: {
        documentMessages: {
          include: { message: true }
        },
        documentFAQs: true
      }
    })

    // Transform to display format
    const messages = updatedDoc.documentMessages.map((dm: any) => dm.message)
    const participants = new Set(messages.map((m: any) => m.username))

    const documentDisplay: DocumentDisplay = {
      id: updatedDoc.id,
      title: updatedDoc.title,
      description: updatedDoc.description,
      category: updatedDoc.category,
      status: updatedDoc.status,
      processingJobId: updatedDoc.processingJobId,
      confidenceScore: updatedDoc.confidenceScore,
      createdBy: updatedDoc.createdBy,
      createdAt: updatedDoc.createdAt,
      updatedAt: updatedDoc.updatedAt,
      messageCount: messages.length,
      faqCount: updatedDoc.documentFAQs.length,
      participantCount: participants.size,
      participants: Array.from(participants) as string[],
      channelNames: Array.from(new Set(messages.map((m: any) => m.channel))),
      lastActivity: updatedDoc.updatedAt,
      timeAgo: getTimeAgo(updatedDoc.updatedAt)
    }

    logger.info(`Updated document ${id}`)

    return res.status(200).json({
      success: true,
      data: documentDisplay
    })

  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message
      })
    }

    logger.error('Failed to update document:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update document'
    })
  }
}

/**
 * Handle DELETE /api/documents - Delete document
 */
async function handleDeleteDocument(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ deleted: boolean }>>
) {
  try {
    const { id } = req.body

    if (!id) {
      throw new ValidationError('Document ID is required')
    }

    // Check if document exists
    const existingDoc = await db.processedDocument.findUnique({
      where: { id }
    })

    if (!existingDoc) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }

    // Delete document (cascade will handle junction tables)
    await db.processedDocument.delete({
      where: { id }
    })

    logger.info(`Deleted document ${id}`)

    return res.status(200).json({
      success: true,
      data: { deleted: true }
    })

  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message
      })
    }

    logger.error('Failed to delete document:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete document'
    })
  }
}

/**
 * Utility function to calculate time ago
 */
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  
  const days = Math.floor(diffInSeconds / 86400)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  
  return `${Math.floor(days / 365)}y ago`
} 