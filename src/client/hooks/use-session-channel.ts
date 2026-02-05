import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createQueryKey } from '@modelence/react-query';
import { 
  sessionClientChannel, 
  onSessionEvent, 
  type SessionEvent,
  type ChatEvent,
} from '@/client/channels';
import { useWebSocketStatus } from './use-web-socket-status';

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

export function useSessionChannel({
  sessionId,
  onStatusChange,
  onParticipantJoined,
  onParticipantLeft,
  onReaction,
  onTimerSync,
  onChatToggled,
  onChatMessage: _onChatMessage,
  onTyping: _onTyping,
  enableChat: _enableChat = true,
}: UseSessionChannelOptions) {
  const queryClient = useQueryClient();
  const isJoinedRef = useRef(false);

  const { status: connectionStatus, isConnected, isDisconnected } = useWebSocketStatus(sessionId);

  const onStatusChangeRef = useRef(onStatusChange);
  const onParticipantJoinedRef = useRef(onParticipantJoined);
  const onParticipantLeftRef = useRef(onParticipantLeft);
  const onReactionRef = useRef(onReaction);
  const onTimerSyncRef = useRef(onTimerSync);
  const onChatToggledRef = useRef(onChatToggled);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onParticipantJoinedRef.current = onParticipantJoined;
    onParticipantLeftRef.current = onParticipantLeft;
    onReactionRef.current = onReaction;
    onTimerSyncRef.current = onTimerSync;
    onChatToggledRef.current = onChatToggled;
  }, [onStatusChange, onParticipantJoined, onParticipantLeft, onReaction, onTimerSync, onChatToggled]);

  const handleSessionEvent = useCallback((event: SessionEvent) => {
    switch (event.type) {
      case 'status_changed':
        onStatusChangeRef.current?.(event);
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
  }, [queryClient]);

  useEffect(() => {
    if (!sessionId) return;

    sessionClientChannel.joinChannel(sessionId);
    isJoinedRef.current = true;

    const unsubscribeSession = onSessionEvent(sessionId, handleSessionEvent);

    return () => {
      if (isJoinedRef.current) {
        sessionClientChannel.leaveChannel(sessionId);
        isJoinedRef.current = false;
      }
      unsubscribeSession();
    };
  }, [sessionId, handleSessionEvent]);

  return {
    isJoined: isJoinedRef.current,
    connectionStatus,
    isConnected,
    isDisconnected,
  };
}

export default useSessionChannel;
