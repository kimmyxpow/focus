import { useState, useEffect, useCallback, useRef } from 'react';
import { onSessionEvent, onChatEvent } from '@/client/channels';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export function useWebSocketStatus(sessionId?: string) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastEventTime, setLastEventTime] = useState<number | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<ConnectionStatus>('connecting');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const handleEvent = useCallback(() => {
    setLastEventTime(Date.now());
    setStatus('connected');

    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    heartbeatTimeoutRef.current = setTimeout(() => {
      setStatus('disconnected');
    }, 60000);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');
    statusRef.current = 'connecting';

    const unsubSession = onSessionEvent(sessionId, handleEvent);
    const unsubChat = onChatEvent(sessionId, handleEvent);

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
  }, [sessionId, handleEvent]);

  return {
    status,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    isDisconnected: status === 'disconnected',
    lastEventTime,
  };
}
