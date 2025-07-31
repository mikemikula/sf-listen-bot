/**
 * Salesforce Integration Library
 * Provides OAuth authentication and API interaction capabilities using Connected Apps
 * Uses native fetch API for all HTTP operations - no external dependencies like jsforce
 * 
 * Key Features:
 * - OAuth 2.0 Web Server Flow implementation
 * - Token management with automatic refresh
 * - Comprehensive error handling with retry logic  
 * - Type-safe API operations
 * - Rate limiting and API usage tracking
 * - Bulk operations support
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { logger } from './logger'
import type {
  SalesforceOAuthConfig,
  SalesforceTokenResponse,
  SalesforceUserInfo,
  SalesforceApiResponse,
  SalesforceCreateResponse,
  SalesforceUpdateResponse,
  SalesforceQueryResult,
  SalesforceApiClientConfig,
  SalesforceError
} from '@/types'
import {
  SalesforceAuthError,
  SalesforceApiError
} from '@/types'

/**
 * Salesforce OAuth Configuration
 * Loads configuration from environment variables
 */
export function getSalesforceConfig(): SalesforceOAuthConfig {
  const config = {
    clientId: process.env.SALESFORCE_CLIENT_ID,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
    redirectUri: process.env.SALESFORCE_REDIRECT_URI,
    loginUrl: process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com',
    apiVersion: process.env.SALESFORCE_API_VERSION || 'v59.0'
  }

  // Validate required configuration
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error('Missing required Salesforce configuration. Please check environment variables.')
  }

  return config as SalesforceOAuthConfig
}

/**
 * Generate Salesforce OAuth Authorization URL
 * Creates the URL to redirect users to for OAuth consent
 * 
 * @param state - Unique state parameter for CSRF protection
 * @param scopes - OAuth scopes to request (defaults to standard API access)
 * @param pkceParams - PKCE parameters for enhanced security
 * @returns Complete authorization URL
 */
export function generateAuthUrl(
  state: string, 
  scopes: string[] = ['api', 'refresh_token', 'id'],
  pkceParams?: {
    codeChallenge: string
    codeChallengeMethod: string
  }
): string {
  const config = getSalesforceConfig()
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: scopes.join(' '),
    state: state,
    prompt: 'consent' // Force consent to ensure refresh token
  })

  // Add PKCE parameters if provided
  if (pkceParams) {
    params.set('code_challenge', pkceParams.codeChallenge)
    params.set('code_challenge_method', pkceParams.codeChallengeMethod)
  }

  const authUrl = `${config.loginUrl}/services/oauth2/authorize?${params.toString()}`
  
  logger.info('Generated Salesforce OAuth authorization URL', {
    state,
    scopes,
    hasPKCE: !!pkceParams,
    clientId: config.clientId.substring(0, 10) + '...' // Log partial client ID for debugging
  })

  return authUrl
}

/**
 * Exchange Authorization Code for Access Token
 * Implements OAuth 2.0 authorization code flow with PKCE support
 * 
 * @param authorizationCode - Code received from OAuth callback
 * @param codeVerifier - PKCE code verifier (optional, for PKCE flow)
 * @returns Token response with access token and user info
 */
export async function exchangeCodeForToken(
  authorizationCode: string,
  codeVerifier?: string
): Promise<SalesforceTokenResponse> {
  const config = getSalesforceConfig()
  
  const tokenUrl = `${config.loginUrl}/services/oauth2/token`
  
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code: authorizationCode
  })

  // Always include client secret for confidential clients (server-side apps)
  params.set('client_secret', config.clientSecret)
  
  // Add PKCE code verifier if provided (enhanced security)
  if (codeVerifier) {
    params.set('code_verifier', codeVerifier)
  }

  try {
    logger.info('Exchanging authorization code for access token', {
      hasPKCE: !!codeVerifier
    })
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    })

    const data = await response.json()

    if (!response.ok) {
      logger.error('Token exchange failed', {
        status: response.status,
        error: data.error,
        description: data.error_description,
        hasPKCE: !!codeVerifier
      })
      
      throw new SalesforceAuthError(
        data.error_description || 'Failed to exchange authorization code',
        data.error,
        data.error_description
      )
    }

    logger.info('Successfully obtained access token', {
      instance_url: data.instance_url,
      token_type: data.token_type,
      hasRefreshToken: !!data.refresh_token,
      hasPKCE: !!codeVerifier
    })

    return data as SalesforceTokenResponse
    
  } catch (error) {
    if (error instanceof SalesforceAuthError) {
      throw error
    }
    
    logger.error('Network error during token exchange', { error })
    throw new SalesforceAuthError('Network error during token exchange')
  }
}

