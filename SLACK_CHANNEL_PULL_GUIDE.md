# Slack Channel Pull Feature Guide

## Overview

The Slack Channel Pull feature allows you to pull all historical data from Slack channels, including messages, threads, and metadata. The data is processed through the existing event processing pipeline, enabling automatic document creation, FAQ generation, and PII detection.

## 🚀 Features

- **Complete Data Extraction**: Pull all messages from any Slack channel
- **Thread Support**: Automatically fetch and process thread replies
- **Progress Tracking**: Real-time progress monitoring with detailed statistics
- **Rate Limiting**: Built-in rate limiting to respect Slack API limits
- **Date Range Filtering**: Pull data from specific time periods
- **Batch Processing**: Configurable batch sizes for optimal performance
- **Error Handling**: Robust error handling with retry mechanisms
- **Integration**: Seamless integration with existing document and FAQ pipelines

## 📋 Prerequisites

### Slack Configuration

1. **Bot Token**: Ensure `SLACK_BOT_TOKEN` is configured in your environment
2. **Required Scopes**: Your Slack app needs these scopes:
   - `channels:history` - Read messages from public channels
   - `groups:history` - Read messages from private channels
   - `im:history` - Read messages from direct messages
   - `mpim:history` - Read messages from group messages
   - `channels:read` - List public channels
   - `groups:read` - List private channels

3. **Channel Access**: The bot must be invited to private channels you want to pull data from

### Environment Variables

```bash
# Required
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret

# Optional (for enhanced features)
GEMINI_API_KEY=your-gemini-api-key  # For document processing
PINECONE_API_KEY=your-pinecone-key  # For FAQ generation
```

## 🎯 Quick Start

### 1. Using the Web Interface

1. Navigate to `/slack/channel-pull` in your browser
2. Click "Refresh Channels" to load available channels
3. Select a channel from the list
4. Configure your pull settings:
   - **Date Range**: Optional start and end dates
   - **Include Threads**: Whether to pull thread replies (recommended)
   - **Advanced Settings**: Batch size and delay configuration
5. Click "Start Channel Pull"
6. Monitor progress in real-time

### 2. Using the API

#### List Available Channels

```bash
curl -X GET "http://localhost:3000/api/slack/channel-pull?action=list-channels"
```

#### Start a Channel Pull

```bash
curl -X POST "http://localhost:3000/api/slack/channel-pull" \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "C1234567890",
    "channelName": "general",
    "includeThreads": true,
    "batchSize": 100,
    "delayBetweenRequests": 1000
  }'
```

#### Check Progress

```bash
curl -X GET "http://localhost:3000/api/slack/channel-pull?progressId=pull_C1234567890_1234567890"
```

#### Cancel a Pull

```bash
curl -X DELETE "http://localhost:3000/api/slack/channel-pull?progressId=pull_C1234567890_1234567890"
```

### 3. Using the Test Script

```bash
# List channels
node src/scripts/test-channel-pull.js --list

# Run full demonstration
node src/scripts/test-channel-pull.js --demo

# Test cancellation
node src/scripts/test-channel-pull.js --cancel
```

## ⚙️ Configuration Options

### Pull Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `channelId` | string | **required** | Slack channel ID (C1234567890) |
| `channelName` | string | optional | Human-readable channel name |
| `startDate` | ISO date | optional | Pull messages after this date |
| `endDate` | ISO date | optional | Pull messages before this date |
| `includeThreads` | boolean | `true` | Whether to include thread replies |
| `batchSize` | number | `100` | Messages per API request (50-200) |
| `delayBetweenRequests` | number | `1000` | Delay between requests in ms (500-5000) |
| `userId` | string | optional | User who initiated the pull |

### Advanced Settings

#### Batch Size
- **Small (50-75)**: Better for channels with complex threads
- **Medium (100-150)**: Good balance for most channels
- **Large (175-200)**: Faster for channels with simple messages

#### Delay Between Requests
- **Conservative (2000-5000ms)**: Safest for large pulls
- **Standard (1000-2000ms)**: Good for most scenarios
- **Aggressive (500-1000ms)**: Faster but may hit rate limits

## 📊 Progress Tracking

### Progress States

- **QUEUED**: Pull request accepted and queued
- **RUNNING**: Actively pulling and processing data
- **COMPLETED**: Successfully completed
- **FAILED**: Failed due to an error
- **CANCELLED**: Manually cancelled

### Progress Information

```json
{
  "id": "pull_C1234567890_1234567890",
  "channelId": "C1234567890",
  "channelName": "general",
  "status": "RUNNING",
  "progress": 45,
  "totalMessages": 1000,
  "processedMessages": 450,
  "threadsProcessed": 25,
  "startedAt": "2024-01-15T10:30:00Z",
  "completedAt": null,
  "errorMessage": null,
  "stats": {
    "newMessages": 400,
    "duplicateMessages": 50,
    "threadRepliesFetched": 150,
    "documentsCreated": 5,
    "faqsGenerated": 12,
    "piiDetected": 3
  }
}
```

## 🔄 Integration with Existing Systems

### Event Processing Pipeline

Pulled messages are processed through the same pipeline as real-time messages:

1. **Message Validation**: Filters and validates message content
2. **PII Detection**: Scans for personally identifiable information
3. **Document Processing**: Groups related messages into documents
4. **FAQ Generation**: Creates FAQs from question-answer patterns
5. **Database Storage**: Stores with full relationship tracking

