# 🚀 Listen Bot - Quick Start Guide

## Step 1: Install Dependencies

```bash
# Install all dependencies
pnpm install

# Verify installation
pnpm verify
```

## Step 2: Environment Setup

```bash
# Copy environment template
cp env.example .env.local

# Edit .env.local with your actual values:
# - DATABASE_URL (your Supabase connection string)
# - SLACK_SIGNING_SECRET (from your Slack app)
```

## Step 3: Database Setup

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to Supabase
pnpm db:push

# (Optional) Open database GUI
pnpm db:studio
```

## Step 4: Start Development

```bash
# Start the dev server
pnpm dev

# Visit http://localhost:3000
```

## Step 5: Configure Slack App

1. **Create Slack App**: https://api.slack.com/apps
2. **Add Bot Scopes**: `channels:history`, `channels:read`
3. **Enable Events**: Point to `http://localhost:3000/api/slack/events`
4. **Subscribe to**: `message.channels`
5. **Install to Workspace**
6. **Invite Bot**: `/invite @Listen Bot` in your channel

## Step 6: Test Everything

```bash
# Check health
curl http://localhost:3000/api/health

# Send a message in Slack channel
# Check dashboard for new messages
```

## Ready for Production?

```bash
# Build and deploy to Vercel
pnpm build
vercel

# Update Slack webhook URL to your Vercel domain
```

**You're all set! 🎉** 