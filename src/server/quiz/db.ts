import { Store, schema } from 'modelence/server';

export const dbQuizSets = new Store('quizSets', {
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

    questionCount: schema.number(),

    attemptCount: schema.number(),
    bestScore: schema.number().optional(),
    lastScore: schema.number().optional(),
    lastAttemptAt: schema.date().optional(),

    createdAt: schema.date(),
    updatedAt: schema.date(),
  },
  indexes: [
    { key: { userId: 1, createdAt: -1 } },
    { key: { isPublic: 1, createdAt: -1 } },
  ]
});

export const dbQuizQuestions = new Store('quizQuestions', {
  schema: {
    quizId: schema.objectId(),
    userId: schema.userId(),

    type: schema.string(),

    question: schema.string(),

    options: schema.array(schema.string()).optional(),
    correctAnswer: schema.string(),

    explanation: schema.string().optional(),

    timesAnswered: schema.number(),
    timesCorrect: schema.number(),

    order: schema.number(),

    createdAt: schema.date(),
  },
  indexes: [
    { key: { quizId: 1, order: 1 } },
    { key: { userId: 1 } },
  ]
});

export const dbQuizAttempts = new Store('quizAttempts', {
  schema: {
    quizId: schema.objectId(),
    userId: schema.userId(),

    totalQuestions: schema.number(),
    correctAnswers: schema.number(),
    score: schema.number(),

    answers: schema.array(schema.object({
      questionId: schema.string(),
      userAnswer: schema.string(),
      isCorrect: schema.boolean(),
    })),

    startedAt: schema.date(),
    completedAt: schema.date(),
    durationSeconds: schema.number(),
  },
  indexes: [
    { key: { userId: 1, completedAt: -1 } },
    { key: { quizId: 1, completedAt: -1 } },
  ]
});
