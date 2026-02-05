import { Store, schema } from 'modelence/server';

// User profiles - public profile information
export const dbUserProfiles = new Store('userProfiles', {
  schema: {
    userId: schema.userId(),
    nickname: schema.string(),              // Unique username/nickname
    pronouns: schema.string().optional(),   // Optional pronouns
    isPublic: schema.boolean(),             // Profile visibility for leaderboards
    createdAt: schema.date(),
    updatedAt: schema.date(),
  },
  indexes: [
    { key: { userId: 1 } },
    { key: { nickname: 1 } },
    { key: { isPublic: 1 } },
  ]
});

// Daily focus activity - for heatmap visualization
export const dbDailyFocusActivity = new Store('dailyFocusActivity', {
  schema: {
    userId: schema.userId(),
    date: schema.string(),                  // YYYY-MM-DD format for easy grouping
    sessionCount: schema.number(),          // Number of sessions completed
    totalMinutes: schema.number(),          // Total focus minutes
    completedSessions: schema.number(),     // Successfully completed sessions
  },
  indexes: [
    { key: { userId: 1, date: 1 } },
    { key: { userId: 1 } },
  ]
});

// Focus sessions - the core unit of the application
export const dbFocusSessions = new Store('focusSessions', {
  schema: {
    // Session metadata
    intent: schema.string(),           // Short description of focus intent
    topic: schema.string(),            // Topic/category
    minDuration: schema.number(),      // Minimum duration in minutes
    maxDuration: schema.number(),      // Maximum duration in minutes
    actualDuration: schema.number().optional(), // Actual duration after completion

    // Session settings (for multi-session/pomodoro patterns)
    repetitions: schema.number().optional(),      // Number of session repetitions (default: 1)
    breakDuration: schema.number().optional(),    // Break duration in minutes (default: 5)
    breakInterval: schema.number().optional(),    // Take break every X sessions (default: 1)
    currentRepetition: schema.number().optional(), // Current repetition (1-indexed)

    // Session state
    status: schema.string(),           // 'waiting' | 'focusing' | 'break' | 'cooldown' | 'completed' | 'cancelled'
    createdAt: schema.date(),
    scheduledStartAt: schema.date().optional(),
    startedAt: schema.date().optional(),
    endedAt: schema.date().optional(),

    // AI-generated content
    cooldownPrompt: schema.string().optional(),

    // Cohort info
    cohortId: schema.string().optional(),
    creatorId: schema.userId(),
    participantCount: schema.number(),

    // AI matching metadata
    matchingTags: schema.array(schema.string()),

    // Privacy settings
    isPrivate: schema.boolean().optional(),    // If true, hidden from public feed
    inviteCode: schema.string().optional(),    // Unique invite code for sharing
    acceptedUserHashes: schema.array(schema.string()).optional(), // Users who accepted the invite (for private sessions)

    // Chat settings
    chatEnabled: schema.boolean().optional(),  // If true, participants can chat

    // Creator info (for display purposes)
    creatorName: schema.string().optional(),   // Display name of creator
  },
  indexes: [
    { key: { status: 1, createdAt: -1 } },
    { key: { cohortId: 1 } },
    { key: { creatorId: 1 } },
    { key: { topic: 1, status: 1 } },
    { key: { inviteCode: 1 } },
  ]
});

// Session participants - tracks who is in each session
export const dbSessionParticipants = new Store('sessionParticipants', {
  schema: {
    sessionId: schema.objectId(),
    odonym: schema.string(),           // Anonymous identifier shown during session
    joinedAt: schema.date(),
    leftAt: schema.date().optional(),
    isActive: schema.boolean(),

    // Minimal reactions (no chat)
    lastReaction: schema.string().optional(),  // 'focus' | 'energy' | 'break'
    lastReactionAt: schema.date().optional(),

    // Post-session outcome
    outcome: schema.string().optional(),       // 'completed' | 'partial' | 'interrupted'
    
    // Flag to track if focus ledger has been updated for this participant
    ledgerUpdated: schema.boolean().optional(),

    // Anonymous user reference (hashed)
    userHash: schema.string(),
  },
  indexes: [
    { key: { sessionId: 1 } },
    { key: { userHash: 1, sessionId: 1 } },
    { key: { sessionId: 1, isActive: 1 } },
    { key: { sessionId: 1, outcome: 1 } }, // Index for counting completed participants
  ]
});

// Focus ledger - privacy-preserving aggregated focus data per user
export const dbFocusLedger = new Store('focusLedger', {
  schema: {
    userId: schema.userId(),

    // Aggregated stats (no individual session details)
    totalFocusMinutes: schema.number(),
    totalSessions: schema.number(),
    completedSessions: schema.number(),

    // Weekly aggregates for pattern analysis
    weeklyStats: schema.array(schema.object({
      weekStart: schema.date(),
      focusMinutes: schema.number(),
      sessionCount: schema.number(),
      avgSessionDuration: schema.number(),
      preferredTopics: schema.array(schema.string()),
      preferredDurations: schema.array(schema.number()),
    })),

    // Focus patterns (anonymized, derived)
    focusPatterns: schema.object({
      preferredDurationRange: schema.array(schema.number()),
      topTopics: schema.array(schema.string()),
      avgCompletionRate: schema.number(),
      focusStreak: schema.number(),
      lastActiveDate: schema.date().optional(),
    }),

    // User-controlled retention
    retentionWeeks: schema.number(),  // How many weeks of data to keep
    lastUpdated: schema.date(),
  },
  indexes: [
    { key: { userId: 1 } },
  ]
});

// Session chat messages
export const dbSessionMessages = new Store('sessionMessages', {
  schema: {
    sessionId: schema.objectId(),
    odonym: schema.string(),           // Anonymous sender name
    message: schema.string(),
    sentAt: schema.date(),
  },
  indexes: [
    { key: { sessionId: 1, sentAt: 1 } },
  ]
});

