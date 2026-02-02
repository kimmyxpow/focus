import { Store, schema } from 'modelence/server';

// OTP tokens for passwordless email login
export const dbOtpTokens = new Store('otpTokens', {
  schema: {
    email: schema.string(),
    code: schema.string(),           // 6-digit OTP code
    expiresAt: schema.date(),
    attempts: schema.number(),        // Track failed attempts
    used: schema.boolean(),
    createdAt: schema.date(),
  },
  indexes: [
    { key: { email: 1, code: 1 } },
    { key: { email: 1, createdAt: -1 } }, // For cooldown checks
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 }, // TTL index - auto delete expired
  ]
});
