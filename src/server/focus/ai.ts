import { generateText } from '../lib/zai';

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

export async function generateCohortMatches(input: CohortMatchInput): Promise<CohortMatch[]> {
  const { userIntent, userTopic, userDurationRange, userPatterns, availableSessions } = input;

  if (availableSessions.length === 0) {
    return [];
  }

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

interface CooldownPromptInput {
  intent: string;
  topic: string;
  duration: number;
}

export async function generateCooldownPrompt(input: CooldownPromptInput): Promise<string> {
  const { intent, topic, duration } = input;

  try {
    const response = await generateText({
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


interface DurationPredictionInput {
  requestedRange: number[];
  userPatterns?: FocusPatterns;
  topic: string;
}

export async function predictOptimalDuration(input: DurationPredictionInput): Promise<number> {
  const { requestedRange, userPatterns, topic } = input;
  const [minRequested, maxRequested] = requestedRange;

  if (!userPatterns) {
    return Math.round((minRequested + maxRequested) / 2 / 5) * 5;
  }

  try {
    const response = await generateText({
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

    const clamped = Math.max(minRequested, Math.min(maxRequested, predicted));
    return Math.round(clamped / 5) * 5;

  } catch (error) {
    console.error('AI duration prediction failed:', error);
    let optimal = Math.round((minRequested + maxRequested) / 2);

    if (userPatterns.avgCompletionRate < 0.5) {
      optimal = Math.max(minRequested, optimal - 5);
    } else if (userPatterns.avgCompletionRate > 0.8 && userPatterns.focusStreak >= 3) {
      optimal = Math.min(maxRequested, optimal + 5);
    }

    return Math.round(optimal / 5) * 5;
  }
}
