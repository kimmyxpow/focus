import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createQueryKey } from '@modelence/react-query';
import { 
  sessionClientChannel, 
  onSessionEvent, 
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
 * 
 * **IMPORTANT FIX:**
 * - Chat channel subscription is now handled ONLY in ChatPanel.tsx
 * - This prevents double join/leave causing race conditions
 * - Session channel is still managed here for session events
 */
export function useSessionChannel({
  sessionId,
  onStatusChange,
  onParticipantJoined,
  onParticipantLeft,
  onReaction,
  onTimerSync,
  onChatToggled,
  // Note: onChatMessage and onTyping are kept for API compatibility but not used here
  // Chat messages are handled by ChatPanel directly
  onChatMessage: _onChatMessage,
  onTyping: _onTyping,
  enableChat: _enableChat = true,
}: UseSessionChannelOptions) {
  const queryClient = useQueryClient();
  const isJoinedRef = useRef(false);
  
  // Track WebSocket connection status
  const { status: connectionStatus, isConnected, isDisconnected } = useWebSocketStatus(sessionId);
  
  // Handle session events - use refs for callbacks to prevent effect re-runs
  const onStatusChangeRef = useRef(onStatusChange);
  const onParticipantJoinedRef = useRef(onParticipantJoined);
  const onParticipantLeftRef = useRef(onParticipantLeft);
  const onReactionRef = useRef(onReaction);
  const onTimerSyncRef = useRef(onTimerSync);
  const onChatToggledRef = useRef(onChatToggled);
  
  // Keep refs updated
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onParticipantJoinedRef.current = onParticipantJoined;
    onParticipantLeftRef.current = onParticipantLeft;
    onReactionRef.current = onReaction;
    onTimerSyncRef.current = onTimerSync;
    onChatToggledRef.current = onChatToggled;
  }, [onStatusChange, onParticipantJoined, onParticipantLeft, onReaction, onTimerSync, onChatToggled]);
  
  // Handle session events - stable callback using refs
  const handleSessionEvent = useCallback((event: SessionEvent) => {
    // Dispatch to appropriate handler
    switch (event.type) {
      case 'status_changed':
        onStatusChangeRef.current?.(event);
        // Invalidate session query to get fresh data
        queryClient.invalidateQueries({ 
          queryKey: createQueryKey('focus.getSession', { sessionId: event.sessionId }) 
        });
        break;
        
      case 'participant_joined':
        onParticipantJoinedRef.current?.(event);
        queryClient.invalidateQueries({ 
          queryKey: createQueryKey('focus.getSession', { sessionId: event.sessionId }) 
        });
        break;
        
      case 'participant_left':
        onParticipantLeftRef.current?.(event);
        queryClient.invalidateQueries({ 
          queryKey: createQueryKey('focus.getSession', { sessionId: event.sessionId }) 
        });
        break;
        
      case 'participant_reaction':
        onReactionRef.current?.(event);
        queryClient.invalidateQueries({ 
          queryKey: createQueryKey('focus.getSession', { sessionId: event.sessionId }) 
        });
        break;
        
      case 'timer_sync':
        onTimerSyncRef.current?.(event);
        break;
        
      case 'chat_toggled':
        onChatToggledRef.current?.(event);
        queryClient.invalidateQueries({ 
          queryKey: createQueryKey('focus.getSession', { sessionId: event.sessionId }) 
        });
        break;
    }
  }, [queryClient]); // Only depends on queryClient which is stable

  // Join/leave SESSION channel on mount/unmount
  // FIXED: Chat channel is now managed by ChatPanel.tsx only
  useEffect(() => {
    if (!sessionId) return;

    // Join session channel only
    sessionClientChannel.joinChannel(sessionId);
    isJoinedRef.current = true;
    
    // Subscribe to session events
    const unsubscribeSession = onSessionEvent(sessionId, handleSessionEvent);

    // Cleanup: leave session channel and unsubscribe
    return () => {
      if (isJoinedRef.current) {
        sessionClientChannel.leaveChannel(sessionId);
        isJoinedRef.current = false;
      }
      unsubscribeSession();
    };
  }, [sessionId, handleSessionEvent]); // FIXED: Removed enableChat dependency and chat channel handling

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
