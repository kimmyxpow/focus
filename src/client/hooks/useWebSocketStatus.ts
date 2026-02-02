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
 */
export function useWebSocketStatus(sessionId?: string) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastEventTime, setLastEventTime] = useState<number | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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

    // Subscribe to events to track connection health
    const unsubSession = onSessionEvent(sessionId, handleEvent);
    const unsubChat = onChatEvent(sessionId, handleEvent);

    // After 5s of joining, if no events received, assume connected
    // (no events doesn't mean disconnected, just no activity)
    const connectionTimeout = setTimeout(() => {
      if (status === 'connecting') {
        setStatus('connected');
      }
    }, 5000);

    return () => {
      unsubSession();
      unsubChat();
      clearTimeout(connectionTimeout);
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
    };
  }, [sessionId, handleEvent, status]);

  return {
    status,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    isDisconnected: status === 'disconnected',
    lastEventTime,
  };
}
