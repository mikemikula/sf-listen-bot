-- CreateEnum
CREATE TYPE "SalesforceConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "salesforce_connections" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "salesforce_user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT,
    "instance_url" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_type" TEXT NOT NULL DEFAULT 'Bearer',
    "token_expires_at" TIMESTAMP(3),
    "status" "SalesforceConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_activity_at" TIMESTAMP(3),
    "api_call_count" INTEGER NOT NULL DEFAULT 0,
    "daily_api_limit" INTEGER,
    "daily_api_used" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),

    CONSTRAINT "salesforce_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salesforce_connections_session_id_key" ON "salesforce_connections"("session_id");

-- CreateIndex
CREATE INDEX "salesforce_connections_session_id_idx" ON "salesforce_connections"("session_id");

-- CreateIndex
CREATE INDEX "salesforce_connections_organization_id_idx" ON "salesforce_connections"("organization_id");

-- CreateIndex
CREATE INDEX "salesforce_connections_salesforce_user_id_idx" ON "salesforce_connections"("salesforce_user_id");

-- CreateIndex
CREATE INDEX "salesforce_connections_status_idx" ON "salesforce_connections"("status");

-- CreateIndex
CREATE INDEX "salesforce_connections_created_at_idx" ON "salesforce_connections"("created_at");
