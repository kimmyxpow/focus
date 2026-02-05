import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'modelence/client';
import { modelenceQuery, modelenceMutation, createQueryKey } from '@modelence/react-query';
import toast from 'react-hot-toast';
import Page from '@/client/components/Page';
import FocusHeatmap from '@/client/components/FocusHeatmap';
import ProfileSkeleton from '@/client/components/skeletons/ProfileSkeleton';
import { cn } from '@/client/lib/utils';

type Profile = {
  nickname: string;
  pronouns?: string;
  isPublic: boolean;
  stats: {
    totalFocusMinutes: number;
    totalSessions: number;
    completedSessions: number;
    focusStreak: number;
  };
};

const PRONOUN_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'he/him', label: 'he/him' },
  { value: 'she/her', label: 'she/her' },
  { value: 'they/them', label: 'they/them' },
  { value: 'custom', label: 'Custom...' },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();

  const [nickname, setNickname] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [customPronouns, setCustomPronouns] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [nicknameError, setNicknameError] = useState('');

  const { data: profile, isLoading } = useQuery({
    ...modelenceQuery<Profile | null>('focus.getMyProfile', {}),
    enabled: !!user,
  });

  const { data: nicknameAvailable, isFetching: checkingNickname } = useQuery({
    ...modelenceQuery<{ available: boolean }>('focus.checkNicknameAvailable', { nickname }),
    enabled: !!nickname && nickname.length >= 3 && nickname !== profile?.nickname,
    staleTime: 1000,
  });

  const { mutate: saveProfile, isPending: isSaving } = useMutation({
    ...modelenceMutation<{ success: boolean; nickname: string }>('focus.saveProfile'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: createQueryKey('focus.getMyProfile', {}) });
      toast.success('Profile saved!');
      setIsEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname);
      setIsPublic(profile.isPublic);
      if (profile.pronouns) {
        const isPredefined = PRONOUN_OPTIONS.some(opt => opt.value === profile.pronouns);
        if (isPredefined) {
          setPronouns(profile.pronouns);
        } else {
          setPronouns('custom');
          setCustomPronouns(profile.pronouns);
        }
      }
    } else if (profile === null) {
      setIsEditing(true);
    }
  }, [profile]);

  useEffect(() => {
    if (!nickname) {
      setNicknameError('');
      return;
    }
    if (nickname.length < 3) {
      setNicknameError('Nicknames need at least 3 characters');
      return;
    }
    if (nickname.length > 20) {
      setNicknameError('Keep it under 20 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
      setNicknameError('Letters, numbers, and underscores only');
      return;
    }
    if (nicknameAvailable && !nicknameAvailable.available && nickname !== profile?.nickname) {
      setNicknameError("Someone's already using that nickname");
      return;
    }
    setNicknameError('');
  }, [nickname, nicknameAvailable, profile?.nickname]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (nicknameError || !nickname) return;

    const finalPronouns = pronouns === 'custom' ? customPronouns : pronouns;
    saveProfile({
      nickname,
      pronouns: finalPronouns || undefined,
      isPublic,
    });
  }, [nickname, pronouns, customPronouns, isPublic, nicknameError, saveProfile]);

  const formatFocusTime = useCallback((minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }, []);

  if (!user) {
    navigate('/login');
    return null;
  }

  if (isLoading) {
    return (
      <Page variant="dark">
        <div className="container-md py-8">
          <ProfileSkeleton />
        </div>
      </Page>
    );
  }

  return (
    <Page variant="dark">
      <div className="container-md py-8 space-y-8 fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-sm text-white">Profile</h1>
            <p className="text-white/50 text-sm mt-1">Personalize your profile and choose what to share</p>
          </div>
          {profile && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="btn-outline-light"
            >
              Edit profile
            </button>
          )}
        </div>

        <div className="space-y-6">
          {isEditing || !profile ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="nickname" className="block text-sm font-medium text-white/70 mb-2">
                  Nickname <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">@</span>
                  <input
                    id="nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="your_nickname"
                    maxLength={20}
                    className={cn(
                      "w-full pl-8 pr-10 py-2.5 rounded-lg text-sm bg-white/5 border text-white placeholder:text-white/30 focus:outline-none",
                      nicknameError ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-white/20"
                    )}
                  />
                  {checkingNickname && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="spinner-sm" />
                    </div>
                  )}
                  {!checkingNickname && nickname && !nicknameError && nickname !== profile?.nickname && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                {nicknameError && (
                  <p className="text-red-400 text-xs mt-1.5">{nicknameError}</p>
                )}
                <p className="text-white/30 text-xs mt-1.5">
                  3-20 characters. Letters, numbers, and underscores only.
                </p>
              </div>

              <div>
                <label htmlFor="pronouns" className="block text-sm font-medium text-white/70 mb-2">
                  Pronouns <span className="text-white/30">(optional)</span>
                </label>
                <select
                  id="pronouns"
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/20"
                >
                  {PRONOUN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-stone-900">
                      {opt.label}
                    </option>
                  ))}
                </select>
                {pronouns === 'custom' && (
                  <input
                    type="text"
                    value={customPronouns}
                    onChange={(e) => setCustomPronouns(e.target.value)}
                    placeholder="Enter your pronouns"
                    maxLength={30}
                    className="w-full mt-2 px-3 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
                  />
                )}
              </div>

              <div className="p-4 bg-white/5 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-white">Public profile</span>
                    <p className="text-xs text-white/40 mt-0.5">
                      {isPublic
                        ? 'Your focus stats will appear on the leaderboard for everyone to see'
                        : "Your profile stays private and won't appear on leaderboards"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPublic(!isPublic)}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-colors",
                      isPublic ? "bg-white" : "bg-white/20"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1 left-1 w-4 h-4 rounded-full transition-transform",
                        isPublic ? "translate-x-5 bg-stone-900" : "translate-x-0 bg-white/60"
                      )}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving || !!nicknameError || !nickname}
                  className="btn-light"
                >
                  {isSaving ? 'Saving...' : profile ? 'Save changes' : 'Create profile'}
                </button>
                {profile && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setNickname(profile.nickname);
                      setIsPublic(profile.isPublic);
                      if (profile.pronouns) {
                        const isPredefined = PRONOUN_OPTIONS.some(opt => opt.value === profile.pronouns);
                        if (isPredefined) {
                          setPronouns(profile.pronouns);
                        } else {
                          setPronouns('custom');
                          setCustomPronouns(profile.pronouns);
                        }
                      } else {
                        setPronouns('');
                        setCustomPronouns('');
                      }
                    }}
                    className="btn-ghost-light"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center text-2xl font-semibold text-white">
                  {profile.nickname.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">@{profile.nickname}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {profile.pronouns && (
                      <span className="text-sm text-white/50">{profile.pronouns}</span>
                    )}
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-medium",
                      profile.isPublic
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/10 text-white/50"
                    )}>
                      {profile.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/10">
                <div className="text-center p-3 bg-white/5 rounded-lg">
                  <span className="block text-2xl font-semibold text-white display-number">
                    {formatFocusTime(profile.stats.totalFocusMinutes)}
                  </span>
                  <span className="text-xs text-white/40">Total Focus</span>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-lg">
                  <span className="block text-2xl font-semibold text-white display-number">
                    {profile.stats.totalSessions}
                  </span>
                  <span className="text-xs text-white/40">Sessions</span>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-lg">
                  <span className="block text-2xl font-semibold text-white display-number">
                    {profile.stats.completedSessions}
                  </span>
                  <span className="text-xs text-white/40">Completed</span>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-lg">
                  <span className="block text-2xl font-semibold text-white display-number">
                    {profile.stats.focusStreak}
                  </span>
                  <span className="text-xs text-white/40">Day Streak</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {profile && (
          <div className="pt-6 border-t border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Your focus activity</h3>
            <FocusHeatmap />
          </div>
        )}
      </div>
    </Page>
  );
}
