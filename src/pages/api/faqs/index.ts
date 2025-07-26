/**
 * FAQs API Endpoint
 * Handles CRUD operations for FAQs with approval workflows and similarity search
 * Based on Next.js custom types approach from search results
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { faqGeneratorService } from '@/lib/faqGenerator'
import { pineconeService } from '@/lib/pinecone'
import { 
  ApiResponse, 
  PaginatedFAQs, 
  FAQDisplay,
  FAQFilters,
  FAQ,
  FAQStatus,
  ValidationError,
  DatabaseError
} from '@/types'

/**
 * FAQs API handler with full CRUD and management support
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) {
  try {
    switch (req.method) {
      case 'GET':
        return await handleGetFAQs(req, res)
      case 'POST':
        return await handleCreateFAQ(req, res)
      case 'PUT':
        return await handleUpdateFAQ(req, res)
      case 'DELETE':
        return await handleDeleteFAQ(req, res)
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        })
    }
  } catch (error) {
    logger.error('FAQs API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Handle GET /api/faqs - Retrieve FAQs with pagination, filtering and similarity search
 */
async function handleGetFAQs(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<PaginatedFAQs>>
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
      approvedBy,
      minConfidence,
      similarTo
    } = req.query as FAQFilters & { [key: string]: string } & { similarTo?: string }

    // Handle similarity search using Pinecone
    if (similarTo) {
      return await handleSimilaritySearch(similarTo, req, res)
    }

    // Standard pagination and filtering
    const pageNum = Math.max(1, parseInt(page.toString(), 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit.toString(), 10) || 20))
    const offset = (pageNum - 1) * limitNum

    // Build filter conditions
    const where: any = {}

    if (category) where.category = category
    if (status) where.status = status
    if (approvedBy) where.approvedBy = approvedBy
    if (minConfidence) where.confidenceScore = { gte: parseFloat(minConfidence.toString()) }
    
    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    // Fetch FAQs with related data
    const [faqs, totalCount] = await Promise.all([
      db.fAQ.findMany({
        where,
        include: {
          documentFAQs: {
            include: { document: true }
          },
          messageFAQs: {
            include: { message: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limitNum
      }),
      db.fAQ.count({ where })
    ])

    // Transform to display format with enriched data
    const faqsDisplay: FAQDisplay[] = faqs.map((faq: any) => {
      const sourceDocuments = faq.documentFAQs.map((df: any) => df.document)
      const sourceMessages = faq.messageFAQs.map((mf: any) => mf.message)

      return {
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        status: faq.status,
        confidenceScore: faq.confidenceScore,
        approvedBy: faq.approvedBy,
        approvedAt: faq.approvedAt,
        createdAt: faq.createdAt,
        updatedAt: faq.updatedAt,
        sourceDocumentCount: sourceDocuments.length,
        sourceMessageCount: sourceMessages.length,
        primarySourceDocument: sourceDocuments[0] ? {
          id: sourceDocuments[0].id,
          title: sourceDocuments[0].title
        } : undefined,
        timeAgo: getTimeAgo(faq.createdAt)
      }
    })

    const totalPages = Math.ceil(totalCount / limitNum)

    const result: PaginatedFAQs = {
      faqs: faqsDisplay,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    }

    logger.info(`Retrieved ${faqs.length} FAQs (page ${pageNum}/${totalPages})`)

    return res.status(200).json({
      success: true,
      data: result
    })

  } catch (error) {
    logger.error('Failed to retrieve FAQs:', error)
    throw new DatabaseError('Failed to retrieve FAQs', error)
  }
}

/**
 * Handle similarity search using Pinecone vector database
 */
async function handleSimilaritySearch(
  query: string,
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<PaginatedFAQs>>
) {
  try {
    const { category, limit = '10' } = req.query as { category?: string; limit?: string }
    const limitNum = Math.min(50, Math.max(1, parseInt(limit.toString(), 10) || 10))

    // Search for similar FAQs using Pinecone
    const similarFAQs = await faqGeneratorService.findSimilarFAQs(query, {
      category,
      status: [FAQStatus.APPROVED, FAQStatus.PENDING],
      limit: limitNum,
      minScore: 0.7
    })

    // Transform to display format
    const faqsDisplay: FAQDisplay[] = similarFAQs.map(result => ({
      ...result.faq,
      sourceDocumentCount: 0,
      sourceMessageCount: 0,
      timeAgo: getTimeAgo(result.faq.createdAt),
      similarity: result.similarity // Add similarity score for search results
    }))

    const result: PaginatedFAQs = {
      faqs: faqsDisplay,
      pagination: {
        page: 1,
        limit: limitNum,
        total: faqsDisplay.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      }
    }

    logger.info(`Found ${similarFAQs.length} similar FAQs for query: "${query}"`)

    return res.status(200).json({
      success: true,
      data: result,
      message: `Found ${similarFAQs.length} similar FAQs`
    })

  } catch (error) {
    logger.error('Similarity search failed:', error)
    return res.status(500).json({
      success: false,
      error: 'Similarity search failed'
    })
  }
}

/**
 * Handle POST /api/faqs - Create new FAQ or generate from document
 */
async function handleCreateFAQ(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ faqId: string } | { faqs: FAQ[] }>>
) {
  try {
    const { type, ...data } = req.body

    if (type === 'generate') {
      // Generate FAQs from document
      return await handleGenerateFAQs(data, res)
    } else {
      // Create manual FAQ
      return await handleCreateManualFAQ(data, res)
    }

  } catch (error) {
    logger.error('Failed to create FAQ:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create FAQ'
    })
  }
}

