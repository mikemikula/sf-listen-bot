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
  automationJobId: string | null
  confidenceScore: number
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
  conversationAnalysis?: any // JsonValue type
  
  // Junction table relationships
  documentMessages?: DocumentMessage[]
  documentFAQs?: DocumentFAQ[]
  automationJob?: AutomationJob
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
 * Automation job for processing tasks
 * Based on the AutomationJob model in the Prisma schema
 */
export interface AutomationJob {
  id: string
  automationRuleId: string
  jobType: string // Using string instead of enum for Prisma compatibility  
  status: string // Using string instead of enum for Prisma compatibility
  inputData: Record<string, any>
  outputData: Record<string, any> | null
  errorMessage: string | null
  progress: number
  retryCount: number
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
  
  // Related entities
  automationRule?: AutomationRule
  processedDocuments?: ProcessedDocument[]
}

/**
 * Legacy interface - use AutomationJob instead
 * @deprecated Use AutomationJob interface instead
 */
export interface DocumentProcessingJob extends AutomationJob {
  createdBy?: string | null
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
    thread_ts?: string
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

// ===== SLACK CHANNEL PULL TYPES =====

/**
 * Configuration for pulling data from a Slack channel
 */
export interface ChannelPullConfig {
  channelId: string
  channelName?: string
  startDate?: Date
  endDate?: Date
  includeThreads?: boolean
  batchSize?: number
  delayBetweenRequests?: number
  userId?: string
}

/**
 * Progress tracking for channel pull operations
 */
export interface ChannelPullProgress {
  id: string
  channelId: string
  channelName: string
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  progress: number // 0-100
  totalMessages: number
  processedMessages: number
  threadsProcessed: number
  startedAt: Date | null
  completedAt: Date | null
  errorMessage: string | null
  userId: string | null
  stats: ChannelPullStats
}

/**
 * Statistics for channel pull operations
 */
export interface ChannelPullStats {
  newMessages: number
  duplicateMessages: number
  threadRepliesFetched: number
  documentsCreated: number
  faqsGenerated: number
  piiDetected: number
}

/**
 * Channel information for channel selection
 */
export interface SlackChannelInfo {
  id: string
  name: string
  memberCount?: number
  isPrivate?: boolean
  topic?: string
  purpose?: string
  created?: Date
  isArchived?: boolean
}

/**
 * Slack message structure from API
 */
export interface SlackApiMessage {
  type: string
  user?: string
  text?: string
  ts: string
  channel: string
  thread_ts?: string
  subtype?: string
  reply_count?: number
  replies?: Array<{ user: string; ts: string }>
  bot_id?: string
  attachments?: any[]
  blocks?: any[]
  reactions?: Array<{
    name: string
    count: number
    users: string[]
  }>
  [key: string]: any
}

/**
 * Response from Slack conversations.history API
 */
export interface SlackHistoryResponse {
  ok: boolean
  messages: SlackApiMessage[]
  has_more: boolean
  response_metadata?: {
    next_cursor?: string
  }
  error?: string
  warning?: string
}

/**
 * Response from Slack conversations.replies API
 */
export interface SlackRepliesResponse {
  ok: boolean
  messages: SlackApiMessage[]
  has_more: boolean
  response_metadata?: {
    next_cursor?: string
  }
  error?: string
}

/**
 * Response from Slack conversations.list API
 */
export interface SlackChannelsResponse {
  ok: boolean
  channels: Array<{
    id: string
    name: string
    is_channel: boolean
    is_group: boolean
    is_im: boolean
    is_mpim: boolean
    is_private: boolean
    is_archived: boolean
    num_members?: number
    topic?: {
      value: string
      creator: string
      last_set: number
    }
    purpose?: {
      value: string
      creator: string
      last_set: number
    }
    created: number
    creator: string
  }>
  response_metadata?: {
    next_cursor?: string
  }
  error?: string
}

/**
 * Channel pull history item for UI display
 */
export interface ChannelPullHistoryItem {
  id: string
  channelId: string
  channelName: string
  status: string
  progress: number
  totalMessages: number
  processedMessages: number
  startedAt: Date | null
  completedAt: Date | null
  stats: ChannelPullStats
  estimatedTimeMs?: number
  actualTimeMs?: number
}

/**
 * API request types for channel pull endpoints
 */
export interface StartChannelPullRequest {
  channelId: string
  channelName?: string
  startDate?: string // ISO date string
  endDate?: string // ISO date string
  includeThreads?: boolean
  batchSize?: number
  delayBetweenRequests?: number
  userId?: string
}

export interface StartChannelPullResponse {
  progress: ChannelPullProgress
  estimatedTimeMs: number
}

export interface ChannelListResponse {
  channels: SlackChannelInfo[]
}

export interface ChannelPullProgressResponse {
  progress: ChannelPullProgress
}

/**
 * Error types specific to channel pulling
 */
export class ChannelPullError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly channelId?: string,
    public readonly progressId?: string
  ) {
    super(message)
    this.name = 'ChannelPullError'
  }
}

