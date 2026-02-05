import { Store, schema } from 'modelence/server';

export const dbUserProfiles = new Store('userProfiles', {
  schema: {
    userId: schema.userId(),
    nickname: schema.string(),
    pronouns: schema.string().optional(),
    isPublic: schema.boolean(),
    createdAt: schema.date(),
    updatedAt: schema.date(),
  },
  indexes: [
    { key: { userId: 1 } },
    { key: { nickname: 1 } },
    { key: { isPublic: 1 } },
  ]
});

export const dbDailyFocusActivity = new Store('dailyFocusActivity', {
  schema: {
    userId: schema.userId(),
    date: schema.string(),
    sessionCount: schema.number(),
    totalMinutes: schema.number(),
    completedSessions: schema.number(),
  },
  indexes: [
    { key: { userId: 1, date: 1 } },
    { key: { userId: 1 } },
  ]
});

export const dbFocusSessions = new Store('focusSessions', {
  schema: {
    intent: schema.string(),
    topic: schema.string(),
    minDuration: schema.number(),
    maxDuration: schema.number(),
    actualDuration: schema.number().optional(),
    repetitions: schema.number().optional(),
    breakDuration: schema.number().optional(),
    breakInterval: schema.number().optional(),
    currentRepetition: schema.number().optional(),
    status: schema.string(),
    createdAt: schema.date(),
    scheduledStartAt: schema.date().optional(),
    startedAt: schema.date().optional(),
    endedAt: schema.date().optional(),
    cooldownPrompt: schema.string().optional(),
    cohortId: schema.string().optional(),
    creatorId: schema.userId(),
    participantCount: schema.number(),
    matchingTags: schema.array(schema.string()),
    isPrivate: schema.boolean().optional(),
    inviteCode: schema.string().optional(),
    acceptedUserHashes: schema.array(schema.string()).optional(),
    chatEnabled: schema.boolean().optional(),
    creatorName: schema.string().optional(),
  },
  indexes: [
    { key: { status: 1, createdAt: -1 } },
    { key: { cohortId: 1 } },
    { key: { creatorId: 1 } },
    { key: { topic: 1, status: 1 } },
    { key: { inviteCode: 1 } },
  ]
});

export const dbSessionParticipants = new Store('sessionParticipants', {
  schema: {
    sessionId: schema.objectId(),
    odonym: schema.string(),
    joinedAt: schema.date(),
    leftAt: schema.date().optional(),
    isActive: schema.boolean(),
    lastReaction: schema.string().optional(),
    lastReactionAt: schema.date().optional(),
    outcome: schema.string().optional(),
    ledgerUpdated: schema.boolean().optional(),
    userHash: schema.string(),
  },
  indexes: [
    { key: { sessionId: 1 } },
    { key: { userHash: 1, sessionId: 1 } },
    { key: { sessionId: 1, isActive: 1 } },
    { key: { sessionId: 1, outcome: 1 } },
  ]
});

export const dbFocusLedger = new Store('focusLedger', {
  schema: {
    userId: schema.userId(),
    totalFocusMinutes: schema.number(),
    totalSessions: schema.number(),
    completedSessions: schema.number(),
    weeklyStats: schema.array(schema.object({
      weekStart: schema.date(),
      focusMinutes: schema.number(),
      sessionCount: schema.number(),
      avgSessionDuration: schema.number(),
      preferredTopics: schema.array(schema.string()),
      preferredDurations: schema.array(schema.number()),
    })),
    focusPatterns: schema.object({
      preferredDurationRange: schema.array(schema.number()),
      topTopics: schema.array(schema.string()),
      avgCompletionRate: schema.number(),
      focusStreak: schema.number(),
      lastActiveDate: schema.date().optional(),
    }),
    retentionWeeks: schema.number(),
    lastUpdated: schema.date(),
  },
  indexes: [
    { key: { userId: 1 } },
  ]
});

export const dbSessionMessages = new Store('sessionMessages', {
  schema: {
    sessionId: schema.objectId(),
    odonym: schema.string(),
    message: schema.string(),
    sentAt: schema.date(),
  },
  indexes: [
    { key: { sessionId: 1, sentAt: 1 } },
  ]
});
