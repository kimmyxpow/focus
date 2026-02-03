/**
 * AI utilities for the Focus app
 *
 * Uses @modelence/ai for real LLM-powered analysis and generation.
 * All AI outputs are designed to be concise, explainable, and skippable.
 */

import { generateText } from '@modelence/ai';

// AI Provider configuration - uses Google Gemini
const AI_PROVIDER = 'google' as const;
const AI_MODEL = 'gemini-2.0-flash'; // Cost-effective Gemini model for focus app

interface FocusPatterns {
  preferredDurationRange: number[];
  topTopics: string[];
  avgCompletionRate: number;
  focusStreak: number;
  lastActiveDate?: Date;
}

interface SessionForMatching {
  id: string;
  intent: string;
  topic: string;
  durationRange: number[];
  participantCount: number;
  matchingTags: string[];
}

interface CohortMatchInput {
  userIntent?: string;
  userTopic?: string;
  userDurationRange?: number[];
  userPatterns?: FocusPatterns;
  availableSessions: SessionForMatching[];
}

interface CohortMatch {
  sessionId: string;
  matchScore: number;
  matchReasons: string[];
  session: {
    intent: string;
    topic: string;
    durationRange: number[];
    participantCount: number;
  };
}

/**
 * Generate cohort matches using AI-powered semantic analysis
 */
