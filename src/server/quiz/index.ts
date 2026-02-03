/**
 * Quiz Module
 * 
 * Provides AI-powered quiz generation from text/PDF content,
 * with multiple question types: multiple choice, true/false, fill-in-blank
 */

import { AuthError } from 'modelence';
import { Module, ObjectId } from 'modelence/server';
import { z } from 'zod';
import { dbQuizSets, dbQuizQuestions, dbQuizAttempts } from './db';
import { generateQuizFromText, GeneratedQuestion } from './ai';
import { parseFile } from '../flashcard/parser';

// Validation constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_CONTENT_LENGTH = 100000; // 100K characters

export default new Module('quiz', {
  stores: [dbQuizSets, dbQuizQuestions, dbQuizAttempts],
  
  queries: {
    /**
     * Get all public quizzes
     */
    async getPublicQuizzes(args) {
      const { limit = 50 } = z.object({
        limit: z.number().optional(),
      }).parse(args || {});

      const quizzes = await dbQuizSets.fetch(
        { isPublic: true },
        { sort: { createdAt: -1 }, limit }
      );

      return quizzes.map(quiz => ({
        _id: quiz._id.toString(),
        title: quiz.title,
        description: quiz.description,
        topic: quiz.topic,
        questionCount: quiz.questionCount,
        creatorName: quiz.creatorName || 'Anonymous',
        attemptCount: quiz.attemptCount,
        createdAt: quiz.createdAt,
      }));
    },

    /**
     * Get all quizzes for the current user
     */
    async getMyQuizzes(_args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const quizzes = await dbQuizSets.fetch(
        { userId: new ObjectId(user.id) },
        { sort: { updatedAt: -1 }, limit: 100 }
      );

      return quizzes.map(quiz => ({
        _id: quiz._id.toString(),
        title: quiz.title,
        description: quiz.description,
        topic: quiz.topic,
        questionCount: quiz.questionCount,
        isPublic: quiz.isPublic,
        attemptCount: quiz.attemptCount,
        bestScore: quiz.bestScore,
        lastScore: quiz.lastScore,
        lastAttemptAt: quiz.lastAttemptAt,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt,
      }));
    },

    /**
     * Get a single quiz with questions for taking
     */
    async getQuiz(args, { user }) {
      const { quizId } = z.object({
        quizId: z.string(),
      }).parse(args);

      const quiz = await dbQuizSets.findOne({
        _id: new ObjectId(quizId),
      });

      if (!quiz) {
        throw new Error('Quiz not found');
      }

      // Check access: owner OR public
      const isOwner = user && quiz.userId.toString() === user.id;
      if (!isOwner && !quiz.isPublic) {
        throw new Error('Quiz not found');
      }

      const questions = await dbQuizQuestions.fetch(
        { quizId: new ObjectId(quizId) },
        { sort: { order: 1 } }
      );

      return {
        _id: quiz._id.toString(),
        title: quiz.title,
        description: quiz.description,
        topic: quiz.topic,
        questionCount: quiz.questionCount,
        isPublic: quiz.isPublic,
        isOwner: user ? quiz.userId.toString() === user.id : false,
        creatorName: quiz.creatorName,
        attemptCount: quiz.attemptCount,
        bestScore: quiz.bestScore,
        createdAt: quiz.createdAt,
        questions: questions.map(q => ({
          _id: q._id.toString(),
          type: q.type,
          question: q.question,
          options: q.options,
          // Don't expose correct answer until submission
        })),
      };
    },

    /**
     * Get quiz questions with answers (for review after attempt)
     */
    async getQuizWithAnswers(args, { user }) {
      const { quizId, attemptId } = z.object({
        quizId: z.string(),
        attemptId: z.string(),
      }).parse(args);

      // Verify the attempt belongs to user
      const attempt = await dbQuizAttempts.findOne({
        _id: new ObjectId(attemptId),
        quizId: new ObjectId(quizId),
        userId: new ObjectId(user?.id || ''),
      });

      if (!attempt) {
        throw new Error('Attempt not found');
      }

      const quiz = await dbQuizSets.findOne({
        _id: new ObjectId(quizId),
      });

      if (!quiz) {
        throw new Error('Quiz not found');
      }

      const questions = await dbQuizQuestions.fetch(
        { quizId: new ObjectId(quizId) },
        { sort: { order: 1 } }
      );

      return {
        _id: quiz._id.toString(),
        title: quiz.title,
        questions: questions.map(q => ({
          _id: q._id.toString(),
          type: q.type,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        })),
        attempt: {
          score: attempt.score,
          correctAnswers: attempt.correctAnswers,
          totalQuestions: attempt.totalQuestions,
          answers: attempt.answers,
        },
      };
    },

    /**
     * Get user's quiz history
     */
    async getQuizHistory(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { quizId, limit = 20 } = z.object({
        quizId: z.string().optional(),
        limit: z.number().optional(),
      }).parse(args || {});

      const query: Record<string, unknown> = { userId: new ObjectId(user.id) };
      if (quizId) {
        query.quizId = new ObjectId(quizId);
      }

      const attempts = await dbQuizAttempts.fetch(
        query,
        { sort: { completedAt: -1 }, limit }
      );

      return attempts.map(attempt => ({
        _id: attempt._id.toString(),
        quizId: attempt.quizId.toString(),
        score: attempt.score,
        correctAnswers: attempt.correctAnswers,
        totalQuestions: attempt.totalQuestions,
        durationSeconds: attempt.durationSeconds,
        completedAt: attempt.completedAt,
      }));
    },
  },

  mutations: {
    /**
     * Generate quiz from text content or file
     */
    async generateQuiz(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { content, fileContent, sourceType, sourceFileName, maxQuestions, difficulty, questionTypes, isPublic, creatorName } = z.object({
        content: z.string().optional(),
        fileContent: z.string().optional(),
        sourceType: z.enum(['text', 'pdf', 'docx', 'txt', 'md']),
        sourceFileName: z.string().optional(),
        maxQuestions: z.number().min(5).max(30).optional(),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
        questionTypes: z.enum(['multiple_choice', 'true_false', 'fill_blank', 'mixed']).optional(),
        isPublic: z.boolean().optional(),
        creatorName: z.string().optional(),
      }).parse(args);

      // Get text content
      let textContent: string;
      
      if (sourceType === 'text') {
        if (!content || content.length < 50) {
          throw new Error('Content must be at least 50 characters');
        }
        if (content.length > MAX_CONTENT_LENGTH) {
          throw new Error(`Content is too long. Maximum ${MAX_CONTENT_LENGTH.toLocaleString()} characters allowed.`);
        }
        textContent = content;
      } else {
        if (!fileContent) {
          throw new Error('File content is required for file uploads');
        }
        
        const buffer = Buffer.from(fileContent, 'base64');
        if (buffer.length > MAX_FILE_SIZE) {
          throw new Error('File size must be less than 5MB');
        }
        
        textContent = await parseFile(buffer, sourceType as 'pdf' | 'docx' | 'txt' | 'md', sourceFileName);
        
        if (textContent.length < 50) {
          throw new Error('Extracted content is too short.');
        }
        
        if (textContent.length > MAX_CONTENT_LENGTH) {
          throw new Error(`Extracted content is too long. Maximum ${MAX_CONTENT_LENGTH.toLocaleString()} characters allowed.`);
        }
      }

      // Generate quiz using AI
      const result = await generateQuizFromText(textContent, {
        maxQuestions: maxQuestions || 15,
        difficulty: difficulty || 'intermediate',
        questionTypes: questionTypes || 'mixed',
      });

      if (result.questions.length === 0) {
        throw new Error('Could not generate quiz from this content. Please try different material.');
      }

      // Create the quiz set
      const now = new Date();
      const userObjectId = new ObjectId(user.id);
      
      const setResult = await dbQuizSets.insertOne({
        userId: userObjectId,
        title: result.title,
        description: result.description,
        topic: result.topic,
        isPublic: isPublic || false,
        creatorName: creatorName,
        sourceType,
        sourceFileName,
        sourceTextPreview: textContent.slice(0, 200),
        questionCount: result.questions.length,
        attemptCount: 0,
        createdAt: now,
        updatedAt: now,
      });

      const quizId = setResult.insertedId;

      // Insert all questions
      const questionsToInsert = result.questions.map((q: GeneratedQuestion, index: number) => ({
        quizId,
        userId: userObjectId,
        type: q.type,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        timesAnswered: 0,
        timesCorrect: 0,
        order: index,
        createdAt: now,
      }));

      await dbQuizQuestions.insertMany(questionsToInsert);

      return {
        quizId: quizId.toString(),
        title: result.title,
        questionCount: result.questions.length,
      };
    },

    /**
     * Submit quiz answers and record attempt
     */
    async submitQuiz(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { quizId, answers, durationSeconds } = z.object({
        quizId: z.string(),
        answers: z.array(z.object({
          questionId: z.string(),
          answer: z.string(),
        })),
        durationSeconds: z.number(),
      }).parse(args);

      // Get quiz and questions
      const quiz = await dbQuizSets.findOne({
        _id: new ObjectId(quizId),
      });

      if (!quiz) {
        throw new Error('Quiz not found');
      }

      // Check access
      const isOwner = quiz.userId.toString() === user.id;
      if (!isOwner && !quiz.isPublic) {
        throw new Error('Quiz not found');
      }

      const questions = await dbQuizQuestions.fetch(
        { quizId: new ObjectId(quizId) }
      );

      const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

      // Helper to normalize text for comparison (especially for fill-in-blank)
      const normalizeAnswer = (text: string): string => {
        return text
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ')        // Normalize multiple spaces
          .replace(/['']/g, "'")       // Normalize apostrophes
          .replace(/[""]/g, '"')       // Normalize quotes
          .replace(/[.,!?;:]+$/g, ''); // Remove trailing punctuation
      };

      // Grade answers
      let correctCount = 0;
      const gradedAnswers = answers.map(a => {
        const question = questionMap.get(a.questionId);
        if (!question) {
          return { questionId: a.questionId, userAnswer: a.answer, isCorrect: false };
        }

        // Normalize answers for comparison
        const userAnswer = normalizeAnswer(a.answer);
        const correctAnswer = normalizeAnswer(question.correctAnswer);
        
        const isCorrect = userAnswer === correctAnswer;
        if (isCorrect) correctCount++;

        return {
          questionId: a.questionId,
          userAnswer: a.answer,
          isCorrect,
        };
      });

      const totalQuestions = questions.length;
      const score = Math.round((correctCount / totalQuestions) * 100);

      // Record attempt
      const now = new Date();
      const attemptResult = await dbQuizAttempts.insertOne({
        quizId: new ObjectId(quizId),
        userId: new ObjectId(user.id),
        totalQuestions,
        correctAnswers: correctCount,
        score,
        answers: gradedAnswers,
        startedAt: new Date(now.getTime() - durationSeconds * 1000),
        completedAt: now,
        durationSeconds,
      });

      // Update quiz stats
      const newBestScore = quiz.bestScore !== undefined 
        ? Math.max(quiz.bestScore, score)
        : score;

      await dbQuizSets.updateOne(
        { _id: new ObjectId(quizId) },
        {
          $set: { 
            lastAttemptAt: now, 
            updatedAt: now,
            lastScore: score,
            bestScore: newBestScore,
          },
          $inc: { attemptCount: 1 },
        }
      );

      // Update question stats
      for (const answer of gradedAnswers) {
        await dbQuizQuestions.updateOne(
          { _id: new ObjectId(answer.questionId) },
          {
            $inc: { 
              timesAnswered: 1,
              timesCorrect: answer.isCorrect ? 1 : 0,
            },
          }
        );
      }

      return {
        attemptId: attemptResult.insertedId.toString(),
        score,
        correctAnswers: correctCount,
        totalQuestions,
        bestScore: newBestScore,
      };
    },

    /**
     * Delete a quiz
     */
    async deleteQuiz(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { quizId } = z.object({
        quizId: z.string(),
      }).parse(args);

      const quiz = await dbQuizSets.findOne({
        _id: new ObjectId(quizId),
        userId: new ObjectId(user.id),
      });

      if (!quiz) {
        throw new Error('Quiz not found');
      }

      // Delete all questions
      await dbQuizQuestions.deleteMany({ quizId: new ObjectId(quizId) });

      // Delete all attempts
      await dbQuizAttempts.deleteMany({ quizId: new ObjectId(quizId) });

      // Delete the quiz
      await dbQuizSets.deleteOne({ _id: new ObjectId(quizId) });

      return { success: true };
    },

    /**
     * Toggle quiz visibility
     */
    async toggleQuizVisibility(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { quizId, isPublic, creatorName } = z.object({
        quizId: z.string(),
        isPublic: z.boolean(),
        creatorName: z.string().optional(),
      }).parse(args);

      const quiz = await dbQuizSets.findOne({
        _id: new ObjectId(quizId),
        userId: new ObjectId(user.id),
      });

      if (!quiz) {
        throw new Error('Quiz not found');
      }

      const updates: Record<string, unknown> = { 
        isPublic, 
        updatedAt: new Date() 
      };
      
      if (creatorName !== undefined) {
        updates.creatorName = creatorName;
      }

      await dbQuizSets.updateOne(
        { _id: new ObjectId(quizId) },
        { $set: updates }
      );

      return { success: true, isPublic };
    },
  },
});
