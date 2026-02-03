import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';
import Page from '@/client/components/Page';

type PublicQuiz = {
  _id: string;
  title: string;
  description?: string;
  topic?: string;
  questionCount: number;
  creatorName: string;
  attemptCount: number;
  createdAt: string;
};

function QuizSkeleton() {
  return (
    <div className="p-4 bg-white/5 rounded-xl">
      <div className="skeleton bg-white/10 h-5 w-3/4 mb-2" />
      <div className="skeleton bg-white/10 h-4 w-full mb-3" />
      <div className="flex gap-2">
        <div className="skeleton bg-white/10 h-6 w-16 rounded-full" />
        <div className="skeleton bg-white/10 h-6 w-20 rounded-full" />
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
      <h3 className="text-display-sm text-white mb-2">No public quizzes yet</h3>
      <p className="text-white/50 text-sm mb-6 max-w-xs mx-auto">
        Be the first to share a quiz with the community!
      </p>
      <Link to="/create-quiz" className="btn-light">
        Create a Quiz
      </Link>
    </div>
  );
}

function QuizCard({ quiz }: { quiz: PublicQuiz }) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Link 
      to={`/quiz/${quiz._id}`}
      className="block p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors fade-in"
    >
      <h3 className="font-semibold text-white mb-1 line-clamp-1">{quiz.title}</h3>
      {quiz.description && (
        <p className="text-white/50 text-sm mb-3 line-clamp-2">{quiz.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {quiz.topic && (
          <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70">
            {quiz.topic}
          </span>
        )}
        <span className="text-white/40">{quiz.questionCount} questions</span>
        <span className="text-white/20">·</span>
        <span className="text-white/40">{quiz.attemptCount} attempts</span>
        <span className="text-white/20">·</span>
        <span className="text-white/40">by {quiz.creatorName}</span>
        <span className="text-white/20">·</span>
        <span className="text-white/40">{formatDate(quiz.createdAt)}</span>
      </div>
    </Link>
  );
}

export default function QuizListPage() {
  const { data: quizzes = [], isLoading } = useQuery({
    ...modelenceQuery<PublicQuiz[]>('quiz.getPublicQuizzes'),
  });

  return (
    <Page variant="dark">
      <div className="container-lg">
        <section className="fade-in pt-6">
          <div className="flex items-center justify-between py-4 mb-4">
            <div>
              <h1 className="text-display-sm text-white">Public Quizzes</h1>
              <p className="text-white/50 text-sm mt-1">Test your knowledge with community quizzes</p>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/my-quizzes" className="btn-outline-light text-sm px-3 py-1.5">
                My Quizzes
              </Link>
              <Link to="/create-quiz" className="btn-light text-sm px-3 py-1.5">
                Create Quiz
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <QuizSkeleton />
              <QuizSkeleton />
              <QuizSkeleton />
              <QuizSkeleton />
              <QuizSkeleton />
              <QuizSkeleton />
            </div>
          ) : quizzes.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {quizzes.map((quiz) => (
                <QuizCard key={quiz._id} quiz={quiz} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
