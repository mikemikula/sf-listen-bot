/**
 * Bulk FAQ Generation API Endpoint
 * Handles bulk FAQ generation across multiple documents for automation system
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { faqGeneratorService } from '@/lib/faqGenerator'
import { ApiResponse } from '@/types'

interface BulkGenerateRequest {
  type: string
  data: {
    template: string
    maxFAQsPerRun?: number
    minDocumentsRequired?: number
    requireApproval?: boolean
    categories?: string[]
    // NEW: Configurable message processing limits
    maxUnprocessedMessages?: number    // Max messages to process into documents per run (default: 50)
    messageBatchSize?: number          // Batch size for processing messages (default: 25)  
    maxDocumentsPerRun?: number        // Max documents to process for FAQ generation (default: 50)
    messageProcessingEnabled?: boolean // Whether to process unprocessed messages (default: true)
    faqGenerationEnabled?: boolean     // Whether to generate FAQs from documents (default: true)
    [key: string]: any
  }
}

interface BulkGenerateResponse {
  newDocumentsCreated: number
  documentsProcessed: number
  faqsGenerated: number
  errors: string[]
  message: string
}

/**
 * Handle POST request - Generate FAQs from multiple documents
 */
async function handleBulkGenerateFAQs(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<BulkGenerateResponse>>
) {
  try {
    const { type, data } = req.body as BulkGenerateRequest

    if (type !== 'faq') {
      return res.status(400).json({
        success: false,
        error: 'Invalid processing type. Expected "faq"'
      })
    }

    const {
      template = 'automation',
      maxFAQsPerRun = 10,
      minDocumentsRequired = 2,
      requireApproval = false,
      categories = [],
      // NEW: Configurable message processing limits
      maxUnprocessedMessages = 50,
      messageBatchSize = 25, // ✅ Larger default to reduce conversation splitting
      maxDocumentsPerRun = 50,
      messageProcessingEnabled = true,
      faqGenerationEnabled = true
    } = data

    logger.info(`🚀 Starting bulk FAQ generation`, {
      template,
      maxFAQsPerRun,
      minDocumentsRequired,
      categories
    })

    // Step 1: First process any unprocessed messages into documents
    logger.info(`📋 Step 1: Processing unprocessed messages into documents...`)
    
    const unprocessedMessages = await db.message.findMany({
      where: {
        documentMessages: { none: {} }
      },
      take: maxUnprocessedMessages, // Now configurable!
      orderBy: { timestamp: 'asc' } // ✅ Order chronologically to keep related messages together
    })

    logger.info(`📊 Found ${unprocessedMessages.length} unprocessed messages`)

    let newDocumentsCreated = 0
    if (unprocessedMessages.length > 0) {
      try {
        // Import document processor service
        const { documentProcessorService } = await import('@/lib/documentProcessor')
        
        // Process messages in configurable batches
        // ⚠️  Note: Batching may split related conversations across documents
        // ✅ Best practice: Use larger batch sizes (20-50) to minimize this issue
        for (let i = 0; i < unprocessedMessages.length; i += messageBatchSize) {
          const batch = unprocessedMessages.slice(i, i + messageBatchSize)
          
          const processingInput = {
            messageIds: batch.map(m => m.id),
            options: {
              autoTitle: true,
              autoCategory: true,
              categoryHint: categories.length > 0 ? categories[0] : 'general'
            }
          }

          const result = await documentProcessorService.processDocument(processingInput)
          if (result.document) {
            newDocumentsCreated++
            logger.info(`✅ Created document: ${result.document.title}`)
          }
          
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error) {
        logger.error('⚠️ Error processing messages into documents:', error)
      }
    }

    // Initialize FAQ processing variables
    let documentsProcessed = 0
    let faqsGenerated = 0
    const errors: string[] = []

    // Step 2: Generate FAQs from documents (if enabled)
    if (faqGenerationEnabled) {
      logger.info(`📋 Step 2: Finding eligible documents for FAQ generation...`)

    // Step 2: Find eligible documents for FAQ generation (including newly created ones)
    const eligibleDocuments = await db.processedDocument.findMany({
      where: {
        status: 'COMPLETE',
        // NOTE: No category filtering here - documents can contain multi-topic content
        // that generates FAQs across different categories
        // Exclude documents that already have many FAQs
        documentFAQs: {
          every: {
            faq: {
              status: 'APPROVED'
            }
          }
        }
      },
      take: Math.min(maxFAQsPerRun, maxDocumentsPerRun), // Now uses both limits!
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        documentFAQs: {
          include: {
            faq: true
          }
        }
      }
    })

    if (eligibleDocuments.length < minDocumentsRequired) {
      logger.info(`📋 Insufficient documents found. Found ${eligibleDocuments.length}, required ${minDocumentsRequired}`)
      
      return res.status(200).json({
        success: true,
        data: {
          newDocumentsCreated,
          documentsProcessed: 0,
          faqsGenerated: 0,
          errors: [],
          message: `No FAQs generated - insufficient documents. Created ${newDocumentsCreated} documents, found ${eligibleDocuments.length}, required ${minDocumentsRequired}`
        },
        message: `Created ${newDocumentsCreated} documents but insufficient for FAQ generation`
      })
    }

      logger.info(`📋 Found ${eligibleDocuments.length} eligible documents for FAQ generation`)

    // Process each document
    for (const document of eligibleDocuments) {
      try {
        // Skip documents that already have FAQs if this is automation template
        if (template === 'automation' && document.documentFAQs.length > 0) {
          continue
        }

        logger.info(`🔄 Generating FAQs for document: ${document.id} (${document.title})`)

        // Generate FAQs for this document
        const result = await faqGeneratorService.generateFAQsFromDocument({
          documentId: document.id,
          categoryOverride: document.category,
          userId: 'automation-system'
        })



        if (result.success) {
          documentsProcessed++
          faqsGenerated += result.stats.newFAQsCreated
          
          logger.info(`✅ Generated ${result.stats.newFAQsCreated} FAQs for document ${document.id}`)
        } else {
          errors.push(`Document ${document.id}: ${result.error}`)
          logger.warn(`⚠️ Failed to generate FAQs for document ${document.id}: ${result.error}`)
        }

        // Respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        const errorMsg = `Document ${document.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMsg)
        logger.error(`❌ Error processing document ${document.id}:`, error)
      }
    }
    } else {
      logger.info(`📋 Step 2: FAQ generation disabled, skipping FAQ generation`)
    }

    const message = `Bulk FAQ generation completed. Created ${newDocumentsCreated} documents from ${messageProcessingEnabled ? maxUnprocessedMessages : 0} messages (max), processed ${documentsProcessed} documents, generated ${faqsGenerated} FAQs`
    
    logger.info(`🎉 ${message}`, {
      newDocumentsCreated,
      documentsProcessed,
      faqsGenerated,
      errorCount: errors.length
    })

    return res.status(200).json({
      success: true,
      data: {
        newDocumentsCreated,
        documentsProcessed,
        faqsGenerated,
        errors,
        message
      },
      message
    })

  } catch (error) {
    logger.error('❌ Bulk FAQ generation failed:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

/**
 * Main handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<BulkGenerateResponse>>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    })
  }

  return handleBulkGenerateFAQs(req, res)
} 