export async function generateCohortMatches(input: CohortMatchInput): Promise<CohortMatch[]> {
  const { userIntent, userTopic, userDurationRange, userPatterns, availableSessions } = input;

  if (availableSessions.length === 0) {
    return [];
  }

  // If no user preferences provided, return empty
  if (!userIntent && !userTopic) {
    return [];
  }

  try {
    const sessionsContext = availableSessions.map((s, i) =>
      `Session ${i + 1}: ID="${s.id}", Topic="${s.topic}", Intent="${s.intent}", Duration=${s.durationRange[0]}-${s.durationRange[1]}min, Participants=${s.participantCount}`
    ).join('\n');

    const userContext = [
      userIntent ? `User Intent: "${userIntent}"` : '',
      userTopic ? `User Topic: "${userTopic}"` : '',
      userDurationRange ? `User Duration Preference: ${userDurationRange[0]}-${userDurationRange[1]} minutes` : '',
      userPatterns ? `User Focus Patterns: Prefers ${userPatterns.preferredDurationRange[0]}-${userPatterns.preferredDurationRange[1]}min sessions, Completion rate ${Math.round(userPatterns.avgCompletionRate * 100)}%, Top topics: ${userPatterns.topTopics.join(', ') || 'none'}` : '',
    ].filter(Boolean).join('\n');

    const response = await generateText({
      provider: AI_PROVIDER,
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a focus session matching AI. Analyze user preferences and available sessions to find the best matches.

Rules:
- Match based on semantic similarity of intent (what they want to accomplish)
- Match based on topic relevance
- Consider duration compatibility
- Consider user's historical patterns if available
- Return JSON array with top 5 matches
- Each match needs: sessionId, matchScore (0-100), matchReasons (max 3 short reasons)

Response format (JSON only, no markdown):
[{"sessionId": "id", "matchScore": 85, "matchReasons": ["Similar intent", "Same topic", "Good duration fit"]}]`
        },
        {
          role: 'user',
          content: `Find the best focus session matches for this user:

${userContext}

Available Sessions:
${sessionsContext}

Return JSON array of matches.`
        }
      ],
      temperature: 0.3,
      maxTokens: 1000,
    });

    // Parse AI response
    const text = response.text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('AI response did not contain valid JSON array:', text);
      return fallbackCohortMatching(input);
    }

    const aiMatches = JSON.parse(jsonMatch[0]) as Array<{
      sessionId: string;
      matchScore: number;
      matchReasons: string[];
    }>;

    // Map AI results back to full session data
    return aiMatches
      .map(match => {
        const session = availableSessions.find(s => s.id === match.sessionId);
        if (!session) return null;

        return {
          sessionId: match.sessionId,
          matchScore: Math.min(100, Math.max(0, match.matchScore)),
          matchReasons: match.matchReasons.slice(0, 3),
          session: {
            intent: session.intent,
            topic: session.topic,
            durationRange: session.durationRange,
            participantCount: session.participantCount,
          },
        };
      })
      .filter((m): m is CohortMatch => m !== null)
      .slice(0, 5);

  } catch (error) {
    console.error('AI cohort matching failed, using fallback:', error);
    return fallbackCohortMatching(input);
  }
}

/**
 * Fallback cohort matching when AI is unavailable
 */
function fallbackCohortMatching(input: CohortMatchInput): CohortMatch[] {
  const { userIntent, userTopic, userDurationRange, userPatterns, availableSessions } = input;
  const matches: CohortMatch[] = [];

  for (const session of availableSessions) {
    let score = 0;
    const reasons: string[] = [];

    if (userTopic && session.topic.toLowerCase() === userTopic.toLowerCase()) {
      score += 40;
      reasons.push(`Same topic: ${session.topic}`);
    }

    if (userIntent) {
      const userWords = new Set(userIntent.toLowerCase().split(/\s+/));
      const sessionWords = session.intent.toLowerCase().split(/\s+/);
      const overlap = sessionWords.filter(w => userWords.has(w)).length;
      if (overlap > 0) {
        score += Math.min(overlap * 10, 30);
        reasons.push(`Similar intent`);
      }
    }

    if (userDurationRange) {
      const [userMin, userMax] = userDurationRange;
      const [sessMin, sessMax] = session.durationRange;
      if (userMin <= sessMax && userMax >= sessMin) {
        score += 20;
        reasons.push(`Duration: ${sessMin}-${sessMax}min`);
      }
    }

    if (userPatterns && userPatterns.topTopics.includes(session.topic.toLowerCase())) {
      score += 10;
      reasons.push(`Your frequent topic`);
    }

    if (score > 20 && reasons.length > 0) {
      matches.push({
        sessionId: session.id,
        matchScore: Math.min(score, 100),
        matchReasons: reasons.slice(0, 3),
        session: {
          intent: session.intent,
          topic: session.topic,
          durationRange: session.durationRange,
          participantCount: session.participantCount,
        },
      });
    }
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
}

interface WarmupPromptInput {
  intent: string;
  topic: string;
  duration: number;
}

/**
 * Generate AI-powered warmup prompt to help users transition into focus mode
 */
export async function generateWarmupPrompt(input: WarmupPromptInput): Promise<string> {
  const { intent, topic, duration } = input;

  try {
    const response = await generateText({
      provider: AI_PROVIDER,
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a mindfulness coach helping people transition into deep focus work.

Generate a brief, calming warmup prompt (2-3 sentences max) that:
- Acknowledges what they're about to work on
- Suggests one practical preparation action
- Sets a positive, focused tone

Keep it concise and actionable. No emojis. Direct address ("you").`
        },
        {
          role: 'user',
          content: `Create a warmup prompt for someone about to focus on:
Topic: ${topic}
Intent: "${intent}"
Duration: ${duration} minutes`
        }
      ],
      temperature: 0.7,
      maxTokens: 150,
    });

    return response.text.trim();

  } catch (error) {
    console.error('AI warmup prompt generation failed:', error);
    return `Take a deep breath. For the next ${duration} minutes, your focus is on: "${intent}". Close any tabs you won't need.`;
  }
}

interface CooldownPromptInput {
  intent: string;
  topic: string;
  duration: number;
}

/**
 * Generate AI-powered cooldown prompt for session wrap-up
 */
