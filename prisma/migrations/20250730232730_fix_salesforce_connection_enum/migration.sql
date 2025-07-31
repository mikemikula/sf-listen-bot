/*
  Warnings:

  - The `status` column on the `salesforce_connections` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "SalesforceConnectionDBStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR', 'DISCONNECTED');

-- AlterTable
ALTER TABLE "salesforce_connections" DROP COLUMN "status",
ADD COLUMN     "status" "SalesforceConnectionDBStatus" NOT NULL DEFAULT 'ACTIVE';

-- DropEnum
DROP TYPE "SalesforceConnectionStatus";

-- CreateIndex
CREATE INDEX "salesforce_connections_status_idx" ON "salesforce_connections"("status");
