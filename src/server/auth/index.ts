import { Module, dbUsers, sendEmail, ObjectId } from 'modelence/server';
import { z } from 'zod';
import { dbOtpTokens } from './db';

const RESEND_COOLDOWN_SECONDS = 60;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateHandle(email: string): string {
  const username = email.split('@')[0];

  const cleanUsername = username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12);

  const suffix = Math.floor(1000 + Math.random() * 9000).toString();

  return `${cleanUsername}${suffix}`;
}

async function generateUniqueHandle(email: string): Promise<string> {
  let handle = generateHandle(email);
  let attempts = 0;

  while (attempts < 5) {
    const existing = await dbUsers.findOne({ handle });
    if (!existing) {
      return handle;
    }
    handle = generateHandle(email);
    attempts++;
  }

  return `user${Date.now().toString(36)}`;
}

function getOTPEmailTemplate(code: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1c1917;">
        <div style="max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: #292524; border-radius: 16px; padding: 40px; text-align: center;">
            <div style="width: 56px; height: 56px; background-color: white; border-radius: 12px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 24px; font-weight: bold; color: #1c1917; line-height: 56px;">F</span>
            </div>

            <h1 style="color: white; font-size: 24px; font-weight: 600; margin: 0 0 8px;">Your login code</h1>
            <p style="color: rgba(255, 255, 255, 0.6); font-size: 14px; margin: 0 0 32px;">Enter this code to sign in to Focus</p>

            <div style="background-color: rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <span style="font-family: 'SF Mono', Monaco, monospace; font-size: 36px; font-weight: 700; color: white; letter-spacing: 8px;">${code}</span>
            </div>

            <p style="color: rgba(255, 255, 255, 0.4); font-size: 12px; margin: 0;">
              This code expires in 10 minutes.<br>
              If you didn't request this code, you can safely ignore this email.
            </p>
          </div>

          <p style="color: rgba(255, 255, 255, 0.3); font-size: 11px; text-align: center; margin-top: 24px;">
            Focus - Coworking for the internet
          </p>
        </div>
      </body>
    </html>
  `;
}

export default new Module('auth', {
  stores: [dbOtpTokens],

  mutations: {
    sendOTP: async (args: unknown) => {
      const { email } = z.object({
        email: z.string().email(),
      }).parse(args);

      const normalizedEmail = email.toLowerCase().trim();

      const lastOTP = await dbOtpTokens.findOne(
        { email: normalizedEmail },
        { sort: { createdAt: -1 } }
      );

      if (lastOTP) {
        const timeSinceLastOTP = Date.now() - lastOTP.createdAt.getTime();
        const cooldownRemaining = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - timeSinceLastOTP) / 1000);

        if (cooldownRemaining > 0) {
          throw new Error(`Please wait ${cooldownRemaining} seconds before requesting a new code.`);
        }
      }

      const recentOTPs = await dbOtpTokens.fetch({
        email: normalizedEmail,
        createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
      });

      if (recentOTPs.length >= 5) {
        throw new Error('Too many attempts. Please try again in 15 minutes.');
      }

      const code = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await dbOtpTokens.insertOne({
        email: normalizedEmail,
        code,
        expiresAt,
        attempts: 0,
        used: false,
        createdAt: new Date(),
      });

      await sendEmail({
        from: 'Focus <focus@mail.pow.kim>',
        to: normalizedEmail,
        subject: 'Your Focus login code',
        html: getOTPEmailTemplate(code),
      });

      return { success: true, cooldown: RESEND_COOLDOWN_SECONDS };
    },

    verifyOTP: async (args: unknown, context: { session: { authToken?: string } | null }) => {
      const { email, code } = z.object({
        email: z.string().email(),
        code: z.string().length(6),
      }).parse(args);

      const normalizedEmail = email.toLowerCase().trim();

      const otpRecord = await dbOtpTokens.findOne({
        email: normalizedEmail,
        code,
        used: false,
        expiresAt: { $gt: new Date() },
      });

      if (!otpRecord) {
        const existingOTP = await dbOtpTokens.findOne({
          email: normalizedEmail,
          used: false,
          expiresAt: { $gt: new Date() },
        });

        if (existingOTP) {
          await dbOtpTokens.updateOne(
            { _id: existingOTP._id },
            { $inc: { attempts: 1 } }
          );

          if (existingOTP.attempts >= 4) {
            await dbOtpTokens.updateOne(
              { _id: existingOTP._id },
              { $set: { used: true } }
            );
            throw new Error('Too many failed attempts. Please request a new code.');
          }

          throw new Error('Invalid code. Please try again.');
        }

        throw new Error('Code expired or invalid. Please request a new code.');
      }

      await dbOtpTokens.updateOne(
        { _id: otpRecord._id },
        { $set: { used: true } }
      );

      let user = await dbUsers.findOne({ 'emails.address': normalizedEmail });
      let isNewUser = false;

      if (!user) {
        isNewUser = true;
        const handle = await generateUniqueHandle(normalizedEmail);

        const { insertedId } = await dbUsers.insertOne({
          handle,
          emails: [{ address: normalizedEmail, verified: true }],
          authMethods: {},
          createdAt: new Date(),
          status: 'active',
        });

        user = await dbUsers.findById(insertedId.toString());
      } else {
        const emailEntry = user.emails?.find((e: { address: string }) => e.address === normalizedEmail);
        if (emailEntry && !emailEntry.verified) {
          await dbUsers.updateOne(
            { _id: user._id },
            { $set: { 'emails.$[elem].verified': true } },
            { arrayFilters: [{ 'elem.address': normalizedEmail }] }
          );
        }
      }

      if (!user) {
        throw new Error('Failed to create or find user');
      }

      const authToken = context.session?.authToken;

      if (authToken) {
        const db = dbOtpTokens.getDatabase();
        const sessionsCollection = db.collection('_modelenceSessions');

        await sessionsCollection.updateOne(
          { authToken },
          {
            $set: {
              userId: new ObjectId(user._id.toString()),
              lastActiveAt: new Date(),
            }
          }
        );
      }

      return {
        success: true,
        isNewUser,
        user: {
          id: user._id.toString(),
          handle: user.handle,
          email: normalizedEmail,
        },
      };
    },
  },
});