export async function generateCooldownPrompt(input: CooldownPromptInput): Promise<string> {
  const { intent, topic, duration } = input;

  try {
    const response = await generateText({
      provider: AI_PROVIDER,
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a mindfulness coach helping people transition out of deep focus work.

Generate a brief cooldown prompt (2-3 sentences max) that:
- Acknowledges the completed focus session
- Prompts brief reflection on accomplishments
- Suggests a healthy transition (break, stretch, etc.)

Keep it concise and positive. No emojis. Direct address ("you").`
        },
        {
          role: 'user',
          content: `Create a cooldown prompt for someone who just finished:
Topic: ${topic}
Intent: "${intent}"
Duration: ${duration} minutes`
        }
      ],
      temperature: 0.7,
      maxTokens: 150,
    });

    return response.text.trim();

  } catch (error) {
    console.error('AI cooldown prompt generation failed:', error);
    return `${duration} minutes complete. Take a moment to reflect: What did you accomplish on "${intent}"? Now stretch and take a short break.`;
  }
}

interface SessionSummaryInput {
  intent: string;
  topic: string;
  duration: number;
  participantOutcome: string;
  cohortCompletionRate: number;
}

/**
 * Generate AI-powered session summary with insights
 */
export async function generateSessionSummary(input: SessionSummaryInput): Promise<string> {
  const { intent, topic, duration, participantOutcome, cohortCompletionRate } = input;

  try {
    const response = await generateText({
      provider: AI_PROVIDER,
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a productivity coach summarizing focus sessions.

Generate a brief, encouraging summary (2-3 sentences) that:
- Acknowledges what was accomplished
- Mentions cohort context if relevant
- Provides a small insight about focus habits
- Adapts tone based on outcome (completed/partial/interrupted)

Keep it concise and supportive. No emojis. Direct address ("you").`
        },
        {
          role: 'user',
          content: `Summarize this focus session:
Topic: ${topic}
Intent: "${intent}"
Duration: ${duration} minutes
User Outcome: ${participantOutcome}
Cohort Completion Rate: ${Math.round(cohortCompletionRate * 100)}%`
        }
      ],
      temperature: 0.6,
      maxTokens: 200,
    });

    return response.text.trim();

  } catch (error) {
    console.error('AI session summary generation failed:', error);
    const completionPercent = Math.round(cohortCompletionRate * 100);
    if (participantOutcome === 'completed') {
      return `You completed ${duration} minutes of focused ${topic} work on "${intent}". ${completionPercent}% of your cohort finished together.`;
    } else if (participantOutcome === 'partial') {
      return `You made progress on "${intent}" in ${topic}. Even partial focus counts toward building your practice.`;
    } else {
      return `Session interrupted, but every attempt at focus builds the habit. Consider a shorter session next time.`;
    }
  }
}

interface NextStepInput {
  topic: string;
  completedDuration: number;
  outcome: string;
  focusPatterns?: FocusPatterns;
}

/**
 * Generate AI-powered next-step suggestion based on session and user patterns
 */
export async function generateNextStepSuggestion(input: NextStepInput): Promise<string> {
  const { topic, completedDuration, outcome, focusPatterns } = input;

  try {
    const patternsContext = focusPatterns
      ? `User patterns: Usually does ${focusPatterns.preferredDurationRange[0]}-${focusPatterns.preferredDurationRange[1]}min sessions, ${Math.round(focusPatterns.avgCompletionRate * 100)}% completion rate, ${focusPatterns.focusStreak} day streak.`
      : 'No historical patterns available.';

    const response = await generateText({
      provider: AI_PROVIDER,
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a productivity coach suggesting next steps after a focus session.

Generate ONE actionable suggestion (1-2 sentences) that:
- Is specific and practical
- Considers the session outcome and duration
- Uses user patterns if available to personalize
- Balances rest and productivity

Keep it concise. No emojis. Direct address ("you").`
        },
        {
          role: 'user',
          content: `Suggest next step after this session:
Topic: ${topic}
Duration: ${completedDuration} minutes
Outcome: ${outcome}
${patternsContext}`
        }
      ],
      temperature: 0.7,
      maxTokens: 100,
    });

    return response.text.trim();

  } catch (error) {
    console.error('AI next step suggestion failed:', error);
    if (outcome === 'completed') {
      if (completedDuration >= 45) {
        return `After ${completedDuration} minutes, take a 10-15 minute break before your next deep work session.`;
      } else if (completedDuration >= 25) {
        return `Great ${completedDuration}-minute session. A 5-minute break, then consider another round if you're in flow.`;
      } else {
        return `Quick win! Ready for another short burst of ${topic} focus, or time for something new?`;
      }
    } else if (outcome === 'partial') {
      return `Try a shorter session (15-20 min) next time. Building consistency matters more than duration.`;
    } else {
      return `No worries. When you're ready, start with a 15-minute ${topic} session to rebuild momentum.`;
    }
  }
}

interface DurationPredictionInput {
  requestedRange: number[];
  userPatterns?: FocusPatterns;
  topic: string;
}

