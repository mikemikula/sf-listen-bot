/**
 * Custom logger utility
 * Provides controlled logging with different levels and reduced noise
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerConfig {
  level: LogLevel
  enabledInProduction: boolean
}

const config: LoggerConfig = {
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'error',
  enabledInProduction: false
}

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

/**
 * Check if logging is enabled for the given level
 */
const shouldLog = (level: LogLevel): boolean => {
  if (process.env.NODE_ENV === 'production' && !config.enabledInProduction) {
    return level === 'error'
  }
  
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level]
}

/**
 * Custom logger with noise reduction
 */
export const logger = {
  debug: (message: string, ...args: any[]): void => {
    if (shouldLog('debug')) {
      console.debug(`🔍 ${message}`, ...args)
    }
  },

  info: (message: string, ...args: any[]): void => {
    if (shouldLog('info')) {
      console.info(`ℹ️  ${message}`, ...args)
    }
  },

  warn: (message: string, ...args: any[]): void => {
    if (shouldLog('warn')) {
      console.warn(`⚠️  ${message}`, ...args)
    }
  },

  error: (message: string, ...args: any[]): void => {
    if (shouldLog('error')) {
      console.error(`❌ ${message}`, ...args)
    }
  },

  // Special methods for specific scenarios
  sse: (message: string, ...args: any[]): void => {
    // Only log SSE events in debug mode to reduce noise
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_SSE === 'true') {
      console.log(`🔌 SSE: ${message}`, ...args)
    }
  },

  slack: (message: string, ...args: any[]): void => {
    if (shouldLog('info')) {
      console.log(`💬 Slack: ${message}`, ...args)
    }
  }
}

/**
 * Set logger configuration
 */
export const setLogLevel = (level: LogLevel): void => {
  config.level = level
} 