export class SlackApiError extends Error {
  constructor(
    message: string,
    public readonly apiError: string,
    public readonly method?: string
  ) {
    super(message)
    this.name = 'SlackApiError'
  }
}

/**
 * Rate limiting information
 */
export interface RateLimitInfo {
  limit: number
  remaining: number
  resetTime: Date
  retryAfter?: number
}

/**
 * Channel pull job configuration for background processing
 */
export interface ChannelPullJobConfig {
  channelId: string
  channelName: string
  config: ChannelPullConfig
  priority: 'low' | 'normal' | 'high'
  retryCount: number
  maxRetries: number
  timeoutMs: number
}

/**
 * Channel pull metrics for monitoring
 */
export interface ChannelPullMetrics {
  totalPulls: number
  successfulPulls: number
  failedPulls: number
  averageProcessingTime: number
  totalMessagesProcessed: number
  totalThreadsProcessed: number
  averageMessagesPerPull: number
  lastPullTime: Date | null
  rateLimitHits: number
  errorsByType: Record<string, number>
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

/**
 * Dashboard System Types
 * Shared interfaces for analytics and automation dashboards
 * Following DRY principle to avoid code duplication
 */

// System Health Types
export interface SystemHealth {
  isHealthy: boolean
  services: {
    database: { status: 'healthy' | 'error'; error?: string }
    documentProcessor: { status: 'healthy' | 'error'; error?: string; stats?: any }
    faqGenerator: { status: 'healthy' | 'error'; error?: string; stats?: any }
    piiDetector: { status: 'healthy' | 'error'; error?: string; stats?: any }
    pinecone: { status: 'healthy' | 'error'; error?: string; stats?: any }
  }
}

// Job Management Types
export interface JobStatistics {
  totalJobs: number
  completedJobs: number
  failedJobs: number
  queuedJobs: number
  processingJobs: number
  avgProcessingTime: number
}

export interface ProcessingJob {
  id: string
  status: string
  jobType: string
  progress: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  createdBy?: string
}

// System Statistics Types
export interface SystemStats {
  totalDocuments: number
  totalFAQs: number
  totalMessages: number
  pendingFAQReviews: number
  piiDetectionsToday: number
  documentsCreatedToday: number
  faqsGeneratedToday: number
}

// Analytics Dashboard Data Structure
export interface AnalyticsData {
  systemHealth: SystemHealth
  systemStats: SystemStats
  jobStatistics: JobStatistics
  recentActivity: {
    documentsProcessed: number
    faqsGenerated: number
    errorsDetected: number
    lastUpdate: string
  }
}

// Automation Types
export interface AutomationRule {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger: {
    type: 'schedule' | 'event' | 'manual'
    schedule?: string // cron expression
    eventType?: string
  }
  action: {
    type: 'document' | 'faq' | 'cleanup' | 'batch'
    parameters: Record<string, any>
  }
  permissions: string[]
  lastRun?: string
  nextRun?: string
  runCount: number
  successRate: number
}

export interface ProcessingSettings {
  maxConcurrentJobs: number
  defaultJobPriority: number
  autoRetryFailedJobs: boolean
  maxRetryAttempts: number
  jobTimeoutMinutes: number
  enableScheduledProcessing: boolean
  enableAutoCleanup: boolean
  cleanupRetentionDays: number
  notificationSettings: {
    enableEmailAlerts: boolean
    enableSlackAlerts: boolean
    alertOnFailure: boolean
    alertOnSuccess: boolean
  }
}

// Automation Dashboard Data Structure
export interface AutomationData {
  processingJobs: {
    active: ProcessingJob[]
    recent: ProcessingJob[]
    statistics: JobStatistics
  }
  automationRules: {
    documentProcessing: {
      id: string
      name: string
      description: string
      enabled: boolean
      schedule: {
        frequency: 'manual' | 'hourly' | 'daily' | 'weekly'
        hour?: number | null
        dayOfWeek?: number | null
        lastRun: string
        nextRun: string
      }
      settings: {
        batchSize: number
        minMessagesRequired: number
        channelFilters: string[]
        excludeThreads: boolean
        requireQuestionAnswer: boolean
        autoTitle: boolean
        autoCategory: boolean
      }
      stats: {
        totalRuns: number
        successfulRuns: number
        documentsCreated: number
        avgProcessingTime: number
      }
    }
    faqGeneration: {
      id: string
      name: string
      description: string
      enabled: boolean
      schedule: {
        frequency: 'manual' | 'hourly' | 'daily' | 'weekly' | 'custom'
        hour?: number | null
        dayOfWeek?: number | null
        customInterval?: number
        customUnit?: 'minutes' | 'hours' | 'days' | 'weeks'
        customTime?: string
        customDayOfWeek?: number
        lastRun: string
        nextRun: string
      }
      settings: {
        maxFAQsPerRun: number
        minDocumentsRequired: number
        requireApproval: boolean
        categories: string[]
        qualityThreshold: number
      }
      stats: {
        totalRuns: number
        successfulRuns: number
        faqsGenerated: number
        avgProcessingTime: number
      }
    }
  }
  processingSettings: ProcessingSettings
}

// Shared Dashboard Props
export interface DashboardProps {
  className?: string
  refreshInterval?: number
}

// Job Action Types
export type JobAction = 'retry' | 'stop' | 'delete' | 'pause' | 'resume'
export type JobFilter = 'all' | 'active' | 'failed' | 'completed' | 'queued'
export type JobSource = {
  type: 'manual' | 'automated' | 'scheduled'
  color: string
  label: string
}

// ===== SALESFORCE INTEGRATION TYPES =====

/**
 * Salesforce OAuth Configuration
 * Configuration for Connected App OAuth flow
 */
export interface SalesforceOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  loginUrl: string
  apiVersion: string
}

