import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'modelence/client';
import { modelenceQuery, modelenceMutation, createQueryKey } from '@modelence/react-query';
import toast from 'react-hot-toast';
import Page from '@/client/components/Page';
import SessionSummarySkeleton from '@/client/components/skeletons/SessionSummarySkeleton';
import { cn } from '@/client/lib/utils';

type SessionSummary = {
  sessionId: string;
  intent: string;
  topic: string;
  duration: number;
  userOutcome?: string;
  cohortStats: {
    totalParticipants: number;
    completedCount: number;
  };
  aiSummary: string;
  aiNextStep: string;
  focusMinutesEarned: number;
};

const OUTCOMES = [
  { key: 'completed', label: 'Nailed it', description: 'Stayed focused the whole time', icon: '✓' },
  { key: 'partial', label: 'Good progress', description: 'Made solid progress', icon: '◐' },
  { key: 'interrupted', label: 'Got interrupted', description: 'Had to step away', icon: '○' },
] as const;

export default function SessionSummaryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const queryClient = useQueryClient();
  const { user } = useSession();

  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);

  const { data: summary, isLoading, error } = useQuery({
    ...modelenceQuery<SessionSummary>('focus.getSessionSummary', { sessionId }),
    enabled: !!sessionId && !!user,
    staleTime: 30 * 60 * 1000, // Cache for 30 minutes - template-based summary is static
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
  });

  const { mutate: recordOutcome, isPending: isRecording } = useMutation({
    ...modelenceMutation('focus.recordOutcome'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: createQueryKey('focus.getSessionSummary', { sessionId }) });
      toast.success('Outcome recorded!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleRecordOutcome = useCallback((outcome: string) => {
    setSelectedOutcome(outcome);
    recordOutcome({ sessionId, outcome });
  }, [sessionId, recordOutcome]);

  if (!user) {
    return (
      <Page variant="dark">
        <div className="container-sm">
          <div className="text-center py-12 fade-in">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-display-sm text-white mb-2">Sign in to Continue</h2>
            <p className="text-white/50 text-sm mb-6">
              Please sign in to view your session summary.
            </p>
            <Link
              to={`/login?_redirect=${encodeURIComponent(`/focus/${sessionId}/summary`)}`}
              className="btn-light inline-block"
            >
              Sign In
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  if (isLoading) {
    return (
      <Page variant="dark">
        <SessionSummarySkeleton />
      </Page>
    );
  }

  if (error || !summary) {
    return (
      <Page variant="dark">
        <div className="container-sm">
          <div className="text-center py-12 fade-in">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-display-sm text-white mb-2">Summary not ready yet</h2>
            <p className="text-white/50 text-sm mb-6">
              {(error as Error)?.message || "We couldn't load the summary. It might still be processing."}
            </p>
            <Link to="/" className="btn-light inline-block">
              Back to sessions
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  const completionRate = summary.cohortStats.totalParticipants > 0
    ? Math.round((summary.cohortStats.completedCount / summary.cohortStats.totalParticipants) * 100)
    : 0;

  return (
    <Page variant="dark">
      <div className="container-sm space-y-6 fade-in">
        {/* Celebration Header */}
        <div className="text-center py-8">
          <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-stone-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="chip bg-emerald-500/20 text-emerald-400 mb-4">Session complete!</span>
          <h1 className="text-display-md text-white mb-2">{summary.topic}</h1>
          <p className="text-white/50">{summary.intent}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-5 text-center bg-white/5 rounded-xl">
            <p className="text-3xl font-bold text-white display-number">{summary.duration}</p>
            <p className="text-xs text-white/50 mt-1">minutes</p>
          </div>
          <div className="p-5 text-center bg-white/5 rounded-xl">
            <p className="text-3xl font-bold text-white">{summary.cohortStats.totalParticipants}</p>
            <p className="text-xs text-white/50 mt-1">participants</p>
          </div>
          <div className="p-5 text-center bg-white/5 rounded-xl">
            <p className="text-3xl font-bold text-white">{completionRate}%</p>
            <p className="text-xs text-white/50 mt-1">completed</p>
          </div>
        </div>

        {/* Outcome Selection */}
        {!summary.userOutcome && (
          <section className="py-6 border-t border-white/10">
            <h2 className="text-lg font-semibold text-white mb-1">How did your session go?</h2>
            <p className="text-sm text-white/50 mb-4">Your feedback helps us match you with better focus partners</p>
            <div className="grid grid-cols-3 gap-3">
              {OUTCOMES.map((outcome) => (
                <button
                  type="button"
                  key={outcome.key}
                  onClick={() => handleRecordOutcome(outcome.key)}
                  disabled={isRecording}
                  className={cn(
                    "flex flex-col items-center p-4 rounded-xl border transition-all",
                    selectedOutcome === outcome.key
                      ? "border-white bg-white text-stone-900"
                      : "border-white/10 bg-white/5 hover:bg-white/10 text-white"
                  )}
                >
                  <span className="text-2xl mb-2">{outcome.icon}</span>
                  <span className={cn(
                    "font-medium text-sm",
                    selectedOutcome === outcome.key ? "text-stone-900" : "text-white"
                  )}>{outcome.label}</span>
                  <span className={cn(
                    "text-xs text-center mt-1",
                    selectedOutcome === outcome.key ? "text-stone-500" : "text-white/50"
                  )}>{outcome.description}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* User Outcome Display */}
        {summary.userOutcome && (
          <div className="flex items-center justify-center gap-2 py-2">
            <span className="text-sm text-white/50">Your outcome:</span>
            <span className={cn(
              "chip",
              summary.userOutcome === 'completed'
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-white/10 text-white/70"
            )}>
              {OUTCOMES.find(o => o.key === summary.userOutcome)?.label || summary.userOutcome}
            </span>
          </div>
        )}

        {/* Session Insights */}
        <section className="py-6 border-t border-white/10">
          <h2 className="text-base font-semibold text-white mb-3">Session insights</h2>
          <p className="text-white/70 leading-relaxed">{summary.aiSummary}</p>
        </section>

        {/* Next Step */}
        <section className="py-6 border-t border-white/10">
          <h2 className="text-base font-semibold text-white mb-3">What to do next</h2>
          <p className="text-white/70 leading-relaxed">{summary.aiNextStep}</p>
        </section>

        {/* Focus Minutes Earned */}
        <section className="py-8 text-center border-t border-white/10">
          <p className="text-sm text-white/50 mb-2">Focus time earned</p>
          <p className="text-5xl font-bold text-white display-number">+{summary.focusMinutesEarned}</p>
          <p className="text-sm text-white/40 mt-3">Added to your personal stats</p>
        </section>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Link to="/" className="btn-outline-light flex-1 text-center">
            Back to sessions
          </Link>
          <Link to="/create-session" className="btn-light flex-1 text-center">
            Start another session
          </Link>
        </div>
      </div>
    </Page>
  );
}
