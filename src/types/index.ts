/**
 * Type definitions for Listen Bot application
 * Provides type safety across the entire application
 * Handles Prisma type compatibility using proper type mappings
 */

// ===== EXISTING MESSAGE TYPES =====

/**
 * Core message data structure matching database schema
 */
export interface BaseMessage {
  id: string
  slackId: string
  text: string
  userId: string
  username: string
  channel: string
  timestamp: Date
  threadTs: string | null
  isThreadReply: boolean
  parentMessageId: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Thread reply data for display 
 */
export interface ThreadReply {
  id: string
  text: string
  username: string
  timestamp: Date
  slackId: string
  userId: string
  channel: string
  isThreadReply: boolean
  timeAgo: string
  channelName: string
}

/**
 * Parent message data for thread context
 */
export interface ParentMessage {
  id: string
  text: string
  username: string
  timestamp: Date
  slackId: string
}

/**
 * Message display data for frontend components with thread support
 */
export interface MessageDisplay extends BaseMessage {
  timeAgo: string
  channelName: string
  parentMessage: ParentMessage | null
  threadReplies: ThreadReply[]
  role?: string // Message role in document context (QUESTION, ANSWER, CONTEXT, etc.)
  // Processing status information
  isProcessed: boolean
  documentId: string | null
  documentTitle: string | null
  documentStatus: string | null
  messageRole: string | null
  processingConfidence: number | null
  // PII detection status information
  hasPIIDetections: boolean
  piiDetectionCount: number
  piiPendingReview: number
  piiWhitelisted: number
  piiAutoReplaced: number
  piiDetections?: PIIDetection[]
}

// ===== AI ANALYSIS TYPES =====

/**
 * Q&A pair identified by AI analysis
 */
export interface QAPair {
  questionMessageId: string
  answerMessageId: string
  confidence: number
  topic: string
  reasoning: string
}

/**
 * Message role analysis with AI reasoning
 */
export interface MessageAnalysis {
  messageId: string
  role: string
  confidence: number
  reasoning: string
  contributesToFAQs: string[]
}

/**
 * FAQ traceability with generation details
 */
export interface FAQTraceability {
  faqId: string
  sourceMessageIds: string[]
  generationReasoning: string
  confidenceFactors: {
    questionClarity: number
    answerCompleteness: number
    contextRelevance: number
    overall: number
  }
}

/**
 * Complete AI analysis data for a document
 */
export interface DocumentAnalysisData {
  qaPairs: QAPair[]
  messageAnalysis: MessageAnalysis[]
  faqTraceability: FAQTraceability[]
}

// ===== DOCUMENT PROCESSING TYPES =====

/**
 * Processed document from Slack messages
 * Using Prisma-compatible types with proper casting
 */
export interface ProcessedDocument {
  id: string
  title: string
  description: string
  category: string
  status: string // Using string instead of enum for Prisma compatibility
  processingJobId: string | null
  confidenceScore: number
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
  
  // Junction table relationships
  documentMessages?: DocumentMessage[]
  documentFAQs?: DocumentFAQ[]
  processingJob?: DocumentProcessingJob
}

/**
 * FAQ entry generated from documents
 * Using Prisma-compatible types
 */
export interface FAQ {
  id: string
  question: string
  answer: string
  category: string
  status: string // Using string instead of enum for Prisma compatibility
  confidenceScore: number
  approvedBy: string | null
  approvedAt: Date | null
  createdAt: Date
  updatedAt: Date
  
  // Junction table relationships
  documentFAQs?: DocumentFAQ[]
  messageFAQs?: MessageFAQ[]
}

/**
 * Background processing job
 */
export interface DocumentProcessingJob {
  id: string
  status: string // Using string instead of enum for Prisma compatibility
  jobType: string // Using string instead of enum for Prisma compatibility
  inputData: Record<string, any>
  outputData: Record<string, any> | null
  errorMessage: string | null
  progress: number
  startedAt: Date | null
  completedAt: Date | null
  createdBy: string | null
  createdAt: Date
  
  // Related documents
  processedDocuments?: ProcessedDocument[]
}

/**
 * PII detection and removal tracking
 */
export interface PIIDetection {
  id: string
  sourceType: string // Using string instead of enum for Prisma compatibility
  sourceId: string
  piiType: string // Using string instead of enum for Prisma compatibility
  originalText: string
  replacementText: string
  confidence: number
  status: string // Using string instead of enum for Prisma compatibility
  reviewedBy: string | null
  reviewedAt: Date | null
  createdAt: Date
  
  // Related message (if applicable)
  message?: BaseMessage
}

// ===== JUNCTION TABLE TYPES =====

/**
 * Message to Document relationship with traceability
 */
export interface DocumentMessage {
  id: string
  documentId: string
  messageId: string
  inclusionMethod: string // Using string instead of enum for Prisma compatibility
  messageRole: string // Using string instead of enum for Prisma compatibility
  addedBy: string | null
  addedAt: Date
  processingConfidence: number
  removalReason: string | null
  
