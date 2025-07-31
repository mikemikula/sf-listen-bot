import { NextApiRequest, NextApiResponse } from 'next'
import { getSalesforceSession } from '@/lib/salesforceSessionStore'
import { createApiClient } from '@/lib/salesforce'
import { logger } from '@/lib/logger'

function extractSessionFromCookies(cookieString?: string): string | null {
  if (!cookieString) return null
  const cookies = cookieString.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    acc[key] = value
    return acc
  }, {} as Record<string, string>)
  return cookies.sf_session || null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const sessionId = extractSessionFromCookies(req.headers.cookie)
    
    if (!sessionId) {
      return res.status(401).json({ error: 'No session found' })
    }

    const sessionData = await getSalesforceSession(sessionId)
    
    if (!sessionData) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    // Get org details
    const apiClient = createApiClient(sessionData.tokenResponse)
    const identity = await apiClient.getUserInfo()
    
    return res.status(200).json({
      orgInfo: {
        userId: sessionData.userInfo.user_id,
        username: sessionData.userInfo.username,
        orgId: sessionData.userInfo.organization_id,
        instanceUrl: sessionData.tokenResponse.instance_url,
        email: sessionData.userInfo.email,
        displayName: sessionData.userInfo.display_name
      },
      identity
    })
  } catch (error) {
    logger.error('Debug org error', { error })
    return res.status(500).json({ error: 'Failed to get org info' })
  }
} 