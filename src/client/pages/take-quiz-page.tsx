import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { modelenceQuery, modelenceMutation } from '@modelence/react-query';
import { useSession } from 'modelence/client';
import Page from '@/client/components/page';
import { Button } from '@/client/components/ui/button';
import { cn } from '@/client/lib/utils';

type Question = {
  _id: string;
  type: 'multiple_choice' | 'true_false' | 'fill_blank';
  question: string;
  options?: string[];
};

type QuestionWithAnswer = Question & {
  correctAnswer: string;
  explanation?: string;
};

type Quiz = {
  _id: string;
  title: string;
  description?: string;
  topic?: string;
  questionCount: number;
  isPublic: boolean;
  isOwner: boolean;
  creatorName?: string;
  questions: Question[];
};

type QuizWithAnswers = {
  _id: string;
  title: string;
  questions: QuestionWithAnswer[];
  attempt: {
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    answers: { questionId: string; userAnswer: string; isCorrect: boolean }[];
  };
};

type QuizResult = {
  attemptId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  bestScore: number;
};

const ArrowLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const EyeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

function ProgressBar({ current, total }: { current: number; total: number }) {
  const percentage = (current / total) * 100;
  return (
    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
      <div 
        className="h-full bg-white/30 rounded-full transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export default function TakeQuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [startTime] = useState(Date.now());
  const [result, setResult] = useState<QuizResult | null>(null);
  const [fillBlankInput, setFillBlankInput] = useState('');
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [animKey, setAnimKey] = useState(0);

  const { data: quiz, isLoading } = useQuery({
    ...modelenceQuery<Quiz>('quiz.getQuiz', { quizId: quizId! }),
    enabled: !!quizId && !isReviewMode,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: reviewData, isLoading: reviewLoading } = useQuery({
    ...modelenceQuery<QuizWithAnswers>('quiz.getQuizWithAnswers', { 
      quizId: quizId!, 
      attemptId: result?.attemptId || '' 
    }),
    enabled: !!quizId && !!result?.attemptId && isReviewMode,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { mutate: submitQuiz, isPending: isSubmitting } = useMutation({
    ...modelenceMutation<QuizResult>('quiz.submitQuiz'),
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const currentQuestion = isReviewMode 
    ? reviewData?.questions[currentIndex]
    : quiz?.questions[currentIndex];
  const totalQuestions = isReviewMode 
    ? reviewData?.questions.length || 0 
    : quiz?.questions.length || 0;
  const currentAnswer = currentQuestion ? answers.get(currentQuestion._id) : undefined;

  useEffect(() => {
    if (currentQuestion?.type === 'fill_blank' && !isReviewMode) {
      setFillBlankInput(answers.get(currentQuestion._id) || '');
    }
  }, [currentIndex, currentQuestion, answers, isReviewMode]);

  const handleSelectAnswer = useCallback((answer: string) => {
    if (!currentQuestion || isReviewMode) return;
    setAnswers(prev => new Map(prev).set(currentQuestion._id, answer));
  }, [currentQuestion, isReviewMode]);

  const handleFillBlankChange = useCallback((value: string) => {
    if (isReviewMode) return;
    setFillBlankInput(value);
    if (currentQuestion) {
      setAnswers(prev => new Map(prev).set(currentQuestion._id, value));
    }
  }, [currentQuestion, isReviewMode]);

  const handleNext = useCallback(() => {
    if (currentIndex < totalQuestions - 1) {
      setSlideDirection('right');
      setAnimKey(k => k + 1);
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, totalQuestions]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setSlideDirection('left');
      setAnimKey(k => k + 1);
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleSubmit = useCallback(() => {
    if (!quiz || !user) return;

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    const answersArray = quiz.questions.map(q => ({
      questionId: q._id,
      answer: answers.get(q._id) || '',
    }));

    submitQuiz({
      quizId: quiz._id,
      answers: answersArray,
      durationSeconds,
    });
  }, [quiz, user, answers, startTime, submitQuiz]);

  const handleStartReview = useCallback(() => {
    setIsReviewMode(true);
    setCurrentIndex(0);
  }, []);

  const handleExitReview = useCallback(() => {
    setIsReviewMode(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentQuestion || (result && !isReviewMode)) return;

      if (!isReviewMode) {
        if (currentQuestion.type === 'multiple_choice' && currentQuestion.options) {
          const num = parseInt(e.key);
          if (num >= 1 && num <= currentQuestion.options.length) {
            handleSelectAnswer(currentQuestion.options[num - 1]);
          }
        } else if (currentQuestion.type === 'true_false') {
          if (e.key === '1' || e.key.toLowerCase() === 't') {
            handleSelectAnswer('true');
          } else if (e.key === '2' || e.key.toLowerCase() === 'f') {
            handleSelectAnswer('false');
          }
        }
      }

      if (e.key === 'ArrowRight') {
        if (isReviewMode || currentAnswer) handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, currentAnswer, result, isReviewMode, handleSelectAnswer, handleNext, handlePrev]);

  if (isLoading) {
    return (
      <Page variant="dark">
        <div className="container-sm py-8">
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-12 h-12 rounded-xl bg-white/10 animate-pulse mb-3" />
            <div className="h-3 bg-white/10 rounded w-24 animate-pulse" />
          </div>
        </div>
      </Page>
    );
  }

  if (!quiz && !isReviewMode) {
    return (
      <Page variant="dark">
        <div className="container-sm py-8">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-white mb-2">Quiz not found</h2>
            <Link to="/quiz" className="btn-light">Browse Quizzes</Link>
          </div>
        </div>
      </Page>
    );
  }

  if (!user && quiz) {
    return (
      <Page variant="dark">
        <div className="container-sm py-8">
          <div className="text-center fade-in">
            <h2 className="text-display-sm text-white mb-2">{quiz.title}</h2>
            <p className="text-white/50 text-sm mb-6">
              {quiz.questionCount} questions · Sign in to take this quiz
            </p>
            <Link 
              to={`/login?_redirect=${encodeURIComponent(`/quiz/${quizId}`)}`} 
              className="btn-light"
            >
              Sign In to Start
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  if (isReviewMode && reviewLoading) {
    return (
      <Page variant="dark">
        <div className="container-sm py-8">
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-12 h-12 rounded-xl bg-white/10 animate-pulse mb-3" />
            <div className="h-3 bg-white/10 rounded w-32 animate-pulse" />
          </div>
        </div>
      </Page>
    );
  }

  if (result && !isReviewMode) {
    return (
      <Page variant="dark">
        <div className="container-sm py-8">
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center mb-4 border animate-pop-in",
              result.score >= 70 
                ? "bg-emerald-500/10 border-emerald-500/30" 
                : result.score >= 50 
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-red-500/10 border-red-500/30"
            )}>
              <span className={cn(
                "text-3xl font-bold",
                result.score >= 70 
                  ? "text-emerald-400" 
                  : result.score >= 50 
                    ? "text-amber-400"
                    : "text-red-400"
              )}>
                {result.score}%
              </span>
            </div>
            
            <h2 className="text-xl font-semibold text-white mb-1 fade-in">Quiz Complete!</h2>
            <p className="text-white/50 text-sm mb-6 fade-in">
              {result.correctAnswers} of {result.totalQuestions} correct
              {result.score === result.bestScore && result.score > 0 && (
                <span className="text-emerald-400 ml-2">🎉 New best!</span>
              )}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 fade-in">
              <Button
                onClick={handleStartReview}
                className="bg-white/5 hover:bg-white/10 text-white border border-white/10"
              >
                <EyeIcon />
                Review Answers
              </Button>
              <Button
                onClick={() => {
                  setCurrentIndex(0);
                  setAnswers(new Map());
                  setResult(null);
                  setFillBlankInput('');
                }}
                className="bg-white/5 hover:bg-white/10 text-white border border-white/10"
              >
                <RefreshIcon />
                Try Again
              </Button>
              <Button
                onClick={() => navigate('/quiz')}
                className="bg-white text-stone-900 hover:bg-white/90"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      </Page>
    );
  }

  if (isReviewMode && reviewData) {
    const reviewQuestion = reviewData.questions[currentIndex] as QuestionWithAnswer;
    const userAnswer = reviewData.attempt.answers.find(a => a.questionId === reviewQuestion._id);

    return (
      <Page variant="dark">
        <div className="container-sm py-6">
          <div className="flex items-center gap-3 mb-6">
            <button 
              onClick={handleExitReview}
              className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Back to results"
            >
              <ArrowLeftIcon />
            </button>
            
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-medium text-white truncate">
                {reviewData.title}
              </h1>
              <p className="text-xs text-white/40">Review Answers</p>
            </div>

            <div className="flex items-center gap-2">
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium",
                userAnswer?.isCorrect ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
              )}>
                {userAnswer?.isCorrect ? 'Correct' : 'Incorrect'}
              </span>
              <span className="text-sm text-white/50 tabular-nums">
                {currentIndex + 1}/{totalQuestions}
              </span>
            </div>
          </div>

          <div className="mb-8">
            <ProgressBar current={currentIndex + 1} total={totalQuestions} />
          </div>

          <div className="space-y-6">
            {/* Question Type Badge */}
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider",
                reviewQuestion.type === 'multiple_choice' && "bg-blue-500/20 text-blue-300",
                reviewQuestion.type === 'true_false' && "bg-purple-500/20 text-purple-300",
                reviewQuestion.type === 'fill_blank' && "bg-amber-500/20 text-amber-300",
              )}>
                {reviewQuestion.type === 'multiple_choice' && 'Multiple Choice'}
                {reviewQuestion.type === 'true_false' && 'True / False'}
                {reviewQuestion.type === 'fill_blank' && 'Fill in the Blank'}
              </span>
            </div>

            <div className="bg-stone-800 border border-white/10 rounded-2xl p-6 sm:p-8">
              <p className="text-lg sm:text-xl font-medium text-white leading-relaxed">
                {reviewQuestion.question}
              </p>
            </div>

            {/* Answer Options with Correct/Incorrect Indicators */}
            <div className="space-y-3">
              {reviewQuestion.type === 'multiple_choice' && reviewQuestion.options?.map((option, index) => {
                const isUserAnswer = userAnswer?.userAnswer === option;
                const isCorrectAnswer = reviewQuestion.correctAnswer === option;
                
                return (
                  <div
                    key={option}
                    className={cn(
                      "w-full p-4 rounded-xl flex items-center gap-4 transition-all",
                      isCorrectAnswer
                        ? "bg-emerald-500/10 border border-emerald-500/30"
                        : isUserAnswer && !userAnswer?.isCorrect
                          ? "bg-red-500/10 border border-red-500/30"
                          : "bg-white/5 border border-transparent"
                    )}
                  >
                    <span className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm shrink-0",
                      isCorrectAnswer
                        ? "bg-emerald-500/20 text-emerald-300"
                        : isUserAnswer
                          ? "bg-red-500/20 text-red-300"
                          : "bg-white/10 text-white/60"
                    )}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className={cn(
                      "flex-1",
                      isCorrectAnswer ? "text-emerald-300" : isUserAnswer ? "text-red-300" : "text-white"
                    )}>
                      {option}
                    </span>
                    {isCorrectAnswer && (
                      <span className="text-emerald-400"><CheckIcon /></span>
                    )}
                    {isUserAnswer && !isCorrectAnswer && (
                      <span className="text-red-400"><XIcon /></span>
                    )}
                  </div>
                );
              })}

              {reviewQuestion.type === 'true_false' && (
                <div className="grid grid-cols-2 gap-3">
                  {['true', 'false'].map((value) => {
                    const isUserAnswer = userAnswer?.userAnswer === value;
                    const isCorrectAnswer = reviewQuestion.correctAnswer === value;
                    
                    return (
                      <div
                        key={value}
                        className={cn(
                          "p-6 rounded-xl text-center font-semibold text-lg flex items-center justify-center gap-2",
                          isCorrectAnswer
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                            : isUserAnswer && !userAnswer?.isCorrect
                              ? "bg-red-500/10 border border-red-500/30 text-red-300"
                              : "bg-white/5 border border-transparent text-white/50"
                        )}
                      >
                        {value === 'true' ? 'True' : 'False'}
                        {isCorrectAnswer && <CheckIcon />}
                        {isUserAnswer && !isCorrectAnswer && <XIcon />}
                      </div>
                    );
                  })}
                </div>
              )}

              {reviewQuestion.type === 'fill_blank' && (
                <div className="space-y-3">
                  <div className={cn(
                    "w-full px-4 py-3 rounded-xl text-lg border",
                    userAnswer?.isCorrect
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-red-500/10 border-red-500/30 text-red-300"
                  )}>
                    <div className="flex items-center justify-between">
                      <span>Your answer: {userAnswer?.userAnswer || '(empty)'}</span>
                      {userAnswer?.isCorrect ? <CheckIcon /> : <XIcon />}
                    </div>
                  </div>
                  {!userAnswer?.isCorrect && (
                    <div className="w-full px-4 py-3 rounded-xl text-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                      <div className="flex items-center justify-between">
                        <span>Correct answer: {reviewQuestion.correctAnswer}</span>
                        <CheckIcon />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Explanation */}
            {reviewQuestion.explanation && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Explanation</p>
                <p className="text-sm text-white/70">{reviewQuestion.explanation}</p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
              <Button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 disabled:opacity-30"
              >
                Previous
              </Button>

              <div className="flex items-center gap-2">
                {currentIndex < totalQuestions - 1 ? (
                  <Button
                    onClick={handleNext}
                    className="bg-white text-stone-900 hover:bg-white/90"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    onClick={handleExitReview}
                    className="bg-white text-stone-900 hover:bg-white/90"
                  >
                    Back to Results
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center gap-1 pt-2">
              {reviewData.questions.map((q, i) => {
                const answer = reviewData.attempt.answers.find(a => a.questionId === q._id);
                return (
                  <button
                    key={q._id}
                    onClick={() => setCurrentIndex(i)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      i === currentIndex
                        ? "w-4 bg-white"
                        : answer?.isCorrect
                          ? "bg-emerald-500/70"
                          : "bg-red-500/70"
                    )}
                    aria-label={`Go to question ${i + 1}`}
                  />
                );
              })}
            </div>
          </div>

          <p className="mt-6 text-center text-white/25 text-xs">
            Arrow keys to navigate
          </p>
        </div>
      </Page>
    );
  }

  const answeredCount = answers.size;
  const allAnswered = answeredCount === totalQuestions;

  return (
    <Page variant="dark">
      <div className="container-sm py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link 
            to="/quiz"
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Back"
          >
            <ArrowLeftIcon />
          </Link>
          
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-medium text-white truncate">
              {quiz?.title}
            </h1>
            <p className="text-xs text-white/40">Quiz</p>
          </div>

          <div className="text-sm text-white/50 tabular-nums">
            {currentIndex + 1}/{totalQuestions}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <ProgressBar current={currentIndex + 1} total={totalQuestions} />
        </div>

        {/* Question */}
        {currentQuestion && (
          <div 
            key={animKey}
            className={cn(
              "space-y-6",
              slideDirection === 'right' ? "animate-slide-in-right" : "animate-slide-in-left"
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider",
                currentQuestion.type === 'multiple_choice' && "bg-blue-500/20 text-blue-300",
                currentQuestion.type === 'true_false' && "bg-purple-500/20 text-purple-300",
                currentQuestion.type === 'fill_blank' && "bg-amber-500/20 text-amber-300",
              )}>
                {currentQuestion.type === 'multiple_choice' && 'Multiple Choice'}
                {currentQuestion.type === 'true_false' && 'True / False'}
                {currentQuestion.type === 'fill_blank' && 'Fill in the Blank'}
              </span>
            </div>

            <div className="bg-stone-800 border border-white/10 rounded-2xl p-6 sm:p-8">
              <p className="text-lg sm:text-xl font-medium text-white leading-relaxed">
                {currentQuestion.question}
              </p>
            </div>

            <div className="space-y-3">
              {currentQuestion.type === 'multiple_choice' && currentQuestion.options?.map((option, index) => (
                <button
                  key={option}
                  onClick={() => handleSelectAnswer(option)}
                  className={cn(
                    "quiz-option w-full p-4 rounded-xl text-left flex items-center gap-4",
                    currentAnswer === option
                      ? "bg-white/15 border border-white/30"
                      : "bg-white/5 hover:bg-white/10 border border-transparent"
                  )}
                >
                  <span className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm shrink-0",
                    currentAnswer === option
                      ? "bg-white/20 text-white"
                      : "bg-white/10 text-white/60"
                  )}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="text-white flex-1">{option}</span>
                </button>
              ))}

              {currentQuestion.type === 'true_false' && (
                <div className="grid grid-cols-2 gap-3">
                  {['true', 'false'].map((value) => (
                    <button
                      key={value}
                      onClick={() => handleSelectAnswer(value)}
                      className={cn(
                        "quiz-option p-6 rounded-xl text-center font-semibold text-lg",
                        currentAnswer === value
                          ? "bg-white/15 border border-white/30 text-white"
                          : "bg-white/5 hover:bg-white/10 border border-transparent text-white/70"
                      )}
                    >
                      {value === 'true' ? 'True' : 'False'}
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.type === 'fill_blank' && (
                <div>
                  <input
                    type="text"
                    value={fillBlankInput}
                    onChange={(e) => handleFillBlankChange(e.target.value)}
                    placeholder="Type your answer..."
                    className="w-full px-4 py-3 rounded-xl text-lg bg-white/5 text-white placeholder:text-white/30 focus:outline-none border border-white/10 focus:border-white/30 transition-colors"
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 disabled:opacity-30"
              >
                Previous
              </Button>

              <div className="flex items-center gap-2">
                {currentIndex < totalQuestions - 1 ? (
                  <Button
                    onClick={handleNext}
                    disabled={!currentAnswer}
                    className={cn(
                      "transition-all",
                      currentAnswer
                        ? "bg-white text-stone-900 hover:bg-white/90"
                        : "bg-white/10 text-white/40 cursor-not-allowed"
                    )}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={!allAnswered || isSubmitting}
                    className={cn(
                      "transition-all",
                      allAnswered
                        ? "bg-emerald-500 text-white hover:bg-emerald-600"
                        : "bg-white/10 text-white/40 cursor-not-allowed"
                    )}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center gap-1 pt-2">
              {quiz?.questions.map((q, i) => (
                <button
                  key={q._id}
                  onClick={() => setCurrentIndex(i)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i === currentIndex
                      ? "w-4 bg-white"
                      : answers.has(q._id)
                        ? "bg-white/50"
                        : "bg-white/20"
                  )}
                  aria-label={`Go to question ${i + 1}`}
                />
              ))}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-white/25 text-xs">
          {currentQuestion?.type === 'multiple_choice' && '1-4 to select · '}
          {currentQuestion?.type === 'true_false' && 'T/F to select · '}
          Arrow keys to navigate
        </p>
      </div>
    </Page>
  );
}
