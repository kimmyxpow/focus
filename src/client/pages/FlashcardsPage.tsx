import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modelenceQuery, modelenceMutation, createQueryKey } from '@modelence/react-query';
import toast from 'react-hot-toast';
import Page from '@/client/components/Page';
import { cn } from '@/client/lib/utils';

type FlashcardSet = {
  _id: string;
  title: string;
  description?: string;
  topic?: string;
  cardCount: number;
  isPublic: boolean;
  lastStudiedAt?: string;
  studyCount: number;
  quizCount: number;
  bestScore?: number;
  createdAt: string;
  updatedAt: string;
};

function SetSkeleton() {
  return (
    <div className="py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="skeleton bg-white/10 h-5 w-48" />
          <div className="skeleton bg-white/10 h-4 w-full max-w-sm" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton bg-white/10 h-9 w-20 rounded-lg" />
          <div className="skeleton bg-white/10 h-9 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 fade-in">
      <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
        <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
        </svg>
      </div>
      <h3 className="text-display-sm text-white mb-2">No flashcards yet</h3>
      <p className="text-white/50 text-sm mb-6 max-w-xs mx-auto">
        Upload your study material and let AI create flashcards for you.
      </p>
      <Link to="/create-flashcard" className="btn-light">
        Create Flashcards
      </Link>
    </div>
  );
}

function FlashcardSetRow({ 
  set, 
  onDelete,
  onToggleVisibility,
}: { 
  set: FlashcardSet; 
  onDelete: (id: string) => void;
  onToggleVisibility: (id: string, isPublic: boolean) => void;
}) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return 'Never studied';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Studied today';
    if (diffDays === 1) return 'Studied yesterday';
    if (diffDays < 7) return `Studied ${diffDays} days ago`;
    return `Last studied ${formatDate(dateString)}`;
  };

  return (
    <div className="py-4 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-white truncate">{set.title}</span>
            {set.topic && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/70">
                {set.topic}
              </span>
            )}
            {set.isPublic ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300">
                Public
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/50">
                Private
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
            <span>{set.cardCount} cards</span>
            <span className="text-white/20">·</span>
            <span>{formatRelativeTime(set.lastStudiedAt)}</span>
            {set.studyCount > 0 && (
              <>
                <span className="text-white/20">·</span>
                <span>{set.studyCount} studies</span>
              </>
            )}
            <span className="text-white/20">·</span>
            <span>{formatDate(set.createdAt)}</span>
          </div>
        </div>
        
        <div className="flex-shrink-0 flex items-center gap-2">
          <button
            onClick={() => onToggleVisibility(set._id, !set.isPublic)}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              set.isPublic 
                ? "text-emerald-400 hover:bg-emerald-500/10" 
                : "text-white/40 hover:text-white hover:bg-white/10"
            )}
            title={set.isPublic ? "Make Private" : "Make Public"}
          >
            {set.isPublic ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => onDelete(set._id)}
            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <Link
            to={`/flashcards/${set._id}/study`}
            className="btn-light text-sm px-3 py-1.5"
          >
            Study
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function FlashcardsPage() {
  const queryClient = useQueryClient();

  const { data: sets = [], isLoading } = useQuery({
    ...modelenceQuery<FlashcardSet[]>('flashcard.getFlashcardSets'),
  });

  const { mutate: deleteSet } = useMutation({
    ...modelenceMutation<{ success: boolean }>('flashcard.deleteFlashcardSet'),
    onSuccess: () => {
      toast.success('Flashcard set deleted');
      queryClient.invalidateQueries({ queryKey: createQueryKey('flashcard.getFlashcardSets', {}) });
    },
    onError: () => {
      toast.error('Failed to delete flashcard set');
    },
  });

  const { mutate: toggleVisibility } = useMutation({
    ...modelenceMutation<{ success: boolean; isPublic: boolean }>('flashcard.toggleFlashcardSetVisibility'),
    onSuccess: (data) => {
      toast.success(data.isPublic ? 'Set is now public' : 'Set is now private');
      queryClient.invalidateQueries({ queryKey: createQueryKey('flashcard.getFlashcardSets', {}) });
      queryClient.invalidateQueries({ queryKey: createQueryKey('flashcard.getPublicFlashcardSets', {}) });
    },
    onError: () => {
      toast.error('Failed to update visibility');
    },
  });

  const handleDelete = (setId: string) => {
    if (confirm('Are you sure you want to delete this flashcard set?')) {
      deleteSet({ setId });
    }
  };

  const handleToggleVisibility = (setId: string, isPublic: boolean) => {
    toggleVisibility({ setId, isPublic });
  };

  return (
    <Page variant="dark">
      <div className="container-lg">
        <section className="fade-in pt-6">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-display-sm text-white">My Flashcards</h1>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/30">{sets.length} sets</span>
              <Link to="/flashcards" className="btn-outline-light text-sm px-3 py-1.5">
                Browse Public
              </Link>
              <Link to="/create-flashcard" className="btn-light text-sm px-3 py-1.5">
                Create Flashcards
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div className="divide-y divide-white/5">
              <SetSkeleton />
              <SetSkeleton />
              <SetSkeleton />
            </div>
          ) : sets.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-white/5">
              {sets.map((set) => (
                <FlashcardSetRow
                  key={set._id}
                  set={set}
                  onDelete={handleDelete}
                  onToggleVisibility={handleToggleVisibility}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
