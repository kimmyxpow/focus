import z from 'zod';
import crypto from 'crypto';
import { AuthError } from 'modelence';
import { Module, ObjectId, UserInfo } from 'modelence/server';
import { dbFocusSessions, dbSessionParticipants, dbFocusLedger, dbSessionMessages, dbUserProfiles, dbDailyFocusActivity } from './db';
import {
  generateCohortMatches,
  generateCooldownPrompt,
  predictOptimalDuration,
} from './ai';
import { sessionServerChannel, chatServerChannel } from '../channels';

function createUserHash(userId: string, sessionSalt: string): string {
  return crypto.createHash('sha256').update(`${userId}:${sessionSalt}`).digest('hex').substring(0, 16);
}

function generateOdonym(): string {
  const adjectives = ['Focused', 'Calm', 'Steady', 'Deep', 'Clear', 'Bright', 'Swift', 'Quiet'];
  const nouns = ['Oak', 'River', 'Mountain', 'Cloud', 'Star', 'Wave', 'Stone', 'Wind'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

function generateInviteCode(): string {
  return crypto.randomBytes(6).toString('base64url');
}

async function getUserNickname(userId: string): Promise<string> {
  const profile = await dbUserProfiles.findOne({ userId: new ObjectId(userId) });
  if (profile) {
    return profile.nickname;
  }
  return `User${userId.slice(-6)}`;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function findUserIdFromHash(userHash: string, sessionId: string): Promise<string | null> {
  const profiles = await dbUserProfiles.fetch({}, { limit: 1000 });

  for (const profile of profiles) {
    const testHash = createUserHash(profile.userId.toString(), sessionId);
    if (testHash === userHash) {
      return profile.userId.toString();
    }
  }

  const ledgers = await dbFocusLedger.fetch({}, { limit: 1000 });

  for (const ledger of ledgers) {
    const testHash = createUserHash(ledger.userId.toString(), sessionId);
    if (testHash === userHash) {
      return ledger.userId.toString();
    }
  }

  return null;
}

async function hasActiveSessionElsewhere(userId: string, excludeSessionId?: string): Promise<{ hasActive: boolean; activeSessionId?: string }> {
  const participations = await dbSessionParticipants.fetch({}, { limit: 500 });

  for (const p of participations) {
    if (excludeSessionId && p.sessionId.toString() === excludeSessionId) {
      continue;
    }

    const userHash = createUserHash(userId, p.sessionId.toString());
    if (p.userHash === userHash && p.isActive) {
      const session = await dbFocusSessions.findOne({
        _id: p.sessionId,
        status: { $in: ['waiting', 'focusing', 'break', 'cooldown'] },
      });

      if (session) {
        return { hasActive: true, activeSessionId: session._id.toString() };
      }
    }
  }

  return { hasActive: false };
}

export default new Module('focus', {
  stores: [dbFocusSessions, dbSessionParticipants, dbFocusLedger, dbSessionMessages, dbUserProfiles, dbDailyFocusActivity],
  channels: [sessionServerChannel, chatServerChannel],

  queries: {
    getActiveSession: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        console.log('[getActiveSession] No user');
        return null;
      }

      console.log('[getActiveSession] Looking for user:', user.id);

      const activeSessions = await dbFocusSessions.fetch({
        status: { $in: ['waiting', 'focusing', 'break', 'cooldown'] }
      }, { limit: 50, sort: { createdAt: -1 } });

      console.log('[getActiveSession] Found', activeSessions.length, 'active sessions');

      for (const session of activeSessions) {
        const userHash = createUserHash(user.id, session._id.toString());
        console.log('[getActiveSession] Checking session:', session._id.toString(), 'hash:', userHash);

        const participation = await dbSessionParticipants.findOne({
          sessionId: session._id,
          userHash: userHash,
          isActive: true
        });

        if (participation) {
          console.log('[getActiveSession] Found active participation in session:', session._id.toString());

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
            intent: session.intent,
            isCreator: session.creatorId.toString() === user.id,
            timer: {
              remainingSeconds,
              serverTimestamp: Date.now(),
            },
          };
        }
      }

      console.log('[getActiveSession] No active participation found in any session');
      return null;
    },

    getActiveSessions: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      const sessions = await dbFocusSessions.fetch(
        {
          status: { $in: ['waiting', 'focusing'] },
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

    getMyRooms: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        return [];
      }

      const createdSessions = await dbFocusSessions.fetch(
        {
          creatorId: new ObjectId(user.id),
          status: { $in: ['waiting', 'focusing'] },
        },
        { sort: { createdAt: -1 }, limit: 10 }
      );

      const participations = await dbSessionParticipants.fetch({}, { limit: 100 });
      const participatedSessionIds: string[] = [];

      for (const p of participations) {
        const userHash = createUserHash(user.id, p.sessionId.toString());
        if (p.userHash === userHash) {
          participatedSessionIds.push(p.sessionId.toString());
        }
      }

      const createdSessionIds = createdSessions.map(s => s._id.toString());
      const otherSessionIds = participatedSessionIds.filter(id => !createdSessionIds.includes(id));

      const participatedSessions = otherSessionIds.length > 0
        ? await dbFocusSessions.fetch(
            {
              _id: { $in: otherSessionIds.map(id => new ObjectId(id)) },
              status: { $in: ['waiting', 'focusing'] },
            },
            { sort: { createdAt: -1 }, limit: 10 }
          )
        : [];

      const allSessions = [...createdSessions, ...participatedSessions];

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

      const ledger = await dbFocusLedger.findOne({ userId: new ObjectId(user.id) });
      const focusPatterns = ledger?.focusPatterns;

      const availableSessions = await dbFocusSessions.fetch(
        { status: 'waiting' },
        { limit: 50 }
      );

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

    getSession: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const { sessionId } = z.object({ sessionId: z.string() }).parse(args);

      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });
      if (!session) {
        throw new Error('Session not found');
      }

      const participants = await dbSessionParticipants.fetch(
        { sessionId: new ObjectId(sessionId), isActive: true }
      );

      let remainingSeconds = 0;
      let elapsedSeconds = 0;
      const targetDuration = session.actualDuration || session.maxDuration;

      if (session.startedAt && session.status === 'focusing') {
        elapsedSeconds = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);
        remainingSeconds = Math.max(0, targetDuration * 60 - elapsedSeconds);
      }

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
        cooldownPrompt: session.cooldownPrompt,
        participantCount: session.participantCount,

        repetitions: session.repetitions || 1,
        breakDuration: session.breakDuration || 5,
        breakInterval: session.breakInterval || 1,
        currentRepetition: session.currentRepetition || 1,

        timer: {
          remainingSeconds,
          elapsedSeconds,
          targetDurationMinutes: targetDuration,
          serverTimestamp: Date.now(),
        },

        participants: participants.map(p => ({
          odonym: p.odonym,
          lastReaction: p.lastReaction,
          isActive: p.isActive,
        })),

        userParticipation: userParticipant ? {
          odonym: userParticipant.odonym,
          outcome: userParticipant.outcome,
          isActive: userParticipant.isActive,
        } : null,

        isCreator: user ? session.creatorId.toString() === user.id : false,

        isPrivate: session.isPrivate ?? false,
        inviteCode: session.inviteCode,

        chatEnabled: session.chatEnabled ?? false,
        creatorName: session.creatorName,
      };
    },

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

    getSessionByInvite: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const { inviteCode } = z.object({ inviteCode: z.string() }).parse(args);

      const session = await dbFocusSessions.findOne({ inviteCode });
      if (!session) {
        throw new Error('Invalid invite link');
      }

      if (session.status === 'completed' || session.status === 'cancelled') {
        throw new Error('This session has ended');
      }

      let hasAcceptedInvite = false;
      if (user && session.isPrivate) {
        const userHash = createUserHash(user.id, session._id.toString());
        hasAcceptedInvite = session.acceptedUserHashes?.includes(userHash) ?? false;
      }

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

    getSessionSummary: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId } = z.object({ sessionId: z.string() }).parse(args);

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
        throw new AuthError('Not a participant of this session');
      }

      if (participant.outcome && !participant.ledgerUpdated) {
        await updateFocusLedger(user.id, session, participant.outcome, {
          joinedAt: participant.joinedAt,
          leftAt: participant.leftAt,
        });
        await dbSessionParticipants.updateOne(
          { _id: participant._id },
          { $set: { ledgerUpdated: true } }
        );
      }

      const [totalParticipants, completedParticipants] = await Promise.all([
        dbSessionParticipants.countDocuments({ sessionId: new ObjectId(sessionId) }),
        dbSessionParticipants.countDocuments({
          sessionId: new ObjectId(sessionId),
          outcome: 'completed'
        }),
      ]);

      const cohortCompletionRate = totalParticipants > 0
        ? completedParticipants / totalParticipants
        : 1;

      const duration = session.actualDuration || session.maxDuration;
      const outcome = participant.outcome || 'completed';
      const completionPercent = Math.round(cohortCompletionRate * 100);

      let summary: string;
      if (outcome === 'completed') {
        summary = `You completed ${duration} minutes of focused ${session.topic} work${session.intent ? ` on "${session.intent}"` : ''}. ${completionPercent}% of your cohort finished together. Great discipline staying on task!`;
      } else if (outcome === 'partial') {
        summary = `You made progress on ${session.topic}${session.intent ? ` - "${session.intent}"` : ''}. Every minute of focused work counts toward building your practice.`;
      } else {
        summary = `Session interrupted, but every attempt at focus builds the habit. Consider a shorter session next time to rebuild momentum.`;
      }

      let nextStep: string;
      if (outcome === 'completed') {
        if (duration >= 45) {
          nextStep = `After ${duration} minutes of deep focus, take a 10-15 minute break. Your brain needs time to consolidate what you've learned.`;
        } else if (duration >= 25) {
          nextStep = `Great ${duration}-minute session! Take a 5-minute break, then consider another round if you're still in flow.`;
        } else {
          nextStep = `Quick win completed! Ready for another short burst of ${session.topic} focus, or time to switch to something new?`;
        }
      } else if (outcome === 'partial') {
        nextStep = `Try a shorter session (15-20 min) next time. Building consistency with shorter bursts matters more than long durations.`;
      } else {
        nextStep = `No worries about the interruption. When you're ready, start with a 15-minute ${session.topic} session to rebuild momentum.`;
      }

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
        focusMinutesEarned: (() => {
          const elapsedMinutes = calculateElapsedMinutes(session, participant);
          return participant.outcome === 'completed'
            ? elapsedMinutes
            : Math.floor(elapsedMinutes * 0.5);
        })(),
      };
    },

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
        weeklyStats: ledger.weeklyStats.slice(-8),
        focusPatterns: ledger.focusPatterns,
        focusStreak: ledger.focusPatterns.focusStreak,
      };
    },

    getUserSessions: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const createdSessions = await dbFocusSessions.fetch(
        { creatorId: new ObjectId(user.id) },
        { sort: { createdAt: -1 }, limit: 20 }
      );

      const participations = await dbSessionParticipants.fetch(
        {},
        { limit: 100 }
      );

      const participatedSessionIds: string[] = [];
      for (const p of participations) {
        const userHash = createUserHash(user.id, p.sessionId.toString());
        if (p.userHash === userHash) {
          participatedSessionIds.push(p.sessionId.toString());
        }
      }

      const createdSessionIds = createdSessions.map(s => s._id.toString());
      const otherSessionIds = participatedSessionIds.filter(id => !createdSessionIds.includes(id));

      const participatedSessions = otherSessionIds.length > 0
        ? await dbFocusSessions.fetch(
            { _id: { $in: otherSessionIds.map(id => new ObjectId(id)) } },
            { sort: { createdAt: -1 }, limit: 20 }
          )
        : [];

      const allSessions = [...createdSessions, ...participatedSessions];

      const uniqueSessions = allSessions
        .filter((s, i, arr) => arr.findIndex(x => x._id.toString() === s._id.toString()) === i)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20);

      return uniqueSessions.map(s => {
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

    getMyProfile: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const profile = await dbUserProfiles.findOne({ userId: new ObjectId(user.id) });
      const ledger = await dbFocusLedger.findOne({ userId: new ObjectId(user.id) });

      if (!profile) {
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

    checkNicknameAvailable: async (args: unknown, _context: { user: UserInfo | null }) => {
      const { nickname } = z.object({ nickname: z.string().min(3).max(20) }).parse(args);

      const existing = await dbUserProfiles.findOne({
        nickname: { $regex: new RegExp(`^${nickname}$`, 'i') },
      });

      return { available: !existing };
    },

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

    getLeaderboard: async (args: unknown, _context: { user: UserInfo | null }) => {
      const { timeFilter, sortBy, limit: resultLimit } = z.object({
        timeFilter: z.enum(['all', 'month', 'week']).optional().default('all'),
        sortBy: z.enum(['focusMinutes', 'sessions', 'streak']).optional().default('focusMinutes'),
        limit: z.number().min(1).max(100).optional().default(50),
      }).parse(args);

      const publicProfiles = await dbUserProfiles.fetch({ isPublic: true });
      const publicUserIds = publicProfiles.map(p => p.userId);

      if (publicUserIds.length === 0) {
        return [];
      }

      const ledgers = await dbFocusLedger.fetch({
        userId: { $in: publicUserIds },
      });

      const profileMap = new Map(publicProfiles.map(p => [p.userId.toString(), p]));

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const leaderboardEntries = ledgers.map(ledger => {
        const profile = profileMap.get(ledger.userId.toString());
        if (!profile) return null;

        let focusMinutes = ledger.totalFocusMinutes;
        let sessions = ledger.totalSessions;

        if (timeFilter !== 'all' && ledger.weeklyStats) {
          const cutoffDate = timeFilter === 'week' ? weekAgo : monthAgo;
          const recentStats = ledger.weeklyStats.filter(
            (w: { weekStart: Date }) => new Date(w.weekStart) >= cutoffDate
          );
          focusMinutes = recentStats.reduce((sum: number, w: { focusMinutes: number }) => sum + w.focusMinutes, 0);
          sessions = recentStats.reduce((sum: number, w: { sessionCount: number }) => sum + w.sessionCount, 0);
        }

        if (focusMinutes === 0 && sessions === 0) return null;

        return {
          nickname: profile.nickname,
          pronouns: profile.pronouns,
          focusMinutes,
          sessions,
          streak: ledger.focusPatterns?.focusStreak || 0,
        };
      }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

      leaderboardEntries.sort((a, b) => {
        if (sortBy === 'focusMinutes') return b.focusMinutes - a.focusMinutes;
        if (sortBy === 'sessions') return b.sessions - a.sessions;
        return b.streak - a.streak;
      });

      return leaderboardEntries.slice(0, resultLimit).map((entry, index) => ({
        rank: index + 1,
        ...entry,
      }));
    },
  },

  mutations: {
    createSession: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { hasActive, activeSessionId } = await hasActiveSessionElsewhere(user.id);
      if (hasActive && activeSessionId) {
        throw new Error(`You are already participating in an active session. Please leave your current session first before creating a new one. Active session: ${activeSessionId}`);
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

      const ledger = await dbFocusLedger.findOne({ userId: new ObjectId(user.id) });

      const matchingTags = generateMatchingTags(intent, topic);

      const predictedDuration = await predictOptimalDuration({
        requestedRange: [minDuration, maxDuration],
        userPatterns: ledger?.focusPatterns,
        topic,
      });

      const sessionId = new ObjectId();
      const inviteCode = generateInviteCode();

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
        isPrivate,
        inviteCode,
        chatEnabled,
        creatorName: creatorNickname,
      });

      const userHash = createUserHash(user.id, sessionId.toString());
      console.log('[createSession] Creator hash:', userHash, 'for user:', user.id, 'session:', sessionId.toString());
      await dbSessionParticipants.insertOne({
        sessionId,
        userHash,
        odonym: generateOdonym(),
        joinedAt: new Date(),
        isActive: true,
      });

      return { sessionId: sessionId.toString() };
    },

    joinSession: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId } = z.object({ sessionId: z.string() }).parse(args);

      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });
      if (!session) {
        throw new Error('Session not found');
      }

      const userHash = createUserHash(user.id, sessionId);
      const existing = await dbSessionParticipants.findOne({ sessionId: new ObjectId(sessionId), userHash });

      if (existing) {
        if (session.status === 'completed' || session.status === 'cancelled') {
          throw new Error('Session has ended');
        }

        if (!existing.isActive) {
          const { hasActive, activeSessionId } = await hasActiveSessionElsewhere(user.id, sessionId);
          if (hasActive && activeSessionId) {
            throw new Error(`You are already in another active session (${activeSessionId}). Please leave that session first before rejoining this one.`);
          }

          await dbSessionParticipants.updateOne(
            { _id: existing._id },
            { $set: { isActive: true, leftAt: undefined, outcome: undefined } }
          );
          await dbFocusSessions.updateOne(
            { _id: new ObjectId(sessionId) },
            { $inc: { participantCount: 1 } }
          );

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

      if (session.status !== 'waiting') {
        throw new Error('Session is no longer accepting new participants');
      }

      const { hasActive, activeSessionId } = await hasActiveSessionElsewhere(user.id, sessionId);
      if (hasActive && activeSessionId) {
        throw new Error(`You are already participating in another active session (${activeSessionId}). Please leave your current session first before joining a new one.`);
      }

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

      sessionServerChannel.broadcast(sessionId, {
        type: 'participant_joined',
        sessionId,
        timestamp: Date.now(),
        participant: { odonym, isActive: true },
        participantCount: session.participantCount + 1,
      });

      return { odonym, rejoined: false };
    },

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

      if (session.status !== 'waiting') {
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

      const targetDuration = session.actualDuration || session.maxDuration;
      const remainingSeconds = targetDuration * 60;

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

      sessionServerChannel.broadcast(sessionId, {
        type: 'participant_reaction',
        sessionId,
        timestamp: Date.now(),
        odonym: participant.odonym,
        reaction,
      });

      return { success: true };
    },

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

      if (session && session.status === 'focusing') {
        await updateFocusLedger(user.id, session, 'interrupted', {
          joinedAt: participant.joinedAt,
          leftAt: participant.leftAt,
        });
      }

      sessionServerChannel.broadcast(sessionId, {
        type: 'participant_left',
        sessionId,
        timestamp: Date.now(),
        odonym: participant.odonym,
        participantCount: session ? session.participantCount - 1 : 0,
      });

      return { success: true };
    },

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

      sessionServerChannel.broadcast(sessionId, {
        type: 'status_changed',
        sessionId,
        timestamp: Date.now(),
        status: 'cooldown',
        previousStatus: 'focusing',
      });

      return { success: true, cooldownPrompt };
    },

    completeSession: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { sessionId } = z.object({ sessionId: z.string() }).parse(args);

      const session = await dbFocusSessions.findOne({ _id: new ObjectId(sessionId) });
      if (!session) {
        throw new Error('Session not found');
      }

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

      await dbSessionParticipants.updateMany(
        { sessionId: new ObjectId(sessionId), isActive: true, outcome: { $exists: false } },
        { $set: { outcome: 'completed', ledgerUpdated: true } }
      );

      for (const participant of activeParticipants) {
        const userId = await findUserIdFromHash(participant.userHash, sessionId);
        if (userId) {
          await updateFocusLedger(userId, session, 'completed', {
            joinedAt: participant.joinedAt,
            leftAt: undefined,
          });
        }
      }

      sessionServerChannel.broadcast(sessionId, {
        type: 'status_changed',
        sessionId,
        timestamp: Date.now(),
        status: 'completed',
        previousStatus: session.status,
      });

      return { success: true };
    },

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

      const alreadyUpdated = participant.ledgerUpdated === true;

      await dbSessionParticipants.updateOne(
        { _id: participant._id },
        { $set: { outcome, ledgerUpdated: true } }
      );

      if (!alreadyUpdated) {
        await updateFocusLedger(user.id, session, outcome, {
          joinedAt: participant.joinedAt,
          leftAt: participant.leftAt,
        });
      }

      return { success: true };
    },

    updateRetentionPreference: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { retentionWeeks } = z.object({
        retentionWeeks: z.number().min(1).max(52),
      }).parse(args);

      const existingLedger = await dbFocusLedger.findOne({ userId: new ObjectId(user.id) });

      if (existingLedger) {
        await dbFocusLedger.updateOne(
          { userId: new ObjectId(user.id) },
          { $set: { retentionWeeks } }
        );
      } else {
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

    clearFocusData: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      await dbFocusLedger.deleteOne({ userId: new ObjectId(user.id) });

      return { success: true };
    },

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

      sessionServerChannel.broadcast(sessionId, {
        type: 'chat_toggled',
        sessionId,
        timestamp: Date.now(),
        chatEnabled: enabled,
      });

      return { success: true, chatEnabled: enabled };
    },

    saveProfile: async (args: unknown, { user }: { user: UserInfo | null }) => {
      if (!user) {
        throw new AuthError('Not authenticated');
      }

      const { nickname, pronouns, isPublic } = z.object({
        nickname: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Nickname can only contain letters, numbers, and underscores'),
        pronouns: z.string().max(30).optional(),
        isPublic: z.boolean(),
      }).parse(args);

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

        await dbFocusSessions.updateMany(
          { creatorId: new ObjectId(user.id) },
          { $set: { creatorName: nickname } }
        );
      } else {
        await dbUserProfiles.insertOne({
          userId: new ObjectId(user.id),
          nickname,
          pronouns: pronouns || undefined,
          isPublic,
          createdAt: now,
          updatedAt: now,
        });

        await dbFocusSessions.updateMany(
          { creatorId: new ObjectId(user.id) },
          { $set: { creatorName: nickname } }
        );
      }

      return { success: true, nickname };
    },

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
        return { success: true, sessionId: session._id.toString(), alreadyAccepted: true };
      }

      if (session.creatorId.toString() === user.id) {
        return { success: true, sessionId: session._id.toString(), alreadyAccepted: true };
      }

      const userHash = createUserHash(user.id, session._id.toString());

      if (session.acceptedUserHashes?.includes(userHash)) {
        return { success: true, sessionId: session._id.toString(), alreadyAccepted: true };
      }

      await dbFocusSessions.updateOne(
        { _id: session._id },
        { $addToSet: { acceptedUserHashes: userHash } }
      );

      return { success: true, sessionId: session._id.toString(), alreadyAccepted: false };
    },
  },
});

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

