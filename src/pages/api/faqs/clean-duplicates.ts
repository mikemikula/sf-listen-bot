import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { pineconeService } from '@/lib/pinecone'

interface CleanDuplicatesResponse {
  success: boolean
  data?: {
    duplicatesRemoved: number
    totalFAQs: number
    duplicateGroups: Array<{
      question: string
      duplicateCount: number
      keptFAQ: string
      removedFAQs: string[]
    }>
  }
  error?: string
}

/**
 * Clean duplicate FAQs using semantic similarity
 */
async function handleCleanDuplicates(
  req: NextApiRequest,
  res: NextApiResponse<CleanDuplicatesResponse>
) {
  try {
    logger.info('Starting duplicate FAQ cleanup process')

    // Get all FAQs
    const allFAQs = await db.fAQ.findMany({
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
        createdAt: true,
        status: true
      },
      orderBy: {
        createdAt: 'asc' // Keep the oldest version of duplicates
      }
    })

    logger.info(`Found ${allFAQs.length} total FAQs to analyze`)

    if (allFAQs.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          duplicatesRemoved: 0,
          totalFAQs: 0,
          duplicateGroups: []
        }
      })
    }

    const duplicateGroups: Array<{
      question: string
      duplicateCount: number
      keptFAQ: string
      removedFAQs: string[]
    }> = []
    
    const processedFAQs = new Set<string>()
    let totalDuplicatesRemoved = 0

    // Process each FAQ to find duplicates
    for (const faq of allFAQs) {
      if (processedFAQs.has(faq.id)) {
        continue // Already processed as part of a duplicate group
      }

      try {
        // Use Pinecone to find similar FAQs
        const duplicateCheck = await pineconeService.findDuplicateFAQs({
          question: faq.question,
          answer: faq.answer,
          category: faq.category
        })

        if (duplicateCheck.isDuplicate && duplicateCheck.matches.length > 1) {
          // Found duplicates - group them by similarity
          const duplicateIds = duplicateCheck.matches
            .filter(match => match.score >= 0.85) // 85% similarity threshold
            .map(match => match.id)
            .filter(id => !processedFAQs.has(id))

          if (duplicateIds.length > 1) {
            // Keep the oldest FAQ (first in our ordered list)
            const keptFAQ = faq
            const duplicatesToRemove = duplicateIds.filter(id => id !== keptFAQ.id)

            if (duplicatesToRemove.length > 0) {
              // Delete duplicate FAQs and their relationships
              // IMPROVED: Better error handling following SOLID principles
              for (const duplicateId of duplicatesToRemove) {
                try {
                  // Step 1: Check if FAQ exists before attempting deletion (DRY principle)
                  const existingFAQ = await db.fAQ.findUnique({
                    where: { id: duplicateId },
                    select: { id: true }
                  })

                  if (!existingFAQ) {
                    logger.warn(`FAQ ${duplicateId} not found in database (stale Pinecone data) - cleaning up Pinecone only`)
                    
                    // Clean up stale Pinecone reference
                    try {
                      await pineconeService.deleteFAQEmbedding(duplicateId)
                      logger.info(`Cleaned up stale Pinecone embedding for: ${duplicateId}`)
                    } catch (pineconeError) {
                      logger.warn(`Failed to clean up Pinecone embedding for ${duplicateId}:`, pineconeError)
                    }
                    
                    processedFAQs.add(duplicateId)
                    continue // Skip database deletion since FAQ doesn't exist
                  }

                  // Step 2: Delete relationships first (referential integrity)
                  await db.documentFAQ.deleteMany({
                    where: { faqId: duplicateId }
                  })

                  await db.messageFAQ.deleteMany({
                    where: { faqId: duplicateId }
                  })

                  // Step 3: Delete the FAQ itself
                  await db.fAQ.delete({
                    where: { id: duplicateId }
                  })

                  // Step 4: Clean up Pinecone embedding
                  try {
                    await pineconeService.deleteFAQEmbedding(duplicateId)
                    logger.info(`Deleted FAQ embedding for: ${duplicateId}`)
                  } catch (pineconeError) {
                    logger.warn(`Failed to delete Pinecone embedding for ${duplicateId}:`, pineconeError)
                    // Continue - don't fail the entire operation for Pinecone issues
                  }

                  processedFAQs.add(duplicateId)
                  totalDuplicatesRemoved++

                  logger.info(`Deleted duplicate FAQ: ${duplicateId}`)
                } catch (deleteError) {
                  // IMPROVED: More specific error handling with better logging
                  if (deleteError instanceof Error && deleteError.message.includes('Record to delete does not exist')) {
                    logger.warn(`FAQ ${duplicateId} already deleted - skipping (concurrent deletion)`)
                    processedFAQs.add(duplicateId)
                  } else {
                    logger.error(`Failed to delete duplicate FAQ ${duplicateId}:`, deleteError)
                  }
                }
              }

              duplicateGroups.push({
                question: keptFAQ.question.substring(0, 100) + '...',
                duplicateCount: duplicatesToRemove.length,
                keptFAQ: keptFAQ.id,
                removedFAQs: duplicatesToRemove
              })
            }
          }

          // Mark all FAQs in this group as processed
          duplicateIds.forEach(id => processedFAQs.add(id))
        }

        processedFAQs.add(faq.id)

      } catch (error) {
        logger.warn(`Failed to check duplicates for FAQ ${faq.id}:`, error)
        processedFAQs.add(faq.id)
      }
    }

    const remainingFAQs = allFAQs.length - totalDuplicatesRemoved

    logger.info(`Duplicate cleanup completed: removed ${totalDuplicatesRemoved} duplicates, ${remainingFAQs} FAQs remain`)

    return res.status(200).json({
      success: true,
      data: {
        duplicatesRemoved: totalDuplicatesRemoved,
        totalFAQs: remainingFAQs,
        duplicateGroups
      }
    })

  } catch (error) {
    logger.error('Failed to clean duplicate FAQs:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CleanDuplicatesResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    })
  }

  return handleCleanDuplicates(req, res)
} 