/**
 * Salesforce OAuth Token Response
 * Response from Salesforce OAuth token endpoint
 */
export interface SalesforceTokenResponse {
  access_token: string
  refresh_token?: string
  instance_url: string
  id: string
  token_type: string
  issued_at: string
  signature: string
  scope?: string
}

/**
 * Salesforce User Info
 * User information from Salesforce identity API
 */
export interface SalesforceUserInfo {
  user_id: string
  organization_id: string
  username: string
  display_name: string
  nick_name: string
  first_name: string
  last_name: string
  email: string
  email_verified: boolean
  mobile_phone?: string
  mobile_phone_verified: boolean
  status: {
    created_date: string
    body: string
  }
  photos: {
    picture: string
    thumbnail: string
  }
  addr_street?: string
  addr_city?: string
  addr_state?: string
  addr_country?: string
  addr_zip?: string
  timezone: string
  language: string
  locale: string
  utcOffset: number
  last_modified_date: string
  is_lightning_login_user: boolean
}

/**
 * Salesforce Connection Database Status Enum
 * Matches the database enum for connection status
 */
export enum SalesforceConnectionDBStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  ERROR = 'ERROR',
  DISCONNECTED = 'DISCONNECTED'
}

/**
 * Salesforce Connection Database Model
 * Represents stored Salesforce connection information
 */
