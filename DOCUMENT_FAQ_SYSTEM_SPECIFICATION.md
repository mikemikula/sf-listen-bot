# SF Listen Bot - Document Processing & FAQ Generation Master Plan

## 🎯 Overview

This master plan outlines the complete implementation of a system to process Slack messages into structured documents and generate FAQ content for an eventual AI agent system. The goal is to create a pipeline that:

1. **Identifies unprocessed messages** that contain Q&A patterns
2. **Processes messages into documents** with conversation context
3. **Removes PII information** from processed content
4. **Generates FAQs** from processed documents
5. **Provides comprehensive management interfaces** for reviewing and approving content
6. **Enables manual curation** for complete user control

## 🏗️ Architecture Overview

```
Messages → Document Processor → PII Removal → Document Storage → FAQ Generator → FAQ Storage → Agent Ready Data
    ↓           ↓                    ↓              ↓               ↓               ↓
Manual      Gemini AI          AI + Rules     Junction Tables   Gemini AI    User Approval
Selection   Analysis           Detection      Full Traceability  Generation   Workflow
                                                     ↓               ↓
                                              PostgreSQL     Pinecone Vector DB
                                              (Structured)   (Embeddings)
```

**Hybrid Database Architecture:**
- **PostgreSQL**: Stores all structured data, relationships, and business logic
- **Pinecone**: Stores Gemini embeddings for lightning-fast similarity search
- **Together**: Scalable duplicate prevention that handles millions of FAQs

## 📊 Database Schema with Junction Tables

### **Core Models**

#### **1. ProcessedDocument**
```sql
- id: string (primary key)
- title: string
- description: string
- category: string
- status: enum (DRAFT, PROCESSING, COMPLETE, ERROR)
- processingJobId: string (foreign key)
- confidenceScore: float (0-1, overall document quality)
- createdAt: datetime
- updatedAt: datetime
- createdBy: string (user ID if manually created)
```

#### **2. FAQ**
```sql
- id: string (primary key)
- question: string
- answer: string
- category: string
- status: enum (PENDING, APPROVED, REJECTED, ARCHIVED)
- confidenceScore: float (0-1, AI confidence in FAQ quality)
- approvedBy: string (user ID)
- approvedAt: datetime
- createdAt: datetime
- updatedAt: datetime
```

#### **3. DocumentProcessingJob**
```sql
- id: string (primary key)
- status: enum (QUEUED, PROCESSING, COMPLETE, FAILED)
- jobType: enum (DOCUMENT_CREATION, DOCUMENT_ENHANCEMENT, FAQ_GENERATION)
- inputData: json (messages, parameters, etc.)
- outputData: json (results, metrics, etc.)
- errorMessage: string
- progress: float (0-1)
- startedAt: datetime
- completedAt: datetime
- createdBy: string (user ID)
```

#### **4. PIIDetection**
```sql
- id: string (primary key)
- sourceType: enum (MESSAGE, DOCUMENT)
- sourceId: string
- piiType: enum (EMAIL, PHONE, NAME, URL, CUSTOM)
- originalText: string
- replacementText: string
- confidence: float (0-1, detection confidence)
- status: enum (AUTO_REPLACED, PENDING_REVIEW, WHITELISTED, FLAGGED)
- reviewedBy: string (user ID)
- reviewedAt: datetime
- createdAt: datetime
```

### **Junction Tables for Full Traceability**

#### **DocumentMessage** (Message ↔ Document relationship)
```sql
- id: string (primary key)
- documentId: string (foreign key to ProcessedDocument)
- messageId: string (foreign key to Message)
- inclusionMethod: enum (AI_AUTOMATIC, USER_MANUAL, USER_ENHANCED)
- messageRole: enum (QUESTION, ANSWER, CONTEXT, FOLLOW_UP, CONFIRMATION)
- addedBy: string (user ID if manual addition)
- addedAt: datetime
- processingConfidence: float (0-1, how confident AI was about including this)
- removalReason: string (if later removed from document)
```

#### **DocumentFAQ** (Document ↔ FAQ relationship)
```sql
- id: string (primary key)
- documentId: string (foreign key to ProcessedDocument)
- faqId: string (foreign key to FAQ)
- generationMethod: enum (AI_GENERATED, USER_CREATED, HYBRID)
- sourceMessageIds: string[] (specific messages that created this FAQ)
- confidenceScore: float (AI confidence in this FAQ)
- createdAt: datetime
- generatedBy: string (user ID if manually created)
```

#### **MessageFAQ** (Direct Message ↔ FAQ traceability)
```sql
- id: string (primary key)  
- messageId: string (foreign key to Message)
- faqId: string (foreign key to FAQ)
- contributionType: enum (PRIMARY_QUESTION, PRIMARY_ANSWER, SUPPORTING_CONTEXT)
- documentId: string (which document facilitated this relationship)
- createdAt: datetime
```

#### **MessageSelection** (Manual curation support)
```sql
- id: string (primary key)
- userId: string (who made the selection)
- selectionName: string ("Password Reset Research")
- messageIds: string[] (array of selected message IDs)
- createdAt: datetime
- purpose: enum (DOCUMENT_CREATION, DOCUMENT_ENHANCEMENT, RESEARCH)
```

#### **CurationActivity** (User activity tracking)
```sql
- id: string (primary key)
- userId: string
- activityType: enum (MESSAGE_ADDED, DOCUMENT_MERGED, MESSAGES_SELECTED)
- targetId: string (document/selection ID)
- details: json (what changed)
- timestamp: datetime
```

