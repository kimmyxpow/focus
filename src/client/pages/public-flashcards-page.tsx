import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';
import { useSession } from 'modelence/client';
import Page from '@/client/components/page';

type PublicFlashcardSet = {
  _id: string;
  title: string;
  description?: string;
  topic?: string;
  cardCount: number;
  creatorName: string;
  studyCount: number;
  quizCount: number;
  createdAt: string;
};

function SetSkeleton() {
  return (
    <div className="py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="skeleton bg-white/10 h-5 w-48" />
          <div className="skeleton bg-white/10 h-4 w-full max-w-sm" />
          <div className="flex gap-2">
            <div className="skeleton bg-white/10 h-4 w-20" />
            <div className="skeleton bg-white/10 h-4 w-24" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="skeleton bg-white/10 h-9 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  const { user } = useSession();
  
  return (
    <div className="text-center py-16 fade-in">
      <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
        <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
        </svg>
      </div>
      <h3 className="text-display-sm text-white mb-2">No public flashcards yet</h3>
      <p className="text-white/50 text-sm mb-6 max-w-xs mx-auto">
        Be the first to share your flashcard sets with the community.
      </p>
      {user && (
        <Link to="/create-flashcard" className="btn-light">
          Create Flashcards
        </Link>
      )}
    </div>
  );
}

function FlashcardSetRow({ set }: { set: PublicFlashcardSet }) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
            <span>{set.cardCount} cards</span>
            <span className="text-white/20">·</span>
            <span>@{set.creatorName}</span>
            <span className="text-white/20">·</span>
            <span>{formatDate(set.createdAt)}</span>
            {(set.studyCount > 0 || set.quizCount > 0) && (
              <>
                <span className="text-white/20">·</span>
                <span>{set.studyCount + set.quizCount} studies</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex-shrink-0 flex items-center gap-2">
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

export default function PublicFlashcardsPage() {
  const { user } = useSession();

  const { data: sets = [], isLoading } = useQuery({
    ...modelenceQuery<PublicFlashcardSet[]>('flashcard.getPublicFlashcardSets'),
  });

  return (
    <Page variant="dark">
      <div className="container-lg">
        <section className="fade-in pt-6">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-display-sm text-white">Flashcards</h1>
            <div className="flex items-center gap-3">
              <Link to="/my-flashcards" className="btn-outline-light text-sm px-3 py-1.5">
                My Flashcards
              </Link>
              {user && (
                <Link to="/create-flashcard" className="btn-light text-sm px-3 py-1.5">
                  Create Flashcards
                </Link>
              )}
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
                <FlashcardSetRow key={set._id} set={set} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
