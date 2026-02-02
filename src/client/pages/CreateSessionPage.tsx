import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useSession } from 'modelence/client';
import { modelenceMutation } from '@modelence/react-query';
import toast from 'react-hot-toast';
import Page from '@/client/components/Page';
import { cn } from '@/client/lib/utils';
import { useActiveSession } from '@/client/hooks/useActiveSession';

const TOPICS = [
  { id: 'writing', label: 'Writing' },
  { id: 'coding', label: 'Coding' },
  { id: 'reading', label: 'Reading' },
  { id: 'studying', label: 'Studying' },
  { id: 'design', label: 'Design' },
  { id: 'research', label: 'Research' },
  { id: 'planning', label: 'Planning' },
  { id: 'creative', label: 'Creative' },
  { id: 'deep-work', label: 'Deep Work' },
  { id: 'other', label: 'Other' },
];

const DURATION_PRESETS = [
  { label: 'Quick', time: '15-20', min: 15, max: 20, description: 'Short burst' },
  { label: 'Standard', time: '25-30', min: 25, max: 30, description: 'Classic pomodoro' },
  { label: 'Deep', time: '45-50', min: 45, max: 50, description: 'Extended focus' },
  { label: 'Marathon', time: '60-90', min: 60, max: 90, description: 'Long session' },
];

function Toggle({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm font-medium text-white/70">{label}</span>
        {description && <p className="text-xs text-white/40 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={cn(
          "relative w-11 h-6 rounded-full transition-colors",
          enabled ? "bg-white" : "bg-white/20"
        )}
      >
        <span
          className={cn(
            "absolute top-1 left-1 w-4 h-4 rounded-full transition-transform",
            enabled ? "translate-x-5 bg-stone-900" : "translate-x-0 bg-white/60"
          )}
        />
      </button>
    </div>
  );
}

function NumberStepper({
  value,
  onChange,
  min,
  max,
  label,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  label: string;
  unit: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-white/70">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-semibold transition-colors bg-white/10 text-white/60 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          -
        </button>
        <span className="text-xl font-bold text-white min-w-[2.5rem] text-center">{value}</span>
        <button
          type="button"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-semibold transition-colors bg-white/10 text-white/60 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          +
        </button>
      </div>
      <span className="text-xs text-white/40 w-16 text-right">{unit}</span>
    </div>
  );
}

