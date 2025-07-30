
# Application Architecture

This document provides a comprehensive overview of the SF Listen Bot application, covering its business objectives, system architecture, technology stack, and key features.

## 1. Business & Solution Overview

This application serves as an intelligent knowledge base generator that transforms unstructured conversations from Slack into valuable, organized assets like official documentation and FAQs. It is designed for organizations that rely on Slack for internal communication and want to capture the valuable information that is often lost in the constant flow of messages.

### 1.1. Core Business Process

The application follows a clear, multi-step process to deliver value:

1.  **Data Ingestion**: The system monitors and ingests conversations from designated Slack channels in real-time.
2.  **AI-Powered Processing**: The raw data is processed by an AI to analyze and summarize the content. During this step, any Personally Identifiable Information (PII) is detected and redacted.
3.  **Knowledge Asset Generation**: The secure, anonymized data is used to generate structured and valuable assets.
4.  **Value Delivery**: The final outputs are clear, accessible knowledge assets:
    *   **Curated Documents**: Well-organized documents that summarize key topics.
    *   **FAQs**: A list of frequently asked questions and their answers.

## 2. Technology Stack

*   **Frontend**: Next.js, React, TypeScript, Tailwind CSS, Lucide React, Server-Sent Events (SSE).
*   **Backend**: Next.js API Routes, Prisma, Bull (with Redis).
*   **AI & Machine Learning**: Google Gemini, Pinecone.
*   **Database**: PostgreSQL, Redis.
*   **Deployment**: Vercel.

## 3. System Architecture

The application is a monolithic Next.js application that encompasses both the frontend and backend. It is designed to be deployed as a serverless application on Vercel.

### 3.1. High-Level System Flow

The system operates through a series of interactions between its main components:

1.  **User Interface (Next.js Frontend)**: Users interact with the application through a web interface built with Next.js and React.
2.  **Backend (Next.js API Routes)**: The frontend sends HTTP requests to the backend, which is a set of serverless functions.
3.  **Data & Services**: The backend interacts with several services:
    *   It sends events to and receives events from the **Slack API**.
    *   It uses the **Prisma ORM** to query the **PostgreSQL Database**.
    *   It leverages **AI/ML Services** (like Google Gemini) for content processing.
4.  **Automation**: An **Automation Engine** triggers background jobs, which are managed by a **Job Queue** (Bull with Redis). These jobs are then executed by the backend.

### 3.2. Architectural Layers & Patterns

*   **Frontend**: A Next.js application serving the user interface, built with a **feature-based component structure** and styled with **Tailwind CSS**. It uses the React Context API for **lightweight state management**.
*   **Backend (API)**: A set of Next.js API routes that provide the business logic, using **custom error classes** for structured error handling.
*   **Data Layer**: A PostgreSQL database with a schema managed by **Prisma**.
*   **Services**: A collection of libraries in `src/lib` for interacting with external APIs and processing data.
*   **Automation**: A **Bull/Redis queue** manages background jobs for long-running tasks.

## 4. Detailed Architecture

### 4.1. Frontend

*   **Routing**: The application uses the Next.js `pages` directory for file-system based routing.
*   **Real-time Updates**: Server-Sent Events (SSE) are used for real-time updates, handled by `/api/messages/stream.ts` and the `useRealTimeMessages.ts` hook.
*   **Error Handling**: The `ErrorBoundary.tsx` component catches and handles rendering errors.

### 4.2. Backend

*   **API Endpoints**: The API is organized by resource in `src/pages/api`.
*   **Core Services**: The core business logic resides in `src/lib`.
*   **Background Jobs**: Long-running tasks are managed in `src/lib/backgroundJobs.ts`.

### 4.3. Data Layer

*   **Schema Definition**: The `prisma/schema.prisma` file defines all data models.
*   **Key Data Models**: `Message`, `ProcessedDocument`, `FAQ`, `AutomationJob`, `PIIDetection`, `SlackEvent`.
*   **Data Relationships**:
    *   A `Message` can be part of a `ProcessedDocument` (`DocumentMessage` join table).
    *   A `ProcessedDocument` can be the source for multiple `FAQ`s (`DocumentFAQ` table).
    *   An `AutomationJob` can generate a `ProcessedDocument`.
    *   `PIIDetection` records are linked to a `Message`.

## 5. Functional Map by Feature

This section provides a detailed mapping of core features to the files that implement them.

### 5.1. Slack Data Ingestion

*   **Real-time Event Handling**: `src/pages/api/slack/events.ts`, `src/lib/eventProcessor.ts`.
*   **Historical Data Pulling**: `src/pages/slack/channel-pull.tsx`, `src/lib/slackChannelPuller.ts`.

### 5.2. Content Processing & AI

*   **Document Processing**: `src/pages/api/documents/process.ts`, `src/lib/documentProcessor.ts`.
*   **FAQ Generation**: `src/pages/api/faqs/generate.ts`, `src/lib/faqGenerator.ts`.
*   **PII Detection**: `src/lib/piiDetector.ts`, `src/pages/pii/review.tsx`.

### 5.3. Data Storage

*   **Database Schema**: `prisma/schema.prisma`.
*   **Database Client**: `src/lib/db.ts`.
*   **Vector Database**: `src/lib/pinecone.ts`.

### 5.4. User Interface

*   **Main Application Shell**: `src/pages/_app.tsx`, `src/components/Header.tsx`.
*   **Dashboards**: `src/pages/index.tsx`, `src/pages/documents/index.tsx`, `src/pages/faqs/index.tsx`, `src/pages/processing/dashboard.tsx`.

### 5.5. Automation & Background Jobs

*   **Job Management**: `src/lib/backgroundJobs.ts`, `src/pages/api/processing/jobs/manage.ts`.
*   **Automation Rules**: `src/pages/api/processing/automation/rules.ts`.

## 6. Security & Deployment

*   **Authentication**: The application is public, with no user-level authentication.
*   **Authorization**: Access control is managed at the service level via API keys and tokens.
*   **Deployment**: The application is configured for deployment on Vercel (`vercel.json`).

This document will be updated as the application evolves. 