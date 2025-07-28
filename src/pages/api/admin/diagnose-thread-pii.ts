import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

interface DiagnoseResult {
  success: boolean
  diagnosis?: {
    parentMessage: {
      id: string
      slackId: string
      text: string
      piiCount: number
    }
    threadReplies: Array<{
      id: string
      slackId: string
      text: string
      timestamp: string
      piiDetections: Array<{
        id: string
        piiType: string
        status: string
        originalText: string
      }>
      shouldHavePII: boolean
      diagnosis: string
    }>
    potentialIssues: string[]
  }
  error?: string
}

/**
 * Comprehensive diagnostic endpoint for thread reply PII issues
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DiagnoseResult>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    logger.info('Running comprehensive thread PII diagnosis...')

    // Find messages with thread replies
    const messagesWithThreads = await db.message.findMany({
      where: {
        isThreadReply: false,
        threadReplies: {
          some: {}
        }
      },
      include: {
        threadReplies: {
          include: {
            piiDetections: true
          },
          orderBy: {
            timestamp: 'asc'
          }
        },
        piiDetections: true
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 5
    })

    const diagnosis = []
    const potentialIssues = []

    for (const message of messagesWithThreads) {
      const threadRepliesAnalysis = message.threadReplies.map(reply => {
        // Check if the reply text contains obvious PII patterns
        const hasEmailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(reply.text)
        const hasPhonePattern = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/.test(reply.text)
        const shouldHavePII = hasEmailPattern || hasPhonePattern

        let diagnosis = 'Normal - no PII patterns detected'
        if (shouldHavePII && reply.piiDetections.length === 0) {
          diagnosis = '⚠️ ISSUE: Contains PII patterns but no detections found'
          potentialIssues.push(`Thread reply ${reply.id} has PII patterns but no detections`)
        } else if (shouldHavePII && reply.piiDetections.length > 0) {
          diagnosis = '✅ PII correctly detected'
        }

        return {
          id: reply.id,
          slackId: reply.slackId,
          text: reply.text.substring(0, 100),
          timestamp: reply.timestamp.toISOString(),
          piiDetections: reply.piiDetections.map(p => ({
            id: p.id,
            piiType: p.piiType,
            status: p.status,
            originalText: p.originalText
          })),
          shouldHavePII,
          diagnosis
        }
      })

      diagnosis.push({
        parentMessage: {
          id: message.id,
          slackId: message.slackId,
          text: message.text.substring(0, 100),
          piiCount: message.piiDetections.length
        },
        threadReplies: threadRepliesAnalysis
      })
    }

    // Check for common issues
    if (potentialIssues.length === 0) {
      potentialIssues.push('No obvious issues detected - PII detection appears to be working')
    }

    return res.status(200).json({
      success: true,
      diagnosis: {
        parentMessage: diagnosis[0]?.parentMessage || { id: '', slackId: '', text: '', piiCount: 0 },
        threadReplies: diagnosis[0]?.threadReplies || [],
        potentialIssues
      }
    })

  } catch (error) {
    logger.error('Thread PII diagnosis failed:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 