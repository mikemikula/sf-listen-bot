import { NextApiRequest, NextApiResponse } from 'next'
import { getSalesforceSession } from './salesforceSessionStore'
import { logger } from './logger'

export interface AuthContext {
  sessionId: string
  userId: string
}

export type AuthenticatedHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  context: AuthContext
) => Promise<void>

/**
 * Extract session ID from cookies
 */
function extractSessionFromCookies(cookieString?: string): string | null {
  if (!cookieString) return null

  const cookies = cookieString.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    acc[key] = value
    return acc
  }, {} as Record<string, string>)

  return cookies.sf_session || null
}

/**
 * Middleware to ensure request is authenticated
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Extract session from HTTP-only cookie
      const sessionId = extractSessionFromCookies(req.headers.cookie)
      
      if (!sessionId) {
        logger.warn('Auth middleware: No session cookie found')
        return res.status(401).json({
          success: false,
          error: 'No active Salesforce session'
        })
      }

      // Validate session
      const sessionData = await getSalesforceSession(sessionId)
      
      if (!sessionData) {
        logger.warn('Auth middleware: Invalid session', { 
          sessionId: sessionId.substring(0, 10) + '...' 
        })
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired Salesforce session'
        })
      }

      // Call handler with auth context
      await handler(req, res, {
        sessionId,
        userId: sessionData.userInfo.user_id
      })
    } catch (error) {
      logger.error('Auth middleware error', { error })
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      })
    }
  }
} 