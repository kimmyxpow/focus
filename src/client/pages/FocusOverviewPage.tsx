import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'modelence/client';
import { modelenceQuery, modelenceMutation, createQueryKey } from '@modelence/react-query';
import toast from 'react-hot-toast';
import Page from '@/client/components/Page';
import { cn } from '@/client/lib/utils';

type WeeklyStat = {
  weekStart: string;
  focusMinutes: number;
  sessionCount: number;
  avgSessionDuration: number;
  preferredTopics: string[];
  preferredDurations: number[];
};

type FocusPatterns = {
  preferredDurationRange: number[];
  topTopics: string[];
  avgCompletionRate: number;
  focusStreak: number;
  lastActiveDate?: string;
};

type FocusOverview = {
  totalFocusMinutes: number;
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  weeklyStats: WeeklyStat[];
  focusPatterns: FocusPatterns | null;
  focusStreak: number;
};

type UserSession = {
  _id: string;
  intent: string;
  topic: string;
  duration: number;
  status: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  participantCount: number;
  isCreator: boolean;
};

function StatCard({ value, label, highlight = false }: { value: string | number; label: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "p-5 rounded-xl text-center",
      highlight ? "bg-white/10" : "bg-white/5"
    )}>
      <p className="text-3xl font-bold display-number text-white">
        {value}
      </p>
      <p className="text-xs text-white/50 mt-1">
        {label}
      </p>
    </div>
  );
}

