/**
 * PII Test Data API Endpoint
 * Creates sample PII detections for testing the review dashboard
 * Only for development/testing purposes
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { PIIType, PIIStatus, PIISourceType } from '@/types'

/**
 * Sample PII test data
 */
const TEST_PII_DETECTIONS = [
  {
    piiType: PIIType.EMAIL,
    originalText: 'john.doe@gmail.com',
    replacementText: '[PERSONAL_EMAIL]',
    confidence: 0.95,
    sourceType: PIISourceType.MESSAGE
  },
  {
    piiType: PIIType.PHONE, 
    originalText: '(555) 123-4567',
    replacementText: '[PERSONAL_PHONE]',
    confidence: 0.88,
    sourceType: PIISourceType.MESSAGE
  },
  {
    piiType: PIIType.NAME,
    originalText: 'Sarah Johnson',
    replacementText: '[PERSON_NAME]',
    confidence: 0.92,
    sourceType: PIISourceType.MESSAGE
  },
  {
    piiType: PIIType.URL,
    originalText: 'https://mybank.com/account/12345',
    replacementText: '[SENSITIVE_URL]',
    confidence: 0.85,
    sourceType: PIISourceType.MESSAGE
  },
  {
    piiType: PIIType.EMAIL,
    originalText: 'customer.service@example.com',
    replacementText: '[BUSINESS_EMAIL]',
    confidence: 0.75,
    sourceType: PIISourceType.MESSAGE
  },
  {
    piiType: PIIType.CUSTOM,
    originalText: 'SSN: 123-45-6789',
    replacementText: '[SSN]',
    confidence: 0.98,
    sourceType: PIISourceType.MESSAGE
  }
]

/**
 * Handle test data creation
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    res.status(405).json({ 
      error: 'Method not allowed',
      allowedMethods: ['POST']
    })
    return
  }

  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({
      error: 'Test data endpoint not available in production'
    })
    return
  }

  try {
    // Create a test message first (if none exists)
    let testMessage
    const existingMessage = await db.message.findFirst({
      where: { username: 'test-user' }
    })

    if (!existingMessage) {
      testMessage = await db.message.create({
        data: {
          slackId: 'test-msg-001',
          text: 'This is a test message containing PII for testing purposes.',
          userId: 'U123TEST',
          username: 'test-user',
          channel: 'C123TEST',
          timestamp: new Date(),
          threadTs: null,
          isThreadReply: false,
          parentMessageId: null
        }
      })
    } else {
      testMessage = existingMessage
    }

    // Clear ALL existing test detections to avoid status conflicts
    await db.pIIDetection.deleteMany({
      where: {
        OR: [
          { sourceId: testMessage.id },
          { originalText: { in: TEST_PII_DETECTIONS.map(d => d.originalText) } }
        ]
      }
    })

    // Create test PII detections
    const createdDetections = []
    for (const testDetection of TEST_PII_DETECTIONS) {
      const detection = await db.pIIDetection.create({
        data: {
          sourceType: testDetection.sourceType,
          sourceId: testMessage.id,
          piiType: testDetection.piiType,
          originalText: testDetection.originalText,
          replacementText: testDetection.replacementText,
          confidence: testDetection.confidence,
          status: PIIStatus.PENDING_REVIEW
        }
      })
      createdDetections.push(detection)
    }

    logger.info(`Created ${createdDetections.length} test PII detections`)

    res.json({
      success: true,
      message: `Created ${createdDetections.length} test PII detections`,
      data: {
        detectionsCreated: createdDetections.length,
        messageId: testMessage.id,
        detections: createdDetections.map(d => ({
          id: d.id,
          type: d.piiType,
          originalText: d.originalText,
          confidence: d.confidence
        }))
      }
    })

  } catch (error) {
    logger.error('Failed to create test PII data:', error)
    res.status(500).json({
      error: 'Failed to create test data',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 