function generateMatchingTags(intent: string, topic: string): string[] {
  const tags: string[] = [topic.toLowerCase()];

  const words = intent.toLowerCase().split(/\s+/);
  const keywords = ['write', 'code', 'read', 'study', 'design', 'plan', 'review', 'learn', 'practice', 'create', 'build', 'research'];

  for (const word of words) {
    if (keywords.includes(word)) {
      tags.push(word);
    }
  }

  return [...new Set(tags)];
}

function calculateElapsedMinutes(
  session: {
    startedAt?: Date;
    endedAt?: Date;
    actualDuration?: number;
    maxDuration: number;
  },
  participant?: {
    joinedAt?: Date;
    leftAt?: Date;
  }
): number {
  if (session.startedAt && session.endedAt) {
    const elapsedMs = session.endedAt.getTime() - session.startedAt.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);

    if (elapsedMinutes > 0 && elapsedMinutes <= session.maxDuration) {
      return elapsedMinutes;
    }
  }

  if (participant?.joinedAt && participant?.leftAt && session.startedAt) {
    const elapsedMs = participant.leftAt.getTime() - session.startedAt.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);

    if (elapsedMinutes > 0 && elapsedMinutes <= session.maxDuration) {
      return elapsedMinutes;
    }
  }

  return session.actualDuration || session.maxDuration;
}