export interface SalesforceConnection {
  id: string
  sessionId: string
  organizationId: string
  salesforceUserId: string
  username: string
  displayName: string | null
  instanceUrl: string
  accessToken: string
  refreshToken: string | null
  tokenType: string
  tokenExpiresAt: Date | null
  status: SalesforceConnectionDBStatus
  lastActivityAt: Date | null
  apiCallCount: number
  dailyApiLimit: number | null
  dailyApiUsed: number | null
  metadata: any | null
  createdAt: Date
  updatedAt: Date
  lastUsedAt: Date | null
  disconnectedAt: Date | null
}

/**
 * Salesforce Connection Input for Creation
 * Data required to create a new connection record
 */
export interface CreateSalesforceConnectionInput {
  sessionId: string
  tokenResponse: SalesforceTokenResponse
  userInfo: SalesforceUserInfo
  metadata?: any
}

/**
 * Salesforce Connection Update Input
 * Data for updating connection information
 */
export interface UpdateSalesforceConnectionInput {
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: Date
  status?: SalesforceConnectionDBStatus
  lastActivityAt?: Date
  apiCallCount?: number
  dailyApiLimit?: number
  dailyApiUsed?: number
  lastUsedAt?: Date
  disconnectedAt?: Date
  metadata?: any
}

/**
 * Salesforce API Response Wrapper
 * Standard response structure from Salesforce REST API
 */
export interface SalesforceApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    message: string
    errorCode: string
    fields?: string[]
  }
  statusCode?: number
}

/**
 * Salesforce Record Creation Response
 * Response when creating records in Salesforce
 */
export interface SalesforceCreateResponse {
  id: string
  success: boolean
  errors: Array<{
    message: string
    statusCode: string
    fields: string[]
  }>
}

/**
 * Salesforce Record Update Response
 * Response when updating records in Salesforce
 */
export interface SalesforceUpdateResponse {
  success: boolean
  errors: Array<{
    message: string
    statusCode: string
    fields: string[]
  }>
}

/**
 * Salesforce Sync Configuration
 * Configuration for what data to sync to Salesforce
 */
export interface SalesforceSyncConfig {
  enabled: boolean
  syncDocuments: boolean
  syncFaqs: boolean
  syncMessages: boolean
  documentObjectName: string
  faqObjectName: string
  messageObjectName: string
  syncInterval: number // minutes
  lastSyncDate?: Date
}

/**
 * Salesforce Document Mapping
 * Maps ProcessedDocument to Salesforce object
 */
export interface SalesforceDocumentRecord {
  Name: string // title
  Description__c: string // description
  Category__c: string // category
  Status__c: string // status
  Confidence_Score__c: number // confidenceScore
  Created_By__c?: string // createdBy
  Slack_Channel__c?: string // derived from messages
  Message_Count__c?: number // documentMessages count
  FAQ_Count__c?: number // documentFAQs count
  // External_Id__c is used in the URL for upsert, not in the body
  Conversation_Analysis__c?: string // JSON string
}

/**
 * Salesforce FAQ Mapping
 * Maps FAQ to Salesforce Knowledge Article or custom object
 */
export interface SalesforceFAQRecord {
  Name: string // question (truncated for title)
  Question__c: string // question
  Answer__c: string // answer
  Category__c: string // category
  Status__c: string // status
  Confidence_Score__c: number // confidenceScore
  Approved_By__c?: string // approvedBy
  Approved_Date__c?: string // approvedAt ISO string
  // External_Id__c is used in the URL for upsert, not in the body
  Source_Documents__c?: string // comma-separated document IDs
}