### **Relationship Schema**
```sql
Message → DocumentMessage ← ProcessedDocument → DocumentFAQ ← FAQ
    ↓            ↓                    ↓             ↓        ↓
PIIDetection  MessageRole    DocumentProcessingJob  FAQSource  FAQApproval
    ↓            ↓                    ↓             ↓        ↓
MessageSelection CurationActivity    BackgroundJobs   MessageFAQ Direct Impact
```

## 🛠️ Core Processing Components

### **1. Gemini API Integration (`src/lib/gemini.ts`)**

**Configuration:**
- API key management with environment variables
- Model selection (gemini-1.5-pro for complex analysis)
- Rate limiting and quota management
- Request batching for efficiency

**Usage Patterns:**
- **Document Analysis**: Conversation boundary detection, Q&A extraction
- **PII Detection**: Contextual name recognition, false-positive reduction  
- **FAQ Generation**: Question normalization, answer quality scoring
- **Content Categorization**: Semantic topic classification

**Error Handling:**
- API rate limit retry with exponential backoff
- Fallback to rule-based processing for critical functions
- Comprehensive logging of API interactions
- Usage analytics and cost monitoring

### **2. Document Processor (`src/lib/documentProcessor.ts`)**

**Gemini-Powered Features:**
- **AI-driven conversation boundary detection**
- **Semantic Q&A pair identification** 
- **Context preservation** with understanding
- **Batch processing** with API rate limiting

**Processing Workflow:**
```
Selected Messages → Conversation Analysis → Thread Structure → PII Scan → 
Document Creation → Confidence Scoring → FAQ Candidate Generation
```

### **3. PII Detector (`src/lib/piiDetector.ts`)**

**Gemini-Enhanced Detection:**
- **AI-powered contextual PII identification**
- Email addresses (regex + context validation)
- Phone numbers (pattern + format recognition)  
- URLs (potentially sensitive domains)
- Names (Gemini semantic analysis + heuristics)
- Custom patterns (configurable + AI-suggested)
- **Contextual false-positive reduction**

**Removal Strategy:**
- Replace with semantic placeholders (`[EMAIL]`, `[PHONE]`, `[PERSON_NAME]`, etc.)
- **Gemini-powered readability preservation**
- Comprehensive logging for manual review
- AI-suggested whitelist exceptions
- Context-aware replacement strategies

### **4. FAQ Generator (`src/lib/faqGenerator.ts`)**

**Gemini-Powered Process:**
1. **AI-driven document analysis** for conversation patterns
2. **Semantic question identification** using Gemini understanding
3. **Context-aware answer extraction** with quality scoring
4. **Intelligent question normalization** (similar intent detection)
5. **AI-suggested categorization** with confidence levels
6. **Multi-factor confidence scoring** using Gemini evaluation

**AI-Enhanced Quality Metrics:**
- **Semantic answer completeness** (Gemini-scored)
- **Question clarity assessment** (AI readability scoring)
- **Contextual relevance scoring** (conversation thread analysis)
- **Intent similarity detection** (duplicate question identification)
- **Answer accuracy confidence** (cross-reference validation)

### **5. Conversation Analyzer (`src/lib/conversationAnalyzer.ts`)**

**AI-Powered Analysis:**
- **Thread structure mapping** with parent/child relationships
- **Semantic question identification** patterns
- **Gemini-driven answer relationship** mapping
- **Intelligent context boundary** detection
- **Message role classification** (QUESTION, ANSWER, CONTEXT, etc.)

### **6. Background Job System (`src/lib/backgroundJobs.ts`)**

**Job Types:**
- Document processing jobs (Gemini-powered)
- FAQ generation jobs (AI-intensive)
- PII review jobs (hybrid AI + manual)
- Cleanup and maintenance jobs

**Features:**
- Priority queuing with AI job rate limiting
- Progress tracking with Gemini API usage metrics
- Error recovery with API failure handling
- Resource management (API quotas + processing power)

### **7. Pinecone Vector Database Service (`src/lib/pinecone.ts`)**

**Scalable Duplicate Prevention Architecture:**
```typescript
// Store FAQ embeddings in Pinecone for fast similarity search
const storeFAQEmbedding = async (faq: FAQ) => {
  const embedding = await gemini.generateEmbedding(
    `${faq.question} ${faq.answer}`
  )
  
  await pineconeIndex.upsert([{
    id: faq.id,
    values: embedding, // 768-dimensional Gemini embedding
    metadata: {
      category: faq.category,
      status: faq.status,
      question: faq.question.substring(0, 200)
    }
  }])
}

// Lightning-fast duplicate detection (sub-second for millions of FAQs)
const findDuplicateFAQs = async (newFAQ) => {
  const queryEmbedding = await gemini.generateEmbedding(
    `${newFAQ.question} ${newFAQ.answer}`
  )
  
  const results = await pineconeIndex.query({
    vector: queryEmbedding,
    topK: 10,
    includeMetadata: true,
    filter: {
      category: { $eq: newFAQ.category },
      status: { $in: ['PENDING', 'APPROVED'] }
    }
  })
  
  const duplicates = results.matches?.filter(m => m.score > 0.85) || []
  return { isDuplicate: duplicates.length > 0, matches: duplicates }
}
```

**Performance Characteristics:**
- **Query Time**: 10-50ms for millions of FAQs
- **Embedding Dimensions**: 768 (Gemini text-embedding-004)
- **Cost**: ~$32/month for 1M FAQs vs $207 with alternatives
- **Scalability**: Automatic scaling, no infrastructure management