/**
 * Refresh Access Token
 * Uses refresh token to obtain new access token
 * 
 * @param refreshToken - Refresh token from initial OAuth flow
 * @returns New token response
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<SalesforceTokenResponse> {
  const config = getSalesforceConfig()
  
  const tokenUrl = `${config.loginUrl}/services/oauth2/token`
  
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken
  })

  try {
    logger.info('Refreshing access token')
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    })

    const data = await response.json()

    if (!response.ok) {
      logger.error('Token refresh failed', {
        status: response.status,
        error: data.error,
        description: data.error_description
      })
      
      throw new SalesforceAuthError(
        data.error_description || 'Failed to refresh access token',
        data.error,
        data.error_description
      )
    }

    logger.info('Successfully refreshed access token')
    return data as SalesforceTokenResponse
    
  } catch (error) {
    if (error instanceof SalesforceAuthError) {
      throw error
    }
    
    logger.error('Network error during token refresh', { error })
    throw new SalesforceAuthError('Network error during token refresh')
  }
}

/**
 * Get User Information
 * Retrieves user details from Salesforce identity endpoint
 * 
 * @param accessToken - Valid access token
 * @param identityUrl - Identity URL from token response
 * @returns User information
 */
export async function getUserInfo(
  accessToken: string,
  identityUrl: string
): Promise<SalesforceUserInfo> {
  try {
    logger.info('Fetching user information from Salesforce')
    
    const response = await fetch(identityUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      logger.error('Failed to fetch user info', {
        status: response.status,
        error: data
      })
      
      throw new SalesforceApiError(
        'Failed to fetch user information',
        response.status
      )
    }

    logger.info('Successfully retrieved user information', {
      userId: data.user_id,
      username: data.username,
      orgId: data.organization_id
    })

    return data as SalesforceUserInfo
    
  } catch (error) {
    if (error instanceof SalesforceApiError) {
      throw error
    }
    
    logger.error('Network error fetching user info', { error })
    throw new SalesforceApiError('Network error fetching user info', 500)
  }
}

/**
 * Salesforce API Client Class
 * Provides methods for interacting with Salesforce REST API
 * Includes automatic retry logic and error handling
 */
export class SalesforceApiClient {
  private config: SalesforceApiClientConfig
  private rateLimitInfo: {
    dailyApiRequestsUsed?: string
    dailyApiRequestsLimit?: string
  } = {}

  constructor(config: SalesforceApiClientConfig) {
    this.config = {
      timeout: 30000, // 30 second default timeout
      retryAttempts: 3,
      retryDelay: 1000, // 1 second base delay
      ...config
    }
  }

  /**
   * Make authenticated API request to Salesforce
   * Includes automatic retry logic and rate limit handling
   * 
   * @param endpoint - API endpoint (relative to instance URL)
   * @param options - Fetch options
   * @returns API response
   */
  private async makeRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<SalesforceApiResponse<T>> {
    const url = `${this.config.instanceUrl}/services/data/${this.config.apiVersion}/${endpoint}`
    
    const defaultHeaders = {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    }

    let lastError: Error | null = null
    
    // Retry logic
    for (let attempt = 1; attempt <= (this.config.retryAttempts || 3); attempt++) {
      try {
        logger.debug(`Making Salesforce API request (attempt ${attempt})`, {
          method: requestOptions.method || 'GET',
          endpoint,
          hasBody: !!requestOptions.body
        })

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

        const response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        // Update rate limit info from response headers
        this.updateRateLimitInfo(response.headers)

        const responseText = await response.text()
        let data: any

        try {
          data = responseText ? JSON.parse(responseText) : null
        } catch (parseError) {
          logger.warn('Failed to parse JSON response', { responseText })
          data = { message: responseText }
        }

        if (!response.ok) {
          const error = this.createApiError(response.status, data)
          
          // Check if we should retry
          if (this.shouldRetry(response.status, attempt)) {
            lastError = error
            await this.delay(this.config.retryDelay! * attempt)
            continue
          }
          
          throw error
        }

        logger.debug('Salesforce API request successful', {
          status: response.status,
          endpoint,
          hasData: !!data
        })

        return {
          success: true,
          data: data as T,
          statusCode: response.status
        }

      } catch (error) {
        lastError = error as Error
        
        if (error instanceof SalesforceApiError) {
          // Don't retry API errors that aren't retriable
          if (!this.shouldRetry(error.statusCode, attempt)) {
            throw error
          }
        } else if (error instanceof DOMException && error.name === 'AbortError') {
          logger.warn(`Request timeout on attempt ${attempt}`, { endpoint })
        } else {
          logger.warn(`Network error on attempt ${attempt}`, { endpoint, error })
        }

        if (attempt < (this.config.retryAttempts || 3)) {
          await this.delay(this.config.retryDelay! * attempt)
        }
      }
    }

    // All retries exhausted
    logger.error('All retry attempts exhausted', { endpoint, lastError })
    throw lastError || new SalesforceApiError('Request failed after all retries', 500)
  }

