# 🤖 SF Listen Bot - AI Knowledge Platform

An enterprise-grade, AI-powered knowledge management platform that captures and transforms unstructured Slack conversations into structured, searchable knowledge assets within Salesforce.

## 🎯 Overview

SF Listen Bot is a full-stack Next.js application designed to solve the critical business problem of knowledge being trapped and lost in ephemeral communication channels. It provides an end-to-end solution that:

-   ✅ **Captures Slack Data**: Ingests Slack messages in real-time via webhooks and supports historical data imports via a channel puller.
-   🧠 **AI-Powered Analysis**: Leverages Google Gemini to analyze conversation patterns, identify key topics, and generate titles and summaries.
-   🛡️ **PII Detection & Management**: Automatically detects and redacts Personally Identifiable Information (PII) with a dedicated dashboard for manual review and approval.
-   📄 **Creates Structured Documents**: Groups related messages into coherent `ProcessedDocuments` that act as a source of truth.
-   💡 **Generates FAQs**: Uses AI to generate high-quality FAQs from processed documents, with built-in duplicate detection using Pinecone vector search.
-   🔗 **Integrates with Salesforce**: Securely connects to Salesforce via OAuth and syncs `Documents` and `FAQs` to custom objects (`Slack_Document__c`, `Slack_FAQ__c`).
-   ⚙️ **Manages Processing**: Features a robust background job system using Bull and Redis to handle intensive AI tasks without blocking the UI.
-   📊 **Provides Rich Dashboards**: A comprehensive UI for viewing messages, managing documents, reviewing FAQs, handling PII, monitoring system analytics, and controlling automation.

## 🏗️ Tech Stack

-   **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
-   **Backend**: Next.js API Routes, Node.js
-   **Database**: PostgreSQL (via Supabase) & Redis
-   **ORM**: Prisma
-   **AI & Machine Learning**: Google Gemini (for generation & analysis), Pinecone (for vector search/duplicate detection)
-   **Job Queuing**: Bull for managing background jobs
-   **Integration**: Slack API, Salesforce (REST & Metadata)
-   **Deployment**: Vercel

## 🚀 Quick Start

### Prerequisites

-   Node.js 18+
-   pnpm (`npm install -g pnpm`)
-   Access to a PostgreSQL database
-   Access to a Redis instance
-   Slack App credentials
-   Google Gemini API Key
-   Pinecone API Key
-   Salesforce Connected App credentials

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd sf-listen-bot
cp env.example .env.local
pnpm install
```

### 2. Environment Setup

Edit `.env.local` with all your credentials for the services listed in the prerequisites. Key variables include `DATABASE_URL`, `REDIS_HOST`, `SLACK_SIGNING_SECRET`, `GEMINI_API_KEY`, `PINECONE_API_KEY`, and Salesforce credentials.

### 3. Database Setup

```bash
# Generate Prisma client from your schema
pnpm db:generate

# Push the database schema to your PostgreSQL instance
pnpm db:push
```

### 4. Development Server

```bash
# Start the Next.js development server
pnpm dev
```

Visit `http://localhost:3000` to see the dashboard.

---

## 🗃️ Database Schema

The application uses a sophisticated relational database schema to track data from ingestion to final output. The core models are:

-   `Message`: Stores every raw message from Slack, including thread relationships.
-   `ProcessedDocument`: An AI-generated summary of a conversation, linking multiple messages together.
-   `FAQ`: An AI-generated Question/Answer pair derived from a `ProcessedDocument`.
-   `PIIDetection`: Tracks every piece of PII found in messages, its status, and how it was redacted.
-   `AutomationJob`: Represents a background task (e.g., generating a document), tracking its progress and status.
-   `SlackEvent`: An audit log of every incoming event from Slack for reliability and debugging.
-   `SalesforceConnection`: Securely stores OAuth credentials for Salesforce integration.

For a complete and detailed view of the schema and all relationships, please refer to the `prisma/schema.prisma` file.

---

## 🔌 API Endpoints

The application exposes a rich set of API endpoints to support its functionality:

-   `POST /api/slack/events`: The main webhook for ingesting real-time events from Slack.
-   `GET /api/messages`: Fetches paginated and filterable messages for the main dashboard.
-   `GET /api/messages/stream`: A Server-Sent Events (SSE) endpoint for pushing real-time updates to the UI.
-   `POST /api/documents/process-all`: Triggers a background job to process all unprocessed messages into documents.
-   `POST /api/faqs/generate`: Triggers a background job to generate FAQs from a specific document.
-   `GET /api/pii/review`: Fetches PII detections that require manual review.
-   `POST /api/salesforce/oauth/connect`: Initiates the OAuth flow for Salesforce connection.
-   `POST /api/salesforce/sync`: Starts a job to sync documents and FAQs to Salesforce.
-   `GET /api/processing/analytics`: Provides a snapshot of system health and processing statistics.

---

## 🔮 Future Enhancements

-   [ ] **Bidirectional Salesforce Sync**: Implement the designed webhook listeners (`SalesforceWebhookPayload`) to allow changes in Salesforce to sync back to the application.
-   [ ] **Microsoft Teams Integration**: Abstract the communication layer to support ingestion from other platforms like MS Teams.
-   [ ] **Advanced Analytics**: Create a dashboard to track knowledge creation, usage metrics, and the impact of automated FAQs on support ticket volume.
-   [ ] **Direct Salesforce Knowledge Integration**: Add a sync target to create and update articles in the official Salesforce Knowledge Base.