**Cross-Document Duplicate Prevention:**
```typescript
// Enhanced FAQ instead of creating duplicate
const enhanceExistingFAQ = async (existingFAQ, newCandidate, newDocumentId) => {
  // Use Gemini to merge answers intelligently
  const enhancedAnswer = await gemini.mergeAnswers({
    existingAnswer: existingFAQ.answer,
    newAnswer: newCandidate.answer
  })
  
  // Update PostgreSQL with enhanced content
  await db.fAQ.update({
    where: { id: existingFAQ.id },
    data: { answer: enhancedAnswer }
  })
  
  // Update Pinecone with new embedding
  const newEmbedding = await gemini.generateEmbedding(enhancedAnswer)
  await pineconeIndex.upsert([{
    id: existingFAQ.id,
    values: newEmbedding
  }])
  
  // Track sources via junction tables
  await db.documentFAQ.create({
    data: {
      documentId: newDocumentId,
      faqId: existingFAQ.id,
      generationMethod: 'AI_ENHANCED'
    }
  })
}
```

## 🖥️ User Interface System

### **1. Processing Dashboard** (`/processing/dashboard`)

```
┌─ SF Listen Bot - Processing Dashboard ─────────────────────────────┐
│                                                                    │
│  📊 Processing Overview                                            │
│  ┌────────────────┬────────────────┬────────────────┬─────────────┐
│  │ Total Messages │ Processed Docs │ Generated FAQs │ Jobs Running│
│  │     2,847      │      156       │       89       │      3      │
│  └────────────────┴────────────────┴────────────────┴─────────────┘
│                                                                    │
│  🔄 Recent Processing Jobs                                         │
│  ┌──────────────────────────────────────────────────────────────┐
│  │ ✅ Document Processing | 45 messages → 12 documents | 2m ago  │
│  │ 🔄 FAQ Generation     | 8 documents → Processing... | 1m ago  │
│  │ ⏸️  PII Review Queue   | 23 items pending review   | 5m ago   │
│  └──────────────────────────────────────────────────────────────┘
│                                                                    │
│  [🚀 Process New Messages] [📋 View PII Queue] [📊 Full Report]   │
└────────────────────────────────────────────────────────────────────┘
```

### **2. Documents Management** (`/documents`)

```
┌─ Processed Documents ─────────────────────────────────────────────┐
│                                                                   │
│ 🔍 [Search...] 📅 [Last 30 days ▼] 📍 [All Channels ▼]          │
│                                                                   │
│ 📄 Password Reset Support Thread                      2 hours ago │
│ ├─ 💬 5 messages from #general                                   │
│ ├─ 👥 3 participants: alice, bob, support_bot                    │
│ ├─ 🤖 Generated 2 FAQ candidates                                 │
│ └─ 🔒 3 PII items removed: 2 emails, 1 name                     │
│    [👁️ View Full] [📝 Edit] [➕ Add Messages] [🤖 Generate FAQs] │
│                                                                   │
│ 📄 API Integration Questions                           5 hours ago │
│ ├─ 💬 12 messages from #dev-help                                 │
│ ├─ 👥 4 participants: dev1, dev2, senior_dev, product_mgr       │
│ ├─ 🤖 Generated 4 FAQ candidates                                 │
│ └─ 🔒 1 PII item removed: 1 email                                │
│    [👁️ View Full] [📝 Edit] [➕ Add Messages] [🤖 Generate FAQs] │
└───────────────────────────────────────────────────────────────────┘
```

### **3. Document Detail View** (`/documents/[id]`)

**Complete Junction Table Transparency:**
```
┌─ Document: Password Reset Support Thread ─────────────────────────┐
│                                                                   │
│ 📋 Document Metadata                                              │
│ ├─ Created: 2024-01-15 14:30:00                                  │
│ ├─ Source: 5 messages from #general thread                       │
│ ├─ Participants: alice, bob, support_bot                         │
│ ├─ Processing Status: ✅ Complete                                 │
│ └─ Confidence Score: 92% (High Quality Q&A detected)             │
│                                                                   │
│ 🔗 Source Messages (5 total) - Junction Table View               │
│ ┌─────────────────────────────────────────────────────────────────┐
│ │ 🔵 QUESTION | 💬 alice (2024-01-15 14:25:12) | ✅ AI Auto     │
│ │ "How do I reset my password? I tried the usual way but..."     │
│ │ 📊 Confidence: 95% | 🎯 Role: PRIMARY_QUESTION                │
│ │ [🔍 View Original] [📍 Go to Slack] [🔗 FAQs Using This]      │
│ │                                                                │
│ │ 🟢 ANSWER | 💬 support_bot (2024-01-15 14:25:45) | ✅ AI Auto │
│ │ "Hi alice! Go to settings, click forgot password, then..."    │
│ │ 📊 Confidence: 98% | 🎯 Role: PRIMARY_ANSWER                  │
│ │ [🔍 View Original] [📍 Go to Slack] [🔗 FAQs Using This]      │
│ │                                                                │
│ │ 🔘 CONFIRMATION | 💬 alice (2024-01-15 14:27:30) | 👤 Manual  │
│ │ "Perfect! That worked, thank you!"                            │
│ │ 📊 Confidence: N/A | 🎯 Role: CONFIRMATION | ✋ Added by: john │
│ │ [🔍 View Original] [📍 Go to Slack] [❌ Remove from Document]  │
│ └─────────────────────────────────────────────────────────────────┘
│                                                                   │
│ 🤖 Generated FAQs (2 items) - Junction Table View                │
│ ┌─────────────────────────────────────────────────────────────────┐
│ │ ✅ FAQ #1: "How to reset password" (Approved)                 │
│ │ 📊 Confidence: 94% | 🤖 Method: AI_GENERATED                  │
│ │ 🔗 Source Messages (3 used):                                  │
│ │   ├─ alice: "How do I reset..." (PRIMARY_QUESTION)            │
│ │   ├─ support_bot: "Go to settings..." (PRIMARY_ANSWER)        │
│ │   └─ alice: "What if email..." (SUPPORTING_CONTEXT)           │
│ │ [👁️ View FAQ] [📝 Edit] [🔗 Show Source Messages]             │
│ └─────────────────────────────────────────────────────────────────┘
│                                                                   │
│ [➕ Add More Messages] [🔗 Merge Documents] [🔄 Reprocess]        │
└───────────────────────────────────────────────────────────────────┘
```

