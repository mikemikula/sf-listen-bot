-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PROCESSING', 'COMPLETE', 'ERROR');

-- CreateEnum
CREATE TYPE "FAQStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETE', 'FAILED', 'CANCELLED', 'PAUSED', 'DELETED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('DOCUMENT_CREATION', 'DOCUMENT_ENHANCEMENT', 'FAQ_GENERATION');

-- CreateEnum
CREATE TYPE "PIISourceType" AS ENUM ('MESSAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "PIIType" AS ENUM ('EMAIL', 'PHONE', 'NAME', 'URL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PIIStatus" AS ENUM ('AUTO_REPLACED', 'PENDING_REVIEW', 'WHITELISTED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "InclusionMethod" AS ENUM ('AI_AUTOMATIC', 'USER_MANUAL', 'USER_ENHANCED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('QUESTION', 'ANSWER', 'CONTEXT', 'FOLLOW_UP', 'CONFIRMATION');

-- CreateEnum
CREATE TYPE "GenerationMethod" AS ENUM ('AI_GENERATED', 'USER_CREATED', 'HYBRID');

-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('PRIMARY_QUESTION', 'PRIMARY_ANSWER', 'SUPPORTING_CONTEXT');

-- CreateEnum
CREATE TYPE "SelectionPurpose" AS ENUM ('DOCUMENT_CREATION', 'DOCUMENT_ENHANCEMENT', 'RESEARCH');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('MESSAGE_ADDED', 'DOCUMENT_MERGED', 'MESSAGES_SELECTED');

-- CreateEnum
CREATE TYPE "SlackEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "slack_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "thread_ts" TEXT,
    "is_thread_reply" BOOLEAN NOT NULL DEFAULT false,
    "parent_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "confidence_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "conversation_analysis" JSONB,
    "automation_job_id" TEXT,

    CONSTRAINT "processed_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "FAQStatus" NOT NULL DEFAULT 'PENDING',
    "confidence_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "last_run" TIMESTAMP(3),
    "next_run" TIMESTAMP(3),
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "schedule" TEXT,
    "jobType" "JobType" DEFAULT 'DOCUMENT_CREATION',
    "job_config" JSONB DEFAULT '{}',

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_jobs" (
    "id" TEXT NOT NULL,
    "automation_rule_id" TEXT NOT NULL,
    "jobType" "JobType" NOT NULL DEFAULT 'DOCUMENT_CREATION',
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "input_data" JSONB NOT NULL,
    "output_data" JSONB,
    "error_message" TEXT,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_jobs_new_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_settings" (
    "id" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pii_detections" (
    "id" TEXT NOT NULL,
    "sourceType" "PIISourceType" NOT NULL DEFAULT 'MESSAGE',
    "source_id" TEXT NOT NULL,
    "piiType" "PIIType" NOT NULL DEFAULT 'EMAIL',
    "original_text" TEXT NOT NULL,
    "replacement_text" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "PIIStatus" NOT NULL DEFAULT 'AUTO_REPLACED',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pii_detections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_messages" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "inclusionMethod" "InclusionMethod" NOT NULL DEFAULT 'AI_AUTOMATIC',
    "messageRole" "MessageRole" NOT NULL DEFAULT 'CONTEXT',
    "added_by" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processing_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "removal_reason" TEXT,

    CONSTRAINT "document_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_faqs" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "faq_id" TEXT NOT NULL,
    "generationMethod" "GenerationMethod" NOT NULL DEFAULT 'AI_GENERATED',
    "source_message_ids" TEXT[],
    "confidence_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_faqs" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "faq_id" TEXT NOT NULL,
    "contributionType" "ContributionType" NOT NULL DEFAULT 'SUPPORTING_CONTEXT',
    "document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_selections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "selection_name" TEXT NOT NULL,
    "message_ids" TEXT[],
    "purpose" "SelectionPurpose" NOT NULL DEFAULT 'DOCUMENT_CREATION',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curation_activities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "activityType" "ActivityType" NOT NULL DEFAULT 'MESSAGE_ADDED',
    "target_id" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curation_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_events" (
    "id" TEXT NOT NULL,
    "slack_event_id" TEXT,
    "event_type" TEXT NOT NULL,
    "event_subtype" TEXT,
    "payload" JSONB NOT NULL,
    "status" "SlackEventStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "message_id" TEXT,
    "channel" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "slack_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MessageToMessageSelection" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "messages_slack_id_key" ON "messages"("slack_id");

-- CreateIndex
CREATE INDEX "messages_channel_idx" ON "messages"("channel");

-- CreateIndex
CREATE INDEX "messages_timestamp_idx" ON "messages"("timestamp");

-- CreateIndex
CREATE INDEX "messages_user_id_idx" ON "messages"("user_id");

-- CreateIndex
CREATE INDEX "messages_thread_ts_idx" ON "messages"("thread_ts");

-- CreateIndex
CREATE INDEX "messages_is_thread_reply_idx" ON "messages"("is_thread_reply");

-- CreateIndex
CREATE INDEX "messages_parent_message_id_idx" ON "messages"("parent_message_id");

-- CreateIndex
CREATE INDEX "processed_documents_status_idx" ON "processed_documents"("status");

-- CreateIndex
CREATE INDEX "processed_documents_category_idx" ON "processed_documents"("category");

-- CreateIndex
CREATE INDEX "processed_documents_created_at_idx" ON "processed_documents"("created_at");

-- CreateIndex
CREATE INDEX "faqs_status_idx" ON "faqs"("status");

-- CreateIndex
CREATE INDEX "faqs_category_idx" ON "faqs"("category");

-- CreateIndex
CREATE INDEX "faqs_created_at_idx" ON "faqs"("created_at");

-- CreateIndex
CREATE INDEX "faqs_approved_by_idx" ON "faqs"("approved_by");

-- CreateIndex
CREATE INDEX "automation_rules_enabled_idx" ON "automation_rules"("enabled");

-- CreateIndex
CREATE INDEX "automation_rules_next_run_idx" ON "automation_rules"("next_run");

-- CreateIndex
CREATE INDEX "automation_rules_created_at_idx" ON "automation_rules"("created_at");

-- CreateIndex
CREATE INDEX "automation_jobs_automation_rule_id_idx" ON "automation_jobs"("automation_rule_id");

-- CreateIndex
CREATE INDEX "automation_jobs_status_idx" ON "automation_jobs"("status");

-- CreateIndex
CREATE INDEX "automation_jobs_jobType_idx" ON "automation_jobs"("jobType");

-- CreateIndex
CREATE INDEX "automation_jobs_created_at_idx" ON "automation_jobs"("created_at");

-- CreateIndex
CREATE INDEX "pii_detections_sourceType_source_id_idx" ON "pii_detections"("sourceType", "source_id");

-- CreateIndex
CREATE INDEX "pii_detections_piiType_idx" ON "pii_detections"("piiType");

-- CreateIndex
CREATE INDEX "pii_detections_status_idx" ON "pii_detections"("status");

-- CreateIndex
CREATE INDEX "pii_detections_created_at_idx" ON "pii_detections"("created_at");

-- CreateIndex
CREATE INDEX "document_messages_document_id_idx" ON "document_messages"("document_id");

-- CreateIndex
CREATE INDEX "document_messages_message_id_idx" ON "document_messages"("message_id");

-- CreateIndex
CREATE INDEX "document_messages_messageRole_idx" ON "document_messages"("messageRole");

-- CreateIndex
CREATE INDEX "document_messages_inclusionMethod_idx" ON "document_messages"("inclusionMethod");

-- CreateIndex
CREATE UNIQUE INDEX "document_messages_document_id_message_id_key" ON "document_messages"("document_id", "message_id");

-- CreateIndex
CREATE INDEX "document_faqs_document_id_idx" ON "document_faqs"("document_id");

-- CreateIndex
CREATE INDEX "document_faqs_faq_id_idx" ON "document_faqs"("faq_id");

-- CreateIndex
CREATE INDEX "document_faqs_generationMethod_idx" ON "document_faqs"("generationMethod");

-- CreateIndex
CREATE UNIQUE INDEX "document_faqs_document_id_faq_id_key" ON "document_faqs"("document_id", "faq_id");

-- CreateIndex
CREATE INDEX "message_faqs_message_id_idx" ON "message_faqs"("message_id");

-- CreateIndex
CREATE INDEX "message_faqs_faq_id_idx" ON "message_faqs"("faq_id");

-- CreateIndex
CREATE INDEX "message_faqs_contributionType_idx" ON "message_faqs"("contributionType");

-- CreateIndex
CREATE INDEX "message_faqs_document_id_idx" ON "message_faqs"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_faqs_message_id_faq_id_key" ON "message_faqs"("message_id", "faq_id");

-- CreateIndex
CREATE INDEX "message_selections_user_id_idx" ON "message_selections"("user_id");

-- CreateIndex
CREATE INDEX "message_selections_purpose_idx" ON "message_selections"("purpose");

-- CreateIndex
CREATE INDEX "message_selections_created_at_idx" ON "message_selections"("created_at");

-- CreateIndex
CREATE INDEX "curation_activities_user_id_idx" ON "curation_activities"("user_id");

-- CreateIndex
CREATE INDEX "curation_activities_activityType_idx" ON "curation_activities"("activityType");

-- CreateIndex
CREATE INDEX "curation_activities_timestamp_idx" ON "curation_activities"("timestamp");

-- CreateIndex
CREATE INDEX "curation_activities_target_id_idx" ON "curation_activities"("target_id");

-- CreateIndex
CREATE INDEX "slack_events_slack_event_id_idx" ON "slack_events"("slack_event_id");

-- CreateIndex
CREATE INDEX "slack_events_status_idx" ON "slack_events"("status");

-- CreateIndex
CREATE INDEX "slack_events_event_type_idx" ON "slack_events"("event_type");

-- CreateIndex
CREATE INDEX "slack_events_created_at_idx" ON "slack_events"("created_at");

-- CreateIndex
CREATE INDEX "slack_events_channel_idx" ON "slack_events"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "channels_slack_id_key" ON "channels"("slack_id");

-- CreateIndex
CREATE INDEX "_MessageToMessageSelection_B_index" ON "_MessageToMessageSelection"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_MessageToMessageSelection_AB_unique" ON "_MessageToMessageSelection"("A", "B");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_documents" ADD CONSTRAINT "processed_documents_automation_job_id_fkey" FOREIGN KEY ("automation_job_id") REFERENCES "automation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_jobs" ADD CONSTRAINT "automation_jobs_automation_rule_id_fkey" FOREIGN KEY ("automation_rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pii_detections" ADD CONSTRAINT "pii_detections_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_messages" ADD CONSTRAINT "document_messages_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "processed_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_messages" ADD CONSTRAINT "document_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_faqs" ADD CONSTRAINT "document_faqs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "processed_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_faqs" ADD CONSTRAINT "document_faqs_faq_id_fkey" FOREIGN KEY ("faq_id") REFERENCES "faqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_faqs" ADD CONSTRAINT "message_faqs_faq_id_fkey" FOREIGN KEY ("faq_id") REFERENCES "faqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_faqs" ADD CONSTRAINT "message_faqs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageToMessageSelection" ADD CONSTRAINT "_MessageToMessageSelection_A_fkey" FOREIGN KEY ("A") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageToMessageSelection" ADD CONSTRAINT "_MessageToMessageSelection_B_fkey" FOREIGN KEY ("B") REFERENCES "message_selections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

