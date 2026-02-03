import { startApp } from 'modelence/server';
import resendProvider from '@modelence/resend';
import focusModule from '@/server/focus';
import authModule from '@/server/auth';
import flashcardModule from '@/server/flashcard';
import quizModule from '@/server/quiz';
import aiModule from '@/server/ai';

startApp({
  modules: [aiModule, focusModule, authModule, flashcardModule, quizModule],
  migrations: [],
  email: {
    provider: resendProvider,
    from: 'Focus <focus@mail.pow.kim>',
  },
});