### **4. FAQ Management** (`/faqs`)

**Complete Source Traceability:**
```
┌─ FAQ Management ─────────────────────────────────────────────────┐
│                                                                  │
│ 🎯 Status: [⏳ Pending (23)] [✅ Approved (45)] [❌ Rejected (5)]│
│ 🏷️ Category: [All ▼] 🔍 [Search FAQs...]                       │
│                                                                  │
│ ❓ How do I reset my password?                        ✅ Approved│
│ ├─ 📄 Source Document: Password Reset Support Thread           │
│ ├─ 🔗 Built from 3 specific messages (DocumentFAQ junction):   │
│ │   ├─ alice: "How do I reset..." (PRIMARY_QUESTION) 95% conf  │
│ │   ├─ support_bot: "Go to settings..." (PRIMARY_ANSWER) 98%   │
│ │   └─ alice: "What if email..." (SUPPORTING_CONTEXT) 87%      │
│ ├─ 👤 Generated from alice, support_bot conversation            │
│ ├─ 🎯 Overall Confidence: High (94%)                            │
│ ├─ 🏷️ Category: Account Management                              │
│ └─ 📅 Created: 2 hours ago | 🤖 Method: AI_GENERATED           │
│    [👁️ View Source Messages] [📝 Edit] [📤 Export] [❌ Reject] │
└──────────────────────────────────────────────────────────────────┘
```

### **5. Message Impact View** (`/messages/[id]/impact`)

**Reverse Traceability:**
```
┌─ Message Impact: alice's Password Question ──────────────────────────┐
│                                                                      │
│ 📝 Original Message                                                  │
│ ├─ 💬 alice (Jan 15, 2:25pm) #general                               │
│ ├─ "How do I reset my password? I tried the usual way but..."       │
│ └─ 🔗 Slack Link: https://slack.com/archives/C123/p1641234567       │
│                                                                      │
│ 📄 Documents Using This Message (2 total)                           │
│ ┌────────────────────────────────────────────────────────────────────┐
│ │ 📄 Password Reset Support Thread                                  │
│ │ ├─ 🎯 Role: PRIMARY_QUESTION (DocumentMessage junction)           │
│ │ ├─ 📊 Confidence: 95% | ✅ Method: AI_AUTOMATIC                   │
│ │ ├─ 📅 Added: Jan 15, 2:30pm                                       │
│ │ └─ [👁️ View Document] [📝 Edit Document] [❌ Remove from Doc]     │
│ │                                                                    │
│ │ 📄 Complete Account Management Guide                              │
│ │ ├─ 🎯 Role: SUPPORTING_CONTEXT (DocumentMessage junction)         │
│ │ ├─ 📊 Confidence: 87% | 👤 Method: USER_MANUAL                    │
│ │ ├─ 📅 Added: Jan 16, 10:15am | ✋ By: john                        │
│ │ └─ [👁️ View Document] [📝 Edit Document] [❌ Remove from Doc]     │
│ └────────────────────────────────────────────────────────────────────┘
│                                                                      │
│ ❓ FAQs Using This Message (3 total)                                 │
│ ┌────────────────────────────────────────────────────────────────────┐
│ │ ❓ "How to reset password" (✅ Approved)                          │
│ │ ├─ 🎯 Contribution: PRIMARY_QUESTION (MessageFAQ junction)        │
│ │ ├─ 📄 Via Document: Password Reset Support Thread                 │
│ │ ├─ 📊 Confidence: 94% | 🤖 Method: AI_GENERATED                   │
│ │ └─ [👁️ View FAQ] [📝 Edit FAQ] [🔗 View All Source Messages]     │
│ └────────────────────────────────────────────────────────────────────┘
│                                                                      │
│ 📊 Impact Summary                                                    │
│ ├─ 💡 This message contributed to 2 documents and 3 FAQs            │
│ ├─ 🎯 Primary role in 1 FAQ, supporting role in 2 FAQs              │
│ ├─ 📈 Average confidence score: 90%                                 │
│ └─ 🤖 2 AI-generated uses, 1 manually curated use                   │
└──────────────────────────────────────────────────────────────────────┘
```

## 🎛️ Manual Curation System

### **1. Message Browser & Selector** (`/messages/browse`)

**Smart Selection Interface:**
```
┌─ Message Browser - Select for Document Creation ─────────────────────┐
│                                                                      │
│ 🔍 [Search messages...] 📅 [Date range] 📍 [#general ▼] 👤 [All ▼] │
│ 🎯 [Show: All | Processed ✓ | Skipped | Never Processed]            │
│                                                                      │
│ 📊 Selected: 8 messages → [📄 Create Document] [🗑️ Clear Selection] │
│                                                                      │
│ ┌────────────────────────────────────────────────────────────────────┐
│ │ ☑️ 💬 alice (Jan 15, 2:25pm) #general                            │
│ │ "How do I reset my password? I've tried the usual steps..."       │
│ │ 🏷️ Status: ⏭️ Skipped (No Q&A pattern) | 👥 Thread: 5 replies    │
│ │ [👁️ View Thread] [📄 Current Documents] [🤖 AI Analysis]          │
│ │                                                                    │
│ │ ☑️ 💬 support_bot (Jan 15, 2:26pm) #general                       │
│ │ "Hi alice! For password resets, go to settings and..."            │
│ │ 🏷️ Status: ⏭️ Skipped (Auto-response detected) | ↪️ Reply to above │
│ │ [👁️ View Thread] [📄 Current Documents] [🤖 AI Analysis]          │
│ └────────────────────────────────────────────────────────────────────┘
│                                                                      │
│ 🔽 Advanced Selection                                                │
│ [📋 Select Entire Thread] [⚡ Smart Select Similar] [📥 Import List] │
└──────────────────────────────────────────────────────────────────────┘
```