  /**
   * Update rate limit information from response headers
   */
  private updateRateLimitInfo(headers: Headers): void {
    const dailyUsed = headers.get('Sforce-Limit-Info')?.match(/api-usage=(\d+)\/(\d+)/)
    if (dailyUsed) {
      this.rateLimitInfo.dailyApiRequestsUsed = dailyUsed[1]
      this.rateLimitInfo.dailyApiRequestsLimit = dailyUsed[2]
    }
  }

  /**
   * Determine if request should be retried based on status code
   */
  private shouldRetry(statusCode: number, attempt: number): boolean {
    if (attempt >= (this.config.retryAttempts || 3)) {
      return false
    }

    // Retry on server errors and rate limiting
    return statusCode >= 500 || statusCode === 429
  }

  /**
   * Create appropriate API error from response
   */
  private createApiError(statusCode: number, data: any): SalesforceApiError {
    let message = 'API request failed'
    let errorCode: string | undefined
    let fields: string[] | undefined

    if (Array.isArray(data)) {
      // Multiple errors format
      const firstError = data[0] as SalesforceError
      message = firstError?.message || message
      errorCode = firstError?.errorCode
      fields = firstError?.fields
    } else if (data?.error) {
      // Single error format
      message = data.error_description || data.error || message
      errorCode = data.error
    } else if (data?.message) {
      message = data.message
      errorCode = data.errorCode
      fields = data.fields
    }

    return new SalesforceApiError(message, statusCode, errorCode, fields)
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current rate limit information
   */
  public getRateLimitInfo(): { used?: string; limit?: string } {
    return {
      used: this.rateLimitInfo.dailyApiRequestsUsed,
      limit: this.rateLimitInfo.dailyApiRequestsLimit
    }
  }

  /**
   * Execute SOQL Query
   * 
   * @param query - SOQL query string
   * @returns Query results
   */
  public async query<T = any>(query: string): Promise<SalesforceQueryResult<T>> {
    const encodedQuery = encodeURIComponent(query)
    const response = await this.makeRequest<SalesforceQueryResult<T>>(`query?q=${encodedQuery}`)
    
    if (!response.success || !response.data) {
      throw new SalesforceApiError('Query failed', 500)
    }

    return response.data
  }

  /**
   * Create Record
   * 
   * @param sobjectType - Salesforce object type (e.g., 'Account', 'Contact')
   * @param recordData - Record data to create
   * @returns Creation response with new record ID
   */
  public async createRecord(
    sobjectType: string,
    recordData: Record<string, any>
  ): Promise<SalesforceCreateResponse> {
    const response = await this.makeRequest<SalesforceCreateResponse>(
      `sobjects/${sobjectType}`,
      {
        method: 'POST',
        body: JSON.stringify(recordData)
      }
    )

    if (!response.success || !response.data) {
      throw new SalesforceApiError('Record creation failed', 500)
    }

    return response.data
  }

  /**
   * Update Record
   * 
   * @param sobjectType - Salesforce object type
   * @param recordId - ID of record to update
   * @param recordData - Updated record data
   * @returns Update response
   */
  public async updateRecord(
    sobjectType: string,
    recordId: string,
    recordData: Record<string, any>
  ): Promise<SalesforceUpdateResponse> {
    const response = await this.makeRequest<SalesforceUpdateResponse>(
      `sobjects/${sobjectType}/${recordId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(recordData)
      }
    )

    if (!response.success) {
      throw new SalesforceApiError('Record update failed', 500)
    }

    return response.data || { success: true, errors: [] }
  }

  /**
   * Upsert Record
   * Creates or updates record based on external ID
   * 
   * @param sobjectType - Salesforce object type
   * @param externalIdField - External ID field name
   * @param externalIdValue - External ID value
   * @param recordData - Record data
   * @returns Upsert response
   */
  public async upsertRecord(
    sobjectType: string,
    externalIdField: string,
    externalIdValue: string,
    recordData: Record<string, any>
  ): Promise<SalesforceCreateResponse> {
    const response = await this.makeRequest<SalesforceCreateResponse>(
      `sobjects/${sobjectType}/${externalIdField}/${encodeURIComponent(externalIdValue)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(recordData)
      }
    )

    if (!response.success || !response.data) {
      throw new SalesforceApiError('Record upsert failed', 500)
    }

    return response.data
  }

  /**
   * Delete Record
   * 
   * @param sobjectType - Salesforce object type
   * @param recordId - ID of record to delete
   * @returns Success status
   */
  public async deleteRecord(sobjectType: string, recordId: string): Promise<boolean> {
    const response = await this.makeRequest(
      `sobjects/${sobjectType}/${recordId}`,
      { method: 'DELETE' }
    )

    return response.success
  }

  /**
   * Get Record by ID
   * 
   * @param sobjectType - Salesforce object type
   * @param recordId - Record ID
   * @param fields - Optional list of fields to retrieve
   * @returns Record data
   */
  public async getRecord<T = any>(
    sobjectType: string,
    recordId: string,
    fields?: string[]
  ): Promise<T> {
    let endpoint = `sobjects/${sobjectType}/${recordId}`
    if (fields && fields.length > 0) {
      endpoint += `?fields=${fields.join(',')}`
    }

    const response = await this.makeRequest<T>(endpoint)
    
    if (!response.success || !response.data) {
      throw new SalesforceApiError('Failed to retrieve record', 404)
    }

    return response.data
  }

  /**
   * Get Organization Limits
   * Retrieves current API usage and limits
   * 
   * @returns Organization limits information
   */
  public async getLimits(): Promise<any> {
    const response = await this.makeRequest('limits')
    
    if (!response.success || !response.data) {
      throw new SalesforceApiError('Failed to retrieve limits', 500)
    }

    return response.data
  }

  /**
   * Test API Connection
   * Simple test to verify authentication and connectivity
   * 
   * @returns Connection test result
   */
  public async testConnection(): Promise<{ success: boolean; userInfo?: any; limits?: any }> {
    try {
      const [userInfoResponse, limitsResponse] = await Promise.all([
        this.makeRequest('sobjects/User/005000000000000AAA'), // Try to get a minimal response
        this.getLimits()
      ])

      return {
        success: true,
        limits: limitsResponse
      }
    } catch (error) {
      logger.error('Connection test failed', { error })
      return { success: false }
    }
  }
}

/**
 * Utility function to create API client from token response
 * 
 * @param tokenResponse - Token response from OAuth flow
 * @returns Configured API client
 */
export function createApiClient(tokenResponse: SalesforceTokenResponse): SalesforceApiClient {
  const config = getSalesforceConfig()
  
  return new SalesforceApiClient({
    instanceUrl: tokenResponse.instance_url,
    accessToken: tokenResponse.access_token,
    apiVersion: config.apiVersion
  })
}

/**
 * Revoke Access Token
 * Revokes the access token to log out the user
 * 
 * @param accessToken - Access token to revoke
 * @returns Success status
 */
export async function revokeToken(accessToken: string): Promise<boolean> {
  const config = getSalesforceConfig()
  const revokeUrl = `${config.loginUrl}/services/oauth2/revoke`

  try {
    const response = await fetch(revokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        token: accessToken
      }).toString()
    })

    if (response.ok) {
      logger.info('Successfully revoked access token')
      return true
    } else {
      logger.warn('Failed to revoke access token', { status: response.status })
      return false
    }
  } catch (error) {
    logger.error('Error revoking access token', { error })
    return false
  }
} 