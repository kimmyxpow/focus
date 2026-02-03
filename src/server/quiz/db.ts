import { Store, schema } from 'modelence/server';

/**
 * Quiz Sets - A collection of quiz questions generated from uploaded material
 */
export const dbQuizSets = new Store('quizSets', {
  schema: {
    userId: schema.userId(),
    
    // Set metadata
    title: schema.string(),
    description: schema.string().optional(),
    topic: schema.string().optional(),
    
    // Visibility
    isPublic: schema.boolean(),
    creatorName: schema.string().optional(),
    
    // Source material info
    sourceType: schema.string(),  // 'text' | 'pdf' | 'txt'
    sourceFileName: schema.string().optional(),
    sourceTextPreview: schema.string().optional(),
    
    // Question counts
    questionCount: schema.number(),
    
    // Stats
    attemptCount: schema.number(),  // How many times this quiz has been taken
    bestScore: schema.number().optional(),
    lastScore: schema.number().optional(),
    lastAttemptAt: schema.date().optional(),
    
    // Timestamps
    createdAt: schema.date(),
    updatedAt: schema.date(),
  },
  indexes: [
    { key: { userId: 1, createdAt: -1 } },
    { key: { isPublic: 1, createdAt: -1 } },
  ]
});

/**
 * Quiz Questions - Individual questions in a quiz set
 * Supports: multiple_choice, true_false, fill_blank
 */
export const dbQuizQuestions = new Store('quizQuestions', {
  schema: {
    quizId: schema.objectId(),
    userId: schema.userId(),
    
    // Question type
    type: schema.string(),  // 'multiple_choice' | 'true_false' | 'fill_blank'
    
    // Question content
    question: schema.string(),
    
    // For multiple_choice: array of options, correctAnswer is the correct option text
    // For true_false: correctAnswer is 'true' or 'false'
    // For fill_blank: correctAnswer is the word/phrase to fill in
    options: schema.array(schema.string()).optional(),  // Only for multiple_choice
    correctAnswer: schema.string(),
    
    // Optional explanation shown after answering
    explanation: schema.string().optional(),
    
    // Stats
    timesAnswered: schema.number(),
    timesCorrect: schema.number(),
    
    // Order within quiz
    order: schema.number(),
    
    createdAt: schema.date(),
  },
  indexes: [
    { key: { quizId: 1, order: 1 } },
    { key: { userId: 1 } },
  ]
});

/**
 * Quiz Attempts - Track quiz attempts and results
 */
export const dbQuizAttempts = new Store('quizAttempts', {
  schema: {
    quizId: schema.objectId(),
    userId: schema.userId(),
    
    // Results
    totalQuestions: schema.number(),
    correctAnswers: schema.number(),
    score: schema.number(),  // Percentage 0-100
    
    // Per-question answers (for review)
    answers: schema.array(schema.object({
      questionId: schema.string(),
      userAnswer: schema.string(),
      isCorrect: schema.boolean(),
    })),
    
    // Duration
    startedAt: schema.date(),
    completedAt: schema.date(),
    durationSeconds: schema.number(),
  },
  indexes: [
    { key: { userId: 1, completedAt: -1 } },
    { key: { quizId: 1, completedAt: -1 } },
  ]
});
