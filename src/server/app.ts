import { startApp } from 'modelence/server';
import resendProvider from '@modelence/resend';
import focusModule from '@/server/focus';
import authModule from '@/server/auth';

startApp({
  modules: [focusModule, authModule],
  migrations: [],
  email: {
    provider: resendProvider,
    from: 'Focus <focus@mail.pow.kim>',
  },
});
