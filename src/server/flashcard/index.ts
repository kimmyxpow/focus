/**
 * Flashcard Module
 * 
 * Provides AI-powered flashcard generation from text/PDF content,
 * with study and quiz modes for learning.
 */

import { AuthError } from 'modelence';
import { Module, ObjectId } from 'modelence/server';
import { z } from 'zod';
import { dbFlashcardSets, dbFlashcards, dbFlashcardStudySessions } from './db';
import { generateFlashcardsFromText, analyzeContent, GeneratedFlashcard } from './ai';
import { parseFile } from './parser';

// Validation constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_CONTENT_LENGTH = 100000; // 100K characters

export default new Module('flashcard', {
  stores: [dbFlashcardSets, dbFlashcards, dbFlashcardStudySessions],
  
  queries: {
    /**
     * Get all public flashcard sets for the directory
     */
    async getPublicFlashcardSets(args) {
      const { limit = 50 } = z.object({
        limit: z.number().optional(),
      }).parse(args || {});

      const sets = await dbFlashcardSets.fetch(
        { isPublic: true },
        { sort: { createdAt: -1 }, limit }
      );

      return sets.map(set => ({
        _id: set._id.toString(),
        title: set.title,
        description: set.description,
        topic: set.topic,
        cardCount: set.cardCount,
        creatorName: set.creatorName || 'Anonymous',
        studyCount: set.studyCount,
        quizCount: set.quizCount,
        createdAt: set.createdAt,
      }));
    },

    /**
     * Get all flashcard sets for the current user
     */
    async getFlashcardSets(_args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const sets = await dbFlashcardSets.fetch(
        { userId: new ObjectId(user.id) },
        { sort: { updatedAt: -1 }, limit: 100 }
      );

      return sets.map(set => ({
        _id: set._id.toString(),
        title: set.title,
        description: set.description,
        topic: set.topic,
        cardCount: set.cardCount,
        isPublic: set.isPublic,
        lastStudiedAt: set.lastStudiedAt,
        studyCount: set.studyCount,
        quizCount: set.quizCount,
        bestScore: set.bestScore,
        createdAt: set.createdAt,
        updatedAt: set.updatedAt,
      }));
    },

    /**
     * Get a single flashcard set with all cards
     * Accessible to owner or if set is public
     */
    async getFlashcardSet(args, { user }) {
      const { setId } = z.object({
        setId: z.string(),
      }).parse(args);

      const set = await dbFlashcardSets.findOne({
        _id: new ObjectId(setId),
      });

      if (!set) {
        throw new Error('Flashcard set not found');
      }

      // Check access: owner OR public
      const isOwner = user && set.userId.toString() === user.id;
      if (!isOwner && !set.isPublic) {
        throw new Error('Flashcard set not found');
      }

      const cards = await dbFlashcards.fetch(
        { setId: new ObjectId(setId) },
        { sort: { order: 1 } }
      );

      return {
        _id: set._id.toString(),
        title: set.title,
        description: set.description,
        topic: set.topic,
        sourceType: set.sourceType,
        sourceFileName: set.sourceFileName,
        cardCount: set.cardCount,
        isPublic: set.isPublic,
        isOwner: user ? set.userId.toString() === user.id : false,
        creatorName: set.creatorName,
        lastStudiedAt: set.lastStudiedAt,
        studyCount: set.studyCount,
        quizCount: set.quizCount,
        bestScore: set.bestScore,
        lastQuizScore: set.lastQuizScore,
        createdAt: set.createdAt,
        updatedAt: set.updatedAt,
        cards: cards.map(card => ({
          _id: card._id.toString(),
          front: card.front,
          back: card.back,
          hint: card.hint,
          explanation: card.explanation,
          wrongOptions: card.wrongOptions,
          difficulty: card.difficulty,
          reviewCount: card.reviewCount,
          correctCount: card.correctCount,
          order: card.order,
        })),
      };
    },

    /**
     * Get cards for study mode (optionally filtered by due for review)
     * Accessible to owner or if set is public
     */
    async getCardsForStudy(args, { user }) {
      const { setId, limit = 20, shuffled = true } = z.object({
        setId: z.string(),
        limit: z.number().optional(),
        shuffled: z.boolean().optional(),
      }).parse(args);

      // Verify access
      const set = await dbFlashcardSets.findOne({
        _id: new ObjectId(setId),
      });

      if (!set) {
        throw new Error('Flashcard set not found');
      }

      // Check access: owner OR public
      const isOwner = user && set.userId.toString() === user.id;
      if (!isOwner && !set.isPublic) {
        throw new Error('Flashcard set not found');
      }

      let cards = await dbFlashcards.fetch(
        { setId: new ObjectId(setId) },
        { sort: { order: 1 }, limit }
      );

      // Shuffle if requested
      if (shuffled) {
        cards = [...cards].sort(() => Math.random() - 0.5);
      }

      return cards.map(card => ({
        _id: card._id.toString(),
        front: card.front,
        back: card.back,
        hint: card.hint,
        explanation: card.explanation,
        difficulty: card.difficulty,
      }));
    },

    /**
     * Get cards for quiz mode (with wrong options)
     * Accessible to owner or if set is public
     */
    async getCardsForQuiz(args, { user }) {
      const { setId, limit = 10 } = z.object({
        setId: z.string(),
        limit: z.number().optional(),
      }).parse(args);

      // Verify access
      const set = await dbFlashcardSets.findOne({
        _id: new ObjectId(setId),
      });

      if (!set) {
        throw new Error('Flashcard set not found');
      }

      // Check access: owner OR public
      const isOwner = user && set.userId.toString() === user.id;
      if (!isOwner && !set.isPublic) {
        throw new Error('Flashcard set not found');
      }

      const allCards = await dbFlashcards.fetch(
        { setId: new ObjectId(setId) },
        { sort: { order: 1 } }
      );

      // Shuffle and limit
      const shuffledCards = [...allCards]
        .sort(() => Math.random() - 0.5)
        .slice(0, limit);

      return shuffledCards.map(card => {
        // Shuffle options for each card
        const correctAnswer = card.back;
        const wrongOptions = card.wrongOptions || [];
        const allOptions = [correctAnswer, ...wrongOptions].sort(() => Math.random() - 0.5);

        return {
          _id: card._id.toString(),
          front: card.front,
          options: allOptions,
          correctIndex: allOptions.indexOf(correctAnswer),
          hint: card.hint,
          explanation: card.explanation,
        };
      });
    },

    /**
     * Analyze content before generating flashcards
     */
    async analyzeContentPreview(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { content } = z.object({
        content: z.string().min(50, 'Content must be at least 50 characters'),
      }).parse(args);

      return await analyzeContent(content);
    },

    /**
     * Get study history for a set
     */
    async getStudyHistory(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { setId, limit = 20 } = z.object({
        setId: z.string(),
        limit: z.number().optional(),
      }).parse(args);

      const sessions = await dbFlashcardStudySessions.fetch(
        { setId: new ObjectId(setId), userId: new ObjectId(user.id) },
        { sort: { startedAt: -1 }, limit }
      );

      return sessions.map(session => ({
        _id: session._id.toString(),
        mode: session.mode,
        cardsReviewed: session.cardsReviewed,
        correctAnswers: session.correctAnswers,
        wrongAnswers: session.wrongAnswers,
        score: session.score,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        durationSeconds: session.durationSeconds,
      }));
    },
  },

  mutations: {
    /**
     * Generate flashcards from text content or file
     */
    async generateFlashcards(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { content, fileContent, sourceType, sourceFileName, maxCards, difficulty, isPublic, creatorName } = z.object({
        content: z.string().optional(),
        fileContent: z.string().optional(), // Base64 encoded file content
        sourceType: z.enum(['text', 'pdf', 'docx', 'txt']),
        sourceFileName: z.string().optional(),
        maxCards: z.number().min(5).max(50).optional(),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
        isPublic: z.boolean().optional(),
        creatorName: z.string().optional(),
      }).parse(args);

      // Get text content - either directly or by parsing file
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
        // Parse file content
        if (!fileContent) {
          throw new Error('File content is required for file uploads');
        }
        
        // Validate file size (base64 is ~33% larger than binary)
        const buffer = Buffer.from(fileContent, 'base64');
        if (buffer.length > MAX_FILE_SIZE) {
          throw new Error('File size must be less than 5MB');
        }
        
        textContent = await parseFile(buffer, sourceType);
        
        if (textContent.length < 50) {
          throw new Error('Extracted content is too short. Please upload a file with more text content.');
        }
        
        // Also validate extracted content length
        if (textContent.length > MAX_CONTENT_LENGTH) {
          throw new Error(`Extracted content is too long. Maximum ${MAX_CONTENT_LENGTH.toLocaleString()} characters allowed. Try a shorter document.`);
        }
      }

      // Generate flashcards using AI
      const result = await generateFlashcardsFromText(textContent, {
        maxCards: maxCards || 20,
        difficulty: difficulty || 'intermediate',
        includeQuizOptions: true,
      });

      if (result.cards.length === 0) {
        throw new Error('Could not generate flashcards from this content. Please try different material.');
      }

      // Create the flashcard set
      const now = new Date();
      const userObjectId = new ObjectId(user.id);
      
      const setResult = await dbFlashcardSets.insertOne({
        userId: userObjectId,
        title: result.title,
        description: result.description,
        topic: result.topic,
        isPublic: isPublic || false,
        creatorName: creatorName,
        sourceType,
        sourceFileName,
        sourceTextPreview: textContent.slice(0, 200),
        cardCount: result.cards.length,
        studyCount: 0,
        quizCount: 0,
        createdAt: now,
        updatedAt: now,
      });

      const setId = setResult.insertedId;

      // Insert all cards
      const cardsToInsert = result.cards.map((card: GeneratedFlashcard, index: number) => ({
        setId,
        userId: userObjectId,
        front: card.front,
        back: card.back,
        hint: card.hint,
        explanation: card.explanation,
        wrongOptions: card.wrongOptions,
        difficulty: 0.5,  // Start at medium difficulty
        reviewCount: 0,
        correctCount: 0,
        order: index,
        createdAt: now,
      }));

      await dbFlashcards.insertMany(cardsToInsert);

      return {
        setId: setId.toString(),
        title: result.title,
        cardCount: result.cards.length,
      };
    },

    /**
     * Add a single card to an existing set
     */
    async addCard(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { setId, front, back, hint, explanation, wrongOptions } = z.object({
        setId: z.string(),
        front: z.string().min(1),
        back: z.string().min(1),
        hint: z.string().optional(),
        explanation: z.string().optional(),
        wrongOptions: z.array(z.string()).optional(),
      }).parse(args);

      // Verify ownership
      const set = await dbFlashcardSets.findOne({
        _id: new ObjectId(setId),
        userId: new ObjectId(user.id),
      });

      if (!set) {
        throw new Error('Flashcard set not found');
      }

      // Get next order number
      const lastCard = await dbFlashcards.findOne(
        { setId: new ObjectId(setId) },
        { sort: { order: -1 } }
      );
      const nextOrder = lastCard ? lastCard.order + 1 : 0;

      const now = new Date();
      const result = await dbFlashcards.insertOne({
        setId: new ObjectId(setId),
        userId: new ObjectId(user.id),
        front,
        back,
        hint,
        explanation,
        wrongOptions,
        difficulty: 0.5,
        reviewCount: 0,
        correctCount: 0,
        order: nextOrder,
        createdAt: now,
      });

      // Update card count
      await dbFlashcardSets.updateOne(
        { _id: new ObjectId(setId) },
        { $inc: { cardCount: 1 }, $set: { updatedAt: now } }
      );

      return { cardId: result.insertedId.toString() };
    },

    /**
     * Update a card
     */
    async updateCard(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { cardId, front, back, hint, explanation, wrongOptions } = z.object({
        cardId: z.string(),
        front: z.string().min(1).optional(),
        back: z.string().min(1).optional(),
        hint: z.string().nullable().optional(),
        explanation: z.string().nullable().optional(),
        wrongOptions: z.array(z.string()).nullable().optional(),
      }).parse(args);

      const card = await dbFlashcards.findOne({
        _id: new ObjectId(cardId),
        userId: new ObjectId(user.id),
      });

      if (!card) {
        throw new Error('Card not found');
      }

      const updates: Record<string, unknown> = {};
      if (front !== undefined) updates.front = front;
      if (back !== undefined) updates.back = back;
      if (hint !== undefined) updates.hint = hint;
      if (explanation !== undefined) updates.explanation = explanation;
      if (wrongOptions !== undefined) updates.wrongOptions = wrongOptions;

      await dbFlashcards.updateOne(
        { _id: new ObjectId(cardId) },
        { $set: updates }
      );

      // Update set's updatedAt
      await dbFlashcardSets.updateOne(
        { _id: card.setId },
        { $set: { updatedAt: new Date() } }
      );

      return { success: true };
    },

    /**
     * Delete a card
     */
    async deleteCard(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { cardId } = z.object({
        cardId: z.string(),
      }).parse(args);

      const card = await dbFlashcards.findOne({
        _id: new ObjectId(cardId),
        userId: new ObjectId(user.id),
      });

      if (!card) {
        throw new Error('Card not found');
      }

      await dbFlashcards.deleteOne({ _id: new ObjectId(cardId) });

      // Update card count
      await dbFlashcardSets.updateOne(
        { _id: card.setId },
        { $inc: { cardCount: -1 }, $set: { updatedAt: new Date() } }
      );

      return { success: true };
    },

    /**
     * Delete an entire flashcard set
     */
    async deleteFlashcardSet(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { setId } = z.object({
        setId: z.string(),
      }).parse(args);

      // Verify ownership
      const set = await dbFlashcardSets.findOne({
        _id: new ObjectId(setId),
        userId: new ObjectId(user.id),
      });

      if (!set) {
        throw new Error('Flashcard set not found');
      }

      // Delete all cards
      await dbFlashcards.deleteMany({ setId: new ObjectId(setId) });

      // Delete all study sessions
      await dbFlashcardStudySessions.deleteMany({ setId: new ObjectId(setId) });

      // Delete the set
      await dbFlashcardSets.deleteOne({ _id: new ObjectId(setId) });

      return { success: true };
    },

    /**
     * Update set metadata
     */
    async updateFlashcardSet(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { setId, title, description, topic } = z.object({
        setId: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        topic: z.string().nullable().optional(),
      }).parse(args);

      const set = await dbFlashcardSets.findOne({
        _id: new ObjectId(setId),
        userId: new ObjectId(user.id),
      });

      if (!set) {
        throw new Error('Flashcard set not found');
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (topic !== undefined) updates.topic = topic;

      await dbFlashcardSets.updateOne(
        { _id: new ObjectId(setId) },
        { $set: updates }
      );

      return { success: true };
    },

    /**
     * Toggle flashcard set visibility (public/private)
     */
    async toggleFlashcardSetVisibility(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { setId, isPublic, creatorName } = z.object({
        setId: z.string(),
        isPublic: z.boolean(),
        creatorName: z.string().optional(),
      }).parse(args);

      const set = await dbFlashcardSets.findOne({
        _id: new ObjectId(setId),
        userId: new ObjectId(user.id),
      });

      if (!set) {
        throw new Error('Flashcard set not found');
      }

      const updates: Record<string, unknown> = { 
        isPublic, 
        updatedAt: new Date() 
      };
      
      if (creatorName !== undefined) {
        updates.creatorName = creatorName;
      }

      await dbFlashcardSets.updateOne(
        { _id: new ObjectId(setId) },
        { $set: updates }
      );

      return { success: true, isPublic };
    },

    /**
     * Record study session completion
     */
    async recordStudySession(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { setId, cardsReviewed, correctAnswers, wrongAnswers, durationSeconds } = z.object({
        setId: z.string(),
        cardsReviewed: z.number(),
        correctAnswers: z.number(),
        wrongAnswers: z.number(),
        durationSeconds: z.number(),
      }).parse(args);

      const now = new Date();

      // Record the session
      await dbFlashcardStudySessions.insertOne({
        setId: new ObjectId(setId),
        userId: new ObjectId(user.id),
        mode: 'study',
        cardsReviewed,
        correctAnswers,
        wrongAnswers,
        startedAt: new Date(now.getTime() - durationSeconds * 1000),
        completedAt: now,
        durationSeconds,
      });

      // Update set stats
      await dbFlashcardSets.updateOne(
        { _id: new ObjectId(setId), userId: new ObjectId(user.id) },
        {
          $set: { lastStudiedAt: now, updatedAt: now },
          $inc: { studyCount: 1 },
        }
      );

      return { success: true };
    },

    /**
     * Record quiz completion
     */
    async recordQuizSession(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { setId, cardsReviewed, correctAnswers, wrongAnswers, score, durationSeconds } = z.object({
        setId: z.string(),
        cardsReviewed: z.number(),
        correctAnswers: z.number(),
        wrongAnswers: z.number(),
        score: z.number(),
        durationSeconds: z.number(),
      }).parse(args);

      const now = new Date();

      // Record the session
      await dbFlashcardStudySessions.insertOne({
        setId: new ObjectId(setId),
        userId: new ObjectId(user.id),
        mode: 'quiz',
        cardsReviewed,
        correctAnswers,
        wrongAnswers,
        score,
        startedAt: new Date(now.getTime() - durationSeconds * 1000),
        completedAt: now,
        durationSeconds,
      });

      // Get current best score
      const set = await dbFlashcardSets.findOne({
        _id: new ObjectId(setId),
        userId: new ObjectId(user.id),
      });

      const newBestScore = set?.bestScore !== undefined 
        ? Math.max(set.bestScore, score)
        : score;

      // Update set stats
      await dbFlashcardSets.updateOne(
        { _id: new ObjectId(setId), userId: new ObjectId(user.id) },
        {
          $set: { 
            lastStudiedAt: now, 
            updatedAt: now,
            lastQuizScore: score,
            bestScore: newBestScore,
          },
          $inc: { quizCount: 1 },
        }
      );

      return { success: true, bestScore: newBestScore };
    },

    /**
     * Update card difficulty after review
     */
    async updateCardProgress(args, { user }) {
      if (!user) throw new AuthError('Authentication required');

      const { cardId, correct } = z.object({
        cardId: z.string(),
        correct: z.boolean(),
      }).parse(args);

      const card = await dbFlashcards.findOne({
        _id: new ObjectId(cardId),
        userId: new ObjectId(user.id),
      });

      if (!card) {
        throw new Error('Card not found');
      }

      const now = new Date();
      const newReviewCount = card.reviewCount + 1;
      const newCorrectCount = card.correctCount + (correct ? 1 : 0);
      
      // Adjust difficulty based on performance
      // Lower difficulty = easier (more correct answers)
      const newDifficulty = 1 - (newCorrectCount / newReviewCount);

      await dbFlashcards.updateOne(
        { _id: new ObjectId(cardId) },
        {
          $set: {
            difficulty: newDifficulty,
            lastReviewedAt: now,
            reviewCount: newReviewCount,
            correctCount: newCorrectCount,
          },
        }
      );

      return { success: true, newDifficulty };
    },
  },
});
