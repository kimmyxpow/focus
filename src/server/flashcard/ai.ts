/**
 * AI utilities for Flashcard generation
 * 
 * Uses Z.AI's GLM-4.7-Flash model via HTTP API to generate flashcards from text content.
 * API Docs: https://docs.z.ai/guides/develop/http/introduction.md
 * Model: glm-4.7-flash (lightweight, completely free)
 */

import { generateText } from '../lib/zai';

export interface GeneratedFlashcard {
  front: string;
  back: string;
  hint?: string;
  explanation?: string;
  wrongOptions?: string[];  // For quiz mode
}

export interface FlashcardGenerationResult {
  title: string;
  description: string;
  topic: string;
  cards: GeneratedFlashcard[];
}

/**
 * Generate flashcards from text content using AI
 */
export async function generateFlashcardsFromText(
  content: string,
  options: {
    maxCards?: number;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    includeQuizOptions?: boolean;
  } = {}
): Promise<FlashcardGenerationResult> {
  const { maxCards = 20, difficulty = 'intermediate', includeQuizOptions = true } = options;
  
  // Truncate content if too long (model has token limits)
  const maxContentLength = 30000;
  const truncatedContent = content.length > maxContentLength 
    ? content.slice(0, maxContentLength) + '\n\n[Content truncated...]'
    : content;

  try {
    const response = await generateText({
      messages: [
        {
          role: 'system',
          content: `You are an expert educator creating flashcards for studying and memorization.

Your task:
1. Analyze the provided learning material
2. Extract the most important concepts, terms, facts, and relationships
3. Create clear, concise flashcards suitable for ${difficulty} level learners
4. Each card should test ONE specific piece of knowledge

Guidelines:
- Front: Write a clear question or term (keep it concise)
- Back: Write the answer or definition (complete but brief)
- Hint: Optional clue to help remember (1-2 words)
- Explanation: Brief context why this is important (1 sentence)
${includeQuizOptions ? '- WrongOptions: 3 plausible but incorrect alternatives for multiple choice' : ''}

Generate up to ${maxCards} flashcards.
Focus on the most important and exam-worthy content.

Response format (JSON only, no markdown):
{
  "title": "Brief descriptive title for this card set",
  "description": "1-2 sentence description of what this covers",
  "topic": "Main topic/subject area",
  "cards": [
    {
      "front": "Question or term",
      "back": "Answer or definition",
      "hint": "Optional hint",
      "explanation": "Why this matters"${includeQuizOptions ? ',\n      "wrongOptions": ["wrong1", "wrong2", "wrong3"]' : ''}
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Create flashcards from this learning material:\n\n${truncatedContent}`
        }
      ],
      temperature: 0.4,
      maxTokens: 8000,
    });

    // Parse AI response
    const text = response.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('AI response did not contain valid JSON:', text);
      throw new Error('Failed to parse AI response');
    }

    const result = JSON.parse(jsonMatch[0]) as FlashcardGenerationResult;
    
    // Validate and clean the result
    return {
      title: result.title || 'Untitled Flashcard Set',
      description: result.description || '',
      topic: result.topic || 'General',
      cards: (result.cards || []).slice(0, maxCards).map((card, index) => ({
        front: card.front || `Question ${index + 1}`,
        back: card.back || 'No answer provided',
        hint: card.hint,
        explanation: card.explanation,
        wrongOptions: includeQuizOptions ? (card.wrongOptions || []).slice(0, 3) : undefined,
      })),
    };

  } catch (error) {
    console.error('AI flashcard generation failed:', error);
    throw new Error('Failed to generate flashcards. Please try again.');
  }
}

/**
 * Generate additional quiz options for existing flashcards
 */
export async function generateQuizOptions(
  cards: Array<{ front: string; back: string }>
): Promise<Array<{ front: string; back: string; wrongOptions: string[] }>> {
  try {
    const response = await generateText({
      messages: [
        {
          role: 'system',
          content: `You are creating multiple choice quiz options for flashcards.

For each flashcard, generate 3 plausible but WRONG answer options.
The wrong options should:
- Be believable and similar in style to the correct answer
- Test common misconceptions
- Be clearly incorrect to someone who knows the material

Response format (JSON array only):
[
  {
    "front": "original question",
    "back": "correct answer",
    "wrongOptions": ["wrong1", "wrong2", "wrong3"]
  }
]`
        },
        {
          role: 'user',
          content: `Generate wrong options for these flashcards:\n\n${JSON.stringify(cards, null, 2)}`
        }
      ],
      temperature: 0.5,
      maxTokens: 4000,
    });

    const text = response.text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    console.error('AI quiz options generation failed:', error);
    // Return original cards with empty wrong options
    return cards.map(card => ({ ...card, wrongOptions: [] }));
  }
}

/**
 * Analyze text to suggest flashcard topics and estimate card count
 */
export async function analyzeContent(content: string): Promise<{
  suggestedTitle: string;
  suggestedTopics: string[];
  estimatedCardCount: number;
  contentType: string;
  keyTermsPreview: string[];
}> {
  try {
    // Quick analysis without full card generation
    const preview = content.slice(0, 5000);
    
    const response = await generateText({
      messages: [
        {
          role: 'system',
          content: `Analyze this learning material and provide a quick assessment.

Response format (JSON only):
{
  "suggestedTitle": "Brief title for flashcard set",
  "suggestedTopics": ["topic1", "topic2", "topic3"],
  "estimatedCardCount": 15,
  "contentType": "textbook|notes|article|technical|other",
  "keyTermsPreview": ["term1", "term2", "term3", "term4", "term5"]
}`
        },
        {
          role: 'user',
          content: `Analyze this content:\n\n${preview}`
        }
      ],
      temperature: 0.3,
      maxTokens: 500,
    });

    const text = response.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const result = JSON.parse(jsonMatch[0]);
    return {
      suggestedTitle: result.suggestedTitle || 'Study Material',
      suggestedTopics: result.suggestedTopics || [],
      estimatedCardCount: Math.min(result.estimatedCardCount || 10, 50),
      contentType: result.contentType || 'other',
      keyTermsPreview: result.keyTermsPreview || [],
    };

  } catch (error) {
    console.error('Content analysis failed:', error);
    return {
      suggestedTitle: 'Study Material',
      suggestedTopics: [],
      estimatedCardCount: 10,
      contentType: 'other',
      keyTermsPreview: [],
    };
  }
}
