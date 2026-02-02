import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'modelence/client';
import { modelenceQuery } from '@modelence/react-query';
import Page from '@/client/components/Page';
import { cn } from '@/client/lib/utils';

type LeaderboardEntry = {
  rank: number;
  nickname: string;
  pronouns?: string;
  focusMinutes: number;
  sessions: number;
  streak: number;
};

type TimeFilter = 'all' | 'month' | 'week';
type SortBy = 'focusMinutes' | 'sessions' | 'streak';

const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
];

const SORT_OPTIONS: { value: SortBy; label: string; icon: React.ReactNode }[] = [
  {
    value: 'focusMinutes',
    label: 'Focus Time',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    value: 'sessions',
    label: 'Sessions',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    value: 'streak',
    label: 'Streak',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
      </svg>
    ),
  },
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
        <span className="text-amber-400 text-lg">1</span>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-400/20 flex items-center justify-center">
        <span className="text-slate-300 text-lg">2</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-8 h-8 rounded-full bg-amber-700/20 flex items-center justify-center">
        <span className="text-amber-600 text-lg">3</span>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
      <span className="text-white/50 text-sm">{rank}</span>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="card-dark p-4 flex items-center gap-4">
          <div className="skeleton bg-white/10 w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton bg-white/10 h-4 w-24" />
            <div className="skeleton bg-white/10 h-3 w-16" />
          </div>
          <div className="skeleton bg-white/10 h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

function EmptyLeaderboard() {
  return (
    <div className="card-dark p-8 text-center">
      <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">No rankings yet</h3>
      <p className="text-white/50 text-sm max-w-xs mx-auto">
        Users with public profiles who complete focus sessions will appear here.
      </p>
    </div>
  );
}

export default function LeaderboardPage() {
  const { user } = useSession();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('focusMinutes');

  const { data: leaderboard, isLoading } = useQuery({
    ...modelenceQuery<LeaderboardEntry[]>('focus.getLeaderboard', {
      timeFilter,
      sortBy,
      limit: 50,
    }),
    refetchInterval: 60000, // Refresh every minute
  });

  const formatFocusTime = useCallback((minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }, []);

  const getStatValue = useCallback((entry: LeaderboardEntry) => {
    switch (sortBy) {
      case 'focusMinutes':
        return formatFocusTime(entry.focusMinutes);
      case 'sessions':
        return `${entry.sessions} sessions`;
      case 'streak':
        return `${entry.streak} days`;
    }
  }, [sortBy, formatFocusTime]);

  return (
    <Page variant="dark">
      <div className="container-md py-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-display-sm text-white mb-2">Leaderboard</h1>
          <p className="text-white/50 text-sm">
            See how you stack up against other focused minds
          </p>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Time Period Tabs - Row 1 */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg w-full sm:w-auto">
              {TIME_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setTimeFilter(filter.value)}
                  className={cn(
                    "flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    timeFilter === filter.value
                      ? "bg-white text-stone-900"
                      : "text-white/50 hover:text-white hover:bg-white/10"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ranking Type Selector - Row 2 */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg w-full sm:w-auto">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex-1 sm:flex-none",
                    sortBy === option.value
                      ? "bg-white text-stone-900"
                      : "text-white/50 hover:text-white hover:bg-white/10"
                  )}
                >
                  {option.icon}
                  <span className="hidden sm:inline">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        {isLoading ? (
          <LeaderboardSkeleton />
        ) : !leaderboard || leaderboard.length === 0 ? (
          <EmptyLeaderboard />
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry) => (
              <div
                key={entry.nickname}
                className={cn(
                  "card-dark p-4 flex items-center gap-4 transition-colors",
                  entry.rank <= 3 && "ring-1 ring-white/10"
                )}
              >
                <RankBadge rank={entry.rank} />

                <div className="flex-1 min-w-0 max-w-[200px] sm:max-w-none">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white truncate">@{entry.nickname}</span>
                    {entry.pronouns && (
                      <span className="text-xs text-white/40 whitespace-nowrap">({entry.pronouns})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
                    <span className="truncate">{formatFocusTime(entry.focusMinutes)} focused</span>
                    <span className="whitespace-nowrap">{entry.sessions} sessions</span>
                    {entry.streak > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-amber-400/70 whitespace-nowrap">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                        </svg>
                        {entry.streak}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className={cn(
                    "text-lg font-semibold display-number",
                    entry.rank === 1 ? "text-amber-400" :
                    entry.rank === 2 ? "text-slate-300" :
                    entry.rank === 3 ? "text-amber-600" :
                    "text-white"
                  )}>
                    {getStatValue(entry)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA for non-public users */}
        {user && (
          <div className="card-dark p-5 text-center bg-gradient-to-r from-white/5 to-white/0">
            <p className="text-white/70 text-sm mb-3">
              Want to appear on the leaderboard? Make your profile public!
            </p>
            <Link to="/profile" className="btn-outline-light text-sm">
              Go to Profile Settings
            </Link>
          </div>
        )}

        {/* Privacy note */}
        <p className="text-center text-white/30 text-xs">
          Only users with public profiles are shown on the leaderboard.
          <br />
          Your privacy settings can be changed at any time from your profile.
        </p>
      </div>
    </Page>
  );
}