export default function CreateSessionPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { hasActiveSession, activeSession } = useActiveSession();

  // Core session info
  const [intent, setIntent] = useState('');
  const [topic, setTopic] = useState('');
  const [durationPreset, setDurationPreset] = useState<number | null>(1); // Default to Standard

  // Session settings (all visible upfront)
  const [repetitions, setRepetitions] = useState(1);
  const [breakDuration, setBreakDuration] = useState(5);
  const [breakInterval, setBreakInterval] = useState(1);
  const [isPrivate, setIsPrivate] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(false);

  const selectedDuration = durationPreset !== null ? DURATION_PRESETS[durationPreset] : null;
  const minDuration = selectedDuration?.min ?? 25;
  const maxDuration = selectedDuration?.max ?? 30;

  const canSubmit = intent.trim().length >= 10 && topic !== '' && durationPreset !== null && !hasActiveSession;

  const { mutate: createSession, isPending } = useMutation({
    ...modelenceMutation<{ sessionId: string }>('focus.createSession'),
    onSuccess: (data) => {
      toast.success('Session created!');
      navigate(`/focus/${data.sessionId}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create session');
    },
  });

  const handleSubmit = useCallback(() => {
    if (!canSubmit) {
      toast.error('Please fill in all required fields');
      return;
    }

    const topicLabel = TOPICS.find(t => t.id === topic)?.label || topic;
    createSession({
      intent: intent.trim(),
      topic: topicLabel,
      minDuration,
      maxDuration,
      repetitions,
      breakDuration,
      breakInterval,
      isPrivate,
      chatEnabled,
    });
  }, [intent, topic, minDuration, maxDuration, repetitions, breakDuration, breakInterval, isPrivate, chatEnabled, createSession, canSubmit]);

  // Sign in prompt
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
            <h2 className="text-display-sm text-white mb-2">Let's get you set up</h2>
            <p className="text-white/50 text-sm mb-6">
              Sign in to create your focus session and invite others to join you.
            </p>
            <Link to={`/login?_redirect=${encodeURIComponent('/create-session')}`} className="btn-light">
              Sign In
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page variant="dark">
      <div className="container-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-display-md text-white mb-2">Create a Focus Session</h1>
          <p className="text-white/50 text-sm">Set your intentions, choose your focus time, and invite others to work alongside you</p>
        </div>

        {/* Warning if user has active session */}
        {hasActiveSession && activeSession && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg fade-in">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-amber-300 font-medium text-sm">You're already in an active session</p>
                <p className="text-amber-300/70 text-xs mt-1">
                  Please leave your current session "{activeSession.topic}" before creating a new one.
                </p>
                <Link 
                  to={`/focus/${activeSession.sessionId}`} 
                  className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 mt-2 transition-colors"
                >
                  Return to session
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="card-dark p-6 fade-in space-y-8">
          {/* Intent */}
          <div>
            <label className="text-label text-white/60 mb-2 block">What are you focusing on today? *</label>
            <textarea
              placeholder="For example: Writing the intro to my research paper, or finishing that coding project..."
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              maxLength={200}
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 min-h-[100px] resize-none"
            />
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className={cn(
                "transition-colors",
                intent.length < 10 ? "text-white/40" : "text-white/60"
              )}>
                {intent.length < 10 ? `Just ${10 - intent.length} more characters to go` : 'Perfect!'}
              </span>
              <span className="text-white/40">{intent.length}/200</span>
            </div>
          </div>

          {/* Topic */}
          <div>
            <label className="text-label text-white/60 mb-2 block">Topic *</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTopic(t.id)}
                  className={cn(
                    "p-2.5 rounded-lg border text-sm font-medium transition-colors text-center",
                    topic === t.id
                      ? "border-white bg-white text-stone-900"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="text-label text-white/60 mb-2 block">Duration *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DURATION_PRESETS.map((preset, index) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setDurationPreset(index)}
                  className={cn(
                    "p-4 rounded-lg border text-center transition-colors",
                    durationPreset === index
                      ? "border-white bg-white text-stone-900"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  <span className={cn(
                    "text-2xl font-semibold display-number block",
                    durationPreset === index ? "text-stone-900" : "text-white"
                  )}>
                    {preset.time}
                  </span>
                  <span className={cn(
                    "text-xs block mt-1",
                    durationPreset === index ? "text-stone-500" : "text-white/50"
                  )}>
                    min · {preset.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10" />

          {/* Session Settings - All visible */}
          <div className="space-y-5">
            <h3 className="text-label text-white/60">Customize Your Session</h3>

            {/* Privacy & Chat Row */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-lg">
                <Toggle
                  enabled={isPrivate}
                  onChange={setIsPrivate}
                  label="Make this private"
                  description="Only people with the link can join"
                />
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <Toggle
                  enabled={chatEnabled}
                  onChange={setChatEnabled}
                  label="Enable chat"
                  description="Let participants send messages during the session"
                />
              </div>
            </div>

            {/* Repetitions & Breaks */}
            <div className="p-4 bg-white/5 rounded-lg space-y-4">
              <NumberStepper
                value={repetitions}
                onChange={setRepetitions}
                min={1}
                max={10}
                label="Focus cycles"
                unit={repetitions === 1 ? 'session' : 'sessions'}
              />

              {repetitions > 1 && (
                <>
                  <div className="border-t border-white/10 pt-4">
                    <NumberStepper
                      value={breakDuration}
                      onChange={setBreakDuration}
                      min={1}
                      max={30}
                      label="Break time"
                      unit="min"
                    />
                  </div>
                  <div className="border-t border-white/10 pt-4">
                    <NumberStepper
                      value={breakInterval}
                      onChange={setBreakInterval}
                      min={1}
                      max={repetitions}
                      label="Take a break every"
                      unit={breakInterval === 1 ? 'session' : 'sessions'}
                    />
                  </div>
                  <p className="text-xs text-white/40 pt-2">
                    {repetitions} sessions with {breakDuration}-min breaks every {breakInterval} session{breakInterval > 1 ? 's' : ''}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Summary */}
          {canSubmit && (
            <div className="p-4 bg-white/5 rounded-lg scale-in">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Summary</p>
              <p className="text-white text-sm mb-3 line-clamp-2">{intent}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip bg-white/10 text-white/70">{TOPICS.find(t => t.id === topic)?.label}</span>
                <span className="text-sm text-white/50">{selectedDuration?.time} min</span>
                {repetitions > 1 && (
                  <span className="chip bg-white/10 text-white/70">{repetitions}x</span>
                )}
                {isPrivate && (
                  <span className="chip bg-white/5 text-white/50">Private</span>
                )}
                {chatEnabled && (
                  <span className="chip bg-white/10 text-white/70">Chat On</span>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Link to="/" className="btn-ghost-light flex-1 text-center">
              Cancel
            </Link>
            <button
              className="btn-light flex-1"
              onClick={handleSubmit}
              disabled={isPending || !canSubmit}
            >
              {isPending ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </div>
      </div>
    </Page>
  );
}
