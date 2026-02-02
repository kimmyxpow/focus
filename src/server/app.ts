import { startApp } from 'modelence/server';
import exampleModule from '@/server/example';
import focusModule from '@/server/focus';
import { createDemoUser } from '@/server/migrations/createDemoUser';

startApp({
  modules: [exampleModule, focusModule],

  migrations: [{
    version: 1,
    description: 'Create demo user',
    handler: createDemoUser,
  }],
});