  // Related entities
  document?: ProcessedDocument
  message?: BaseMessage
}

/**
 * Document to FAQ relationship with generation tracking
 */
export interface DocumentFAQ {
  id: string
  documentId: string
  faqId: string
  generationMethod: string // Using string instead of enum for Prisma compatibility
  sourceMessageIds: string[]
  confidenceScore: number
  generatedBy: string | null
  createdAt: Date
  
  // Related entities
  document?: ProcessedDocument
  faq?: FAQ
}

/**
 * Direct Message to FAQ traceability
 */
export interface MessageFAQ {
  id: string
  messageId: string
  faqId: string
  contributionType: string // Using string instead of enum for Prisma compatibility
  documentId: string | null
  createdAt: Date
  
  // Related entities
  message?: BaseMessage
  faq?: FAQ
}

/**
 * Manual message selection for curation
 */
export interface MessageSelection {
  id: string
  userId: string
  selectionName: string
  messageIds: string[]
  purpose: string // Using string instead of enum for Prisma compatibility
  createdAt: Date
  
  // Related messages
  messages?: BaseMessage[]
}

/**
 * User curation activity tracking
 */
export interface CurationActivity {
  id: string
  userId: string
  activityType: string // Using string instead of enum for Prisma compatibility
  targetId: string
  details: Record<string, any>
  timestamp: Date
}

// ===== ENUMS (For application logic, not database) =====

export enum DocumentStatus {
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export enum FAQStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED'
}

export enum JobStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED'
}

export enum JobType {
  DOCUMENT_CREATION = 'DOCUMENT_CREATION',
  DOCUMENT_ENHANCEMENT = 'DOCUMENT_ENHANCEMENT',
  FAQ_GENERATION = 'FAQ_GENERATION'
}

export enum PIISourceType {
  MESSAGE = 'MESSAGE',
  DOCUMENT = 'DOCUMENT'
}

export enum PIIType {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  NAME = 'NAME',
  URL = 'URL',
  CUSTOM = 'CUSTOM'
}

export enum PIIStatus {
  AUTO_REPLACED = 'AUTO_REPLACED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  WHITELISTED = 'WHITELISTED',
  FLAGGED = 'FLAGGED'
}

export enum InclusionMethod {
  AI_AUTOMATIC = 'AI_AUTOMATIC',
  USER_MANUAL = 'USER_MANUAL',
  USER_ENHANCED = 'USER_ENHANCED'
}

export enum MessageRole {
  QUESTION = 'QUESTION',
  ANSWER = 'ANSWER',
  CONTEXT = 'CONTEXT',
  FOLLOW_UP = 'FOLLOW_UP',
  CONFIRMATION = 'CONFIRMATION'
}

export enum GenerationMethod {
  AI_GENERATED = 'AI_GENERATED',
  USER_CREATED = 'USER_CREATED',
  HYBRID = 'HYBRID'
}

export enum ContributionType {
  PRIMARY_QUESTION = 'PRIMARY_QUESTION',
  PRIMARY_ANSWER = 'PRIMARY_ANSWER',
  SUPPORTING_CONTEXT = 'SUPPORTING_CONTEXT'
}

export enum SelectionPurpose {
  DOCUMENT_CREATION = 'DOCUMENT_CREATION',
  DOCUMENT_ENHANCEMENT = 'DOCUMENT_ENHANCEMENT',
  RESEARCH = 'RESEARCH'
}

export enum ActivityType {
  MESSAGE_ADDED = 'MESSAGE_ADDED',
  DOCUMENT_MERGED = 'DOCUMENT_MERGED',
  MESSAGES_SELECTED = 'MESSAGES_SELECTED'
}

// ===== TYPE HELPERS FOR PRISMA COMPATIBILITY =====

/**
 * Type helper to cast Prisma enums to our application enums
 * Based on the approach described in GraphQL CodeGen compatibility guide
 */
export type PrismaToAppType<T> = T extends any ? string : never

/**
 * Utility type for converting Prisma results to app types
 */
export type PrismaResultToApp<T> = {
  [K in keyof T]: T[K] extends { status: any } 
    ? Omit<T[K], 'status'> & { status: string }
    : T[K]
}

// ===== DISPLAY TYPES FOR UI =====

/**
 * Document display data with enriched information
 * Compatible with Prisma result types
 */
export interface DocumentDisplay extends Omit<ProcessedDocument, 'status'> {
  status: string
  messageCount: number
  faqCount: number
  participantCount: number
  participants: string[]
  channelNames: string[]
  lastActivity: Date
  timeAgo: string
  // Optional detailed data for document detail pages
  messages?: MessageDisplay[]
  faqs?: FAQDisplay[]
  conversationAnalysis?: {
    patterns: Array<{
      type: 'qa_pair' | 'question_only' | 'answer_only' | 'context' | 'greeting'
      messageIds: string[]
      confidence: number
      reasoning: string
      topics: string[]
    }>
    overallTopics: string[]
    conversationFlow: string
    faqPotential: number
  }
}

/**
 * FAQ display data with source information
 */
