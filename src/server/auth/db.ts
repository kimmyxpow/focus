import { Store, schema } from 'modelence/server';

export const dbOtpTokens = new Store('otpTokens', {
  schema: {
    email: schema.string(),
    code: schema.string(),
    expiresAt: schema.date(),
    attempts: schema.number(),
    used: schema.boolean(),
    createdAt: schema.date(),
  },
  indexes: [
    { key: { email: 1, code: 1 } },
    { key: { email: 1, createdAt: -1 } },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ]
});