/**
 * Predict optimal session duration using AI analysis of user patterns
 */
export async function predictOptimalDuration(input: DurationPredictionInput): Promise<number> {
  const { requestedRange, userPatterns, topic } = input;
  const [minRequested, maxRequested] = requestedRange;

  // If no user patterns, use middle of range
  if (!userPatterns) {
    return Math.round((minRequested + maxRequested) / 2 / 5) * 5;
  }

  try {
    const response = await generateText({
      provider: AI_PROVIDER,
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are analyzing focus session data to predict optimal duration.

Based on user patterns and requested range, suggest ONE optimal duration in minutes.
Consider:
- User's historical completion rate (lower = suggest shorter)
- User's preferred duration range
- Current streak (higher = can handle slightly longer)
- Topic familiarity

Respond with ONLY a number (the suggested duration in minutes).`
        },
        {
          role: 'user',
          content: `Predict optimal duration:
Requested Range: ${minRequested}-${maxRequested} minutes
Topic: ${topic}
User Patterns:
- Preferred duration: ${userPatterns.preferredDurationRange[0]}-${userPatterns.preferredDurationRange[1]} min
- Completion rate: ${Math.round(userPatterns.avgCompletionRate * 100)}%
- Focus streak: ${userPatterns.focusStreak} days
- Top topics: ${userPatterns.topTopics.join(', ') || 'varied'}

Return only a number.`
        }
      ],
      temperature: 0.3,
      maxTokens: 10,
    });

    const predicted = parseInt(response.text.trim(), 10);
    if (isNaN(predicted)) {
      throw new Error('AI returned non-numeric duration');
    }

    // Clamp to requested range and round to nearest 5
    const clamped = Math.max(minRequested, Math.min(maxRequested, predicted));
    return Math.round(clamped / 5) * 5;

  } catch (error) {
    console.error('AI duration prediction failed:', error);
    // Fallback logic
    let optimal = Math.round((minRequested + maxRequested) / 2);

    if (userPatterns.avgCompletionRate < 0.5) {
      optimal = Math.max(minRequested, optimal - 5);
    } else if (userPatterns.avgCompletionRate > 0.8 && userPatterns.focusStreak >= 3) {
      optimal = Math.min(maxRequested, optimal + 5);
    }

    return Math.round(optimal / 5) * 5;
  }
}

interface FocusInsightsInput {
  weeklyStats: Array<{
    weekStart: Date;
    focusMinutes: number;
    sessionCount: number;
    avgSessionDuration: number;
    preferredTopics: string[];
    preferredDurations: number[];
  }>;
  totalSessions: number;
  completionRate: number;
  focusStreak: number;
}

/**
 * Generate AI-powered insights from focus patterns
 */
export async function generateFocusInsights(input: FocusInsightsInput): Promise<{
  summary: string;
  strengths: string[];
  suggestions: string[];
}> {
  const { weeklyStats, totalSessions, completionRate, focusStreak } = input;

  if (totalSessions < 3) {
    return {
      summary: "Complete a few more sessions to unlock personalized insights about your focus patterns.",
      strengths: [],
      suggestions: ["Try to maintain consistency by focusing at the same time each day."],
    };
  }

  try {
    const recentWeeks = weeklyStats.slice(-4);
    const statsContext = recentWeeks.map(w =>
      `Week of ${w.weekStart.toLocaleDateString()}: ${w.focusMinutes}min total, ${w.sessionCount} sessions, avg ${w.avgSessionDuration}min, topics: ${w.preferredTopics.join(', ')}`
    ).join('\n');

    const response = await generateText({
      provider: AI_PROVIDER,
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are analyzing focus session data to provide personalized insights.

Generate a JSON response with:
- summary: Brief overall assessment (1-2 sentences)
- strengths: Array of 2-3 things they're doing well
- suggestions: Array of 2-3 actionable improvements

Keep each point concise (under 15 words). No emojis. Be specific and encouraging.

Response format (JSON only):
{"summary": "...", "strengths": ["...", "..."], "suggestions": ["...", "..."]}`
        },
        {
          role: 'user',
          content: `Analyze this user's focus patterns:

Total Sessions: ${totalSessions}
Overall Completion Rate: ${Math.round(completionRate * 100)}%
Current Streak: ${focusStreak} days

Recent Activity:
${statsContext}

Provide insights as JSON.`
        }
      ],
      temperature: 0.6,
      maxTokens: 400,
    });

    const text = response.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI response did not contain valid JSON');
    }

    const insights = JSON.parse(jsonMatch[0]) as {
      summary: string;
      strengths: string[];
      suggestions: string[];
    };

    return {
      summary: insights.summary || "Keep building your focus practice!",
      strengths: (insights.strengths || []).slice(0, 3),
      suggestions: (insights.suggestions || []).slice(0, 3),
    };

  } catch (error) {
    console.error('AI focus insights generation failed:', error);
    return {
      summary: `You've completed ${totalSessions} sessions with a ${Math.round(completionRate * 100)}% completion rate.`,
      strengths: completionRate > 0.7 ? ["Strong completion rate"] : [],
      suggestions: focusStreak < 3
        ? ["Try to focus at the same time each day to build a streak."]
        : ["Consider gradually increasing your session duration."],
    };
  }
}