### **2. Document Enhancement Interface** (`/documents/[id]/enhance`)

**AI-Assisted Addition:**
```
┌─ Enhance Document: Password Reset Support Thread ────────────────────┐
│                                                                      │
│ 📋 Current Document Contents (5 messages)                           │
│ ┌────────────────────────────────────────────────────────────────────┐
│ │ ✅ alice: "How do I reset my password?"                           │
│ │ ✅ support_bot: "Go to settings, click forgot password..."         │
│ │ ✅ alice: "Thanks! That worked."                                   │
│ └────────────────────────────────────────────────────────────────────┘
│                                                                      │
│ ➕ Add Related Messages (3 candidates found)                        │
│ ┌────────────────────────────────────────────────────────────────────┐
│ │ ☑️ 🔍 sarah (Jan 16): "Same password issue, but with 2FA..."      │
│ │    🤖 AI Confidence: High relevance (89%) | From: #general        │
│ │    💡 Would improve: 2FA troubleshooting section                   │
│ │                                                                    │
│ │ ☑️ 🔍 mike (Jan 14): "Password policy requirements?"              │
│ │    🤖 AI Confidence: Medium relevance (71%) | From: #support      │
│ │    💡 Would improve: Password requirements context                 │
│ └────────────────────────────────────────────────────────────────────┘
│                                                                      │
│ 📊 Impact Preview                                                    │
│ ├─ Original document: 92% confidence, 2 FAQ candidates              │
│ ├─ With additions: 94% confidence, 4 FAQ candidates                 │
│ └─ New topics covered: 2FA issues, password policies                │
│                                                                      │
│ [✅ Add Selected Messages] [🔄 Reprocess Document] [❌ Cancel]        │
└──────────────────────────────────────────────────────────────────────┘
```

### **3. Custom Document Creation** (`/documents/create`)

**Flexible Creation Options:**
```
┌─ Create Custom Document ──────────────────────────────────────────────┐
│                                                                      │
│ 📝 Document Details                                                  │
│ ├─ Title: [Password & Account Management FAQ]                       │
│ ├─ Category: [Support ▼]                                            │
│ └─ Description: [Comprehensive guide covering all password issues]   │
│                                                                      │
│ 🎯 Message Selection Strategy                                        │
│ ┌────────────────────────────────────────────────────────────────────┐
│ │ ⚡ Smart Collection                                                │
│ │ [🔍 Find Similar] Topic: "password reset" → Found 23 messages     │
│ │ [📅 Date Range] Jan 1-31 → Filtered to 18 messages               │
│ │ [📍 Channels] #general, #support → 15 messages                    │
│ │ [🤖 AI Filter] Q&A patterns only → 12 quality messages           │
│ │                                                                    │
│ │ ✋ Manual Selection                                                │
│ │ [📋 Browse All Messages] [📥 Import Message IDs] [🔗 From URLs]   │
│ └────────────────────────────────────────────────────────────────────┘
│                                                                      │
│ [🚀 Create Document] [👁️ Preview First] [💾 Save Draft]             │
└──────────────────────────────────────────────────────────────────────┘
```

### **4. Document Merging** (`/documents/merge`)

**Intelligent Combination:**
```
┌─ Merge Documents ─────────────────────────────────────────────────────┐
│                                                                      │
│ 🎯 Select Documents to Merge                                         │
│ ┌────────────────────────────────────────────────────────────────────┐
│ │ ☑️ 📄 Password Reset Support Thread (5 messages)                  │
│ │    Created: Jan 15 | FAQs: 2 | Confidence: 92%                   │
│ │                                                                    │
│ │ ☑️ 📄 Account Security Questions (8 messages)                     │
│ │    Created: Jan 16 | FAQs: 3 | Confidence: 87%                   │
│ └────────────────────────────────────────────────────────────────────┘
│                                                                      │
│ 📊 Merge Preview                                                     │
│ ├─ Combined messages: 13 total                                       │
│ ├─ Estimated FAQs: 6-8 (some duplicates will be merged)            │
│ ├─ Topics covered: Password reset, 2FA, security policies           │
│ └─ Predicted confidence: 94% (comprehensive coverage)                │
│                                                                      │
│ [🔗 Create Merged Document] [👁️ Preview Result] [❌ Cancel]          │
└──────────────────────────────────────────────────────────────────────┘
```

## 📁 Complete File Structure

### **New Files to Create**

