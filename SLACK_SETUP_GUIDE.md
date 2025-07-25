# 🤖 Slack App Setup Guide for Listen Bot

## Step 1: Create Your Slack App

1. **Go to** [https://api.slack.com/apps](https://api.slack.com/apps)
2. **Click** "Create New App" → "From scratch"
3. **Name**: `Listen Bot` (or whatever you prefer)
4. **Workspace**: Select your workspace
5. **Click** "Create App"

## Step 2: Configure Basic Information

### Get Your Signing Secret
1. **Go to** "Basic Information" in sidebar
2. **Find** "App Credentials" section
3. **Copy** the "Signing Secret" 
4. **Add to** your `.env.local`:
   ```bash
   SLACK_SIGNING_SECRET="your_signing_secret_here"
   ```

## Step 3: Set OAuth & Permissions

### Bot Token Scopes
1. **Go to** "OAuth & Permissions" in sidebar
2. **Scroll to** "Scopes" section
3. **Add these Bot Token Scopes**:
   - `channels:history` - Read message history from public channels
   - `channels:read` - View basic information about public channels
   - `groups:history` - (Optional) Read private channel history
   - `groups:read` - (Optional) View basic information about private channels

### Install App to Workspace
1. **Scroll up** to "OAuth Tokens for Your Workspace"
2. **Click** "Install to Workspace"
3. **Authorize** the permissions
4. **(Optional)** Copy "Bot User OAuth Token" if you need it later

## Step 4: Enable Event Subscriptions

### Configure Webhook URL
1. **Go to** "Event Subscriptions" in sidebar
2. **Toggle** "Enable Events" to **ON**
3. **Request URL**: Enter your webhook endpoint:
   - **Development**: `http://localhost:3000/api/slack/events`
   - **Production**: `https://your-app.railway.app/api/slack/events`

### URL Verification Process
When you save the URL, Slack will send a verification challenge:
- ✅ Your Listen Bot will automatically handle this
- ✅ You should see "Verified ✓" if successful
- ❌ If it fails, check your server is running and accessible

### Subscribe to Bot Events
**Scroll down** to "Subscribe to bot events" and add:
- `message.channels` - Message posted to public channel
- `message.groups` - (Optional) Message posted to private channel

**Click** "Save Changes"

## Step 5: Install Bot to Channels

### Invite Bot to Channels
In each Slack channel where you want to capture messages:

```
/invite @Listen Bot
```

Or use the UI:
1. **Click** channel name → "Integrations" → "Apps"
2. **Find** "Listen Bot" → "Add"

## Step 6: Test the Integration

### 1. Start Your Local Server
```bash
cd sf-listen-bot
pnpm dev
```

### 2. Send Test Message
Post a message in a channel where the bot is installed:
```
Hello Listen Bot! 👋
```

### 3. Check Dashboard
- **Visit**: `http://localhost:3000`
- **Verify**: Message appears in the feed
- **Check**: Database has the message

### 4. Check Logs
Your terminal should show:
```
✅ Message stored: cm1x2y3z4...
```

## 🚀 Production Deployment

### Update Webhook URL
After deploying to Railway:

1. **Go back** to Slack App → "Event Subscriptions"
2. **Update Request URL** to: `https://your-app.railway.app/api/slack/events`
3. **Save Changes** (Slack will re-verify)

### Verify Production
- **Send message** in Slack
- **Check** your production dashboard
- **Monitor** Railway logs for any errors

## 🔍 Troubleshooting

### Common Issues

**1. URL Verification Failed**
- ✅ Check server is running on correct port
- ✅ Verify webhook URL is accessible
- ✅ Check firewall/network settings

**2. Messages Not Appearing**
- ✅ Bot invited to channel?
- ✅ Correct event subscriptions?
- ✅ Check server logs for errors
- ✅ Verify signing secret in `.env.local`

**3. Signature Verification Failed**
- ✅ Double-check `SLACK_SIGNING_SECRET`
- ✅ Ensure no extra spaces/quotes
- ✅ Restart server after env changes

### Debug Commands

```bash
# Check webhook endpoint
curl http://localhost:3000/api/health

# Check database connection
pnpm db:studio

# View application logs
pnpm dev  # Watch terminal output
```

## 📋 Final Checklist

- ✅ Slack app created and configured
- ✅ Signing secret added to `.env.local`
- ✅ Bot token scopes configured
- ✅ Event subscriptions enabled
- ✅ Webhook URL verified
- ✅ Bot installed to workspace
- ✅ Bot invited to target channels
- ✅ Test message captured successfully

**You're all set! 🎉** 