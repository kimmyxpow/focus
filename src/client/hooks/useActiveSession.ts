import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';

type ActiveSessionData = {
  sessionId: string;
  topic: string;
  status: 'waiting' | 'warmup' | 'focusing' | 'break' | 'cooldown';
  isActiveParticipant: boolean;
} | null;

/**
 * Hook to check if the user has an active focus session.
 * Returns null if no active session, or session data if active.
 */
export function useActiveSession() {
  const { data, isLoading } = useQuery({
    ...modelenceQuery<ActiveSessionData>('focus.getActiveSession', {}),
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: false,
  });

  return {
    activeSession: data ?? null,
    hasActiveSession: !!data && data.isActiveParticipant,
    isLoading,
  };
}