### Data Consistency

- **Deduplication**: Prevents duplicate messages if run multiple times
- **Thread Linking**: Maintains proper parent-child relationships
- **Timestamp Preservation**: Maintains original Slack timestamps
- **User Attribution**: Preserves original user information

## 🚨 Rate Limiting & Best Practices

### Slack API Limits

- **Tier 3 Methods**: `conversations.history` and `conversations.replies`
- **Rate Limit**: ~50 requests per minute (may vary)
- **Burst Limits**: Short-term higher limits for small bursts

### Best Practices

1. **Start Small**: Test with small channels first
2. **Use Date Ranges**: Limit pulls to specific time periods
3. **Monitor Progress**: Watch for rate limit warnings
4. **Schedule Large Pulls**: Run during off-peak hours
5. **Batch Appropriately**: Use smaller batches for complex channels

### Error Handling

The system includes automatic:
- **Exponential Backoff**: Gradually increases delays on rate limits
- **Retry Logic**: Retries failed requests up to 3 times
- **Graceful Degradation**: Continues processing on non-critical errors

## 🛠️ Troubleshooting

### Common Issues

#### "No channels available"
- **Cause**: Bot not invited to channels or missing scopes
- **Solution**: Invite bot to channels and verify OAuth scopes

#### "Invalid channel ID format"
- **Cause**: Using channel name instead of ID
- **Solution**: Use channel ID (starts with C, G, or D)

#### "Rate limited"
- **Cause**: Too many requests too quickly
- **Solution**: Increase delay between requests

#### "Channel not found"
- **Cause**: Bot doesn't have access to the channel
- **Solution**: Invite bot to the channel or check permissions

#### Pull stuck at 0%
- **Cause**: No messages in date range or channel access issues
- **Solution**: Check date range and channel permissions

### Debug Mode

Enable detailed logging by setting:
```bash
DEBUG=slack-channel-pull
```

### Health Checks

Monitor system health at:
```bash
curl http://localhost:3000/api/health
```

## 📈 Performance Guidelines

### Channel Size Recommendations

| Channel Size | Batch Size | Delay | Estimated Time |
|--------------|------------|-------|----------------|
| < 1K messages | 100-200 | 1000ms | 1-5 minutes |
| 1K-10K messages | 75-150 | 1500ms | 5-30 minutes |
| 10K-50K messages | 50-100 | 2000ms | 30-120 minutes |
| > 50K messages | 50-75 | 2500ms | 2+ hours |

### Memory Usage

- **Small pulls**: < 100MB RAM
- **Large pulls**: 500MB-1GB RAM
- **Very large pulls**: Consider splitting by date range

## 🔐 Security Considerations

### Data Privacy

- **PII Detection**: Automatic scanning and replacement
- **Access Control**: Respects Slack channel permissions
- **Audit Trail**: Full logging of all pull operations

### Token Security

- **Environment Variables**: Never hardcode tokens
- **Rotation**: Regularly rotate bot tokens
- **Scopes**: Use minimal required scopes

## 📚 API Reference

### Endpoints

#### `GET /api/slack/channel-pull?action=list-channels`
List all available channels

**Response:**
```json
{
  "success": true,
  "data": {
    "channels": [
      {
        "id": "C1234567890",
        "name": "general",
        "memberCount": 25
      }
    ]
  }
}
```

#### `POST /api/slack/channel-pull`
Start a new channel pull

**Request Body:**
```json
{
  "channelId": "C1234567890",
  "channelName": "general",
  "includeThreads": true,
  "batchSize": 100,
  "delayBetweenRequests": 1000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "progress": { /* Progress object */ },
    "estimatedTimeMs": 120000
  }
}
```

#### `GET /api/slack/channel-pull?progressId=<id>`
Get pull progress

**Response:**
```json
{
  "success": true,
  "data": {
    "progress": { /* Progress object */ }
  }
}
```

#### `DELETE /api/slack/channel-pull?progressId=<id>`
Cancel a running pull

**Response:**
```json
{
  "success": true,
  "message": "Channel pull cancelled successfully"
}
```

## 🤝 Contributing

### Adding Features

1. Update the `SlackChannelPuller` service
2. Add new API endpoints as needed
3. Update the UI components
4. Add tests and documentation

### Testing

```bash
# Run unit tests
npm test

# Test API endpoints
node src/scripts/test-channel-pull.js

# Test UI
npm run dev
```

## 📞 Support

### Getting Help

1. **Check Logs**: Review application logs for errors
2. **Test Script**: Use the test script to isolate issues
3. **API Status**: Check Slack API status page
4. **Documentation**: Review this guide and API docs

### Common Solutions

- **Restart Application**: Fixes most temporary issues
- **Check Environment**: Verify all required variables are set
- **Update Tokens**: Ensure tokens haven't expired
- **Verify Permissions**: Check bot has required scopes and channel access

---

## 📄 License

This feature is part of the SF Listen Bot project and follows the same license terms.

## 🔄 Version History

- **v1.0.0**: Initial release with basic pull functionality
- **v1.1.0**: Added progress tracking and cancellation
- **v1.2.0**: Enhanced error handling and rate limiting
- **v1.3.0**: Added date range filtering and batch configuration 