function WeeklyChart({ stats }: { stats: WeeklyStat[] }) {
  const maxMinutes = Math.max(...stats.map(w => w.focusMinutes), 1);
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-2">
      {stats.slice(-8).map((week, index) => {
        const percentage = (week.focusMinutes / maxMinutes) * 100;
        return (
          <div key={index} className="flex items-center gap-3">
            <span className="text-xs text-white/40 w-14 flex-shrink-0">
              {formatDate(week.weekStart)}
            </span>
            <div className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden">
              <div
                className="h-full bg-white/20 rounded-lg transition-all duration-500"
                style={{ width: `${Math.max(percentage, 2)}%` }}
              />
            </div>
            <span className="text-sm font-medium text-white w-14 text-right">
              {formatHours(week.focusMinutes)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SessionHistoryCard({ session }: { session: UserSession }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    waiting: { label: 'Waiting', className: 'bg-white/10 text-white/70' },
    warmup: { label: 'Starting', className: 'bg-white/10 text-white/70' },
    focusing: { label: 'Live', className: 'bg-green-500/20 text-green-300' },
    cooldown: { label: 'Ending', className: 'bg-white/10 text-white/70' },
    completed: { label: 'Completed', className: 'bg-white/5 text-white/50' },
    cancelled: { label: 'Cancelled', className: 'bg-white/5 text-white/40' },
  };

  const status = statusConfig[session.status] || { label: session.status, className: 'bg-white/10 text-white/70' };
  const isActive = ['waiting', 'warmup', 'focusing', 'cooldown'].includes(session.status);

  return (
    <div className="card-dark p-4 fade-in">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-white truncate">{session.topic}</h4>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", status.className)}>
              {status.label}
            </span>
            {session.isCreator && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/60">
                Creator
              </span>
            )}
          </div>
          <p className="text-sm text-white/50 truncate">{session.intent}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3 text-xs text-white/40">
          <span>{session.duration} min</span>
          <span>{session.participantCount} participant{session.participantCount !== 1 ? 's' : ''}</span>
          <span>{new Date(session.createdAt).toLocaleDateString()}</span>
        </div>
        {isActive ? (
          <Link to={`/focus/${session._id}`} className="btn-light text-xs px-3 py-1.5">
            {session.status === 'focusing' ? 'Rejoin' : 'Continue'}
          </Link>
        ) : session.status === 'completed' ? (
          <Link to={`/focus/${session._id}/summary`} className="btn-outline-light text-xs px-3 py-1.5">
            Summary
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function FocusOverviewPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [showDataControls, setShowDataControls] = useState(false);
  const [retentionWeeks, setRetentionWeeks] = useState(12);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    ...modelenceQuery<FocusOverview>('focus.getFocusOverview', {}),
    enabled: !!user,
  });

  const { data: userSessions, isLoading: sessionsLoading } = useQuery({
    ...modelenceQuery<UserSession[]>('focus.getUserSessions', {}),
    enabled: !!user,
  });

  const { mutate: updateRetention, isPending: isUpdatingRetention } = useMutation({
    ...modelenceMutation('focus.updateRetentionPreference'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: createQueryKey('focus.getFocusOverview', {}) });
      toast.success('Retention preference updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: clearData, isPending: isClearing } = useMutation({
    ...modelenceMutation('focus.clearFocusData'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: createQueryKey('focus.getFocusOverview', {}) });
      toast.success('Focus data cleared');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const formatHours = useCallback((minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }, []);

  const isLoading = overviewLoading || sessionsLoading;

  if (!user) {
    return (
      <Page variant="dark">
        <div className="container-sm">
          <div className="card-dark p-8 text-center fade-in">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-display-sm text-white mb-2">Sign in to Continue</h2>
            <p className="text-white/50 text-sm mb-6">
              View your focus history and track your progress.
            </p>
            <Link to={`/login?_redirect=${encodeURIComponent('/focus-overview')}`} className="btn-light">
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
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-white/50 flex items-center gap-2">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Loading your focus data...</span>
          </div>
        </div>
      </Page>
    );
  }

  const hasStats = overview && overview.totalSessions > 0;
  const hasSessions = userSessions && userSessions.length > 0;
  const activeSessions = userSessions?.filter(s => ['waiting', 'warmup', 'focusing', 'cooldown'].includes(s.status)) || [];
  const pastSessions = userSessions?.filter(s => ['completed', 'cancelled'].includes(s.status)) || [];

  return (
    <Page variant="dark">
      <div className="container-lg space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between fade-in">
          <div>
            <h1 className="text-display-md text-white mb-1">My Focus</h1>
            <p className="text-white/50 text-sm">Your private focus history and stats</p>
          </div>
          <Link to="/create-session" className="btn-light">
            New Session
          </Link>
        </div>

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <section className="fade-in">
            <h2 className="text-label text-white/40 mb-4">Active Sessions</h2>
            <div className="space-y-3">
              {activeSessions.map((session) => (
                <SessionHistoryCard key={session._id} session={session} />
              ))}
            </div>
          </section>
        )}

        {/* Stats Overview */}
        {hasStats && (
          <section className="fade-in">
            <h2 className="text-label text-white/40 mb-4">Your Stats</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                value={formatHours(overview.totalFocusMinutes)}
                label="Total Focus"
                highlight
              />
              <StatCard value={overview.totalSessions} label="Sessions" />
              <StatCard value={`${Math.round(overview.completionRate * 100)}%`} label="Completion" />
              <StatCard value={overview.focusStreak} label="Day Streak" />
            </div>
          </section>
        )}

        {/* Weekly Chart */}
        {hasStats && overview.weeklyStats.length > 0 && (
          <section className="card-dark p-6 fade-in">
            <h3 className="text-white font-semibold mb-1">Weekly Focus Time</h3>
            <p className="text-white/40 text-xs mb-4">Last {Math.min(overview.weeklyStats.length, 8)} weeks</p>
            <WeeklyChart stats={overview.weeklyStats} />
          </section>
        )}

        {/* Past Sessions */}
        {pastSessions.length > 0 && (
          <section className="fade-in">
            <h2 className="text-label text-white/40 mb-4">Past Sessions</h2>
            <div className="space-y-3">
              {pastSessions.slice(0, 10).map((session) => (
                <SessionHistoryCard key={session._id} session={session} />
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {!hasSessions && !hasStats && (
          <div className="card-dark p-12 text-center fade-in">
            <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No focus sessions yet</h2>
            <p className="text-white/50 mb-8 max-w-sm mx-auto">
              Start your first focus session to begin tracking your progress.
            </p>
            <Link to="/create-session" className="btn-light">
              Start Your First Session
            </Link>
          </div>
        )}

        {/* Focus Patterns */}
        {hasStats && overview.focusPatterns && (
          <section className="card-dark p-6 fade-in">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-white font-semibold">Your Focus Patterns</h3>
              <span className="chip text-[10px]">AI</span>
            </div>
            <p className="text-white/40 text-xs mb-4">
              Used for cohort matching and session recommendations
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {overview.focusPatterns.preferredDurationRange && (
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Preferred Duration</p>
                  <p className="font-medium text-white">
                    {overview.focusPatterns.preferredDurationRange[0]}-
                    {overview.focusPatterns.preferredDurationRange[1]} minutes
                  </p>
                </div>
              )}
              {overview.focusPatterns.topTopics && overview.focusPatterns.topTopics.length > 0 && (
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Top Topics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {overview.focusPatterns.topTopics.map((topic) => (
                      <span key={topic} className="chip bg-white/10 text-white/70">{topic}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Privacy & Data Controls */}
        <section className="card-dark p-6 fade-in">
          <h3 className="text-white font-semibold mb-1">Privacy & Data</h3>
          <p className="text-white/40 text-xs mb-4">
            You control your data. Only aggregated, anonymized data is stored.
          </p>

          <button
            onClick={() => setShowDataControls(!showDataControls)}
            className="flex items-center justify-between w-full p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="text-left">
              <p className="font-medium text-white text-sm">Manage Data</p>
              <p className="text-xs text-white/40">Retention settings & deletion</p>
            </div>
            <svg
              className={cn(
                "w-5 h-5 text-white/40 transition-transform",
                showDataControls && "rotate-180"
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDataControls && (
            <div className="space-y-4 p-4 bg-white/5 rounded-xl mt-4 scale-in">
              <div>
                <label className="text-sm font-medium text-white mb-2 block">
                  Data Retention Period
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={retentionWeeks}
                    onChange={(e) => setRetentionWeeks(Number(e.target.value))}
                    className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    <option value="4">4 weeks</option>
                    <option value="8">8 weeks</option>
                    <option value="12">12 weeks</option>
                    <option value="26">26 weeks</option>
                    <option value="52">52 weeks</option>
                  </select>
                  <button
                    className="btn-light text-sm px-4 py-2"
                    onClick={() => updateRetention({ retentionWeeks })}
                    disabled={isUpdatingRetention}
                  >
                    {isUpdatingRetention ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <p className="text-sm text-white/60 mb-3">
                  Permanently delete all your focus data. This cannot be undone.
                </p>
                <button
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete all your focus data? This cannot be undone.')) {
                      clearData({});
                    }
                  }}
                  disabled={isClearing}
                >
                  {isClearing ? 'Clearing...' : 'Delete All Data'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* What we store */}
        <div className="grid sm:grid-cols-2 gap-4 text-sm fade-in">
          <div className="p-4 rounded-xl bg-white/5">
            <p className="font-medium text-white mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              What we store
            </p>
            <ul className="text-white/50 space-y-1 text-xs">
              <li>Aggregated focus minutes per week</li>
              <li>Session counts and completion rates</li>
              <li>Preferred topics and durations</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl bg-white/5">
            <p className="font-medium text-white mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              What we don't store
            </p>
            <ul className="text-white/50 space-y-1 text-xs">
              <li>Individual session details</li>
              <li>Your focus intents or notes</li>
              <li>Who you focused with</li>
            </ul>
          </div>
        </div>
      </div>
    </Page>
  );
}
