import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modelenceQuery, modelenceMutation, createQueryKey } from '@modelence/react-query';
import toast from 'react-hot-toast';
import Page from '@/client/components/Page';
import { cn } from '@/client/lib/utils';

type QuizSet = {
  _id: string;
  title: string;
  description?: string;
  topic?: string;
  questionCount: number;
  isPublic: boolean;
  attemptCount: number;
  bestScore?: number;
  lastScore?: number;
  lastAttemptAt?: string;
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
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 fade-in">
      <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
        <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h3 className="text-display-sm text-white mb-2">No quizzes yet</h3>
      <p className="text-white/50 text-sm mb-6 max-w-xs mx-auto">
        Upload your study material and let AI create quiz questions for you.
      </p>
      <Link to="/create-quiz" className="btn-light">
        Create Your First Quiz
      </Link>
    </div>
  );
}

function QuizRow({ 
  quiz, 
  onDelete,
  onToggleVisibility,
}: { 
  quiz: QuizSet; 
  onDelete: (id: string) => void;
  onToggleVisibility: (id: string, isPublic: boolean) => void;
}) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return 'Never taken';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Taken today';
    if (diffDays === 1) return 'Taken yesterday';
    if (diffDays < 7) return `Taken ${diffDays} days ago`;
    return `Last taken ${formatDate(dateString)}`;
  };

  return (
    <div className="py-4 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-white truncate">{quiz.title}</span>
            {quiz.topic && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/70">
                {quiz.topic}
              </span>
            )}
            {quiz.isPublic ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300">
                Public
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/50">
                Private
              </span>
            )}
            {quiz.bestScore !== undefined && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300">
                Best: {quiz.bestScore}%
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
            <span>{quiz.questionCount} questions</span>
            <span className="text-white/20">·</span>
            <span>{formatRelativeTime(quiz.lastAttemptAt)}</span>
            {quiz.attemptCount > 0 && (
              <>
                <span className="text-white/20">·</span>
                <span>{quiz.attemptCount} attempts</span>
              </>
            )}
            <span className="text-white/20">·</span>
            <span>{formatDate(quiz.createdAt)}</span>
          </div>
        </div>
        
        <div className="flex-shrink-0 flex items-center gap-2">
          <button
            onClick={() => onToggleVisibility(quiz._id, !quiz.isPublic)}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              quiz.isPublic 
                ? "text-emerald-400 hover:bg-emerald-500/10" 
                : "text-white/40 hover:text-white hover:bg-white/10"
            )}
            title={quiz.isPublic ? "Make Private" : "Make Public"}
          >
            {quiz.isPublic ? (
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
            onClick={() => onDelete(quiz._id)}
            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <Link
            to={`/quiz/${quiz._id}`}
            className="btn-light text-sm px-3 py-1.5"
          >
            Take Quiz
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function MyQuizzesPage() {
  const queryClient = useQueryClient();

  const { data: quizzes = [], isLoading } = useQuery({
    ...modelenceQuery<QuizSet[]>('quiz.getMyQuizzes'),
  });

  const { mutate: deleteQuiz } = useMutation({
    ...modelenceMutation<{ success: boolean }>('quiz.deleteQuiz'),
    onSuccess: () => {
      toast.success('Quiz deleted');
      queryClient.invalidateQueries({ queryKey: createQueryKey('quiz.getMyQuizzes', {}) });
    },
    onError: () => {
      toast.error('Failed to delete quiz');
    },
  });

  const { mutate: toggleVisibility } = useMutation({
    ...modelenceMutation<{ success: boolean; isPublic: boolean }>('quiz.toggleQuizVisibility'),
    onSuccess: (data) => {
      toast.success(data.isPublic ? 'Quiz is now public' : 'Quiz is now private');
      queryClient.invalidateQueries({ queryKey: createQueryKey('quiz.getMyQuizzes', {}) });
      queryClient.invalidateQueries({ queryKey: createQueryKey('quiz.getPublicQuizzes', {}) });
    },
    onError: () => {
      toast.error('Failed to update visibility');
    },
  });

  const handleDelete = (quizId: string) => {
    if (confirm('Are you sure you want to delete this quiz?')) {
      deleteQuiz({ quizId });
    }
  };

  const handleToggleVisibility = (quizId: string, isPublic: boolean) => {
    toggleVisibility({ quizId, isPublic });
  };

  return (
    <Page variant="dark">
      <div className="container-lg">
        <section className="fade-in pt-6">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-display-sm text-white">My Quizzes</h1>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/30">{quizzes.length} quizzes</span>
              <Link to="/quiz" className="btn-outline-light text-sm px-3 py-1.5">
                Browse Public
              </Link>
              <Link to="/create-quiz" className="btn-light text-sm px-3 py-1.5">
                Create Quiz
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div className="divide-y divide-white/5">
              <SetSkeleton />
              <SetSkeleton />
              <SetSkeleton />
            </div>
          ) : quizzes.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-white/5">
              {quizzes.map((quiz) => (
                <QuizRow
                  key={quiz._id}
                  quiz={quiz}
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
