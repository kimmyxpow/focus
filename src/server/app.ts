import { startApp } from 'modelence/server';
import focusModule from '@/server/focus';

startApp({
  modules: [focusModule],
  migrations: [],
});