async function updateFocusLedger(
  userId: string,
  session: {
    _id: ObjectId;
    topic: string;
    startedAt?: Date;
    endedAt?: Date;
    actualDuration?: number;
    maxDuration: number;
  },
  outcome: string,
  participant?: {
    joinedAt?: Date;
    leftAt?: Date;
  }
): Promise<void> {
  const duration = calculateElapsedMinutes(session, participant);
  const isCompleted = outcome === 'completed';
  const focusMinutes = isCompleted ? duration : Math.floor(duration * 0.5);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const existingLedger = await dbFocusLedger.findOne({ userId: new ObjectId(userId) });

  if (!existingLedger) {
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
      retentionWeeks: 12,
      lastUpdated: now,
    });
  } else {
    const weeklyStats = existingLedger.weeklyStats;
    const currentWeekIndex = weeklyStats.findIndex(
      w => w.weekStart.getTime() === weekStart.getTime()
    );

    if (currentWeekIndex >= 0) {
      const week = weeklyStats[currentWeekIndex];
      week.focusMinutes += focusMinutes;
      week.sessionCount += 1;
      week.avgSessionDuration = week.focusMinutes / week.sessionCount;
      if (!week.preferredTopics.includes(session.topic)) {
        week.preferredTopics.push(session.topic);
      }
      week.preferredDurations.push(duration);
    } else {
      weeklyStats.push({
        weekStart,
        focusMinutes,
        sessionCount: 1,
        avgSessionDuration: duration,
        preferredTopics: [session.topic],
        preferredDurations: [duration],
      });
    }

    const retentionMs = existingLedger.retentionWeeks * 7 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - retentionMs);
    const trimmedStats = weeklyStats.filter(w => w.weekStart >= cutoff);

    const lastActive = existingLedger.focusPatterns.lastActiveDate;
    const daysSinceLastActive = lastActive
      ? Math.floor((now.getTime() - lastActive.getTime()) / (24 * 60 * 60 * 1000))
      : 999;

    const newStreak = isCompleted
      ? (daysSinceLastActive <= 1 ? existingLedger.focusPatterns.focusStreak + 1 : 1)
      : (daysSinceLastActive <= 1 ? existingLedger.focusPatterns.focusStreak : 0);

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
