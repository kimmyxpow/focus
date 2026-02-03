import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { modelenceQuery, modelenceMutation } from '@modelence/react-query';
import Page from '@/client/components/Page';
import { Button } from '@/client/components/ui/Button';
import { cn } from '@/client/lib/utils';

type StudyCard = {
  _id: string;
  front: string;
  back: string;
  hint?: string;
  explanation?: string;
  difficulty: number;
};

type FlashcardSet = {
  _id: string;
  title: string;
  description?: string;
  cardCount: number;
};

// Icons
const ArrowLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const LightbulbIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

function FlashCard({
  card,
  isFlipped,
  onFlip,
  showHint,
  onToggleHint,
}: {
  card: StudyCard;
  isFlipped: boolean;
  onFlip: () => void;
  showHint: boolean;
  onToggleHint: () => void;
}) {
  return (
    <div 
      className="w-full max-w-xl mx-auto"
      style={{ perspective: '1000px' }}
    >
      <div
        onClick={onFlip}
        className="relative w-full cursor-pointer"
        style={{ paddingBottom: '66.67%' }}
      >
        <div
          className="absolute inset-0 transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0)',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 bg-stone-800 border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center overflow-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <p className="text-lg sm:text-xl font-medium text-white text-center leading-relaxed">
              {card.front}
            </p>
            {card.hint && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHint();
                }}
                className={cn(
                  "mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all",
                  showHint 
                    ? "bg-amber-500/20 text-amber-300" 
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                )}
              >
                <LightbulbIcon />
                {showHint ? card.hint : 'Hint'}
              </button>
            )}
            <p className="absolute bottom-3 text-white/25 text-xs">
              Tap to reveal
            </p>
          </div>

          {/* Back - with glow overlay */}
          <div
            className="absolute inset-0 bg-stone-800 border border-white/20 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center overflow-hidden"
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            {/* Glow overlay like floating widget */}
            <div 
              className="absolute inset-0 pointer-events-none rounded-2xl"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(52, 211, 153, 0.08) 0%, transparent 70%)',
              }}
            />
            {/* Border glow */}
            <div className="absolute inset-0 pointer-events-none rounded-2xl border border-emerald-500/20" />
            
            <p className="relative text-lg sm:text-xl font-medium text-white text-center leading-relaxed">
              {card.back}
            </p>
            {card.explanation && (
              <p className="relative mt-4 text-white/40 text-sm text-center max-w-sm">
                {card.explanation}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FlashcardStudyPage() {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [results, setResults] = useState<{ correct: number; wrong: number }>({ correct: 0, wrong: 0 });
  const [isComplete, setIsComplete] = useState(false);
  const [startTime] = useState(Date.now());

  const { data: setData, isLoading: setLoading } = useQuery({
    ...modelenceQuery<FlashcardSet>('flashcard.getFlashcardSet', { setId: setId! }),
    enabled: !!setId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: cards = [], isLoading: cardsLoading } = useQuery({
    ...modelenceQuery<StudyCard[]>('flashcard.getCardsForStudy', { setId: setId!, shuffled: true }),
    enabled: !!setId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { mutate: updateProgress } = useMutation({
    ...modelenceMutation('flashcard.updateCardProgress'),
  });

  const { mutate: recordSession } = useMutation({
    ...modelenceMutation('flashcard.recordStudySession'),
  });

  const currentCard = cards[currentIndex];

  const handleFlip = useCallback(() => {
    setIsFlipped(!isFlipped);
  }, [isFlipped]);

  const handleAnswer = useCallback((correct: boolean) => {
    if (!currentCard) return;

    updateProgress({ cardId: currentCard._id, correct });

    setResults(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      wrong: prev.wrong + (correct ? 0 : 1),
    }));

    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
      setShowHint(false);
    } else {
      setIsComplete(true);
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);
      recordSession({
        setId,
        cardsReviewed: cards.length,
        correctAnswers: results.correct + (correct ? 1 : 0),
        wrongAnswers: results.wrong + (correct ? 0 : 1),
        durationSeconds,
      });
    }
  }, [currentCard, currentIndex, cards.length, updateProgress, recordSession, setId, results, startTime]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!isFlipped) {
          handleFlip();
        }
      } else if (e.key === 'ArrowRight' || e.key === '1') {
        if (isFlipped) handleAnswer(true);
      } else if (e.key === 'ArrowLeft' || e.key === '2') {
        if (isFlipped) handleAnswer(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, handleFlip, handleAnswer]);

  const isLoading = setLoading || cardsLoading;

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

  if (isComplete) {
    const totalCards = cards.length;
    const score = Math.round((results.correct / totalCards) * 100);
    
    return (
      <Page variant="dark">
        <div className="container-sm py-8">
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-white">{score}%</span>
            </div>
            
            <h2 className="text-lg font-semibold text-white mb-1">Study Complete</h2>
            <p className="text-white/50 text-sm mb-6">
              {totalCards} cards · {results.correct} correct · {results.wrong} to review
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                onClick={() => {
                  setCurrentIndex(0);
                  setIsFlipped(false);
                  setShowHint(false);
                  setResults({ correct: 0, wrong: 0 });
                  setIsComplete(false);
                }}
                className="bg-white/5 hover:bg-white/10 text-white border border-white/10"
              >
                <RefreshIcon />
                Study Again
              </Button>
              <Button
                onClick={() => navigate('/my-flashcards')}
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

  return (
    <Page variant="dark">
      <div className="container-sm py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link 
            to="/my-flashcards"
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Back"
          >
            <ArrowLeftIcon />
          </Link>
          
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-medium text-white truncate">
              {setData?.title || 'Study'}
            </h1>
            <p className="text-xs text-white/40">Study Mode</p>
          </div>

          <div className="text-sm text-white/50 tabular-nums">
            {currentIndex + 1}/{cards.length}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/5 rounded-full mb-8 overflow-hidden">
          <div 
            className="h-full bg-white/30 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
          />
        </div>

        {/* Card */}
        {currentCard && (
          <FlashCard
            card={currentCard}
            isFlipped={isFlipped}
            onFlip={handleFlip}
            showHint={showHint}
            onToggleHint={() => setShowHint(!showHint)}
          />
        )}

        {/* Actions */}
        <div className="mt-6">
          {isFlipped ? (
            <div className="flex items-center justify-center gap-3">
              <Button
                onClick={() => handleAnswer(false)}
                className="h-11 px-5 bg-white/5 hover:bg-white/10 text-white/70 border border-white/10"
              >
                Need Review
              </Button>
              <Button
                onClick={() => handleAnswer(true)}
                className="h-11 px-5 bg-white/10 hover:bg-white/15 text-white border border-white/20"
              >
                I Know This
              </Button>
            </div>
          ) : (
            <p className="text-center text-white/25 text-xs">
              Space to flip
            </p>
          )}
        </div>
      </div>
    </Page>
  );
}
