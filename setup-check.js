#!/usr/bin/env node

/**
 * SF Listen Bot - Setup Verification Script
 * Checks all required environment variables and service connections
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' })

console.log('🔍 SF Listen Bot - Setup Verification\n')

// Required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'DIRECT_URL', 
  'GEMINI_API_KEY',
  'PINECONE_API_KEY',
  'PINECONE_ENVIRONMENT',
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET',
  'REDIS_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL'
]

let allGood = true

// Check environment variables
console.log('📋 Checking Environment Variables:')
requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar]
  if (value) {
    console.log(`✅ ${envVar}: Set (${value.length > 10 ? 'Hidden' : value})`)
  } else {
    console.log(`❌ ${envVar}: Missing`)
    allGood = false
  }
})

console.log('\n🔧 Service Check:')

// Check Redis connection
try {
  const redis = require('redis')
  const client = redis.createClient({ url: process.env.REDIS_URL })
  
  client.on('error', (err) => {
    console.log('❌ Redis: Connection failed')
    allGood = false
  })
  
  client.connect().then(() => {
    console.log('✅ Redis: Connected successfully')
    client.quit()
  }).catch(() => {
    console.log('❌ Redis: Connection failed')
    allGood = false
  })
} catch (error) {
  console.log('❌ Redis: Not configured or dependency missing')
  allGood = false
}

// Check if Prisma is ready
try {
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  
  prisma.$connect().then(() => {
    console.log('✅ Database: Connected successfully')
    return prisma.$disconnect()
  }).catch((error) => {
    console.log('❌ Database: Connection failed')
    console.log(`   Error: ${error.message}`)
    allGood = false
  })
} catch (error) {
  console.log('❌ Database: Prisma client error')
  allGood = false
}

setTimeout(() => {
  console.log('\n🎯 Setup Status:')
  if (allGood) {
    console.log('✅ All systems ready! You can now run: pnpm dev')
  } else {
    console.log('❌ Setup incomplete. Please fix the issues above.')
    console.log('\n📚 Quick fixes:')
    console.log('   1. Create .env.local file with all required variables')
    console.log('   2. Get API keys from:')
    console.log('      - Gemini: https://aistudio.google.com/app/apikey')
    console.log('      - Pinecone: https://app.pinecone.io/')
    console.log('   3. Start Redis: brew services start redis')
    console.log('   4. Check database connection')
  }
}, 2000) 