/**
 * Generate FAQs from document
 */
async function handleGenerateFAQs(
  data: { documentId: string; categoryOverride?: string; userId?: string },
  res: NextApiResponse<ApiResponse<{ faqs: FAQ[] }>>
) {
  try {
    const { documentId, categoryOverride, userId } = data

    if (!documentId) {
      throw new ValidationError('documentId is required for FAQ generation')
    }

    const result = await faqGeneratorService.generateFAQsFromDocument({
      documentId,
      categoryOverride,
      userId
    })

    logger.info(`Generated ${result.faqs.length} FAQs from document ${documentId}`)

    return res.status(201).json({
      success: true,
      data: { faqs: result.faqs },
      message: `Generated ${result.faqs.length} FAQs, found ${result.duplicatesFound} duplicates, enhanced ${result.enhancedExisting} existing FAQs`
    })

  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message
      })
    }
    throw error
  }
}

/**
 * Create manual FAQ
 */
async function handleCreateManualFAQ(
  data: { question: string; answer: string; category: string; userId?: string },
  res: NextApiResponse<ApiResponse<{ faqId: string }>>
) {
  try {
    const { question, answer, category, userId } = data

    // Validate required fields
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      throw new ValidationError('question is required and cannot be empty')
    }

    if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
      throw new ValidationError('answer is required and cannot be empty')
    }

    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      throw new ValidationError('category is required and cannot be empty')
    }

    // Check for duplicates using Pinecone
    const duplicateCheck = await pineconeService.findDuplicateFAQs({
      question: question.trim(),
      answer: answer.trim(),
      category: category.trim()
    })

    if (duplicateCheck.isDuplicate) {
      return res.status(409).json({
        success: false,
        error: 'Similar FAQ already exists'
      })
    }

    // Create new FAQ
    const newFAQ = await db.fAQ.create({
      data: {
        question: question.trim(),
        answer: answer.trim(),
        category: category.trim(),
        status: 'PENDING',
        confidenceScore: 1.0 // Manual FAQs get full confidence
      }
    })

    // Store embedding in Pinecone
    await pineconeService.storeFAQEmbedding(newFAQ as FAQ)

    logger.info(`Created manual FAQ: ${newFAQ.id}`)

    return res.status(201).json({
      success: true,
      data: { faqId: newFAQ.id }
    })

  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message
      })
    }
    throw error
  }
}

/**
 * Handle PUT /api/faqs - Update FAQ or approve/reject
 */
async function handleUpdateFAQ(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<FAQ>>
) {
  try {
    const { id, action, ...updateData } = req.body

    if (!id) {
      throw new ValidationError('FAQ ID is required')
    }

    if (action === 'approve' || action === 'reject') {
      // Handle approval/rejection
      const { reviewedBy } = updateData
      if (!reviewedBy) {
        throw new ValidationError('reviewedBy is required for approval/rejection')
      }

      const status = action === 'approve' ? FAQStatus.APPROVED : FAQStatus.REJECTED
      const updatedFAQ = await faqGeneratorService.reviewFAQ(id, status, reviewedBy)

      logger.info(`FAQ ${id} ${action}d by ${reviewedBy}`)

      return res.status(200).json({
        success: true,
        data: updatedFAQ
      })
    } else {
      // Handle general update
      const updateFields: any = {}
      if (updateData.question !== undefined) updateFields.question = updateData.question.trim()
      if (updateData.answer !== undefined) updateFields.answer = updateData.answer.trim()
      if (updateData.category !== undefined) updateFields.category = updateData.category.trim()
      if (updateData.status !== undefined) updateFields.status = updateData.status

      const updatedFAQ = await db.fAQ.update({
        where: { id },
        data: updateFields
      })

      // Update embedding if content changed
      if (updateData.question || updateData.answer) {
        await pineconeService.updateFAQEmbedding(updatedFAQ as FAQ)
      }

      logger.info(`Updated FAQ ${id}`)

      return res.status(200).json({
        success: true,
        data: updatedFAQ as FAQ
      })
    }

  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message
      })
    }

    logger.error('Failed to update FAQ:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update FAQ'
    })
  }
}

/**
 * Handle DELETE /api/faqs - Delete FAQ
 */
async function handleDeleteFAQ(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ deleted: boolean }>>
) {
  try {
    const { id } = req.body

    if (!id) {
      throw new ValidationError('FAQ ID is required')
    }

    // Check if FAQ exists
    const existingFAQ = await db.fAQ.findUnique({
      where: { id }
    })

    if (!existingFAQ) {
      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      })
    }

    // Delete from database (cascade will handle junction tables)
    await db.fAQ.delete({
      where: { id }
    })

    // Delete from Pinecone
    await pineconeService.deleteFAQEmbedding(id)

    logger.info(`Deleted FAQ ${id}`)

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

    logger.error('Failed to delete FAQ:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete FAQ'
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