/**
 * Analyze intent to extract topics and keywords for better matching
 */
export async function analyzeIntent(intent: string): Promise<{
  extractedTopics: string[];
  keywords: string[];
  category: string;
}> {
  try {
    const response = await generateText({
      provider: AI_PROVIDER,
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `Analyze a focus session intent and extract:
- extractedTopics: 1-3 relevant topic categories (e.g., "coding", "writing", "research")
- keywords: 3-5 important keywords from the intent
- category: Single best category (coding/writing/reading/studying/design/research/planning/creative/other)

Response as JSON only:
{"extractedTopics": [...], "keywords": [...], "category": "..."}`
        },
        {
          role: 'user',
          content: `Analyze this focus intent: "${intent}"`
        }
      ],
      temperature: 0.3,
      maxTokens: 150,
    });

    const text = response.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI response did not contain valid JSON');
    }

    const analysis = JSON.parse(jsonMatch[0]) as {
      extractedTopics: string[];
      keywords: string[];
      category: string;
    };

    return {
      extractedTopics: (analysis.extractedTopics || []).slice(0, 3),
      keywords: (analysis.keywords || []).slice(0, 5),
      category: analysis.category || 'other',
    };

  } catch (error) {
    console.error('AI intent analysis failed:', error);
    // Fallback: simple keyword extraction
    const words = intent.toLowerCase().split(/\s+/);
    const actionWords = ['write', 'code', 'read', 'study', 'design', 'plan', 'review', 'learn', 'practice', 'create', 'build', 'research'];
    const keywords = words.filter(w => w.length > 3);
    const category = actionWords.find(a => words.includes(a)) || 'other';

    return {
      extractedTopics: [category],
      keywords: keywords.slice(0, 5),
      category,
    };
  }
}

/**
 * Analyze focus patterns from historical data (non-AI helper)
 */
export function analyzeFocusPatterns(
  weeklyStats: Array<{
    focusMinutes: number;
    sessionCount: number;
    avgSessionDuration: number;
    preferredTopics: string[];
    preferredDurations: number[];
  }>
): FocusPatterns {
  if (weeklyStats.length === 0) {
    return {
      preferredDurationRange: [25, 30],
      topTopics: [],
      avgCompletionRate: 0,
      focusStreak: 0,
    };
  }

  const allDurations = weeklyStats.flatMap(w => w.preferredDurations);
  const avgDuration = allDurations.length > 0
    ? allDurations.reduce((a, b) => a + b, 0) / allDurations.length
    : 25;

  const variance = allDurations.length > 0
    ? allDurations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / allDurations.length
    : 25;
  const stdDev = Math.sqrt(variance);
  const prefMin = Math.max(5, Math.round(avgDuration - stdDev));
  const prefMax = Math.round(avgDuration + stdDev);

  const topicCounts: Record<string, number> = {};
  for (const week of weeklyStats) {
    for (const topic of week.preferredTopics) {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }
  }
  const topTopics = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([topic]) => topic);

  return {
    preferredDurationRange: [prefMin, prefMax],
    topTopics,
    avgCompletionRate: 0.7,
    focusStreak: 0,
  };
}
