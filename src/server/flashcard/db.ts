import { Store, schema } from 'modelence/server';

export const dbFlashcardSets = new Store('flashcardSets', {
  schema: {
    userId: schema.userId(),
    

    title: schema.string(),
    description: schema.string().optional(),
    topic: schema.string().optional(),
    

    isPublic: schema.boolean(),
    creatorName: schema.string().optional(),
    

    sourceType: schema.string(),
    sourceFileName: schema.string().optional(),
    sourceTextPreview: schema.string().optional(),
    

    cardCount: schema.number(),
    

    lastStudiedAt: schema.date().optional(),
    studyCount: schema.number(),
    

    quizCount: schema.number(),
    bestScore: schema.number().optional(),
    lastQuizScore: schema.number().optional(),
    

    createdAt: schema.date(),
    updatedAt: schema.date(),
  },
  indexes: [
    { key: { userId: 1, createdAt: -1 } },
    { key: { userId: 1, lastStudiedAt: -1 } },
    { key: { isPublic: 1, createdAt: -1 } },
  ]
});

export const dbFlashcards = new Store('flashcards', {
  schema: {
    setId: schema.objectId(),
    userId: schema.userId(),
    

    front: schema.string(),
    back: schema.string(),
    

    hint: schema.string().optional(),
    explanation: schema.string().optional(),
    

    wrongOptions: schema.array(schema.string()).optional(),
    

    difficulty: schema.number(),
    lastReviewedAt: schema.date().optional(),
    nextReviewAt: schema.date().optional(),
    reviewCount: schema.number(),
    correctCount: schema.number(),
    

    order: schema.number(),
    
    createdAt: schema.date(),
  },
  indexes: [
    { key: { setId: 1, order: 1 } },
    { key: { userId: 1 } },
    { key: { setId: 1, nextReviewAt: 1 } },
  ]
});

export const dbFlashcardStudySessions = new Store('flashcardStudySessions', {
  schema: {
    setId: schema.objectId(),
    userId: schema.userId(),
    

    mode: schema.string(),
    

    cardsReviewed: schema.number(),
    correctAnswers: schema.number(),
    wrongAnswers: schema.number(),
    score: schema.number().optional(),
    

    startedAt: schema.date(),
    completedAt: schema.date().optional(),
    durationSeconds: schema.number().optional(),
  },
  indexes: [
    { key: { userId: 1, startedAt: -1 } },
    { key: { setId: 1, startedAt: -1 } },
  ]
});
