import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';

type ActiveSessionData = {
  sessionId: string;
  topic: string;
  status: 'waiting' | 'focusing' | 'break' | 'cooldown';
  isActiveParticipant: boolean;
} | null;

/**
 * Hook to check if the user has an active focus session.
 * Returns null if no active session, or session data if active.
 * 
 * Note: This hook uses reduced polling (30s) as a fallback.
 * The actual session page uses WebSocket for real-time updates.
 * This hook is primarily for the global session indicator/widget.
 * 
 * FIXED: Reduced staleTime from 10s to 2s to allow faster response to invalidation
 * when user leaves a session.
 */
export function useActiveSession() {
  const { data, isLoading } = useQuery({
    ...modelenceQuery<ActiveSessionData>('focus.getActiveSession', {}),
    refetchInterval: 30000, // Reduced from 10s to 30s - used as fallback only
    staleTime: 2000, // FIXED: Reduced from 10s to 2s - faster invalidation response
    refetchOnWindowFocus: true, // Refetch when window regains focus
    retry: false,
  });

  return {
    activeSession: data ?? null,
    hasActiveSession: !!data && data.isActiveParticipant,
    isLoading,
  };
}
