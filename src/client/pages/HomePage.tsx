import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';
import Page from '@/client/components/Page';

// Icons
const ClockIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const QuizIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
  </svg>
);

const FlashcardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
);

type FeatureRowProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  stats?: string;
};

function FeatureRow({ title, description, icon, href, stats }: FeatureRowProps) {
  return (
    <Link
      to={href}
      className="group flex items-center gap-4 py-5 border-b border-white/5 hover:bg-white/[0.02] transition-colors -mx-4 px-4"
    >
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white/60 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium text-white">{title}</h3>
          {stats && (
            <span className="text-xs text-white/40">{stats}</span>
          )}
        </div>
        <p className="text-sm text-white/40">{description}</p>
      </div>
      <div className="text-white/30 group-hover:text-white/60 transition-colors">
        <ArrowRightIcon />
      </div>
    </Link>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-4 py-5 border-b border-white/5 -mx-4 px-4">
      <div className="skeleton bg-white/10 w-10 h-10 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="skeleton bg-white/10 h-4 w-24" />
        <div className="skeleton bg-white/10 h-3 w-48" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    ...modelenceQuery<{ length: number }>('focus.getActiveSessions', {}),
    staleTime: 30000,
  });

  const { data: quizzes } = useQuery({
    ...modelenceQuery<{ length: number }>('quiz.getPublicQuizzes', {}),
    staleTime: 60000,
  });

  const { data: flashcards } = useQuery({
    ...modelenceQuery<{ length: number }>('flashcard.getPublicFlashcardSets', {}),
    staleTime: 60000,
  });

  const sessionCount = Array.isArray(sessions) ? sessions.length : 0;
  const quizCount = Array.isArray(quizzes) ? quizzes.length : 0;
  const flashcardCount = Array.isArray(flashcards) ? flashcards.length : 0;

  return (
    <Page variant="dark">
      <div className="container-sm">
        {/* Header */}
        <section className="py-8 fade-in">
          <h1 className="text-display-md text-white mb-2">
            Focus. Learn. Grow.
          </h1>
          <p className="text-white/50">
            Study together, test your knowledge, master new concepts.
          </p>
        </section>

        {/* Features List */}
        <section className="fade-in">
          <h2 className="text-label text-white/30 mb-2">Features</h2>
          
          {sessionsLoading ? (
            <>
              <LoadingRow />
              <LoadingRow />
              <LoadingRow />
            </>
          ) : (
            <>
              <FeatureRow
                title="Focus Sessions"
                description="Join live study sessions with others"
                icon={<ClockIcon />}
                href="/sessions"
                stats={sessionCount > 0 ? `${sessionCount} active` : undefined}
              />
              <FeatureRow
                title="Quizzes"
                description="AI-generated tests for any topic"
                icon={<QuizIcon />}
                href="/quiz"
                stats={quizCount > 0 ? `${quizCount} available` : undefined}
              />
              <FeatureRow
                title="Flashcards"
                description="Create and study card sets"
                icon={<FlashcardIcon />}
                href="/flashcards"
                stats={flashcardCount > 0 ? `${flashcardCount} sets` : undefined}
              />
            </>
          )}
        </section>

        {/* Quick Actions */}
        <section className="mt-8 pt-8 border-t border-white/10 fade-in">
          <h2 className="text-label text-white/30 mb-4">Create New</h2>
          <div className="space-y-2">
            <Link 
              to="/create-session" 
              className="flex items-center gap-3 py-3 px-4 -mx-4 rounded-lg hover:bg-white/[0.02] transition-colors group"
            >
              <span className="text-white/60">+</span>
              <span className="text-white/70 group-hover:text-white transition-colors">Focus Session</span>
            </Link>
            <Link 
              to="/create-quiz" 
              className="flex items-center gap-3 py-3 px-4 -mx-4 rounded-lg hover:bg-white/[0.02] transition-colors group"
            >
              <span className="text-white/60">+</span>
              <span className="text-white/70 group-hover:text-white transition-colors">Quiz</span>
            </Link>
            <Link 
              to="/create-flashcard" 
              className="flex items-center gap-3 py-3 px-4 -mx-4 rounded-lg hover:bg-white/[0.02] transition-colors group"
            >
              <span className="text-white/60">+</span>
              <span className="text-white/70 group-hover:text-white transition-colors">Flashcards</span>
            </Link>
          </div>
        </section>
      </div>
    </Page>
  );
}
