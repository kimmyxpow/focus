import z from 'zod';
import crypto from 'crypto';
import { AuthError } from 'modelence';
import { Module, ObjectId, UserInfo } from 'modelence/server';
import { dbFocusSessions, dbSessionParticipants, dbFocusLedger, dbCohortMetrics, dbSessionMessages, dbUserProfiles, dbDailyFocusActivity } from './db';
import {
  generateCohortMatches,
  generateWarmupPrompt,
  generateCooldownPrompt,
  generateSessionSummary,
  generateNextStepSuggestion,
  predictOptimalDuration,
} from './ai';
import { sessionServerChannel, chatServerChannel } from '../channels';

// Helper to create anonymous user hash for privacy
function createUserHash(userId: string, sessionSalt: string): string {
  return crypto.createHash('sha256').update(`${userId}:${sessionSalt}`).digest('hex').substring(0, 16);
}

// Helper to generate anonymous odonym
function generateOdonym(): string {
  const adjectives = ['Focused', 'Calm', 'Steady', 'Deep', 'Clear', 'Bright', 'Swift', 'Quiet'];
  const nouns = ['Oak', 'River', 'Mountain', 'Cloud', 'Star', 'Wave', 'Stone', 'Wind'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

// Helper to generate unique invite code
function generateInviteCode(): string {
  return crypto.randomBytes(6).toString('base64url');
}

// Helper to get user's nickname (creates profile if needed)
async function getUserNickname(userId: string): Promise<string> {
  const profile = await dbUserProfiles.findOne({ userId: new ObjectId(userId) });
  if (profile) {
    return profile.nickname;
  }
  // Return a default based on user ID if no profile exists
  return `User${userId.slice(-6)}`;
}

// Helper to format date as YYYY-MM-DD
function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper to find userId from userHash by checking all users' profiles
// This is used to update focus ledger when we only have the userHash
async function findUserIdFromHash(userHash: string, sessionId: string): Promise<string | null> {
  // Get all user profiles to find matching userId
  const profiles = await dbUserProfiles.fetch({}, { limit: 1000 });
  
  for (const profile of profiles) {
    const testHash = createUserHash(profile.userId.toString(), sessionId);
    if (testHash === userHash) {
      return profile.userId.toString();
    }
  }
  
  // If no profile found, try to match against focus ledgers
  const ledgers = await dbFocusLedger.fetch({}, { limit: 1000 });
  
  for (const ledger of ledgers) {
    const testHash = createUserHash(ledger.userId.toString(), sessionId);
    if (testHash === userHash) {
      return ledger.userId.toString();
    }
  }
  
  return null;
}

// Helper to check if user has an active session in another session
async function hasActiveSessionElsewhere(userId: string, excludeSessionId?: string): Promise<{ hasActive: boolean; activeSessionId?: string }> {
  // Get all participations for this user
  const participations = await dbSessionParticipants.fetch({}, { limit: 500 });
  
  for (const p of participations) {
    // Skip the session we're trying to join/rejoin
    if (excludeSessionId && p.sessionId.toString() === excludeSessionId) {
      continue;
    }
    
    // Check if this participation belongs to the user
    const userHash = createUserHash(userId, p.sessionId.toString());
    if (p.userHash === userHash && p.isActive) {
      // Check if the session is still active (not completed/cancelled)
      const session = await dbFocusSessions.findOne({
        _id: p.sessionId,
        status: { $in: ['waiting', 'warmup', 'focusing', 'break', 'cooldown'] },
      });
      
      if (session) {
        return { hasActive: true, activeSessionId: session._id.toString() };
      }
    }
  }
  
  return { hasActive: false };
}

export default new Module('focus', {
  stores: [dbFocusSessions, dbSessionParticipants, dbFocusLedger, dbCohortMetrics, dbSessionMessages, dbUserProfiles, dbDailyFocusActivity],
  channels: [sessionServerChannel, chatServerChannel],

  queries: {
    // Get user's active session (for navbar indicator)
    getActiveSession: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        return null;
      }

      // Get all sessions where user is a participant
      const participations = await dbSessionParticipants.fetch({}, { limit: 500 });

      // Find user's active participation
      let activeParticipation = null;
      for (const p of participations) {
        const userHash = createUserHash(user.id, p.sessionId.toString());
        if (p.userHash === userHash && p.isActive) {
          activeParticipation = p;
          break;
        }
      }

      if (!activeParticipation) {
        return null;
      }

      // Get the session details
      const session = await dbFocusSessions.findOne({
        _id: activeParticipation.sessionId,
        status: { $in: ['waiting', 'warmup', 'focusing', 'break', 'cooldown'] },
      });

      if (!session) {
        return null;
      }

      // Calculate timer if focusing
      let remainingSeconds = 0;
      if (session.startedAt && session.status === 'focusing') {
        const targetDuration = session.actualDuration || session.maxDuration;
        const elapsedSeconds = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);
        remainingSeconds = Math.max(0, targetDuration * 60 - elapsedSeconds);
      }

      return {
        sessionId: session._id.toString(),
        topic: session.topic,
        status: session.status,
        isActiveParticipant: true,
        timer: {
          remainingSeconds,
          serverTimestamp: Date.now(),
        },
      };
    },

    // Get active/waiting sessions for the landing page
    getActiveSessions: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      // Get public sessions (not private) for the main feed
      const sessions = await dbFocusSessions.fetch(
        {
          status: { $in: ['waiting', 'warmup', 'focusing'] },
          $or: [{ isPrivate: { $ne: true } }, { isPrivate: false }],
        },
        { sort: { createdAt: -1 }, limit: 20 }
      );

      const results = [];
      for (const session of sessions) {
        const isCreator = user ? session.creatorId.toString() === user.id : false;
        const participationInfo = user ? await getUserParticipation(user.id, session._id.toString()) : null;
        const isParticipant = participationInfo !== null;
        const isActiveParticipant = participationInfo?.isActive ?? false;

        results.push({
          _id: session._id.toString(),
          intent: session.intent,
          topic: session.topic,
          minDuration: session.minDuration,
          maxDuration: session.maxDuration,
          status: session.status,
          participantCount: session.participantCount,
          createdAt: session.createdAt,
          scheduledStartAt: session.scheduledStartAt,
          startedAt: session.startedAt,
          matchingTags: session.matchingTags,
          isParticipant,
          isActiveParticipant,
          isCreator,
          chatEnabled: session.chatEnabled ?? false,
          creatorName: session.creatorName,
          isPrivate: session.isPrivate ?? false,
        });
      }
      return results;
    },

    // Get user's own rooms (created or participated, including private)
    getMyRooms: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        return [];
      }

      // Get sessions created by user (including private)
      const createdSessions = await dbFocusSessions.fetch(
        {
          creatorId: new ObjectId(user.id),
          status: { $in: ['waiting', 'warmup', 'focusing'] },
        },
        { sort: { createdAt: -1 }, limit: 10 }
      );

      // Get all participations to find rooms where user participated
      const participations = await dbSessionParticipants.fetch({}, { limit: 100 });
      const participatedSessionIds: string[] = [];

      for (const p of participations) {
        const userHash = createUserHash(user.id, p.sessionId.toString());
        if (p.userHash === userHash) {
          participatedSessionIds.push(p.sessionId.toString());
        }
      }

      // Get participated sessions not created by user
      const createdSessionIds = createdSessions.map(s => s._id.toString());
      const otherSessionIds = participatedSessionIds.filter(id => !createdSessionIds.includes(id));

      const participatedSessions = otherSessionIds.length > 0
        ? await dbFocusSessions.fetch(
            {
              _id: { $in: otherSessionIds.map(id => new ObjectId(id)) },
              status: { $in: ['waiting', 'warmup', 'focusing'] },
            },
            { sort: { createdAt: -1 }, limit: 10 }
          )
        : [];

      const allSessions = [...createdSessions, ...participatedSessions];

      // Deduplicate and sort
      const uniqueSessions = allSessions
        .filter((s, i, arr) => arr.findIndex(x => x._id.toString() === s._id.toString()) === i)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const results = [];
      for (const session of uniqueSessions) {
        const isCreator = session.creatorId.toString() === user.id;
        const participationInfo = await getUserParticipation(user.id, session._id.toString());
        const isActiveParticipant = participationInfo?.isActive ?? false;

        results.push({
          _id: session._id.toString(),
          intent: session.intent,
          topic: session.topic,
          minDuration: session.minDuration,
          maxDuration: session.maxDuration,
          status: session.status,
          participantCount: session.participantCount,
          createdAt: session.createdAt,
          startedAt: session.startedAt,
          isCreator,
          isActiveParticipant,
          isPrivate: session.isPrivate ?? false,
          inviteCode: session.inviteCode,
          chatEnabled: session.chatEnabled ?? false,
        });
      }

      return results;
    },

    // Get AI-suggested cohorts for a user
    getSuggestedCohorts: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        return [];
      }

      const { intent, topic, minDuration, maxDuration } = z.object({
        intent: z.string().optional(),
        topic: z.string().optional(),
        minDuration: z.number().optional(),
        maxDuration: z.number().optional(),
      }).parse(args);

      // Get user's focus patterns
      const ledger = await dbFocusLedger.findOne({ userId: new ObjectId(user.id) });
      const focusPatterns = ledger?.focusPatterns;

      // Get available sessions
      const availableSessions = await dbFocusSessions.fetch(
        { status: 'waiting' },
        { limit: 50 }
      );

      // Generate AI-powered cohort matches
      const matches = await generateCohortMatches({
        userIntent: intent,
        userTopic: topic,
        userDurationRange: minDuration && maxDuration ? [minDuration, maxDuration] : undefined,
        userPatterns: focusPatterns,
        availableSessions: availableSessions.map(s => ({
          id: s._id.toString(),
          intent: s.intent,
          topic: s.topic,
          durationRange: [s.minDuration, s.maxDuration],
          participantCount: s.participantCount,
          matchingTags: s.matchingTags,
        })),
      });

      return matches;
    },

    // Get session details including timer state
    getSession: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const { sessionId } = z.object({ sessionId: z.string() }).parse(args);

      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });
      if (!session) {
        throw new Error('Session not found');
      }

      // Get active participants (anonymous)
      const participants = await dbSessionParticipants.fetch(
        { sessionId: new ObjectId(sessionId), isActive: true }
      );

      // Calculate server-authoritative timer
      let remainingSeconds = 0;
      let elapsedSeconds = 0;
      const targetDuration = session.actualDuration || session.maxDuration;

      if (session.startedAt && session.status === 'focusing') {
        elapsedSeconds = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);
        remainingSeconds = Math.max(0, targetDuration * 60 - elapsedSeconds);
      }

      // Check if user is participant
      let userParticipant = null;
      if (user) {
        const userHash = createUserHash(user.id, sessionId);
        userParticipant = await dbSessionParticipants.findOne({
          sessionId: new ObjectId(sessionId),
          userHash,
        });
      }

      return {
        _id: session._id.toString(),
        intent: session.intent,
        topic: session.topic,
        minDuration: session.minDuration,
        maxDuration: session.maxDuration,
        actualDuration: session.actualDuration,
        status: session.status,
        createdAt: session.createdAt,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        warmupPrompt: session.warmupPrompt,
        cooldownPrompt: session.cooldownPrompt,
        participantCount: session.participantCount,

        // Session settings
        repetitions: session.repetitions || 1,
        breakDuration: session.breakDuration || 5,
        breakInterval: session.breakInterval || 1,
        currentRepetition: session.currentRepetition || 1,

        // Timer state (server-authoritative)
        timer: {
          remainingSeconds,
          elapsedSeconds,
          targetDurationMinutes: targetDuration,
          serverTimestamp: Date.now(),
        },

        // Anonymous participant indicators
        participants: participants.map(p => ({
          odonym: p.odonym,
          lastReaction: p.lastReaction,
          isActive: p.isActive,
        })),

        // User's participation status (includes active status for rejoin logic)
        userParticipation: userParticipant ? {
          odonym: userParticipant.odonym,
          outcome: userParticipant.outcome,
          isActive: userParticipant.isActive,
        } : null,

        // Is user the creator?
        isCreator: user ? session.creatorId.toString() === user.id : false,

        // Privacy and invite
        isPrivate: session.isPrivate ?? false,
        inviteCode: session.inviteCode,

        // Chat
        chatEnabled: session.chatEnabled ?? false,
        creatorName: session.creatorName,
      };
    },

    // Get chat messages for a session
    getSessionMessages: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId, limit: messageLimit } = z.object({
        sessionId: z.string(),
        limit: z.number().min(1).max(100).optional().default(50),
      }).parse(args);

      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });
      if (!session) {
        throw new Error('Session not found');
      }

      if (!session.chatEnabled) {
        return [];
      }

      // Verify user is a participant
      const userHash = createUserHash(user.id, sessionId);
      const participant = await dbSessionParticipants.findOne({
        sessionId: new ObjectId(sessionId),
        userHash,
      });

      if (!participant) {
        throw new AuthError('Not a participant of this session');
      }

      const messages = await dbSessionMessages.fetch(
        { sessionId: new ObjectId(sessionId) },
        { sort: { sentAt: -1 }, limit: messageLimit }
      );

      return messages.reverse().map(m => ({
        id: m._id.toString(),
        odonym: m.odonym,
        message: m.message,
        sentAt: m.sentAt,
        isOwn: m.odonym === participant.odonym,
      }));
    },

    // Get session by invite code
    getSessionByInvite: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const { inviteCode } = z.object({ inviteCode: z.string() }).parse(args);

      const session = await dbFocusSessions.findOne({ inviteCode });
      if (!session) {
        throw new Error('Invalid invite link');
      }

      if (session.status === 'completed' || session.status === 'cancelled') {
        throw new Error('This session has ended');
      }

      // Check if user has already accepted the invite (for private sessions)
      let hasAcceptedInvite = false;
      if (user && session.isPrivate) {
        const userHash = createUserHash(user.id, session._id.toString());
        hasAcceptedInvite = session.acceptedUserHashes?.includes(userHash) ?? false;
      }

      // For private sessions, also check if user is the creator
      const isCreator = user ? session.creatorId.toString() === user.id : false;

      return {
        sessionId: session._id.toString(),
        topic: session.topic,
        intent: session.intent,
        status: session.status,
        participantCount: session.participantCount,
        isPrivate: session.isPrivate ?? false,
        hasAcceptedInvite,
        isCreator,
        creatorName: session.creatorName,
        minDuration: session.minDuration,
        maxDuration: session.maxDuration,
      };
    },

    // Get session summary after completion
    getSessionSummary: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId } = z.object({ sessionId: z.string() }).parse(args);

      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });
      if (!session) {
        throw new Error('Session not found');
      }

      // Verify user was a participant
      const userHash = createUserHash(user.id, sessionId);
      const participant = await dbSessionParticipants.findOne({
        sessionId: new ObjectId(sessionId),
        userHash,
      });

      if (!participant) {
        throw new AuthError('Not a participant of this session');
      }

      // Auto-update focus ledger if participant has an outcome but ledger hasn't been updated yet
      // This ensures stats are recorded even if user skips the outcome selection
      if (participant.outcome && !participant.ledgerUpdated) {
        await updateFocusLedger(user.id, session, participant.outcome);
        // Mark ledger as updated to prevent duplicate updates
        await dbSessionParticipants.updateOne(
          { _id: participant._id },
          { $set: { ledgerUpdated: true } }
        );
      }

      // Get participant count for summary
      const allParticipants = await dbSessionParticipants.fetch({
        sessionId: new ObjectId(sessionId),
      });
      const totalParticipants = allParticipants.length;

      const completedParticipantsList = await dbSessionParticipants.fetch({
        sessionId: new ObjectId(sessionId),
        outcome: 'completed',
      });
      const completedParticipants = completedParticipantsList.length;

      // Generate AI summary
      const summary = await generateSessionSummary({
        intent: session.intent,
        topic: session.topic,
        duration: session.actualDuration || session.maxDuration,
        participantOutcome: participant.outcome || 'completed',
        cohortCompletionRate: totalParticipants > 0 ? completedParticipants / totalParticipants : 1,
      });

      // Generate next step suggestion
      const nextStep = await generateNextStepSuggestion({
        topic: session.topic,
        completedDuration: session.actualDuration || session.maxDuration,
        outcome: participant.outcome || 'completed',
      });

      return {
        sessionId: session._id.toString(),
        intent: session.intent,
        topic: session.topic,
        duration: session.actualDuration || session.maxDuration,
        userOutcome: participant.outcome,
        cohortStats: {
          totalParticipants,
          completedCount: completedParticipants,
        },
        aiSummary: summary,
        aiNextStep: nextStep,
        focusMinutesEarned: participant.outcome === 'completed'
          ? (session.actualDuration || session.maxDuration)
          : Math.floor((session.actualDuration || session.maxDuration) * 0.5),
      };
    },

    // Get personal focus overview
    getFocusOverview: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const ledger = await dbFocusLedger.findOne({ userId: new ObjectId(user.id) });

      if (!ledger) {
        return {
          totalFocusMinutes: 0,
          totalSessions: 0,
          completedSessions: 0,
          completionRate: 0,
          weeklyStats: [],
          focusPatterns: null,
          focusStreak: 0,
        };
      }

      return {
        totalFocusMinutes: ledger.totalFocusMinutes,
        totalSessions: ledger.totalSessions,
        completedSessions: ledger.completedSessions,
        completionRate: ledger.totalSessions > 0
          ? ledger.completedSessions / ledger.totalSessions
          : 0,
        weeklyStats: ledger.weeklyStats.slice(-8), // Last 8 weeks
        focusPatterns: ledger.focusPatterns,
        focusStreak: ledger.focusPatterns.focusStreak,
      };
    },

    // Get user's session history (created and participated)
    getUserSessions: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      // Get sessions created by this user
      const createdSessions = await dbFocusSessions.fetch(
        { creatorId: new ObjectId(user.id) },
        { sort: { createdAt: -1 }, limit: 20 }
      );

      // Get all sessions where user participated
      const participations = await dbSessionParticipants.fetch(
        {},
        { limit: 100 }
      );

      // Filter participations by user hash (need to check each session)
      const participatedSessionIds: string[] = [];
      for (const p of participations) {
        const userHash = createUserHash(user.id, p.sessionId.toString());
        if (p.userHash === userHash) {
          participatedSessionIds.push(p.sessionId.toString());
        }
      }

      // Get participated sessions (excluding ones they created)
      const createdSessionIds = createdSessions.map(s => s._id.toString());
      const otherSessionIds = participatedSessionIds.filter(id => !createdSessionIds.includes(id));

      const participatedSessions = otherSessionIds.length > 0
        ? await dbFocusSessions.fetch(
            { _id: { $in: otherSessionIds.map(id => new ObjectId(id)) } },
            { sort: { createdAt: -1 }, limit: 20 }
          )
        : [];

      // Combine and format
      const allSessions = [...createdSessions, ...participatedSessions];

      // Sort by date and remove duplicates
      const uniqueSessions = allSessions
        .filter((s, i, arr) => arr.findIndex(x => x._id.toString() === s._id.toString()) === i)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20);

      return uniqueSessions.map(s => {
        // Check if user is currently an active participant
        const userHash = createUserHash(user.id, s._id.toString());
        const participation = participations.find(p => p.sessionId.toString() === s._id.toString() && p.userHash === userHash);
        const isActiveParticipant = participation?.isActiveParticipant ?? false;

        return {
          _id: s._id.toString(),
          intent: s.intent,
          topic: s.topic,
          duration: s.actualDuration || s.maxDuration,
          status: s.status,
          createdAt: s.createdAt,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          participantCount: s.participantCount,
          isCreator: s.creatorId.toString() === user.id,
          isActiveParticipant,
        };
      });
    },

    // Get user's profile
    getMyProfile: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const profile = await dbUserProfiles.findOne({ userId: new ObjectId(user.id) });
      const ledger = await dbFocusLedger.findOne({ userId: new ObjectId(user.id) });

      if (!profile) {
        // Return null to indicate profile needs to be created
        return null;
      }

      return {
        nickname: profile.nickname,
        pronouns: profile.pronouns,
        isPublic: profile.isPublic,
        stats: ledger ? {
          totalFocusMinutes: ledger.totalFocusMinutes,
          totalSessions: ledger.totalSessions,
          completedSessions: ledger.completedSessions,
          focusStreak: ledger.focusPatterns?.focusStreak || 0,
        } : {
          totalFocusMinutes: 0,
          totalSessions: 0,
          completedSessions: 0,
          focusStreak: 0,
        },
      };
    },

    // Check if a nickname is available
    checkNicknameAvailable: async (args: unknown, _context: { user: UserInfo | null }) => {
      const { nickname } = z.object({ nickname: z.string().min(3).max(20) }).parse(args);

      const existing = await dbUserProfiles.findOne({
        nickname: { $regex: new RegExp(`^${nickname}$`, 'i') },
      });

      return { available: !existing };
    },

    // Get public profile by nickname
    getPublicProfile: async (args: unknown, _context: { user: UserInfo | null }) => {
      const { nickname } = z.object({ nickname: z.string() }).parse(args);

      const profile = await dbUserProfiles.findOne({ nickname });
      if (!profile || !profile.isPublic) {
        return null;
      }

      const ledger = await dbFocusLedger.findOne({ userId: profile.userId });

      return {
        nickname: profile.nickname,
        pronouns: profile.pronouns,
        stats: ledger ? {
          totalFocusMinutes: ledger.totalFocusMinutes,
          totalSessions: ledger.totalSessions,
          completedSessions: ledger.completedSessions,
          focusStreak: ledger.focusPatterns?.focusStreak || 0,
        } : {
          totalFocusMinutes: 0,
          totalSessions: 0,
          completedSessions: 0,
          focusStreak: 0,
        },
      };
    },

    // Get focus heatmap data for current user
    getFocusHeatmap: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { year } = z.object({
        year: z.number().optional(),
      }).parse(args);

      const targetYear = year || new Date().getFullYear();
      const startDate = `${targetYear}-01-01`;
      const endDate = `${targetYear}-12-31`;

      const activities = await dbDailyFocusActivity.fetch({
        userId: new ObjectId(user.id),
        date: { $gte: startDate, $lte: endDate },
      });

      // Convert to a map for easy lookup
      const activityMap: Record<string, { sessionCount: number; totalMinutes: number; completedSessions: number }> = {};
      for (const activity of activities) {
        activityMap[activity.date] = {
          sessionCount: activity.sessionCount,
          totalMinutes: activity.totalMinutes,
          completedSessions: activity.completedSessions,
        };
      }

      return {
        year: targetYear,
        activities: activityMap,
      };
    },

    // Get leaderboard data
    getLeaderboard: async (args: unknown, _context: { user: UserInfo | null }) => {
      const { timeFilter, sortBy, limit: resultLimit } = z.object({
        timeFilter: z.enum(['all', 'month', 'week']).optional().default('all'),
        sortBy: z.enum(['focusMinutes', 'sessions', 'streak']).optional().default('focusMinutes'),
        limit: z.number().min(1).max(100).optional().default(50),
      }).parse(args);

      // Get all public profiles
      const publicProfiles = await dbUserProfiles.fetch({ isPublic: true });
      const publicUserIds = publicProfiles.map(p => p.userId);

      if (publicUserIds.length === 0) {
        return [];
      }

      // Get ledgers for public users
      const ledgers = await dbFocusLedger.fetch({
        userId: { $in: publicUserIds },
      });

      // Create profile lookup map
      const profileMap = new Map(publicProfiles.map(p => [p.userId.toString(), p]));

      // Calculate scores based on time filter
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const leaderboardEntries = ledgers.map(ledger => {
        const profile = profileMap.get(ledger.userId.toString());
        if (!profile) return null;

        let focusMinutes = ledger.totalFocusMinutes;
        let sessions = ledger.totalSessions;

        // Apply time filter for weekly stats
        if (timeFilter !== 'all' && ledger.weeklyStats) {
          const cutoffDate = timeFilter === 'week' ? weekAgo : monthAgo;
          const recentStats = ledger.weeklyStats.filter(
            (w: { weekStart: Date }) => new Date(w.weekStart) >= cutoffDate
          );
          focusMinutes = recentStats.reduce((sum: number, w: { focusMinutes: number }) => sum + w.focusMinutes, 0);
          sessions = recentStats.reduce((sum: number, w: { sessionCount: number }) => sum + w.sessionCount, 0);
        }

        // Only include users who have actual focus data
        // Filter out users with 0 focus minutes or 0 sessions
        if (focusMinutes === 0 && sessions === 0) return null;

        return {
          nickname: profile.nickname,
          pronouns: profile.pronouns,
          focusMinutes,
          sessions,
          streak: ledger.focusPatterns?.focusStreak || 0,
        };
      }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

      // Sort based on criteria
      leaderboardEntries.sort((a, b) => {
        if (sortBy === 'focusMinutes') return b.focusMinutes - a.focusMinutes;
        if (sortBy === 'sessions') return b.sessions - a.sessions;
        return b.streak - a.streak;
      });

      // Add rank and return
      return leaderboardEntries.slice(0, resultLimit).map((entry, index) => ({
        rank: index + 1,
        ...entry,
      }));
    },
  },

  mutations: {
    // Create a new focus session
    createSession: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      // Check if user already has an active session
      const { hasActive } = await hasActiveSessionElsewhere(user.id);
      if (hasActive) {
        throw new Error('You are already participating in an active session. Please leave your current session first before creating a new one.');
      }

      const { intent, topic, minDuration, maxDuration, repetitions, breakDuration, breakInterval, isPrivate, chatEnabled } = z.object({
        intent: z.string().min(1).max(200),
        topic: z.string().min(1).max(50),
        minDuration: z.number().min(5).max(120),
        maxDuration: z.number().min(5).max(120),
        repetitions: z.number().min(1).max(10).optional().default(1),
        breakDuration: z.number().min(1).max(30).optional().default(5),
        breakInterval: z.number().min(1).max(10).optional().default(1),
        isPrivate: z.boolean().optional().default(false),
        chatEnabled: z.boolean().optional().default(false),
      }).parse(args);

      if (minDuration > maxDuration) {
        throw new Error('Minimum duration cannot exceed maximum duration');
      }

      // Get user's focus patterns for AI optimization
      const ledger = await dbFocusLedger.findOne({ userId: new ObjectId(user.id) });

      // Predict optimal duration based on patterns
      const predictedDuration = await predictOptimalDuration({
        requestedRange: [minDuration, maxDuration],
        userPatterns: ledger?.focusPatterns,
        topic,
      });

      // Generate matching tags for cohort formation
      const matchingTags = generateMatchingTags(intent, topic);

      // Generate warmup prompt
      const warmupPrompt = await generateWarmupPrompt({ intent, topic, duration: predictedDuration });

      const sessionId = new ObjectId();
      const inviteCode = generateInviteCode();

      // Get creator's nickname from profile
      const creatorNickname = await getUserNickname(user.id);

      await dbFocusSessions.insertOne({
        _id: sessionId,
        intent,
        topic,
        minDuration,
        maxDuration,
        actualDuration: predictedDuration,
        repetitions,
        breakDuration,
        breakInterval,
        currentRepetition: 1,
        status: 'waiting',
        createdAt: new Date(),
        creatorId: new ObjectId(user.id),
        participantCount: 1,
        matchingTags,
        warmupPrompt,
        isPrivate,
        inviteCode,
        chatEnabled,
        creatorName: creatorNickname,
      });

      // Auto-join creator as participant
      const userHash = createUserHash(user.id, sessionId.toString());
      await dbSessionParticipants.insertOne({
        sessionId,
        userHash,
        odonym: generateOdonym(),
        joinedAt: new Date(),
        isActive: true,
      });

      return { sessionId: sessionId.toString() };
    },

    // Join an existing session
    joinSession: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId } = z.object({ sessionId: z.string() }).parse(args);

      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });
      if (!session) {
        throw new Error('Session not found');
      }

      // Check if already joined (for re-entry scenarios)
      const userHash = createUserHash(user.id, sessionId);
      const existing = await dbSessionParticipants.findOne({ sessionId: new ObjectId(sessionId), userHash });

      if (existing) {
        // Allow re-entry if previously left, regardless of session status (except completed/cancelled)
        if (session.status === 'completed' || session.status === 'cancelled') {
          throw new Error('Session has ended');
        }

        // Rejoin if left
        if (!existing.isActive) {
          // Check if user has another active session before allowing rejoin
          const { hasActive } = await hasActiveSessionElsewhere(user.id, sessionId);
          if (hasActive) {
            throw new Error('You are already in another active session. Please leave that session first before rejoining this one.');
          }

          await dbSessionParticipants.updateOne(
            { _id: existing._id },
            { $set: { isActive: true, leftAt: undefined, outcome: undefined } }
          );
          await dbFocusSessions.updateOne(
            { _id: new ObjectId(sessionId) },
            { $inc: { participantCount: 1 } }
          );
          
          // Broadcast participant rejoined event
          sessionServerChannel.broadcast(sessionId, {
            type: 'participant_joined',
            sessionId,
            timestamp: Date.now(),
            participant: { odonym: existing.odonym, isActive: true },
            participantCount: session.participantCount + 1,
          });
        }
        return { odonym: existing.odonym, rejoined: !existing.isActive };
      }

      // New participant - only allow in waiting/warmup states
      if (session.status !== 'waiting' && session.status !== 'warmup') {
        throw new Error('Session is no longer accepting new participants');
      }

      // Check if user already has an active session elsewhere
      const { hasActive } = await hasActiveSessionElsewhere(user.id, sessionId);
      if (hasActive) {
        throw new Error(`You are already participating in another active session. Please leave your current session first before joining a new one.`);
      }

      // For private sessions, check if user has accepted the invite (unless they're the creator)
      if (session.isPrivate && session.creatorId.toString() !== user.id) {
        const hasAccepted = session.acceptedUserHashes?.includes(userHash) ?? false;
        if (!hasAccepted) {
          throw new Error('You need to accept the invitation first to join this private session');
        }
      }

      const odonym = generateOdonym();
      await dbSessionParticipants.insertOne({
        sessionId: new ObjectId(sessionId),
        userHash,
        odonym,
        joinedAt: new Date(),
        isActive: true,
      });

      await dbFocusSessions.updateOne(
        { _id: new ObjectId(sessionId) },
        { $inc: { participantCount: 1 } }
      );

      // Broadcast participant joined event
      sessionServerChannel.broadcast(sessionId, {
        type: 'participant_joined',
        sessionId,
        timestamp: Date.now(),
        participant: { odonym, isActive: true },
        participantCount: session.participantCount + 1,
      });

      return { odonym, rejoined: false };
    },

    // Start the focus session (creator only or auto-start)
    startSession: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId } = z.object({ sessionId: z.string() }).parse(args);

      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.creatorId.toString() !== user.id) {
        throw new AuthError('Only the session creator can start the session');
      }

      if (session.status !== 'waiting' && session.status !== 'warmup') {
        throw new Error('Session cannot be started');
      }

      await dbFocusSessions.updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $set: {
            status: 'focusing',
            startedAt: new Date(),
          }
        }
      );

      // Calculate initial timer state
      const targetDuration = session.actualDuration || session.maxDuration;
      const remainingSeconds = targetDuration * 60;
      
      // Broadcast session started event
      sessionServerChannel.broadcast(sessionId, {
        type: 'status_changed',
        sessionId,
        timestamp: Date.now(),
        status: 'focusing',
        previousStatus: session.status,
        timer: {
          remainingSeconds,
          elapsedSeconds: 0,
          targetDurationMinutes: targetDuration,
          serverTimestamp: Date.now(),
        },
      });

      return { success: true };
    },

    // Begin warmup phase
    startWarmup: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId } = z.object({ sessionId: z.string() }).parse(args);

      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.creatorId.toString() !== user.id) {
        throw new AuthError('Only the session creator can start warmup');
      }

      if (session.status !== 'waiting') {
        throw new Error('Session is not in waiting state');
      }

      await dbFocusSessions.updateOne(
        { _id: new ObjectId(sessionId) },
        { $set: { status: 'warmup' } }
      );

      // Broadcast warmup started event
      sessionServerChannel.broadcast(sessionId, {
        type: 'status_changed',
        sessionId,
        timestamp: Date.now(),
        status: 'warmup',
        previousStatus: 'waiting',
      });

      return { success: true };
    },

    // Skip warmup and start directly
    skipWarmup: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId } = z.object({ sessionId: z.string() }).parse(args);

      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.creatorId.toString() !== user.id) {
        throw new AuthError('Only the session creator can skip warmup');
      }

      await dbFocusSessions.updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $set: {
            status: 'focusing',
            startedAt: new Date(),
          }
        }
      );

      // Calculate initial timer state for skip warmup
      const targetDuration = session.actualDuration || session.maxDuration;
      const remainingSeconds = targetDuration * 60;
      
      // Broadcast session started (skipped warmup) event
      sessionServerChannel.broadcast(sessionId, {
        type: 'status_changed',
        sessionId,
        timestamp: Date.now(),
        status: 'focusing',
        previousStatus: session.status,
        timer: {
          remainingSeconds,
          elapsedSeconds: 0,
          targetDurationMinutes: targetDuration,
          serverTimestamp: Date.now(),
        },
      });

      return { success: true };
    },

    // Send a minimal reaction (no chat)
    sendReaction: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId, reaction } = z.object({
        sessionId: z.string(),
        reaction: z.enum(['focus', 'energy', 'break']),
      }).parse(args);

      const userHash = createUserHash(user.id, sessionId);
      const participant = await dbSessionParticipants.findOne({
        sessionId: new ObjectId(sessionId),
        userHash,
      });

      if (!participant || !participant.isActive) {
        throw new Error('Not an active participant');
      }

      await dbSessionParticipants.updateOne(
        { _id: participant._id },
        {
          $set: {
            lastReaction: reaction,
            lastReactionAt: new Date(),
          }
        }
      );

      // Broadcast reaction event
      sessionServerChannel.broadcast(sessionId, {
        type: 'participant_reaction',
        sessionId,
        timestamp: Date.now(),
        odonym: participant.odonym,
        reaction,
      });

      return { success: true };
    },

    // Leave session early
    leaveSession: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId } = z.object({ sessionId: z.string() }).parse(args);

      const userHash = createUserHash(user.id, sessionId);
      const participant = await dbSessionParticipants.findOne({
        sessionId: new ObjectId(sessionId),
        userHash,
      });

      if (!participant) {
        throw new Error('Not a participant');
      }

      // Get session for participant count and to check if focus was in progress
      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });

      await dbSessionParticipants.updateOne(
        { _id: participant._id },
        {
          $set: {
            isActive: false,
            leftAt: new Date(),
            outcome: 'interrupted',
            ledgerUpdated: true,
          }
        }
      );

      await dbFocusSessions.updateOne(
        { _id: new ObjectId(sessionId) },
        { $inc: { participantCount: -1 } }
      );

      // Update focus ledger if session was in focusing state
      // This records partial progress when user leaves mid-session
      if (session && session.status === 'focusing') {
        await updateFocusLedger(user.id, session, 'interrupted');
      }

      // Broadcast participant left event
      sessionServerChannel.broadcast(sessionId, {
        type: 'participant_left',
        sessionId,
        timestamp: Date.now(),
        odonym: participant.odonym,
        participantCount: session ? session.participantCount - 1 : 0,
      });

      return { success: true };
    },

    // End session and record outcomes
    endSession: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId } = z.object({ sessionId: z.string() }).parse(args);

      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.creatorId.toString() !== user.id) {
        throw new AuthError('Only the session creator can end the session');
      }

      // Generate cooldown prompt
      const cooldownPrompt = await generateCooldownPrompt({
        intent: session.intent,
        topic: session.topic,
        duration: session.actualDuration || session.maxDuration,
      });

      await dbFocusSessions.updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $set: {
            status: 'cooldown',
            cooldownPrompt,
          }
        }
      );

      // Broadcast session ended (cooldown) event
      sessionServerChannel.broadcast(sessionId, {
        type: 'status_changed',
        sessionId,
        timestamp: Date.now(),
        status: 'cooldown',
        previousStatus: 'focusing',
      });

      return { success: true, cooldownPrompt };
    },

    // Complete session fully
    completeSession: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId } = z.object({ sessionId: z.string() }).parse(args);

      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });
      if (!session) {
        throw new Error('Session not found');
      }

      // Get all active participants before updating status
      const activeParticipants = await dbSessionParticipants.fetch({
        sessionId: new ObjectId(sessionId),
        isActive: true,
        outcome: { $exists: false },
      });

      await dbFocusSessions.updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $set: {
            status: 'completed',
            endedAt: new Date(),
          }
        }
      );

      // Update all remaining active participants to completed and mark ledger as updated
      await dbSessionParticipants.updateMany(
        { sessionId: new ObjectId(sessionId), isActive: true, outcome: { $exists: false } },
        { $set: { outcome: 'completed', ledgerUpdated: true } }
      );

      // Update focus ledger for all completed participants
      // This ensures stats are recorded even if users don't visit the summary page
      for (const participant of activeParticipants) {
        const userId = await findUserIdFromHash(participant.userHash, sessionId);
        if (userId) {
          await updateFocusLedger(userId, session, 'completed');
        }
      }

      // Broadcast session completed event
      sessionServerChannel.broadcast(sessionId, {
        type: 'status_changed',
        sessionId,
        timestamp: Date.now(),
        status: 'completed',
        previousStatus: session.status,
      });

      return { success: true };
    },

    // Record user's session outcome
    recordOutcome: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId, outcome } = z.object({
        sessionId: z.string(),
        outcome: z.enum(['completed', 'partial', 'interrupted']),
      }).parse(args);

      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });
      if (!session) {
        throw new Error('Session not found');
      }

      const userHash = createUserHash(user.id, sessionId);
      const participant = await dbSessionParticipants.findOne({
        sessionId: new ObjectId(sessionId),
        userHash,
      });

      if (!participant) {
        throw new Error('Not a participant');
      }

      // Check if ledger was already updated (e.g., from getSessionSummary auto-update)
      const alreadyUpdated = participant.ledgerUpdated === true;

      // Update participant outcome and mark ledger as updated
      await dbSessionParticipants.updateOne(
        { _id: participant._id },
        { $set: { outcome, ledgerUpdated: true } }
      );

      // Only update focus ledger if it hasn't been updated yet
      if (!alreadyUpdated) {
        await updateFocusLedger(user.id, session, outcome);
      }

      return { success: true };
    },

    // Update data retention preference
    updateRetentionPreference: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { retentionWeeks } = z.object({
        retentionWeeks: z.number().min(1).max(52),
      }).parse(args);

      // Check if ledger exists
      const existingLedger = await dbFocusLedger.findOne({ userId: new ObjectId(user.id) });

      if (existingLedger) {
        await dbFocusLedger.updateOne(
          { userId: new ObjectId(user.id) },
          { $set: { retentionWeeks } }
        );
      } else {
        // Create minimal ledger with retention preference
        await dbFocusLedger.insertOne({
          userId: new ObjectId(user.id),
          totalFocusMinutes: 0,
          totalSessions: 0,
          completedSessions: 0,
          weeklyStats: [],
          focusPatterns: {
            preferredDurationRange: [25, 30],
            topTopics: [],
            avgCompletionRate: 0,
            focusStreak: 0,
          },
          retentionWeeks,
          lastUpdated: new Date(),
        });
      }

      return { success: true };
    },

    // Clear all personal focus data
    clearFocusData: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      await dbFocusLedger.deleteOne({ userId: new ObjectId(user.id) });

      return { success: true };
    },

    // Send a chat message
    sendMessage: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId, message } = z.object({
        sessionId: z.string(),
        message: z.string().min(1).max(500),
      }).parse(args);

      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });
      if (!session) {
        throw new Error('Session not found');
      }

      if (!session.chatEnabled) {
        throw new Error('Chat is disabled for this session');
      }

      if (session.status === 'completed' || session.status === 'cancelled') {
        throw new Error('Session has ended');
      }

      // Get participant info
      const userHash = createUserHash(user.id, sessionId);
      const participant = await dbSessionParticipants.findOne({
        sessionId: new ObjectId(sessionId),
        userHash,
      });

      if (!participant || !participant.isActive) {
        throw new Error('Not an active participant');
      }

      const messageId = new ObjectId();
      const messageDoc = {
        _id: messageId,
        sessionId: new ObjectId(sessionId),
        odonym: participant.odonym,
        message: message.trim(),
        sentAt: new Date(),
      };

      await dbSessionMessages.insertOne(messageDoc);

      // Broadcast chat message to all participants in the session
      chatServerChannel.broadcast(sessionId, {
        type: 'message',
        sessionId,
        timestamp: Date.now(),
        message: {
          id: messageId.toString(),
          odonym: participant.odonym,
          message: message.trim(),
          sentAt: messageDoc.sentAt.toISOString(),
        },
      });

      return {
        success: true,
        message: {
          id: messageId.toString(),
          odonym: participant.odonym,
          message: message.trim(),
          sentAt: messageDoc.sentAt.toISOString(),
          isOwn: true,
        },
      };
    },

    // Toggle chat for a session (creator only)
    toggleChat: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId, enabled } = z.object({
        sessionId: z.string(),
        enabled: z.boolean(),
      }).parse(args);

      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.creatorId.toString() !== user.id) {
        throw new AuthError('Only the session creator can toggle chat');
      }

      await dbFocusSessions.updateOne(
        { _id: new ObjectId(sessionId) },
        { $set: { chatEnabled: enabled } }
      );

      // Broadcast chat toggled event
      sessionServerChannel.broadcast(sessionId, {
        type: 'chat_toggled',
        sessionId,
        timestamp: Date.now(),
        chatEnabled: enabled,
      });

      return { success: true, chatEnabled: enabled };
    },

    // Create or update user profile
    saveProfile: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { nickname, pronouns, isPublic } = z.object({
        nickname: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Nickname can only contain letters, numbers, and underscores'),
        pronouns: z.string().max(30).optional(),
        isPublic: z.boolean(),
      }).parse(args);

      // Check if nickname is taken by another user
      const existingWithNickname = await dbUserProfiles.findOne({
        nickname: { $regex: new RegExp(`^${nickname}$`, 'i') },
        userId: { $ne: new ObjectId(user.id) },
      });

      if (existingWithNickname) {
        throw new Error('This nickname is already taken');
      }

      const existingProfile = await dbUserProfiles.findOne({ userId: new ObjectId(user.id) });
      const now = new Date();

      if (existingProfile) {
        // Update existing profile
        await dbUserProfiles.updateOne(
          { userId: new ObjectId(user.id) },
          {
            $set: {
              nickname,
              pronouns: pronouns || undefined,
              isPublic,
              updatedAt: now,
            },
          }
        );

        // Update creatorName in all sessions created by this user
        await dbFocusSessions.updateMany(
          { creatorId: new ObjectId(user.id) },
          { $set: { creatorName: nickname } }
        );
      } else {
        // Create new profile
        await dbUserProfiles.insertOne({
          userId: new ObjectId(user.id),
          nickname,
          pronouns: pronouns || undefined,
          isPublic,
          createdAt: now,
          updatedAt: now,
        });

        // Update creatorName in all existing sessions created by this user
        await dbFocusSessions.updateMany(
          { creatorId: new ObjectId(user.id) },
          { $set: { creatorName: nickname } }
        );
      }

      return { success: true, nickname };
    },

    // Update profile visibility only
    updateProfileVisibility: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { isPublic } = z.object({
        isPublic: z.boolean(),
      }).parse(args);

      const existingProfile = await dbUserProfiles.findOne({ userId: new ObjectId(user.id) });
      if (!existingProfile) {
        throw new Error('Profile not found. Please create your profile first.');
      }

      await dbUserProfiles.updateOne(
        { userId: new ObjectId(user.id) },
        { $set: { isPublic, updatedAt: new Date() } }
      );

      return { success: true, isPublic };
    },

    // Accept a private session invite
    acceptPrivateInvite: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { inviteCode } = z.object({ inviteCode: z.string() }).parse(args);

      const session = await dbFocusSessions.findOne({ inviteCode });
      if (!session) {
        throw new Error('Invalid invite link');
      }

      if (session.status === 'completed' || session.status === 'cancelled') {
        throw new Error('This session has ended');
      }

      if (!session.isPrivate) {
        // For public sessions, no need to accept - just redirect to join
        return { success: true, sessionId: session._id.toString(), alreadyAccepted: true };
      }

      // Check if user is the creator (they don't need to accept)
      if (session.creatorId.toString() === user.id) {
        return { success: true, sessionId: session._id.toString(), alreadyAccepted: true };
      }

      const userHash = createUserHash(user.id, session._id.toString());

      // Check if already accepted
      if (session.acceptedUserHashes?.includes(userHash)) {
        return { success: true, sessionId: session._id.toString(), alreadyAccepted: true };
      }

      // Add user to accepted list
      await dbFocusSessions.updateOne(
        { _id: session._id },
        { $addToSet: { acceptedUserHashes: userHash } }
      );

      return { success: true, sessionId: session._id.toString(), alreadyAccepted: false };
    },
  },
});

