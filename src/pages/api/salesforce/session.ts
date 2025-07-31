/**
 * Salesforce Session Status API
 * Returns current session information from HTTP-only cookies
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { getSalesforceSession } from '@/lib/salesforceSessionStore'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/types'

interface SessionStatusResponse {
  isAuthenticated: boolean
  sessionId?: string
  userInfo?: {
    user_id: string
    username: string
    organization_id: string
    display_name: string
  }
}

/**
 * GET /api/salesforce/session
 * Returns current session status from HTTP-only cookie
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
): Promise<void> {
  if (req.method === 'GET') {
    return await handleGetSession(req, res)
  } else if (req.method === 'DELETE') {
    return await handleClearSession(req, res)
  } else {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }
}

/**
 * Handle GET request for session status
 */
async function handleGetSession(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<SessionStatusResponse>>
): Promise<void> {

  try {
    // Extract session ID from HTTP-only cookie
    const cookies = req.headers.cookie
    const sessionId = extractSessionFromCookies(cookies)

    if (!sessionId) {
      return res.status(200).json({
        success: true,
        data: {
          isAuthenticated: false
        }
      })
    }

    // Validate session in database
    const sessionData = await getSalesforceSession(sessionId)
    
    if (!sessionData) {
      // Session not found or expired, clear the cookie
      res.setHeader('Set-Cookie', [
        'sf_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
      ])
      
      return res.status(200).json({
        success: true,
        data: {
          isAuthenticated: false
        }
      })
    }

    // Return session information
    return res.status(200).json({
      success: true,
      data: {
        isAuthenticated: true,
        sessionId: sessionId.substring(0, 10) + '...', // Partial for security
        userInfo: {
          user_id: sessionData.userInfo.user_id,
          username: sessionData.userInfo.username,
          organization_id: sessionData.userInfo.organization_id,
          display_name: sessionData.userInfo.display_name
        }
      }
    })

  } catch (error) {
    logger.error('Session status check failed', {
      error: error instanceof Error ? error.message : error
    })

    return res.status(500).json({
      success: false,
      error: 'Failed to check session status'
    })
  }
}

/**
 * Extract session ID from cookie string
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
 * Handle DELETE request to clear session cookie
 */
async function handleClearSession(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ cleared: boolean }>>
): Promise<void> {
  try {
    // Clear the HTTP-only cookie
    res.setHeader('Set-Cookie', [
      'sf_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
    ])

    return res.status(200).json({
      success: true,
      data: {
        cleared: true
      }
    })

  } catch (error) {
    logger.error('Failed to clear session cookie', {
      error: error instanceof Error ? error.message : error
    })

    return res.status(500).json({
      success: false,
      error: 'Failed to clear session'
    })
  }
} 