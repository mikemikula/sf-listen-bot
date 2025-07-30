/*
  Warnings:

  - You are about to drop the column `processing_job_id` on the `processed_documents` table. All the data in the column will be lost.
  - You are about to drop the `document_processing_jobs` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "JobStatus" ADD VALUE 'PAUSED';
ALTER TYPE "JobStatus" ADD VALUE 'DELETED';

-- DropForeignKey
ALTER TABLE "processed_documents" DROP CONSTRAINT "processed_documents_processing_job_id_fkey";

-- DropIndex
DROP INDEX "processed_documents_processing_job_id_idx";

-- AlterTable
ALTER TABLE "processed_documents" DROP COLUMN "processing_job_id",
ADD COLUMN     "automation_job_id" TEXT;

-- DropTable
DROP TABLE "document_processing_jobs";

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

-- AddForeignKey
ALTER TABLE "processed_documents" ADD CONSTRAINT "processed_documents_automation_job_id_fkey" FOREIGN KEY ("automation_job_id") REFERENCES "automation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_jobs" ADD CONSTRAINT "automation_jobs_automation_rule_id_fkey" FOREIGN KEY ("automation_rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