```
src/
├── lib/
│   ├── documentProcessor.ts           # Core document processing logic
│   ├── piiDetector.ts                # PII detection and removal
│   ├── faqGenerator.ts               # FAQ generation from documents
│   ├── backgroundJobs.ts             # Job queue management
│   ├── conversationAnalyzer.ts       # Q&A pattern detection
│   ├── gemini.ts                     # Gemini API service and utilities
│   └── pinecone.ts                   # Pinecone vector database service
├── pages/api/
│   ├── documents/
│   │   ├── index.ts                  # Document CRUD operations
│   │   ├── process.ts                # Trigger document processing
│   │   ├── batch-process.ts          # Batch processing endpoint
│   │   ├── enhance.ts                # Add messages to existing documents
│   │   └── merge.ts                  # Merge multiple documents
│   ├── faqs/
│   │   ├── index.ts                  # FAQ CRUD operations
│   │   ├── generate.ts               # Generate FAQs from documents
│   │   └── approve.ts                # FAQ approval workflow
│   ├── processing/
│   │   ├── status.ts                 # Processing job status
│   │   └── queue.ts                  # Job queue management
│   └── curation/
│       ├── selections.ts             # Message selection management
│       └── activity.ts               # User curation activity
├── components/
│   ├── documents/
│   │   ├── DocumentCard.tsx          # Document display component
│   │   ├── DocumentFeed.tsx          # Document listing
│   │   ├── DocumentViewer.tsx        # Full document view
│   │   ├── DocumentEnhancer.tsx      # Add messages interface
│   │   ├── DocumentMerger.tsx        # Merge documents interface
│   │   └── ProcessingStatus.tsx      # Processing status display
│   ├── faqs/
│   │   ├── FAQCard.tsx               # FAQ display component
│   │   ├── FAQEditor.tsx             # FAQ editing interface
│   │   ├── FAQApproval.tsx           # Approval workflow UI
│   │   └── FAQCategories.tsx         # Category management
│   ├── curation/
│   │   ├── MessageBrowser.tsx        # Message selection interface
│   │   ├── MessageSelector.tsx       # Smart message selection
│   │   ├── CurationActivity.tsx      # User activity tracking
│   │   └── SelectionManager.tsx      # Saved selections management
│   └── processing/
│       ├── ProcessingDashboard.tsx   # Overall processing status
│       ├── PIIReviewQueue.tsx        # PII review interface
│       └── JobQueue.tsx              # Background job monitoring
├── pages/
│   ├── documents/
│   │   ├── index.tsx                 # Documents listing page
│   │   ├── [id].tsx                  # Individual document page
│   │   ├── create.tsx                # Custom document creation
│   │   └── merge.tsx                 # Document merging page
│   ├── faqs/
│   │   ├── index.tsx                 # FAQs listing page
│   │   └── manage.tsx                # FAQ management page
│   ├── messages/
│   │   ├── browse.tsx                # Message browser page
│   │   └── [id]/impact.tsx           # Message impact view
│   ├── processing/
│   │   └── dashboard.tsx             # Processing dashboard page
│   └── curation/
│       └── activity.tsx              # Curation activity page
└── hooks/
    ├── useDocuments.ts               # Document data fetching
    ├── useFAQs.ts                    # FAQ data fetching
    ├── useProcessingStatus.ts        # Processing status hooks
    ├── useMessageSelection.ts        # Message selection hooks
    └── useCurationActivity.ts        # Curation activity hooks
```

### **Files to Update**

```
prisma/
└── schema.prisma                     # Add all new models and junctions

src/
├── types/
│   └── index.ts                      # Add all new type definitions
├── lib/
│   ├── db.ts                        # Add new database utilities
│   └── logger.ts                    # Add processing-specific logging
├── pages/
│   └── index.tsx                    # Add navigation to new features
└── components/
    ├── Header.tsx                   # Add new navigation items
    └── TransactionStats.tsx         # Include processing statistics
```

## 🚀 Implementation Phases (6-Day MVP Sprint)

### **Phase 1: Database Schema & Vector Database Setup (Day 1)**
1. **Update Prisma Schema**
   - Add ProcessedDocument, FAQ, DocumentProcessingJob, PIIDetection models
   - Add junction tables: DocumentMessage, DocumentFAQ, MessageFAQ
   - Add curation tables: MessageSelection, CurationActivity
   - Generate migrations

2. **Pinecone Vector Database Setup**
   - Create Pinecone account and API key
   - Initialize Pinecone index for FAQ embeddings
   - Configure index: 768 dimensions, cosine similarity
   - Set up environment variables

3. **Update Type Definitions**
   - Document interfaces with junction relationships
   - FAQ interfaces with traceability and embedding support
   - Processing job interfaces
   - Curation activity interfaces
   - API response types with junction data
   - Pinecone integration types

### **Phase 2: Core Processing Logic (Days 2-3)**
1. **Gemini Service (`gemini.ts`)**
   - API client configuration and initialization
   - Rate limiting and quota management
   - Request/response handling with error recovery
   - **Embedding generation** for FAQ vector search
   - Usage analytics and monitoring

2. **Pinecone Service (`pinecone.ts`)**
   - Pinecone client initialization and configuration
   - FAQ embedding storage and retrieval
   - Vector similarity search operations
   - Metadata filtering and batch operations
   - Migration utilities for existing FAQs

3. **Document Processor (`documentProcessor.ts`)**
   - Gemini-powered message conversation detection
   - AI-driven Q&A pattern identification
   - Context extraction with semantic understanding
   - Junction table population for traceability

4. **PII Detector (`piiDetector.ts`)**
   - Regex-based email/phone detection
   - Gemini-enhanced name recognition
   - Contextual false-positive reduction
   - Audit trail creation

5. **Conversation Analyzer (`conversationAnalyzer.ts`)**
   - AI-powered thread analysis
   - Message role classification
   - Context boundary detection

### **Phase 3: FAQ Generation & Scalable Duplicate Prevention (Day 4)**
1. **FAQ Generator (`faqGenerator.ts`)**
   - Gemini-powered document analysis for FAQ candidates
   - AI-driven question normalization and similarity detection
   - Context-aware answer synthesis with quality scoring
   - Junction table relationships (DocumentFAQ, MessageFAQ)
   - **Pinecone integration** for scalable duplicate checking

