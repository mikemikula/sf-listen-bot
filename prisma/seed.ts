import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create default automation rules
  console.log('📋 Creating automation rules...')
  
  await prisma.automationRule.upsert({
    where: { id: 'doc-automation' },
    update: {},
    create: {
      id: 'doc-automation',
      name: 'Document Processing',
      description: 'Automatically process messages into documents',
      enabled: true,
      createdBy: 'system',
      schedule: '0 */6 * * *', // Every 6 hours
      jobConfig: {
        type: 'document',
        parameters: {
          batchSize: 50,
          maxDocumentsPerRun: 100,
          requireApproval: false
        }
      }
    }
  })

  await prisma.automationRule.upsert({
    where: { id: 'faq-automation' },
    update: {},
    create: {
      id: 'faq-automation',
      name: 'FAQ Generation',
      description: 'Automatically generate FAQs from processed documents',
      enabled: true,
      createdBy: 'system',
      schedule: '0 8 * * *', // Daily at 8 AM
      jobConfig: {
        type: 'faq',
        parameters: {
          maxFAQsPerRun: 10,
          minDocumentsRequired: 0,
          requireApproval: false,
          categories: ['technical', 'general', 'product'],
          qualityThreshold: 0.7,
          maxUnprocessedMessages: 50,
          messageBatchSize: 25,
          messageProcessingEnabled: true,
          faqGenerationEnabled: true
        }
      }
    }
  })

  // Create default processing settings
  console.log('⚙️ Creating processing settings...')
  
  await prisma.processingSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      settings: {
        name: 'Default Processing Settings',
        description: 'Default settings for message and document processing',
        batchSize: 100,
        maxRetries: 3,
        timeout: 30000,
        enablePIIDetection: true,
        enableAutoProcessing: false,
        documentProcessing: {
          enabled: true,
          minMessageLength: 10,
          maxDocumentSize: 50
        },
        faqGeneration: {
          enabled: true,
          minConfidenceScore: 0.7,
          maxFAQsPerDocument: 20
        }
      }
    }
  })

  console.log('✅ Database seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 