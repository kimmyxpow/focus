import { Store, schema } from 'modelence/server';

/**
 * Flashcard Sets - A collection of flashcards generated from uploaded material
 */
export const dbFlashcardSets = new Store('flashcardSets', {
  schema: {
    userId: schema.userId(),
    
    // Set metadata
    title: schema.string(),
    description: schema.string().optional(),
    topic: schema.string().optional(),
    
    // Visibility
    isPublic: schema.boolean(),
    creatorName: schema.string().optional(),  // Display name for public sets
    
    // Source material info
    sourceType: schema.string(),  // 'text' | 'pdf' | 'txt'
    sourceFileName: schema.string().optional(),
    sourceTextPreview: schema.string().optional(),  // First 200 chars of source
    
    // Card counts
    cardCount: schema.number(),
    
    // Study progress
    lastStudiedAt: schema.date().optional(),
    studyCount: schema.number(),  // How many times this set has been studied
    
    // Quiz stats
    quizCount: schema.number(),  // How many times quizzed
    bestScore: schema.number().optional(),  // Best quiz percentage
    lastQuizScore: schema.number().optional(),
    
    // Timestamps
    createdAt: schema.date(),
    updatedAt: schema.date(),
  },
  indexes: [
    { key: { userId: 1, createdAt: -1 } },
    { key: { userId: 1, lastStudiedAt: -1 } },
    { key: { isPublic: 1, createdAt: -1 } },  // For public directory
  ]
});

/**
 * Flashcards - Individual cards in a set
 */
export const dbFlashcards = new Store('flashcards', {
  schema: {
    setId: schema.objectId(),
    userId: schema.userId(),
    
    // Card content
    front: schema.string(),  // Question or term
    back: schema.string(),   // Answer or definition
    
    // Optional extra content
    hint: schema.string().optional(),
    explanation: schema.string().optional(),
    
    // For quiz mode - wrong options for multiple choice
    wrongOptions: schema.array(schema.string()).optional(),
    
    // Learning progress (spaced repetition ready)
    difficulty: schema.number(),  // 0-1 scale, higher = harder
    lastReviewedAt: schema.date().optional(),
    nextReviewAt: schema.date().optional(),
    reviewCount: schema.number(),
    correctCount: schema.number(),
    
    // Order within set
    order: schema.number(),
    
    createdAt: schema.date(),
  },
  indexes: [
    { key: { setId: 1, order: 1 } },
    { key: { userId: 1 } },
    { key: { setId: 1, nextReviewAt: 1 } },
  ]
});

/**
 * Study Sessions - Track study/quiz attempts
 */
export const dbFlashcardStudySessions = new Store('flashcardStudySessions', {
  schema: {
    setId: schema.objectId(),
    userId: schema.userId(),
    
    // Session type
    mode: schema.string(),  // 'study' | 'quiz'
    
    // Stats
    cardsReviewed: schema.number(),
    correctAnswers: schema.number(),
    wrongAnswers: schema.number(),
    score: schema.number().optional(),  // Percentage for quiz mode
    
    // Duration
    startedAt: schema.date(),
    completedAt: schema.date().optional(),
    durationSeconds: schema.number().optional(),
  },
  indexes: [
    { key: { userId: 1, startedAt: -1 } },
    { key: { setId: 1, startedAt: -1 } },
  ]
});