2. **Pinecone Vector Service (`pinecone.ts`)**
   - Gemini embedding generation for FAQ content
   - Vector storage and retrieval from Pinecone
   - Sub-second similarity search across millions of FAQs
   - Metadata filtering (category, status, etc.)
   - Batch operations and migration utilities

3. **Scalable Duplicate Prevention System**
   - **Cross-document duplicate detection** using vector similarity
   - **Real-time FAQ enhancement** instead of creating duplicates
   - **Performance**: Handles 1M+ FAQs in <1 second queries
   - **Cost-effective**: Gemini embeddings at $0.0000125 per 1M tokens

4. **Background Job System (`backgroundJobs.ts`)**
   - Job queue implementation with Gemini API rate limiting
   - Pinecone embedding generation and updates
   - Progress tracking with AI processing metrics
   - Error handling with API failure recovery

5. **Curation System Foundation**
   - Message selection utilities
   - Document enhancement logic
   - Activity tracking system

### **Phase 4: API Layer (Day 5)**
1. **Document APIs**
   - CRUD operations with junction data
   - Processing triggers
   - Enhancement and merging endpoints

2. **FAQ APIs**
   - CRUD operations with source traceability
   - Generation endpoints
   - Approval workflow

3. **Curation APIs**
   - Message selection management
   - Document enhancement
   - Activity tracking

### **Phase 5: Essential UI Components (Day 5)**
1. **Core Document UI**
   - Document listing with junction metadata
   - Document viewer with source traceability
   - Message addition interface

2. **Basic FAQ Management**
   - FAQ listing with source information
   - Simple approval workflow

3. **Curation Interface**
   - Message browser
   - Selection tools
   - Impact visualization

### **Phase 6: Integration & Launch (Day 6)**
1. **System Integration**
   - Connect all components
   - Basic end-to-end workflow verification
   - Essential error handling

2. **Initial Processing**
   - Process small batch of existing messages
   - Generate initial document set
   - Create baseline FAQs
   - Launch MVP for prototype testing

## 🔍 Complete Traceability Features

### **Bidirectional Navigation**
```
FAQ → DocumentFAQ → Document → DocumentMessage → Message → Slack Thread
  ↑       ↑            ↑           ↑              ↑         ↑
  |   Junction     Document    Junction        Original   External
  |   metadata     content     metadata        content    source
  |
  └─ MessageFAQ → Direct message impact view
         ↑
     Junction shows contribution type & confidence
```

### **Navigation Flows**
- ✅ **Forward**: Message → Documents using it → FAQs generated
- ✅ **Backward**: FAQ → Source messages → Original Slack threads  
- ✅ **Lateral**: Document → All FAQs generated from it
- ✅ **Impact**: Message → All documents & FAQs it contributed to

## 📊 Success Metrics (MVP Level)

### **Core Functionality**
- Messages successfully processed into documents
- Basic PII detection working
- FAQs generated from documents
- System runs without major errors

### **MVP Goals**
- End-to-end pipeline functional
- Usable documents created
- Complete traceability working
- Manual curation system operational
- Gemini API integration working

## 🔧 Dependencies to Add

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",    // Gemini API for AI processing
    "@pinecone-database/pinecone": "^2.0.0", // Vector database for similarity search
    "compromise": "^14.0.0",                // NLP for conversation analysis
    "node-cron": "^3.0.0",                  // Scheduled job processing
    "bull": "^4.0.0"                        // Job queue management
  }
}
```

**Environment Variables:**
```bash
# .env additions
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=us-east-1
GEMINI_API_KEY=your_gemini_api_key
```

## 🎯 Key System Benefits

### **Complete User Control**
- ✅ **Override AI decisions** - Include what AI missed
- ✅ **Create custom collections** - Focus on specific topics  
- ✅ **Merge related content** - Combine scattered conversations
- ✅ **Enhance existing docs** - Add context and completeness

### **Full Transparency**
- ✅ **Junction table traceability** - See exact relationships
- ✅ **Message role classification** - Understand contribution types
- ✅ **Confidence scoring** - Know AI certainty levels
- ✅ **User attribution** - Track manual additions

### **AI-Powered Intelligence**
- ✅ **Gemini-enhanced processing** - Context-aware analysis
- ✅ **Smart suggestions** - AI finds related content
- ✅ **Quality scoring** - Confidence metrics throughout
- ✅ **PII protection** - Contextual privacy preservation

### **Scalable Vector Search**
- ✅ **Pinecone integration** - Purpose-built for similarity search
- ✅ **Sub-second queries** - Even with millions of FAQs
- ✅ **Cost-effective** - Gemini embeddings 10x cheaper than alternatives
- ✅ **Cross-document deduplication** - Intelligent FAQ enhancement

### **Production Ready**
- ✅ **Hybrid database architecture** - PostgreSQL + Pinecone
- ✅ **Scalable infrastructure** - Background job processing
- ✅ **Error recovery** - Robust failure handling
- ✅ **Rate limiting** - API quota management
- ✅ **Audit trails** - Complete activity logging

---

**This master plan provides a complete blueprint for transforming your Slack conversations into a comprehensive, AI-ready knowledge base with full user control and transparency.** 🚀

## 🛠️ Setup & Configuration Guide

### **Prerequisites**

**Required Accounts & Services:**
- PostgreSQL database (Supabase recommended)
- Pinecone account with API key
- Google Cloud account with Gemini API access
- Node.js 18+ and pnpm package manager
- Git repository for version control

**System Requirements:**
- Node.js 18.0.0 or higher
- pnpm 8.0.0 or higher
- PostgreSQL 13+ or Supabase project
- 2GB+ available disk space
- Internet connection for API services

### **Phase 1: Environment Setup**

**1. Repository Setup**
- Clone the sf-listen-bot repository
- Install dependencies using `pnpm install`
- Verify Node.js and pnpm versions meet requirements
- Set up TypeScript configuration

**2. Database Configuration**
- Create new Supabase project or PostgreSQL database
- Obtain database connection URL and direct URL
- Set up database user with full privileges
- Test database connectivity

**3. Environment Variables Setup**
Create `.env.local` file with required variables:
```
# Database Configuration
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# AI Services
GEMINI_API_KEY="your_gemini_api_key"
PINECONE_API_KEY="your_pinecone_api_key"
PINECONE_ENVIRONMENT="us-east-1"