/**
 * Salesforce Message Mapping
 * Maps Message to Salesforce case comment or custom object
 */
export interface SalesforceMessageRecord {
  Name: string // username + timestamp
  Text__c: string // text content
  Username__c: string // username
  User_ID__c: string // userId
  Channel__c: string // channel
  Timestamp__c: string // timestamp ISO string
  Thread_ID__c?: string // threadTs
  Is_Thread_Reply__c: boolean // isThreadReply
  // External_Id__c is used in the URL for upsert, not in the body
  Slack_Message_ID__c: string // slackId
}

/**
 * Salesforce Sync Job
 * Tracks sync operations to Salesforce
 */
export interface SalesforceSyncJob {
  id: string
  jobType: 'FULL_SYNC' | 'INCREMENTAL_SYNC' | 'DOCUMENT_SYNC' | 'FAQ_SYNC' | 'MESSAGE_SYNC'
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  startedAt?: Date
  completedAt?: Date
  recordsProcessed: number
  recordsSucceeded: number
  recordsFailed: number
  errorDetails?: Array<{
    recordId: string
    error: string
    recordType: 'document' | 'faq' | 'message'
  }>
  lastSyncCursor?: string // for incremental syncs
  syncConfig: SalesforceSyncConfig
  createdAt: Date
  updatedAt: Date
}

/**
 * Salesforce Connection Status
 * Current status of Salesforce integration
 */
export interface SalesforceConnectionStatus {
  isConnected: boolean
  isAuthenticated: boolean
  connectionError?: string
  lastConnectionTest?: Date
  userInfo?: SalesforceUserInfo
  instanceUrl?: string
  apiVersion: string
  limits?: {
    dailyApiCalls: {
      used: number
      limit: number
    }
  }
}

/**
 * Salesforce OAuth State
 * State parameter for OAuth flow security
 */
export interface SalesforceOAuthState {
  state: string
  redirectTo?: string
  userId?: string
  createdAt: Date
}

/**
 * Salesforce Sync Summary
 * Summary of sync operation results
 */
export interface SalesforceSyncSummary {
  totalRecords: number
  successfulSyncs: number
  failedSyncs: number
  skippedRecords: number
  syncDuration: number // milliseconds
  recordTypes: {
    documents: { synced: number; failed: number }
    faqs: { synced: number; failed: number }
    messages: { synced: number; failed: number }
  }
  errors: Array<{
    recordId: string
    recordType: string
    error: string
  }>
}

/**
 * Salesforce API Client Configuration
 * Configuration for making Salesforce API calls
 */
export interface SalesforceApiClientConfig {
  instanceUrl: string
  accessToken: string
  apiVersion: string
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
}

/**
 * Salesforce Query Result
 * Result from SOQL queries
 */
export interface SalesforceQueryResult<T = any> {
  totalSize: number
  done: boolean
  nextRecordsUrl?: string
  records: T[]
}

/**
 * Salesforce Bulk Operation Result
 * Result from bulk API operations
 */
export interface SalesforceBulkResult {
  jobId: string
  state: 'Open' | 'InProgress' | 'Aborted' | 'Completed' | 'Failed'
  object: string
  operation: 'insert' | 'update' | 'upsert' | 'delete'
  createdDate: string
  systemModstamp: string
  numberBatchesQueued: number
  numberBatchesInProgress: number
  numberBatchesCompleted: number
  numberBatchesFailed: number
  numberRecordsProcessed: number
  numberRecordsFailed: number
  numberRetries: number
}

/**
 * Salesforce Error Response
 * Error structure from Salesforce API
 */
export interface SalesforceError {
  message: string
  errorCode: string
  fields?: string[]
}

/**
 * Salesforce Sync Settings for UI
 * Settings that can be configured through the UI
 */
