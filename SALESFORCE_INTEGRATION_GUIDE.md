# Salesforce Integration Guide

This guide explains how to set up and use the Salesforce Connected App integration to sync your processed documents, FAQs, and messages to Salesforce.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Salesforce Setup](#salesforce-setup)
4. [Application Configuration](#application-configuration)
5. [Custom Objects Setup](#custom-objects-setup)
6. [Usage](#usage)
7. [API Endpoints](#api-endpoints)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

## Overview

The Salesforce integration provides:

- **OAuth 2.0 Authentication** using Connected Apps (no jsforce dependency)
- **Automated Data Sync** for documents, FAQs, and messages
- **Real-time Sync Status** monitoring and reporting
- **Error Handling** with retry logic and detailed error reporting
- **API Usage Tracking** to monitor Salesforce API limits
- **Configurable Object Mapping** for custom Salesforce objects

## Prerequisites

- Salesforce Developer/Sandbox or Production org
- System Administrator permissions in Salesforce
- Next.js application with the integration code installed

## Salesforce Setup

### 1. Create a Connected App

1. **Navigate to Setup**
   - In Salesforce, click the gear icon → Setup
   - Or go to `https://your-domain.lightning.force.com/lightning/setup/SetupOneHome/home`

2. **Create Connected App**
   - In Quick Find, search for "App Manager"
   - Click "New Connected App"

3. **Basic Information**
   ```
   Connected App Name: Slack Listen Bot Integration
   API Name: Slack_Listen_Bot_Integration
   Contact Email: your-email@company.com
   Description: Integration for syncing Slack messages, documents, and FAQs
   ```

4. **API (Enable OAuth Settings)**
   - Check "Enable OAuth Settings"
   - **Callback URL**: `https://your-domain.com/api/salesforce/oauth/callback`
     - For development: `http://localhost:3000/api/salesforce/oauth/callback`
   - **Selected OAuth Scopes**:
     - Access the identity URL service (id, profile, email, address, phone)
     - Manage user data via APIs (api)
     - Perform requests any time (refresh_token, offline_access)

5. **Save and Note Credentials**
   - After saving, note the **Consumer Key** and **Consumer Secret**
   - You'll need these for your environment configuration

### 2. Configure Connected App Policies

1. **Edit the Connected App**
   - Go back to App Manager → Find your app → Edit

2. **OAuth Policies**
   - **Permitted Users**: Admin approved users are pre-authorized
   - **IP Relaxation**: Relax IP restrictions (for development/testing)
   - **Refresh Token Policy**: Refresh token is valid until revoked

3. **Save Changes**

### 3. Create Permission Set (Recommended)

1. **Create Permission Set**
   - Setup → Permission Sets → New
   - **Label**: Slack Integration Access
   - **API Name**: Slack_Integration_Access

2. **Assign Object Permissions**
   - Edit the permission set
   - Object Settings → Add your custom objects (see Custom Objects Setup)
   - Grant Read, Create, Edit permissions as needed

3. **Assign Connected App**
   - Connected App Access → Edit
   - Enable your Connected App

4. **Assign to Users**
   - Assign this permission set to users who need access

## Application Configuration

### 1. Environment Variables

Add these variables to your `.env.local` file:

```bash
# Salesforce Connected App OAuth Configuration
SALESFORCE_CLIENT_ID="your_connected_app_consumer_key"
SALESFORCE_CLIENT_SECRET="your_connected_app_consumer_secret"
SALESFORCE_REDIRECT_URI="http://localhost:3000/api/salesforce/oauth/callback"
SALESFORCE_LOGIN_URL="https://login.salesforce.com"
# For sandbox, use: https://test.salesforce.com
SALESFORCE_API_VERSION="v59.0"

# Salesforce Integration Settings
SALESFORCE_ENABLED="true"
SALESFORCE_SYNC_DOCUMENTS="true"
SALESFORCE_SYNC_FAQS="true"
SALESFORCE_SYNC_MESSAGES="false"

# Optional: Custom Object Names
SALESFORCE_DOCUMENT_OBJECT="Slack_Document__c"
SALESFORCE_FAQ_OBJECT="Slack_FAQ__c"
SALESFORCE_MESSAGE_OBJECT="Slack_Message__c"
```

### 2. Production Configuration

For production, update:

```bash
SALESFORCE_REDIRECT_URI="https://your-production-domain.com/api/salesforce/oauth/callback"
SALESFORCE_LOGIN_URL="https://login.salesforce.com"  # Use login.salesforce.com for production
```

## Custom Objects Setup

### 1. Create Custom Objects

You'll need to create three custom objects in Salesforce:

#### Slack Document Object (`Slack_Document__c`)

**Fields:**
```
Name (Text, 80) - Auto Number: SD-{00000000}
Description__c (Long Text Area, 32,768)
Category__c (Text, 255)
Status__c (Picklist: Draft, Processing, Complete, Error)
Confidence_Score__c (Number, 16, 2)
Created_By__c (Text, 255)
Slack_Channel__c (Text, 255)
Message_Count__c (Number, 18, 0)
FAQ_Count__c (Number, 18, 0)
External_Id__c (Text, 255, External ID, Unique)
Conversation_Analysis__c (Long Text Area, 32,768)
```

#### Slack FAQ Object (`Slack_FAQ__c`)

**Fields:**
```
Name (Text, 80) - Auto Number: FAQ-{00000000}
Question__c (Long Text Area, 32,768)
Answer__c (Long Text Area, 32,768)
Category__c (Text, 255)
Status__c (Picklist: Pending, Approved, Rejected, Archived)
Confidence_Score__c (Number, 16, 2)
Approved_By__c (Text, 255)
Approved_Date__c (Date)
External_Id__c (Text, 255, External ID, Unique)
Source_Documents__c (Long Text Area, 32,768)
```

#### Slack Message Object (`Slack_Message__c`) - Optional

**Fields:**
```
Name (Text, 80) - Auto Number: MSG-{00000000}
Text__c (Long Text Area, 32,768)
Username__c (Text, 255)
User_ID__c (Text, 255)
Channel__c (Text, 255)
Timestamp__c (Date/Time)
Thread_ID__c (Text, 255)
Is_Thread_Reply__c (Checkbox)
External_Id__c (Text, 255, External ID, Unique)
Slack_Message_ID__c (Text, 255)
```

### 2. Create Custom Object via Salesforce CLI (Alternative)

If you have Salesforce CLI installed:

```bash
# Create the objects using metadata
sfdx force:source:deploy -p metadata/objects/
```

### 3. Set Object Permissions

1. **Setup → Object Manager**
2. **For each custom object:**
   - Go to the object → Permission Sets
   - Add your permission set with appropriate access levels

## Usage

### 1. Access the Integration Dashboard

Add the Salesforce integration component to a page:

```tsx
import { SalesforceIntegrationDashboard } from '@/components/salesforce'

export default function IntegrationPage() {
  return (
    <div className="container mx-auto py-8">
      <SalesforceIntegrationDashboard />
    </div>
  )
}
```

### 2. Connect to Salesforce

1. **Navigate to the integration page**
2. **Click "Connect to Salesforce"**
3. **Authorize the application** in the Salesforce OAuth flow
4. **You'll be redirected back** with a success message

### 3. Sync Data

Once connected, you can:

- **Test Connection**: Verify your connection is working
- **Full Sync**: Sync all eligible records
- **Incremental Sync**: Sync only recently updated records
- **Monitor Progress**: View real-time sync status and history

### 4. View Synced Data

In Salesforce:
1. **App Launcher** → Search for your custom objects
2. **Navigate to List Views** to see synced records
3. **Create Reports and Dashboards** for analytics

## API Endpoints

### OAuth Endpoints

```
POST /api/salesforce/oauth/connect
GET /api/salesforce/oauth/callback
```

### Connection Management

```
GET /api/salesforce/connection          # Get connection status
POST /api/salesforce/connection         # Test connection
DELETE /api/salesforce/connection       # Disconnect
```

### Sync Operations

```
POST /api/salesforce/sync              # Start sync operation
GET /api/salesforce/sync               # Get sync status/history
GET /api/salesforce/sync?jobId={id}    # Get specific job status
GET /api/salesforce/sync?history=true  # Get sync history
```

### Example API Usage

```javascript
// Start a sync operation
const response = await fetch('/api/salesforce/sync', {
  method: 'POST',
  headers: {
    'X-SF-Session': sessionId,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    syncType: 'full',
    recordTypes: ['documents', 'faqs'],
    filters: {
      startDate: '2024-01-01',
      categories: ['Technical', 'Support']
    }
  })
})

const result = await response.json()
```

## Troubleshooting

### Common Issues

#### 1. OAuth Callback URL Mismatch

**Error**: `redirect_uri_mismatch`

**Solution**: 
- Ensure the callback URL in your Connected App exactly matches your environment configuration
- Check for trailing slashes and protocol (http vs https)

#### 2. Invalid Client Credentials

**Error**: `invalid_client_id` or `invalid_client`

**Solution**:
- Verify your `SALESFORCE_CLIENT_ID` and `SALESFORCE_CLIENT_SECRET` are correct
- Make sure you're using the Consumer Key (not Consumer Secret) for the Client ID

#### 3. Insufficient Privileges

**Error**: `insufficient_access_rights`

**Solution**:
- Check that your user has the necessary permissions
- Verify the Connected App is assigned to your user or permission set
- Ensure custom objects have proper CRUD permissions

#### 4. Custom Objects Not Found

**Error**: `Object 'Slack_Document__c' is not supported`

**Solution**:
- Verify custom objects exist in your Salesforce org
- Check object API names match your configuration
- Ensure objects are deployed and accessible

#### 5. API Limits Exceeded

**Error**: `REQUEST_LIMIT_EXCEEDED`

**Solution**:
- Monitor your API usage in the dashboard
- Consider reducing sync frequency
- Implement incremental sync instead of full sync

### Debug Mode

Enable debug logging by setting:

```bash
NODE_ENV=development
```

Check the browser console and server logs for detailed error information.

### Connection Health Check

Use the connection test feature in the dashboard to diagnose issues:

1. **Click "Test Connection"** in the dashboard
2. **Review any error messages**
3. **Check API usage and limits**

## Best Practices

### 1. Security

- **Use HTTPS** in production for all OAuth callbacks
- **Store credentials securely** using environment variables
- **Regularly rotate** Connected App credentials
- **Use permission sets** to control access granularly

### 2. Performance

- **Use incremental sync** for regular operations
- **Schedule full sync** during off-peak hours
- **Monitor API limits** to avoid rate limiting
- **Batch operations** when possible

### 3. Data Management

- **Map data appropriately** to Salesforce field limits
- **Handle large text fields** with truncation
- **Use external IDs** for reliable upsert operations
- **Implement error handling** for data quality issues

### 4. Monitoring

- **Track sync performance** and success rates
- **Set up alerts** for failed sync operations
- **Monitor API usage** trends
- **Review error logs** regularly

### 5. Maintenance

- **Update API versions** as needed
- **Test with Salesforce updates** before production deployment
- **Document custom field mappings**
- **Maintain backup procedures**

## Support

For additional support:

1. **Check the logs** in your application
2. **Use Salesforce debug logs** for API issues
3. **Review Salesforce documentation** for Connected Apps
4. **Test in a Sandbox environment** before production

## References

- [Salesforce Connected Apps Documentation](https://help.salesforce.com/s/articleView?id=sf.connected_app_overview.htm)
- [OAuth 2.0 Web Server Flow](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm)
- [Salesforce REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/)
- [Custom Objects and Fields](https://help.salesforce.com/s/articleView?id=sf.dev_objectcreate_task_parent.htm) 