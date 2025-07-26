import type { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '@/lib/logger'
import { faqGeneratorService } from '@/lib/faqGenerator'

interface GenerateWithReviewRequest {
  documentId: string
  categoryOverride?: string
  userId?: string
}

interface GenerateWithReviewResponse {
  success: boolean
  data?: {
    stats: {
      candidatesGenerated: number
      duplicatesFound: number
      duplicatesEnhanced: number
      newFAQsCreated: number
      processingTime: number
      averageConfidence: number
    }
    potentialDuplicates?: Array<{
      candidateFAQ: {
        question: string
        answer: string
        category: string
        confidence: number
      }
      duplicateMatches: Array<{
        id: string
        score: number
        metadata: {
          category: string
          status: string
          question: string
        }
        existingAnswer?: string
      }>
    }>
  }
  error?: string
}

async function handleGenerateWithReview(
  req: NextApiRequest,
  res: NextApiResponse<GenerateWithReviewResponse>
) {
  try {
    const { documentId, categoryOverride, userId } = req.body as GenerateWithReviewRequest

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      })
    }

    logger.info(`Starting FAQ candidate generation with duplicate review for document: ${documentId}`)

    const result = await faqGeneratorService.generateFAQCandidatesWithDuplicateCheck({
      documentId,
      categoryOverride,
      userId
    })

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'FAQ candidate generation failed'
      })
    }

    logger.info(`FAQ candidate generation completed: ${result.stats.candidatesGenerated} candidates, ${result.stats.duplicatesFound} potential duplicates`)

    return res.status(200).json({
      success: true,
      data: {
        stats: result.stats,
        potentialDuplicates: result.potentialDuplicates
      }
    })

  } catch (error) {
    logger.error('FAQ candidate generation with review failed:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateWithReviewResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    })
  }

  return handleGenerateWithReview(req, res)
} 