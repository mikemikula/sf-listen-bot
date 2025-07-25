# 🔄 Listen Bot Integration Flow

## Technical Overview

Here's exactly what happens when someone posts a message in your Slack channel:

### **Step 1: Message Posted in Slack**
```
User: "Hello team! 👋"
Channel: #general
User ID: U1234567890
Timestamp: 1703123456.789123
```

### **Step 2: Slack Events API Triggers**
Slack automatically sends a POST request to your webhook:

```http
POST /api/slack/events
Headers:
  X-Slack-Signature: v0=abc123...
  X-Slack-Request-Timestamp: 1703123456
  Content-Type: application/json

Body:
{
  "token": "verification_token_here",
  "team_id": "T1234567890",
  "api_app_id": "A1234567890",
  "event": {
    "type": "message",
    "user": "U1234567890",
    "text": "Hello team! 👋",
    "ts": "1703123456.789123",
    "channel": "C1234567890",
    "event_ts": "1703123456.789123"
  },
  "type": "event_callback",
  "event_id": "Ev1234567890",
  "event_time": 1703123456
}
```

### **Step 3: Your Listen Bot Processes**

Your `/api/slack/events` endpoint:

1. **Verifies Signature** (Security)
   ```typescript
   const isValid = verifySlackSignature(signature, timestamp, rawBody)
   // Uses your SLACK_SIGNING_SECRET to verify request is from Slack
   ```

2. **Validates Event Type**
   ```typescript
   if (payload.type === 'event_callback' && payload.event) {
     // Process the message
   }
   ```

3. **Stores in Database**
   ```typescript
   const message = await db.message.create({
     data: {
       slackId: "1703123456.789123",
       text: "Hello team! 👋", 
       userId: "U1234567890",
       username: "user_1234567", // Formatted from user ID
       channel: "C1234567890",
       timestamp: new Date(1703123456789), // Converted to JS Date
     }
   })
   ```

### **Step 4: Dashboard Updates**

Your React dashboard:

1. **Fetches Messages**
   ```typescript
   const response = await fetch('/api/messages?page=1&limit=20')
   ```

2. **Displays in UI**
   ```jsx
   <MessageCard 
     message={{
       id: "cm1x2y3z4...",
       text: "Hello team! 👋",
       username: "user_1234567",
       channel: "C1234567890", 
       timeAgo: "2 minutes ago"
     }}
   />
   ```

## 🔐 Security & Authentication

### **Signature Verification Process**

```typescript
// What your bot does to verify each request:
const hmac = crypto.createHmac('sha256', SLACK_SIGNING_SECRET)
hmac.update(`v0:${timestamp}:${rawBody}`)
const computedSignature = `v0=${hmac.digest('hex')}`

// Compare with Slack's signature
const isValid = crypto.timingSafeEqual(
  Buffer.from(computedSignature),
  Buffer.from(requestSignature)
)
```

This ensures **only Slack** can send events to your bot.

## 📊 Database Schema Mapping

### **Slack Event → Database Record**

| Slack Field | Database Field | Transformation |
|-------------|----------------|----------------|
| `event.ts` | `slackId` | Direct mapping (unique) |
| `event.text` | `text` | Direct mapping |
| `event.user` | `userId` | Direct mapping |
| `event.user` | `username` | Formatted to `user_XXXXXXX` |
| `event.channel` | `channel` | Direct mapping |
| `event.ts` | `timestamp` | Converted: `parseFloat(ts) * 1000` |

### **Database Indexes for Performance**

```sql
CREATE INDEX idx_messages_channel ON messages(channel);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);  
CREATE INDEX idx_messages_user_id ON messages(user_id);
```

## 🚀 Real-Time Flow Example

Let's trace a complete message:

### **1. Slack Channel**
```
@john.doe: "Hey everyone, the meeting is at 3pm"
Channel: #announcements 
Time: 2:30 PM
```

### **2. Webhook Payload**
```json
{
  "event": {
    "type": "message",
    "user": "U02A1B2C3D4", 
    "text": "Hey everyone, the meeting is at 3pm",
    "ts": "1703527800.123456",
    "channel": "C01ABCDEF12"
  }
}
```

### **3. Database Record**
```sql
INSERT INTO messages (
  id, slack_id, text, user_id, username, channel, timestamp
) VALUES (
  'cm1x2y3z4a5b6c7d8e9f',
  '1703527800.123456', 
  'Hey everyone, the meeting is at 3pm',
  'U02A1B2C3D4',
  'user_02A1B2C',
  'C01ABCDEF12',
  '2024-12-25 14:30:00'
);
```

### **4. Dashboard Display**
```jsx
<MessageCard>
  <Avatar>JD</Avatar>
  <Content>
    <Header>user_02A1B2C • #announcements • 2 minutes ago</Header>
    <Text>Hey everyone, the meeting is at 3pm</Text>
  </Content>
</MessageCard>
```

## 🔄 Error Handling & Retries

### **Slack Retry Logic**
- If your webhook fails, Slack retries up to **3 times**
- Your bot handles **duplicate messages** using `slackId` unique constraint
- **Idempotent**: Same message won't be stored twice

### **Your Bot's Response**
```typescript
// Success - Slack won't retry
return res.status(200).json({ success: true })

// Error - Slack will retry
return res.status(500).json({ success: false, error: 'Database error' })
```

## 🎯 Key Integration Points

### **1. Environment Configuration**
```bash
# Required for Slack integration
SLACK_SIGNING_SECRET="your_app_signing_secret"

# Required for database
DATABASE_URL="postgresql://user:pass@host:port/db"
```

### **2. Webhook Endpoint**
```typescript
// src/pages/api/slack/events.ts
export default async function handler(req, res) {
  // 1. Verify signature
  // 2. Handle url_verification 
  // 3. Process message events
  // 4. Store in database
  // 5. Return success
}
```

### **3. Dashboard API**
```typescript  
// src/pages/api/messages/index.ts
export default async function handler(req, res) {
  // 1. Parse filters
  // 2. Query database
  // 3. Transform for display
  // 4. Return paginated results
}
```

**This creates a seamless flow from Slack → Database → Dashboard! 🚀** 