/**
 * Individual FAQ API Endpoint
 * Handles operations on specific FAQs using ID in URL path
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { pineconeService } from '@/lib/pinecone'
import { ApiResponse } from '@/types'

/**
 * Handle individual FAQ operations
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) {
  try {
    const { id } = req.query

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'FAQ ID is required'
      })
    }

    switch (req.method) {
      case 'DELETE':
        return await handleDeleteFAQ(req, res, id)
      default:
        res.setHeader('Allow', ['DELETE'])
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        })
    }
  } catch (error) {
    logger.error('Individual FAQ API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Handle DELETE /api/faqs/[id] - Delete specific FAQ
 */
async function handleDeleteFAQ(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ deleted: boolean }>>,
  id: string
) {
  try {
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
    try {
      await pineconeService.deleteFAQEmbedding(id)
    } catch (error) {
      logger.warn(`Failed to delete FAQ ${id} from Pinecone:`, error)
      // Continue anyway - database deletion is more critical
    }

    logger.info(`Deleted FAQ ${id}`)

    return res.status(200).json({
      success: true,
      data: { deleted: true }
    })

  } catch (error) {
    logger.error(`Failed to delete FAQ ${id}:`, error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete FAQ'
    })
  }
} 