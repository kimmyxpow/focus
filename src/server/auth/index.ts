import { Module, dbUsers, sendEmail, ObjectId } from 'modelence/server';
import { z } from 'zod';
import { dbOtpTokens } from './db';

// Resend cooldown in seconds
const RESEND_COOLDOWN_SECONDS = 60;

// Generate random 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate random handle from email or random words
function generateHandle(email: string): string {
  // Extract username part from email
  const username = email.split('@')[0];
  
  // Clean and format: remove special chars, add random suffix
  const cleanUsername = username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12);
  
  // Add random 4-digit suffix to ensure uniqueness
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  
  return `${cleanUsername}${suffix}`;
}

// Generate unique handle (check for collisions)
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
  
  // Fallback: use timestamp
  return `user${Date.now().toString(36)}`;
}

// OTP email template
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
            <!-- Logo -->
            <div style="width: 56px; height: 56px; background-color: white; border-radius: 12px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 24px; font-weight: bold; color: #1c1917; line-height: 56px;">F</span>
            </div>
            
            <h1 style="color: white; font-size: 24px; font-weight: 600; margin: 0 0 8px;">Your login code</h1>
            <p style="color: rgba(255, 255, 255, 0.6); font-size: 14px; margin: 0 0 32px;">Enter this code to sign in to Focus</p>
            
            <!-- OTP Code -->
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
    // Send OTP to email
    sendOTP: async (args: unknown) => {
      const { email } = z.object({
        email: z.string().email(),
      }).parse(args);

      const normalizedEmail = email.toLowerCase().trim();

      // Check cooldown: must wait 60 seconds between OTP requests
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

      // Check rate limit: max 5 OTPs per email per 15 minutes
      const recentOTPs = await dbOtpTokens.fetch({
        email: normalizedEmail,
        createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
      });

      if (recentOTPs.length >= 5) {
        throw new Error('Too many attempts. Please try again in 15 minutes.');
      }

      // Generate OTP
      const code = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP
      await dbOtpTokens.insertOne({
        email: normalizedEmail,
        code,
        expiresAt,
        attempts: 0,
        used: false,
        createdAt: new Date(),
      });

      // Send email
      await sendEmail({
        from: 'Focus <focus@mail.pow.kim>',
        to: normalizedEmail,
        subject: 'Your Focus login code',
        html: getOTPEmailTemplate(code),
      });

      return { success: true, cooldown: RESEND_COOLDOWN_SECONDS };
    },

    // Verify OTP and login/signup user
    verifyOTP: async (args: unknown, context: { session: { authToken?: string } | null }) => {
      const { email, code } = z.object({
        email: z.string().email(),
        code: z.string().length(6),
      }).parse(args);

      const normalizedEmail = email.toLowerCase().trim();

      // Find valid OTP
      const otpRecord = await dbOtpTokens.findOne({
        email: normalizedEmail,
        code,
        used: false,
        expiresAt: { $gt: new Date() },
      });

      if (!otpRecord) {
        // Check if there's an unused OTP for this email (wrong code)
        const existingOTP = await dbOtpTokens.findOne({
          email: normalizedEmail,
          used: false,
          expiresAt: { $gt: new Date() },
        });

        if (existingOTP) {
          // Increment attempts
          await dbOtpTokens.updateOne(
            { _id: existingOTP._id },
            { $inc: { attempts: 1 } }
          );

          // Check if max attempts reached
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

      // Mark OTP as used
      await dbOtpTokens.updateOne(
        { _id: otpRecord._id },
        { $set: { used: true } }
      );

      // Find or create user
      let user = await dbUsers.findOne({ 'emails.address': normalizedEmail });
      let isNewUser = false;

      if (!user) {
        // Auto-signup: Create new user
        isNewUser = true;
        const handle = await generateUniqueHandle(normalizedEmail);
        
        const { insertedId } = await dbUsers.insertOne({
          handle,
          emails: [{ address: normalizedEmail, verified: true }],
          authMethods: {}, // No password - OTP only
          createdAt: new Date(),
          status: 'active',
        });

        user = await dbUsers.findById(insertedId.toString());
      } else {
        // Update email as verified if not already
        const emailEntry = user.emails?.find((e: { address: string }) => e.address === normalizedEmail);
        if (emailEntry && !emailEntry.verified) {
          await dbUsers.updateOne(
            { _id: user._id },
            { $set: { 'emails.$[elem].verified': true } },
            // @ts-expect-error - MongoDB array filter syntax
            { arrayFilters: [{ 'elem.address': normalizedEmail }] }
          );
        }
      }

      if (!user) {
        throw new Error('Failed to create or find user');
      }

      // Login: Update session with userId using raw MongoDB
      // Get the session authToken from context
      const authToken = context.session?.authToken;
      
      if (authToken) {
        // Get the raw database and update the session directly
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