# Slack Integration (existing)
SLACK_BOT_TOKEN="xoxb-..."
SLACK_SIGNING_SECRET="..."

# Application
NEXTAUTH_SECRET="your_secret_key"
NEXTAUTH_URL="http://localhost:3000"
```

**4. Third-Party Service Setup**

**Pinecone Vector Database:**
- Create Pinecone account at pinecone.io
- Create new index with specifications:
  - Name: `faq-duplicates`
  - Dimensions: `768`
  - Metric: `cosine`
  - Environment: `us-east-1` (or preferred region)
- Generate API key and add to environment variables

**Google Gemini API:**
- Enable Gemini API in Google Cloud Console
- Create service account with Gemini API permissions
- Generate API key for text generation and embeddings
- Verify API access and rate limits

### **Phase 2: Database Schema Deployment**

**1. Prisma Schema Setup**
- Review and update `prisma/schema.prisma` with new models
- Ensure all junction tables are properly defined
- Verify foreign key relationships are correct
- Check enum values match specification

**2. Database Migration**
- Generate Prisma client: `pnpm prisma generate`
- Create initial migration: `pnpm prisma migrate dev --name init-document-faq-system`
- Apply migrations to database: `pnpm prisma db push`
- Verify all tables are created correctly

**3. Database Seeding (Optional)**
- Create seed script for test data
- Run seeding: `pnpm prisma db seed`
- Verify data integrity and relationships

### **Phase 3: Application Configuration**

**1. API Route Configuration**
- Verify all API routes are properly configured
- Test database connections from API endpoints
- Ensure proper error handling is implemented
- Validate request/response schemas

**2. Background Job Setup**
- Configure job queue system (Bull/Redis)
- Set up job processing workers
- Verify job scheduling and execution
- Test error handling and retry logic

**3. Vector Database Integration**
- Test Pinecone connection and authentication
- Create initial index structure
- Implement embedding generation pipeline
- Verify vector search functionality

### **Phase 4: Testing & Validation**

**1. Unit Testing Setup**
- Configure testing framework (Jest recommended)
- Create test databases for development
- Implement core function tests
- Verify API endpoint functionality

**2. Integration Testing**
- Test end-to-end message processing pipeline
- Validate document creation and FAQ generation
- Verify PII detection and removal
- Test manual curation workflows

**3. Performance Testing**
- Test with large message datasets
- Verify Pinecone query performance
- Validate API response times
- Check memory usage and optimization

### **Phase 5: Deployment Preparation**

**1. Production Environment Setup**
- Configure production database (Supabase Pro)
- Set up production Pinecone index
- Configure environment variables for production
- Set up monitoring and logging

**2. Build & Deployment Configuration**
- Configure Next.js build settings
- Set up deployment pipeline (Vercel recommended)
- Configure environment-specific settings
- Verify build process and optimization

**3. Security Configuration**
- Review and secure API endpoints
- Implement proper authentication
- Configure CORS and security headers
- Audit environment variable security

### **Phase 6: Launch & Monitoring**

**1. Initial Data Migration**
- Plan migration strategy for existing messages
- Set up batch processing for large datasets
- Monitor migration progress and errors
- Validate migrated data integrity

**2. System Monitoring Setup**
- Configure application performance monitoring
- Set up error tracking and alerting
- Monitor API usage and rate limits
- Track database performance metrics

**3. User Access & Training**
- Configure user authentication and permissions
- Create user documentation and guides
- Set up support and feedback channels
- Plan user onboarding process

## 🚀 Deployment Options

### **Recommended Stack:**
- **Frontend & API**: Vercel (seamless Next.js deployment)
- **Database**: Supabase (managed PostgreSQL)
- **Vector Database**: Pinecone (managed vector search)
- **Background Jobs**: Vercel Functions + Upstash Redis
- **Monitoring**: Vercel Analytics + Sentry

### **Alternative Deployments:**
- **Self-hosted**: Docker containers with PostgreSQL + Redis
- **Cloud providers**: AWS/GCP with managed services
- **Hybrid**: Mix of managed and self-hosted components

### **Cost Estimation (Monthly):**
```
Supabase Pro: $25/month
Pinecone Starter: $70/month (1M vectors)
Gemini API: ~$20/month (typical usage)
Vercel Pro: $20/month
Total: ~$135/month for production system
```

## 🔧 Maintenance & Operations

### **Regular Maintenance Tasks:**
- Monitor API usage and costs
- Update embeddings for modified FAQs
- Review and clean up PII detection logs
- Backup database and vector indices
- Update dependencies and security patches

### **Scaling Considerations:**
- Plan for message volume growth
- Monitor Pinecone index performance
- Consider database sharding for large datasets
- Optimize background job processing
- Plan for increased API usage costs

### **Troubleshooting Guide:**
- Common API integration issues
- Database connection problems
- Vector search performance optimization
- Background job failure recovery
- PII detection accuracy improvement

## Next Steps

1. **Review and approve this comprehensive plan**
2. **Set up development environment following Phase 1**
3. **Begin Phase 1 implementation immediately**  
4. **Deploy prototype with full traceability**
5. **Scale based on real usage patterns** 