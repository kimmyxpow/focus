import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createQueryKey } from '@modelence/react-query';
import { 
  sessionClientChannel, 
  chatClientChannel, 
  onSessionEvent, 
  onChatEvent,
  type SessionEvent,
  type ChatEvent,
} from '@/client/channels';
import { useWebSocketStatus } from './useWebSocketStatus';

interface UseSessionChannelOptions {
  sessionId: string | undefined;
  onStatusChange?: (event: SessionEvent) => void;
  onParticipantJoined?: (event: SessionEvent) => void;
  onParticipantLeft?: (event: SessionEvent) => void;
  onReaction?: (event: SessionEvent) => void;
  onTimerSync?: (event: SessionEvent) => void;
  onChatToggled?: (event: SessionEvent) => void;
  onChatMessage?: (event: ChatEvent) => void;
  onTyping?: (event: ChatEvent) => void;
  enableChat?: boolean;
}

/**
 * Hook to manage WebSocket channel subscriptions for a focus session.
 * Handles automatic join/leave on mount/unmount and provides callbacks
 * for handling real-time events.
 * 
 * The hook automatically invalidates relevant queries when events are received,
 * providing seamless integration with React Query.
 * 
 * **Graceful Degradation:**
 * - Returns connection status so components can adjust behavior
 * - Fallback polling (30s) in FocusRoomPage ensures data stays fresh even if WebSocket fails
 * - Connection status indicator shows users when they're receiving real-time vs polling updates
 */
export function useSessionChannel({
  sessionId,
  onStatusChange,
  onParticipantJoined,
  onParticipantLeft,
  onReaction,
  onTimerSync,
  onChatToggled,
  onChatMessage,
  onTyping,
  enableChat = true,
}: UseSessionChannelOptions) {
  const queryClient = useQueryClient();
  const isJoinedRef = useRef(false);
  
  // Track WebSocket connection status
  const { status: connectionStatus, isConnected, isDisconnected } = useWebSocketStatus(sessionId);
  
  // Handle session events
  const handleSessionEvent = useCallback((event: SessionEvent) => {
    // Dispatch to appropriate handler
    switch (event.type) {
      case 'status_changed':
        onStatusChange?.(event);
        // Invalidate session query to get fresh data
        queryClient.invalidateQueries({ 
          queryKey: createQueryKey('focus.getSession', { sessionId: event.sessionId }) 
        });
        break;
        
      case 'participant_joined':
        onParticipantJoined?.(event);
        queryClient.invalidateQueries({ 
          queryKey: createQueryKey('focus.getSession', { sessionId: event.sessionId }) 
        });
        break;
        
      case 'participant_left':
        onParticipantLeft?.(event);
        queryClient.invalidateQueries({ 
          queryKey: createQueryKey('focus.getSession', { sessionId: event.sessionId }) 
        });
        break;
        
      case 'participant_reaction':
        onReaction?.(event);
        queryClient.invalidateQueries({ 
          queryKey: createQueryKey('focus.getSession', { sessionId: event.sessionId }) 
        });
        break;
        
      case 'timer_sync':
        onTimerSync?.(event);
        break;
        
      case 'chat_toggled':
        onChatToggled?.(event);
        queryClient.invalidateQueries({ 
          queryKey: createQueryKey('focus.getSession', { sessionId: event.sessionId }) 
        });
        break;
    }
  }, [queryClient, onStatusChange, onParticipantJoined, onParticipantLeft, onReaction, onTimerSync, onChatToggled]);

  // Handle chat events
  const handleChatEvent = useCallback((event: ChatEvent) => {
    switch (event.type) {
      case 'message':
        onChatMessage?.(event);
        // No need to invalidate chat query since we're handling messages directly
        break;
        
      case 'typing':
        onTyping?.(event);
        break;
    }
  }, [onChatMessage, onTyping]);

  // Join/leave channels on mount/unmount
  useEffect(() => {
    if (!sessionId) return;

    // Join session channel
    sessionClientChannel.joinChannel(sessionId);
    isJoinedRef.current = true;
    
    // Subscribe to session events
    const unsubscribeSession = onSessionEvent(sessionId, handleSessionEvent);

    // Join chat channel if enabled
    let unsubscribeChat: (() => void) | null = null;
    if (enableChat) {
      chatClientChannel.joinChannel(sessionId);
      unsubscribeChat = onChatEvent(sessionId, handleChatEvent);
    }

    // Cleanup: leave channels and unsubscribe
    return () => {
      if (isJoinedRef.current) {
        sessionClientChannel.leaveChannel(sessionId);
        if (enableChat) {
          chatClientChannel.leaveChannel(sessionId);
        }
        isJoinedRef.current = false;
      }
      unsubscribeSession();
      unsubscribeChat?.();
    };
  }, [sessionId, enableChat, handleSessionEvent, handleChatEvent]);

  return {
    /** Whether channels have been joined */
    isJoined: isJoinedRef.current,
    /** WebSocket connection status: 'connecting' | 'connected' | 'disconnected' */
    connectionStatus,
    /** Whether WebSocket is connected and receiving events */
    isConnected,
    /** Whether WebSocket appears disconnected (fallback polling will cover) */
    isDisconnected,
  };
}

export default useSessionChannel;
