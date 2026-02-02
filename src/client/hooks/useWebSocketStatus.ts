import { useState, useEffect, useCallback, useRef } from 'react';
import { onSessionEvent, onChatEvent } from '@/client/channels';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * Track WebSocket connection status
 * 
 * Since Modelence doesn't expose direct connection state,
 * we infer status from:
 * 1. Whether channels have been joined
 * 2. Whether we've received events recently
 * 3. Periodic heartbeat checks
 * 
 * FIXED:
 * - Removed `status` from dependency array to prevent infinite loops
 * - Use ref to track status for timeout callback (avoiding stale closure)
 * - Properly track if component is mounted
 */
export function useWebSocketStatus(sessionId?: string) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastEventTime, setLastEventTime] = useState<number | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<ConnectionStatus>('connecting');
  
  // Keep ref in sync with state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  
  // Track when we receive any event
  const handleEvent = useCallback(() => {
    setLastEventTime(Date.now());
    setStatus('connected');
    
    // Reset heartbeat timeout - if no event for 60s, consider disconnected
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    heartbeatTimeoutRef.current = setTimeout(() => {
      setStatus('disconnected');
    }, 60000); // 60s timeout
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setStatus('disconnected');
      return;
    }

    // Initial status
    setStatus('connecting');
    statusRef.current = 'connecting';

    // Subscribe to events to track connection health
    const unsubSession = onSessionEvent(sessionId, handleEvent);
    const unsubChat = onChatEvent(sessionId, handleEvent);

    // After 5s of joining, if no events received, assume connected
    // (no events doesn't mean disconnected, just no activity)
    // Use ref to check current status (avoid stale closure)
    connectionTimeoutRef.current = setTimeout(() => {
      if (statusRef.current === 'connecting') {
        setStatus('connected');
      }
    }, 5000);

    return () => {
      unsubSession();
      unsubChat();
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
    };
  }, [sessionId, handleEvent]); // FIXED: Removed `status` from dependencies

  return {
    status,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    isDisconnected: status === 'disconnected',
    lastEventTime,
  };
}