export interface SalesforceSyncSettings {
  enabled: boolean
  syncFrequency: 'manual' | 'hourly' | 'daily' | 'weekly'
  syncHour?: number // for daily/weekly sync
  syncDayOfWeek?: number // for weekly sync
  documentObjectName: string
  faqObjectName: string
  messageObjectName: string
  enableBidirectionalSync: boolean
  conflictResolution: 'salesforce_wins' | 'app_wins' | 'manual_review'
  fieldMappings: {
    documents: Record<string, string>
    faqs: Record<string, string>
    messages: Record<string, string>
  }
  filters: {
    syncOnlyApprovedFaqs: boolean
    syncOnlyCompletedDocuments: boolean
    excludePrivateChannels: boolean
    dateRangeFilter?: {
      startDate: Date
      endDate?: Date
    }
  }
}

/**
 * Component Props for Salesforce Integration UI
 */
export interface SalesforceConfigProps {
  config: SalesforceSyncSettings
  connectionStatus: SalesforceConnectionStatus
  onConfigChange: (config: SalesforceSyncSettings) => void
  onConnect: () => void
  onDisconnect: () => void
  onTestConnection: () => void
  onStartSync: (syncType: 'full' | 'incremental') => void
  className?: string
}

export interface SalesforceSyncDashboardProps {
  syncJobs: SalesforceSyncJob[]
  connectionStatus: SalesforceConnectionStatus
  onRefresh: () => void
  onRetryJob: (jobId: string) => void
  onCancelJob: (jobId: string) => void
  className?: string
}

/**
 * API Request/Response Types for Salesforce Endpoints
 */
export interface SalesforceConnectRequest {
  userId?: string
  redirectTo?: string
}

export interface SalesforceConnectResponse {
  authUrl: string
  state: string
}

export interface SalesforceCallbackRequest {
  code: string
  state: string
  error?: string
  error_description?: string
}

export interface SalesforceCallbackResponse {
  success: boolean
  userInfo?: SalesforceUserInfo
  redirectTo?: string
  error?: string
}

export interface SalesforceStartSyncRequest {
  syncType: 'full' | 'incremental'
  recordTypes?: ('documents' | 'faqs' | 'messages')[]
  filters?: {
    startDate?: string
    endDate?: string
    categories?: string[]
    statuses?: string[]
  }
}

export interface SalesforceStartSyncResponse {
  jobId: string
  estimatedRecords: number
  estimatedDuration: number // milliseconds
}

export interface SalesforceDisconnectResponse {
  success: boolean
  message: string
}

export interface SalesforceTestConnectionResponse {
  success: boolean
  connectionDetails?: {
    instanceUrl: string
    userInfo: SalesforceUserInfo
    limits: any
  }
  error?: string
  warning?: string
}

/**
 * Webhook Types for Salesforce Integration
 * For receiving updates from Salesforce if bidirectional sync is enabled
 */
export interface SalesforceWebhookPayload {
  sobjectType: string
  eventType: 'created' | 'updated' | 'deleted' | 'undeleted'
  recordIds: string[]
  changeType: string
  channelName: string
  clientId: string
}

export interface SalesforceWebhookEvent {
  schema: string
  payload: SalesforceWebhookPayload
  event: {
    replayId: number
  }
}

/**
 * Error Classes for Salesforce Integration
 */
export class SalesforceAuthError extends Error {
  constructor(
    message: string,
    public readonly authCode?: string,
    public readonly description?: string
  ) {
    super(message)
    this.name = 'SalesforceAuthError'
  }
}

export class SalesforceApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode?: string,
    public readonly fields?: string[]
  ) {
    super(message)
    this.name = 'SalesforceApiError'
  }
}

export class SalesforceSyncError extends Error {
  constructor(
    message: string,
    public readonly jobId?: string,
    public readonly recordType?: string,
    public readonly recordId?: string
  ) {
    super(message)
    this.name = 'SalesforceSyncError'
  }
} 