/**
 * AI utilities for Quiz generation
 * 
 * Uses Z.AI's GLM-4.7-Flash model to generate quiz questions from text content.
 * Supports: Multiple Choice, True/False, Fill in the Blank
 */

import { generateText } from '../lib/zai';

export interface GeneratedQuestion {
  type: 'multiple_choice' | 'true_false' | 'fill_blank';
  question: string;
  options?: string[];  // For multiple_choice only
  correctAnswer: string;
  explanation?: string;
}

export interface QuizGenerationResult {
  title: string;
  description: string;
  topic: string;
  questions: GeneratedQuestion[];
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'mixed';

/**
 * Generate quiz questions from text content using AI
 */
export async function generateQuizFromText(
  content: string,
  options: {
    maxQuestions?: number;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    questionTypes?: QuestionType;
  } = {}
): Promise<QuizGenerationResult> {
  const { maxQuestions = 15, difficulty = 'intermediate', questionTypes = 'mixed' } = options;
  
  // Truncate content if too long
  const maxContentLength = 30000;
  const truncatedContent = content.length > maxContentLength 
    ? content.slice(0, maxContentLength) + '\n\n[Content truncated...]'
    : content;

  // Build question type instruction
  let typeInstruction = '';
  if (questionTypes === 'multiple_choice') {
    typeInstruction = 'Generate ONLY multiple choice questions with 4 options (A, B, C, D).';
  } else if (questionTypes === 'true_false') {
    typeInstruction = 'Generate ONLY true/false questions.';
  } else if (questionTypes === 'fill_blank') {
    typeInstruction = 'Generate ONLY fill-in-the-blank questions. Use "___" to indicate the blank.';
  } else {
    typeInstruction = 'Mix question types: multiple choice (4 options), true/false, and fill-in-the-blank.';
  }

  try {
    const response = await generateText({
      messages: [
        {
          role: 'system',
          content: `You are an expert educator creating quiz questions for testing knowledge.

Your task:
1. Analyze the provided learning material
2. Create ${maxQuestions} quiz questions to test understanding
3. Make questions suitable for ${difficulty} level learners
4. ${typeInstruction}

Question Types Format:
- multiple_choice: Has "options" array with 4 choices, "correctAnswer" is the correct option text
- true_false: No options, "correctAnswer" is either "true" or "false"  
- fill_blank: Question contains "___" for blank, "correctAnswer" is the word/phrase to fill

Guidelines:
- Questions should be clear and unambiguous
- Test important concepts, not trivial details
- Wrong options should be plausible but clearly incorrect
- Include brief explanations to aid learning

Response format (JSON only, no markdown):
{
  "title": "Quiz title",
  "description": "What this quiz covers",
  "topic": "Main subject area",
  "questions": [
    {
      "type": "multiple_choice",
      "question": "What is X?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Brief explanation"
    },
    {
      "type": "true_false",
      "question": "Statement to evaluate",
      "correctAnswer": "true",
      "explanation": "Why it's true/false"
    },
    {
      "type": "fill_blank",
      "question": "The capital of France is ___",
      "correctAnswer": "Paris",
      "explanation": "Brief explanation"
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Create quiz questions from this material:\n\n${truncatedContent}`
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

    const result = JSON.parse(jsonMatch[0]) as QuizGenerationResult;
    
    // Validate and clean the result
    return {
      title: result.title || 'Untitled Quiz',
      description: result.description || '',
      topic: result.topic || 'General',
      questions: (result.questions || []).slice(0, maxQuestions).map((q, index) => {
        // Normalize question type
        const type = validateQuestionType(q.type);
        
        return {
          type,
          question: q.question || `Question ${index + 1}`,
          options: type === 'multiple_choice' ? (q.options || []).slice(0, 4) : undefined,
          correctAnswer: q.correctAnswer || '',
          explanation: q.explanation,
        };
      }).filter(q => q.correctAnswer), // Remove questions without answers
    };

  } catch (error) {
    console.error('AI quiz generation failed:', error);
    throw new Error('Failed to generate quiz. Please try again.');
  }
}

function validateQuestionType(type: string): 'multiple_choice' | 'true_false' | 'fill_blank' {
  if (type === 'true_false' || type === 'truefalse' || type === 'boolean') {
    return 'true_false';
  }
  if (type === 'fill_blank' || type === 'fill_in_blank' || type === 'fillblank') {
    return 'fill_blank';
  }
  return 'multiple_choice';
}

/**
 * Analyze text to suggest quiz parameters
 */
export async function analyzeContentForQuiz(content: string): Promise<{
  suggestedTitle: string;
  suggestedTopics: string[];
  estimatedQuestionCount: number;
  recommendedTypes: QuestionType;
}> {
  try {
    const preview = content.slice(0, 5000);
    
    const response = await generateText({
      messages: [
        {
          role: 'system',
          content: `Analyze this learning material for quiz generation.

Response format (JSON only):
{
  "suggestedTitle": "Quiz title",
  "suggestedTopics": ["topic1", "topic2"],
  "estimatedQuestionCount": 15,
  "recommendedTypes": "mixed"
}`
        },
        {
          role: 'user',
          content: `Analyze:\n\n${preview}`
        }
      ],
      temperature: 0.3,
      maxTokens: 300,
    });

    const text = response.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const result = JSON.parse(jsonMatch[0]);
    return {
      suggestedTitle: result.suggestedTitle || 'Quiz',
      suggestedTopics: result.suggestedTopics || [],
      estimatedQuestionCount: Math.min(result.estimatedQuestionCount || 15, 30),
      recommendedTypes: result.recommendedTypes || 'mixed',
    };

  } catch (error) {
    console.error('Content analysis failed:', error);
    return {
      suggestedTitle: 'Quiz',
      suggestedTopics: [],
      estimatedQuestionCount: 15,
      recommendedTypes: 'mixed',
    };
  }
}
