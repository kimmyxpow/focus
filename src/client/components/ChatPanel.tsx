import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modelenceQuery, modelenceMutation, createQueryKey } from '@modelence/react-query';
import { cn } from '@/client/lib/utils';
import { chatClientChannel, onChatEvent, type ChatEvent } from '@/client/channels';

type ChatMessage = {
  id: string;
  odonym: string;
  message: string;
  sentAt: string;
  isOwn: boolean;
};

interface ChatPanelProps {
  sessionId: string;
  isOpen: boolean;
  onToggle: () => void;
  chatEnabled: boolean;
  isCreator: boolean;
  isActiveParticipant: boolean;
  currentOdonym?: string; // Current user's anonymous name in this session
}

export default function ChatPanel({
  sessionId,
  isOpen,
  onToggle,
  chatEnabled,
  isCreator,
  isActiveParticipant,
  currentOdonym,
}: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [realtimeMessages, setRealtimeMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const hasInitializedRef = useRef(false);
  
  // FIXED: Use ref to store currentOdonym to avoid recreating handleChatMessage
  // This prevents the effect from re-running and causing channel re-subscription
  const currentOdonymRef = useRef(currentOdonym);
  useEffect(() => {
    currentOdonymRef.current = currentOdonym;
  }, [currentOdonym]);

  // Fetch initial messages (no polling - WebSocket handles new messages)
  const { data: initialMessages = [], isLoading } = useQuery({
    ...modelenceQuery<ChatMessage[]>('focus.getSessionMessages', { sessionId, limit: 50 }),
    enabled: chatEnabled && isOpen && isActiveParticipant,
    refetchInterval: false, // REMOVED polling - WebSocket handles real-time
    staleTime: 60000, // Consider data fresh for 1 minute
  });

  // Initialize realtime messages from initial fetch
  useEffect(() => {
    if (initialMessages.length > 0 && !hasInitializedRef.current) {
      setRealtimeMessages(initialMessages);
      hasInitializedRef.current = true;
    }
  }, [initialMessages]);

  // FIXED: Handle incoming WebSocket chat messages - use ref instead of closure
  // This ensures the callback is stable and doesn't cause effect re-runs
  const handleChatMessage = useCallback((event: ChatEvent) => {
    console.log('[ChatPanel] WebSocket event received:', event);
    if (event.type === 'message' && event.message) {
      const newMessage: ChatMessage = {
        id: event.message.id,
        odonym: event.message.odonym,
        message: event.message.message,
        sentAt: event.message.sentAt,
        isOwn: event.message.odonym === currentOdonymRef.current,
      };
      console.log('[ChatPanel] Processing WebSocket message:', newMessage, 'currentOdonym:', currentOdonymRef.current);
      
      // Add message if not already present (avoid duplicates)
      setRealtimeMessages((prev) => {
        if (prev.some(m => m.id === newMessage.id)) {
          console.log('[ChatPanel] WebSocket message already exists, skipping');
          return prev;
        }
        console.log('[ChatPanel] Added WebSocket message, new count:', prev.length + 1);
        return [...prev, newMessage];
      });
    }
  }, []); // FIXED: Empty dependency array - uses ref for currentOdonym

  // FIXED: Subscribe to chat channel - only depends on stable values
  // Channel subscription is managed ONLY here (not in useSessionChannel)
  // to avoid double subscription causing race conditions
  useEffect(() => {
    if (!sessionId || !chatEnabled || !isActiveParticipant) return;
    
    // Only join/subscribe when chat panel conditions are met
    // Note: We join even when panel is closed to ensure messages are received
    // The isOpen check is only for initial messages fetch
    
    // Join chat channel
    chatClientChannel.joinChannel(sessionId);
    
    // Subscribe to chat events
    const unsubscribe = onChatEvent(sessionId, handleChatMessage);

    return () => {
      // Leave channel on cleanup
      chatClientChannel.leaveChannel(sessionId);
      unsubscribe();
    };
  }, [sessionId, chatEnabled, isActiveParticipant, handleChatMessage]); // FIXED: Removed isOpen - stay subscribed even when closed

  // Reset state when chat is disabled or session changes
  useEffect(() => {
    if (!chatEnabled) {
      hasInitializedRef.current = false;
      setRealtimeMessages([]);
    }
  }, [chatEnabled]);

  // FIXED: Reset state when sessionId changes (switching between sessions)
  const prevSessionIdRef = useRef(sessionId);
  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      hasInitializedRef.current = false;
      setRealtimeMessages([]);
      prevSessionIdRef.current = sessionId;
    }
  }, [sessionId]);

  const { mutate: sendMessageMutation, isPending: isSending } = useMutation({
    ...modelenceMutation<{ success: boolean; message: ChatMessage }>('focus.sendMessage'),
    onSuccess: (data) => {
      console.log('[ChatPanel] sendMessage onSuccess:', data);
      setMessage('');
      // Message will arrive via WebSocket, but add optimistically for immediate feedback
      if (data.message) {
        const optimisticMessage: ChatMessage = {
          ...data.message,
          isOwn: true,
        };
        console.log('[ChatPanel] Adding optimistic message:', optimisticMessage);
        setRealtimeMessages((prev) => {
          // Only add if not already present (WebSocket may have already delivered it)
          if (prev.some(m => m.id === optimisticMessage.id)) {
            console.log('[ChatPanel] Message already exists, skipping');
            return prev;
          }
          console.log('[ChatPanel] Added message, new count:', prev.length + 1);
          return [...prev, optimisticMessage];
        });
      } else {
        console.warn('[ChatPanel] No message in response data');
      }
    },
    onError: (error) => {
      console.error('[ChatPanel] sendMessage error:', error);
    },
  });

  const { mutate: toggleChat, isPending: isTogglingChat } = useMutation({
    ...modelenceMutation<{ success: boolean; chatEnabled: boolean }>('focus.toggleChat'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: createQueryKey('focus.getSession', { sessionId }) });
    },
  });

  // Combine initial and realtime messages
  const messages = realtimeMessages;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && chatEnabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, chatEnabled]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending) return;
    sendMessageMutation({ sessionId, message: trimmedMessage });
  }, [message, sessionId, sendMessageMutation, isSending]);

  const handleToggleChat = useCallback(() => {
    toggleChat({ sessionId, enabled: !chatEnabled });
  }, [sessionId, chatEnabled, toggleChat]);

  // Chat toggle button (always visible) - No tooltip since the button's purpose is clear
  const toggleButton = (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg",
        isOpen
          ? "bg-white text-stone-900"
          : chatEnabled
            ? "bg-white/20 text-white hover:bg-white/30"
            : "bg-white/10 text-white/50 hover:bg-white/15"
      )}
    >
      {isOpen ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <title>Close chat</title>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <title>Open chat</title>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      )}
      {!isOpen && messages.length > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-stone-900 rounded-full text-xs font-semibold flex items-center justify-center">
          {messages.length > 9 ? '9+' : messages.length}
        </span>
      )}
    </button>
  );

  if (!isOpen) {
    return toggleButton;
  }

  return (
    <>
      {toggleButton}

      {/* Chat Panel - Bottom drawer on mobile, side panel on desktop */}
      <div className="fixed inset-x-0 bottom-0 sm:inset-auto sm:right-4 sm:bottom-20 sm:w-80 z-30 fade-in">
        <div className="bg-stone-900/95 backdrop-blur-sm border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[60vh] sm:max-h-[500px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Chat</span>
              {chatEnabled ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400" title="Real-time connected" />
              ) : (
                <span className="text-xs text-white/40">Disabled</span>
              )}
            </div>
            {isCreator && (
              <button
                type="button"
                onClick={handleToggleChat}
                disabled={isTogglingChat}
                className={cn(
                  "text-xs px-2 py-1 rounded transition-colors",
                  chatEnabled
                    ? "bg-white/10 text-white/70 hover:bg-white/20"
                    : "bg-white/5 text-white/40 hover:bg-white/10"
                )}
              >
                {isTogglingChat ? '...' : chatEnabled ? 'Disable' : 'Enable'}
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
            {!chatEnabled ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <svg className="w-8 h-8 text-white/20 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <title>Chat disabled</title>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <p className="text-white/40 text-sm">Chat is turned off for this session</p>
                {isCreator && (
                  <p className="text-white/30 text-xs mt-1">You can enable it from the menu above</p>
                )}
              </div>
            ) : !isActiveParticipant ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <p className="text-white/40 text-sm">Join this session to start chatting</p>
              </div>
            ) : isLoading && messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="spinner" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <svg className="w-8 h-8 text-white/20 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <title>No messages</title>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <p className="text-white/40 text-sm">No messages yet</p>
                <p className="text-white/30 text-xs mt-1">Be the first to say hello!</p>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col",
                      msg.isOwn ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2",
                        msg.isOwn
                          ? "bg-white text-stone-900 rounded-br-sm"
                          : "bg-white/10 text-white rounded-bl-sm"
                      )}
                    >
                      {!msg.isOwn && (
                        <span className="text-[10px] font-medium text-white/50 block mb-0.5">
                          {msg.odonym}
                        </span>
                      )}
                      <p className="text-sm break-words">{msg.message}</p>
                    </div>
                    <span className="text-[10px] text-white/30 mt-1 px-1">
                      {formatTime(msg.sentAt)}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          {chatEnabled && isActiveParticipant && (
            <form onSubmit={handleSubmit} className="p-3 border-t border-white/10">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Send a message..."
                  maxLength={500}
                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
                />
                <button
                  type="submit"
                  disabled={!message.trim() || isSending}
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                    message.trim()
                      ? "bg-white text-stone-900 hover:bg-white/90"
                      : "bg-white/10 text-white/30"
                  )}
                >
                  {isSending ? (
                    <div className="spinner-sm" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <title>Send message</title>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
