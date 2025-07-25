# 🚀 Vercel Deployment Guide

Deploy your Listen Bot to Vercel for optimal Next.js 15 performance and scalability.

## Why Vercel?

✅ **Built for Next.js** - Made by the Next.js team  
✅ **Edge Functions** - Global performance with serverless  
✅ **Automatic Deployments** - Git-based CI/CD  
✅ **Built-in Analytics** - Performance monitoring  
✅ **Zero Configuration** - Works out of the box  

## 📋 Prerequisites

- [Vercel Account](https://vercel.com/signup) (free tier available)
- [Vercel CLI](https://vercel.com/docs/cli) installed: `npm i -g vercel`
- Supabase database configured
- Slack app configured (see `SLACK_SETUP_GUIDE.md`)

## 🚀 Deployment Steps

### 1. **Install Vercel CLI**

```bash
npm install -g vercel
vercel login
```

### 2. **Configure Environment Variables**

Copy `env.example` to create your environment variables:

```bash
cp env.example .env.local
```

**Required Environment Variables:**

```bash
# Database (Supabase)
DATABASE_URL="postgresql://username:password@host:port/database?pgbouncer=true"
DIRECT_URL="postgresql://username:password@host:port/database"

# Slack
SLACK_SIGNING_SECRET="your_slack_signing_secret_here"
SLACK_BOT_TOKEN="xoxb-your-bot-token-here"

# App URL (will update after deployment)
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
```

### 3. **Deploy to Vercel**

#### Option A: Deploy via Git (Recommended)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "🚀 Ready for Vercel deployment"
   git push origin main
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel auto-detects Next.js configuration

3. **Configure Environment Variables:**
   - In Vercel dashboard, go to: Project Settings → Environment Variables
   - Add all variables from your `.env.local`
   - Set environment to "Production"

#### Option B: Deploy via CLI

```bash
# Deploy from your project directory
vercel

# Follow the prompts:
# ? Set up and deploy "sf-listen-bot"? [Y/n] Y
# ? Which scope? Your username
# ? Link to existing project? [y/N] N
# ? What's your project's name? sf-listen-bot
# ? In which directory is your code located? ./
```

### 4. **Set Up Database**

```bash
# Generate Prisma client for production
pnpm db:generate

# Push database schema to Supabase
pnpm db:push
```

### 5. **Update Slack Webhook URL**

After deployment, update your Slack app's webhook URL:

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Select your app
3. Go to "Event Subscriptions"
4. Update Request URL to: `https://your-app.vercel.app/api/slack/events`
5. Verify the URL (should show ✅ Verified)

### 6. **Configure Custom Domain (Optional)**

In Vercel dashboard:
1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS settings as instructed
4. Update `NEXT_PUBLIC_APP_URL` environment variable

## 🔧 Vercel Configuration

Our `vercel.json` is optimized for:

- **Edge Functions**: API routes run on Vercel's Edge Network
- **Security Headers**: CSP, CORS, and security policies
- **Performance**: Optimized for Next.js 15 and React 19
- **Regional Deployment**: US East and West for low latency

## 📊 Monitoring & Analytics

### Built-in Vercel Analytics

Add to your environment variables:
```bash
NEXT_PUBLIC_VERCEL_ANALYTICS_ID="your_analytics_id"
```

### Health Check Endpoint

Monitor your app health at:
```
https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 12345,
  "database": "connected",
  "environment": "production"
}
```

## 🐛 Troubleshooting

### Common Issues

#### 1. **Database Connection Errors**
```bash
# Check your DATABASE_URL format
DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true"
```

#### 2. **Slack Webhook Verification Fails**
- Ensure `SLACK_SIGNING_SECRET` is correct
- Check that webhook URL ends with `/api/slack/events`
- Verify Vercel function timeout (max 30s)

#### 3. **Build Failures**
```bash
# Test build locally first
pnpm build

# Check Vercel build logs in dashboard
```

#### 4. **Environment Variables Not Loading**
- Ensure variables are set in Vercel dashboard
- No quotes needed in Vercel UI
- Redeploy after adding new variables

### Debug Commands

```bash
# Check deployment status
vercel ls

# View function logs
vercel logs

# Run local development with Vercel environment
vercel dev
```

## 🚀 Production Checklist

Before going live:

- [ ] All environment variables configured
- [ ] Database schema deployed (`pnpm db:push`)
- [ ] Slack webhook URL updated and verified
- [ ] Health check endpoint returns 200
- [ ] Test message flow: Slack → Webhook → Database → Dashboard
- [ ] Custom domain configured (optional)
- [ ] Analytics enabled (optional)

## 🎯 Performance Optimization

### Vercel Edge Functions Benefits

- **Global CDN**: Sub-50ms response times worldwide
- **Auto-scaling**: Handles traffic spikes automatically  
- **Cold Start Optimization**: Next.js 15 pre-warming
- **Image Optimization**: Built-in with Vercel

### Monitoring Production

```bash
# View real-time logs
vercel logs --follow

# Check function performance
vercel inspect [deployment-url]
```

## 💡 Next Steps

After successful deployment:

1. **Monitor Usage**: Check Vercel dashboard for metrics
2. **Set Up Alerts**: Configure uptime monitoring
3. **Scale Database**: Upgrade Supabase plan as needed
4. **Enable Analytics**: Add Vercel Web Analytics
5. **Custom Domain**: Set up branded URL

---

## 🆘 Support

- **Vercel Docs**: https://vercel.com/docs
- **Next.js 15 Docs**: https://nextjs.org/docs
- **Issues**: Open an issue in this repository

**Your Listen Bot is now running on Vercel! 🎉** 