export interface FAQDisplay extends Omit<FAQ, 'status'> {
  status: string
  sourceDocumentCount: number
  sourceMessageCount: number
  primarySourceDocument?: {
    id: string
    title: string
  }
  timeAgo: string
}

/**
 * Message impact data showing relationships
 */
export interface MessageImpact {
  message: MessageDisplay
  documentUsage: Array<{
    document: ProcessedDocument
    role: string
    confidence: number
    addedAt: Date
  }>
  faqUsage: Array<{
    faq: FAQ
    contributionType: string
    viaDocument?: ProcessedDocument
  }>
  impactSummary: {
    documentCount: number
    faqCount: number
    averageConfidence: number
    primaryRole: string
  }
}

// ===== API PROCESSING TYPES =====

/**
 * Gemini API configuration and response types
 */
export interface GeminiConfig {
  apiKey: string
  model: string
  maxTokens?: number
  temperature?: number
}

export interface GeminiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Pinecone vector database types
 */
export interface PineconeConfig {
  apiKey: string
  environment: string
  indexName: string
}

export interface FAQEmbedding {
  id: string
  values: number[]
  metadata: {
    category: string
    status: string
    question: string
  }
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  matches: Array<{
    id: string
    score: number
    metadata: any
  }>
}

/**
 * Document processing input/output types
 */
export interface DocumentProcessingInput {
  messageIds: string[]
  title?: string
  category?: string
  userId?: string
}

export interface DocumentProcessingResult {
  document: ProcessedDocument
  messagesProcessed: number
  piiDetected: PIIDetection[]
  confidenceScore: number
  processingTime: number
}

/**
 * FAQ generation input/output types
 */
export interface FAQGenerationInput {
  documentId: string
  categoryOverride?: string
  userId?: string
}

export interface FAQGenerationResult {
  faqs: FAQ[]
  duplicatesFound: number
  enhancedExisting: number
  processingTime: number
}

// ===== EXISTING API TYPES =====

/**
 * API Response wrapper for consistent API responses
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Paginated response for message listings
 */
export interface PaginatedMessages {
  messages: MessageDisplay[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Paginated response for documents
 */
export interface PaginatedDocuments {
  documents: DocumentDisplay[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Paginated response for FAQs
 */
export interface PaginatedFAQs {
  faqs: FAQDisplay[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Message filters for search and filtering
 */
export interface MessageFilters {
  channel?: string
  userId?: string
  username?: string
  search?: string
  startDate?: string
  endDate?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
  processed?: boolean
  hasQAPairs?: boolean
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

/**
 * Document filters
 */
export interface DocumentFilters {
  category?: string
  status?: string
  search?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
  createdBy?: string
  minConfidence?: number
}

/**
 * FAQ filters
 */
export interface FAQFilters {
  category?: string
  status?: string
  search?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
  approvedBy?: string
  minConfidence?: number
}

// ===== SLACK WEBHOOK TYPES =====

/**
 * Slack webhook event types
 */
export interface SlackWebhookPayload {
  token: string
  team_id: string
  api_app_id: string
  event?: {
    type: string
    user?: string
    text?: string
    ts: string
    channel: string
    event_ts: string
    subtype?: string
    deleted_ts?: string
    message?: {
      type: string
      user: string
      text: string
      ts: string
    }
    previous_message?: {
      type: string
      user: string
      text: string
      ts: string
    }
  }
  type: 'event_callback' | 'url_verification'
  challenge?: string
  event_id?: string
  event_time?: number
}

// ===== DATABASE OPERATION TYPES =====

/**
 * Database operation results
 */
export interface DbOperationResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ===== COMPONENT PROP TYPES =====

export interface MessageCardProps {
  message: MessageDisplay
  showChannel?: boolean
  className?: string
  showChannelName?: boolean
  showDocumentBadge?: boolean
  showTimestamp?: boolean
  getUserAvatar: (username: string) => string
  onPIIStatusUpdate?: () => void
}

export interface MessageFeedProps {
  messages: MessageDisplay[]
  loading?: boolean
  error?: string
  onLoadMore?: () => void
  hasMore?: boolean
  onPIIStatusUpdate?: () => void
}

export interface FilterBarProps {
  filters: MessageFilters
  onFiltersChange: (filters: MessageFilters) => void
  channels: string[]
  loading?: boolean
}

export interface DocumentCardProps {
  document: DocumentDisplay
  className?: string
  showActions?: boolean
}

export interface FAQCardProps {
  faq: FAQDisplay
  className?: string
  showActions?: boolean
  onApprove?: (faqId: string) => void
  onReject?: (faqId: string) => void
}

// ===== ERROR TYPES =====

export class SlackVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SlackVerificationError'
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ProcessingError extends Error {
  constructor(message: string, public readonly jobId?: string) {
    super(message)
    this.name = 'ProcessingError'
  }
}

export class GeminiError extends Error {
  constructor(message: string, public readonly apiError?: any) {
    super(message)
    this.name = 'GeminiError'
  }
}

export class PineconeError extends Error {
  constructor(message: string, public readonly apiError?: any) {
    super(message)
    this.name = 'PineconeError'
  }
} 