// Helper to get user's participation info for a session
async function getUserParticipation(userId: string, sessionId: string): Promise<{ isActive: boolean; odonym: string } | null> {
  const userHash = createUserHash(userId, sessionId);
  const participant = await dbSessionParticipants.findOne({
    sessionId: new ObjectId(sessionId),
    userHash,
  });
  if (!participant) return null;
  return {
    isActive: participant.isActive,
    odonym: participant.odonym,
  };
}

// Helper to generate matching tags from intent and topic
function generateMatchingTags(intent: string, topic: string): string[] {
  const tags: string[] = [topic.toLowerCase()];

  // Extract key words from intent
  const words = intent.toLowerCase().split(/\s+/);
  const keywords = ['write', 'code', 'read', 'study', 'design', 'plan', 'review', 'learn', 'practice', 'create', 'build', 'research'];

  for (const word of words) {
    if (keywords.includes(word)) {
      tags.push(word);
    }
  }

  return [...new Set(tags)];
}

// Helper to update focus ledger after session
async function updateFocusLedger(
  userId: string,
  session: {
    topic: string;
    actualDuration?: number;
    maxDuration: number;
  },
  outcome: string
): Promise<void> {
  const duration = session.actualDuration || session.maxDuration;
  const isCompleted = outcome === 'completed';
  const focusMinutes = isCompleted ? duration : Math.floor(duration * 0.5);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const existingLedger = await dbFocusLedger.findOne({ userId: new ObjectId(userId) });

  if (!existingLedger) {
    // Create new ledger
    await dbFocusLedger.insertOne({
      userId: new ObjectId(userId),
      totalFocusMinutes: focusMinutes,
      totalSessions: 1,
      completedSessions: isCompleted ? 1 : 0,
      weeklyStats: [{
        weekStart,
        focusMinutes,
        sessionCount: 1,
        avgSessionDuration: duration,
        preferredTopics: [session.topic],
        preferredDurations: [duration],
      }],
      focusPatterns: {
        preferredDurationRange: [duration, duration],
        topTopics: [session.topic],
        avgCompletionRate: isCompleted ? 1 : 0,
        focusStreak: isCompleted ? 1 : 0,
        lastActiveDate: now,
      },
      retentionWeeks: 12, // Default 12 weeks
      lastUpdated: now,
    });
  } else {
    // Update existing ledger
    const weeklyStats = existingLedger.weeklyStats;
    const currentWeekIndex = weeklyStats.findIndex(
      w => w.weekStart.getTime() === weekStart.getTime()
    );

    if (currentWeekIndex >= 0) {
      // Update current week
      const week = weeklyStats[currentWeekIndex];
      week.focusMinutes += focusMinutes;
      week.sessionCount += 1;
      week.avgSessionDuration = week.focusMinutes / week.sessionCount;
      if (!week.preferredTopics.includes(session.topic)) {
        week.preferredTopics.push(session.topic);
      }
      week.preferredDurations.push(duration);
    } else {
      // Add new week
      weeklyStats.push({
        weekStart,
        focusMinutes,
        sessionCount: 1,
        avgSessionDuration: duration,
        preferredTopics: [session.topic],
        preferredDurations: [duration],
      });
    }

    // Trim old weeks based on retention
    const retentionMs = existingLedger.retentionWeeks * 7 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - retentionMs);
    const trimmedStats = weeklyStats.filter(w => w.weekStart >= cutoff);

    // Calculate new focus streak
    const lastActive = existingLedger.focusPatterns.lastActiveDate;
    const daysSinceLastActive = lastActive
      ? Math.floor((now.getTime() - lastActive.getTime()) / (24 * 60 * 60 * 1000))
      : 999;

    const newStreak = isCompleted
      ? (daysSinceLastActive <= 1 ? existingLedger.focusPatterns.focusStreak + 1 : 1)
      : (daysSinceLastActive <= 1 ? existingLedger.focusPatterns.focusStreak : 0);

    // Update patterns
    const totalSessions = existingLedger.totalSessions + 1;
    const completedSessions = existingLedger.completedSessions + (isCompleted ? 1 : 0);

    await dbFocusLedger.updateOne(
      { userId: new ObjectId(userId) },
      {
        $set: {
          totalFocusMinutes: existingLedger.totalFocusMinutes + focusMinutes,
          totalSessions,
          completedSessions,
          weeklyStats: trimmedStats,
          'focusPatterns.avgCompletionRate': completedSessions / totalSessions,
          'focusPatterns.focusStreak': newStreak,
          'focusPatterns.lastActiveDate': now,
          lastUpdated: now,
        },
      }
    );
  }

  // Update daily activity for heatmap
  const dateKey = formatDateKey(now);
  const existingActivity = await dbDailyFocusActivity.findOne({
    userId: new ObjectId(userId),
    date: dateKey,
  });

  if (existingActivity) {
    await dbDailyFocusActivity.updateOne(
      { userId: new ObjectId(userId), date: dateKey },
      {
        $inc: {
          sessionCount: 1,
          totalMinutes: focusMinutes,
          completedSessions: isCompleted ? 1 : 0,
        },
      }
    );
  } else {
    await dbDailyFocusActivity.insertOne({
      userId: new ObjectId(userId),
      date: dateKey,
      sessionCount: 1,
      totalMinutes: focusMinutes,
      completedSessions: isCompleted ? 1 : 0,
    });
  }
}
