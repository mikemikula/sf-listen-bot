/**
 * Custom hook for real-time message updates using Server-Sent Events
 * Provides real-time message streaming functionality
 */

import { useEffect, useRef, useCallback } from 'react'
import { logger } from '@/lib/logger'
import type { MessageDisplay } from '@/types'

interface UseRealTimeMessagesProps {
  onNewMessage: (message: MessageDisplay) => void
  onMessageEdited?: (message: MessageDisplay) => void
  onMessagesDeleted?: () => void
  onError?: (error: string) => void
  enabled?: boolean
}

interface SSEMessage {
  type: 'connected' | 'message' | 'message_edited' | 'messages_deleted' | 'heartbeat' | 'error'
  data?: MessageDisplay
  message?: string
  timestamp?: string
}

/**
 * Hook for managing real-time message updates via Server-Sent Events
 */
export const useRealTimeMessages = ({
  onNewMessage,
  onMessageEdited,
  onMessagesDeleted,
  onError,
  enabled = true
}: UseRealTimeMessagesProps): {
  isConnected: boolean
  disconnect: () => void
  reconnect: () => void
} => {
  const eventSourceRef = useRef<EventSource | null>(null)
  const isConnectedRef = useRef(false)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Connect to SSE stream
   */
     const connect = useCallback(() => {
     if (!enabled || eventSourceRef.current) {
       return
     }

     try {
       logger.sse('Connecting to real-time message stream')
       
       const eventSource = new EventSource('/api/messages/stream')
       eventSourceRef.current = eventSource

       eventSource.onopen = () => {
         logger.sse('Real-time connection established')
         isConnectedRef.current = true
       }

       eventSource.onmessage = (event) => {
         try {
           const data: SSEMessage = JSON.parse(event.data)
           
           switch (data.type) {
             case 'connected':
               logger.sse('SSE connection confirmed')
               break
               
             case 'message':
               if (data.data) {
                 logger.sse('New message received')
                 onNewMessage(data.data)
               }
               break

             case 'message_edited':
               if (data.data) {
                 logger.sse('Message edit received')
                 if (onMessageEdited) {
                   onMessageEdited(data.data)
                 }
               }
               break

             case 'messages_deleted':
               logger.sse('Messages deleted, triggering refresh')
               if (onMessagesDeleted) {
                 onMessagesDeleted()
               }
               break
               
             case 'heartbeat':
               // Connection is alive (no logging to reduce noise)
               break
               
             case 'error':
               logger.error('SSE error:', data.message)
               if (onError) {
                 onError(data.message || 'Unknown error')
               }
               break
           }
         } catch (error) {
           logger.error('Error parsing SSE message:', error)
         }
       }

       eventSource.onerror = (error) => {
         logger.warn('SSE connection error, will attempt reconnect')
         isConnectedRef.current = false
         
         // Attempt to reconnect after 5 seconds
         if (reconnectTimeoutRef.current) {
           clearTimeout(reconnectTimeoutRef.current)
         }
         
         reconnectTimeoutRef.current = setTimeout(() => {
           logger.sse('Attempting to reconnect')
           disconnect()
           connect()
         }, 5000)
       }

     } catch (error) {
       logger.error('Failed to establish SSE connection:', error)
       if (onError) {
         onError('Failed to establish real-time connection')
       }
     }
   }, [enabled, onNewMessage, onMessageEdited, onMessagesDeleted, onError]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Disconnect from SSE stream
   */
     const disconnect = useCallback(() => {
     if (eventSourceRef.current) {
       logger.sse('Disconnecting from real-time stream')
       eventSourceRef.current.close()
       eventSourceRef.current = null
       isConnectedRef.current = false
     }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  /**
   * Reconnect to SSE stream
   */
  const reconnect = useCallback(() => {
    disconnect()
    setTimeout(connect, 1000) // Wait 1 second before reconnecting
  }, [disconnect, connect])

  // Setup connection on mount
  useEffect(() => {
    if (enabled) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [enabled, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    isConnected: isConnectedRef.current,
    disconnect,
    reconnect
  }
} 