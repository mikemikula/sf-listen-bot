# 🤖 Listen Bot - Slack Message Logger

A modern Slack message logger that captures messages from designated channels and displays them in a beautiful, real-time dashboard.

## 🎯 Overview

Listen Bot is a full-stack Next.js application that:
- ✅ Captures Slack messages via webhooks  
- ✅ Stores messages in Postgres (Supabase)
- ✅ Displays messages in a real-time dashboard
- ✅ Provides filtering and search capabilities
- ✅ Built with modern tech stack and best practices

## 🏗️ Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS v4, BEM methodology
- **Backend**: Next.js API Routes, Node.js
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Hosting**: Railway
- **Package Manager**: pnpm

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Supabase account and database
- Slack app created and configured

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd sf-listen-bot
cp env.example .env.local
pnpm install
```

### 2. Environment Setup

Edit `.env.local` with your configuration:

```bash
# Database (Supabase)
DATABASE_URL="postgresql://username:password@host:port/database"
DIRECT_URL="postgresql://username:password@host:port/database"

# Slack App
SLACK_SIGNING_SECRET="your_slack_signing_secret"

# App Config
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Database Setup

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# (Optional) Open Prisma Studio
pnpm db:studio
```

### 4. Development

```bash
# Start development server
pnpm dev

# Run type checking
pnpm type-check

# Run linting
pnpm lint

# Verify everything is working
pnpm verify
```

Visit `http://localhost:3000` to see the dashboard.

---

## 📱 Slack App Configuration

### Step 1: Create Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app "Listen Bot" and select your workspace

### Step 2: Configure OAuth & Permissions

Add these **Bot Token Scopes**:
- `channels:history` - Read message history
- `channels:read` - Read channel information
- `chat:write` - Send messages (optional)

### Step 3: Enable Event Subscriptions

1. Go to **Event Subscriptions**
2. Enable Events: **On**
3. Request URL: `https://your-domain.railway.app/api/slack/events`
4. Subscribe to bot events:
   - `message.channels`

### Step 4: Install to Workspace

1. Go to **Install App**
2. Click "Install to Workspace"
3. Authorize the permissions

### Step 5: Invite Bot to Channel

In your Slack channel:
```
/invite @Listen Bot
```

---

## 🗃️ Database Schema

### Messages Table

```sql
CREATE TABLE messages (
  id          TEXT PRIMARY KEY,
  slack_id    TEXT UNIQUE NOT NULL,
  text        TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  username    TEXT NOT NULL,
  channel     TEXT NOT NULL,
  timestamp   TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_messages_channel ON messages(channel);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_messages_user_id ON messages(user_id);
```

---

## 🎨 Component Architecture

```
src/
├── components/
│   ├── ErrorBoundary.tsx    # Error handling
│   ├── FilterBar.tsx        # Search & filters
│   ├── Header.tsx           # App header
│   ├── LoadingSpinner.tsx   # Loading states
│   ├── MessageCard.tsx      # Individual message
│   └── MessageFeed.tsx      # Message list
├── lib/
│   ├── db.ts               # Database connection
│   └── slack.ts            # Slack utilities
├── pages/
│   ├── api/
│   │   ├── health.ts       # Health check
│   │   ├── messages/       # Messages API
│   │   └── slack/events.ts # Slack webhook
│   └── index.tsx           # Main dashboard
├── types/
│   └── index.ts            # TypeScript definitions
└── prisma/
    └── schema.prisma       # Database schema
```

---

## 🔌 API Endpoints

### Slack Webhook
```
POST /api/slack/events
- Handles Slack event subscriptions
- Validates request signatures
- Stores messages in database
```

### Messages API
```
GET /api/messages?channel=C123&search=hello&page=1&limit=20
- Fetches paginated messages
- Supports filtering and search
- Returns formatted message data
```

### Health Check
```
GET /api/health
- Database connectivity check
- Application status
- Uptime information
```

---

## 🚢 Deployment (Railway)

### 1. Prepare for Production

```bash
# Build the application
pnpm build

# Run production build locally (optional)
pnpm start
```

### 2. Railway Setup

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init`
4. Deploy: `railway up`

### 3. Environment Variables

Set these in Railway dashboard:

```bash
DATABASE_URL="your_supabase_url"
DIRECT_URL="your_supabase_direct_url"  
SLACK_SIGNING_SECRET="your_slack_secret"
NEXT_PUBLIC_APP_URL="https://your-app.railway.app"
NODE_ENV="production"
```

### 4. Database Migration

```bash
# Generate Prisma client for production
railway run npx prisma generate

# Deploy database schema
railway run npx prisma db push
```

### 5. Update Slack App

Update your Slack app's **Event Subscriptions** URL:
```
https://your-app.railway.app/api/slack/events
```

---

## 🧪 Testing

### Manual Testing

1. **Webhook**: Send test message in Slack channel
2. **Dashboard**: Check message appears in UI
3. **Filtering**: Test search and channel filters
4. **Health**: Visit `/api/health`

### API Testing

```bash
# Test health endpoint
curl https://your-app.railway.app/api/health

# Test messages API
curl https://your-app.railway.app/api/messages
```

---

## 🛠️ Development Commands

```bash
# Development
pnpm dev                 # Start dev server
pnpm build              # Build for production
pnpm start              # Start production server
pnpm lint               # Run ESLint
pnpm type-check         # Run TypeScript checker
pnpm verify             # Run all checks

# Database
pnpm db:generate        # Generate Prisma client
pnpm db:push            # Push schema to database
pnpm db:migrate         # Create and run migration
pnpm db:studio          # Open Prisma Studio
pnpm db:seed            # Run database seeder
```

---

## 🔍 Troubleshooting

### Common Issues

**1. Slack signature verification fails**
- Check `SLACK_SIGNING_SECRET` is correct
- Ensure webhook URL is accessible
- Verify request timestamp isn't too old

**2. Database connection errors** 
- Verify `DATABASE_URL` is correct
- Check Supabase database is running
- Ensure network connectivity

**3. Messages not appearing**
- Check bot is invited to channel
- Verify webhook URL is correct
- Check application logs for errors

**4. Build/Deploy errors**
- Run `pnpm verify` locally first
- Check all environment variables are set
- Ensure database schema is migrated

### Debugging

```bash
# Check logs in development
pnpm dev

# Check Railway logs
railway logs

# Test database connection
railway run npx prisma studio
```

---

## 📊 Monitoring

### Health Checks

- **Endpoint**: `/api/health`
- **Database**: Connection status
- **Uptime**: Application uptime tracking
- **Status**: Overall service health

### Logging

- **Development**: Console logs with emojis
- **Production**: Structured logging to Railway
- **Errors**: Comprehensive error tracking

---

## 🔮 Future Enhancements

### Phase 2 Features
- [ ] Multiple channel support
- [ ] Message reactions and threads  
- [ ] User management system
- [ ] Export functionality
- [ ] Advanced analytics dashboard
- [ ] Real-time notifications

### Technical Improvements
- [ ] Redis caching layer
- [ ] WebSocket connections
- [ ] Message queuing (Bull/Agenda)
- [ ] Advanced monitoring (Sentry)
- [ ] Automated testing suite
- [ ] Performance optimizations

---

## 📄 License

MIT License - see LICENSE file for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm verify`
5. Submit a pull request

---

**Built with ❤️ using Next.js, TypeScript, and modern web technologies.** 