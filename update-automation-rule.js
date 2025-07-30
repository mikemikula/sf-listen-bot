/**
 * Script to update FAQ automation rule with better defaults
 */

const { PrismaClient } = require('@prisma/client')

async function updateAutomationRule() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔄 Updating FAQ automation rule...')
    
    const result = await prisma.automationRule.update({
      where: { id: 'faq-automation' },
      data: {
        jobConfig: {
          type: 'faq',
          parameters: {
            maxFAQsPerRun: 10,
            minDocumentsRequired: 0,
            requireApproval: false,
            categories: ['technical', 'general', 'product'],
            qualityThreshold: 0.7
          }
        }
      }
    })
    
    console.log('✅ Successfully updated FAQ automation rule:', result.name)
    console.log('📋 New settings:', JSON.stringify(result.jobConfig, null, 2))
    
  } catch (error) {
    console.error('❌ Failed to update automation rule:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

updateAutomationRule().catch(console.error) 