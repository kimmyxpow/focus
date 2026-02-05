import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';

type ActiveSessionData = {
  sessionId: string;
  topic: string;
  status: 'waiting' | 'focusing' | 'break' | 'cooldown';
  isActiveParticipant: boolean;
} | null;

export function useActiveSession() {
  const { data, isLoading } = useQuery({
    ...modelenceQuery<ActiveSessionData>('focus.getActiveSession', {}),
    refetchInterval: 30000,
    staleTime: 2000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  return {
    activeSession: data ?? null,
    hasActiveSession: !!data && data.isActiveParticipant,
    isLoading,
  };
}
