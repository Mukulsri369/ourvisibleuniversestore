import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { randomUUID } from 'node:crypto';
import { database } from './db.server';

export interface TransactionalEmail {
  send(message: { to: string; subject: string; url: string }): Promise<void>;
}

function origin() {
  const value = process.env.BETTER_AUTH_URL;
  if (!value) throw new Error('BETTER_AUTH_URL must be configured');
  const url = new URL(value);
  const local = url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)
    && process.env.OVU_LOCAL_DEVELOPMENT === 'true';
  if (url.protocol !== 'https:' && !local) throw new Error('Authentication requires HTTPS outside explicit loopback development');
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid authentication origin');
  return url.origin;
}

export function authOptions(email?: TransactionalEmail): BetterAuthOptions {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('A private BETTER_AUTH_SECRET of at least 32 characters is required');
  const baseURL = origin();
  const send = async (to: string, subject: string, url: string) => {
    if (!email) throw new Error('Transactional email delivery is not configured');
    await email.send({ to, subject, url });
  };
  return {
    appName: 'Our Visible Universe', baseURL, secret,
    database: database(), trustedOrigins: [baseURL],
    user: { modelName: 'auth_user' },
    session: { modelName: 'auth_session', expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    account: { modelName: 'auth_account', accountLinking: { enabled: true, trustedProviders: ['google'] } },
    verification: { modelName: 'auth_verification', storeIdentifier: 'hashed' },
    advanced: {
      disableCSRFCheck: false,
      disableOriginCheck: false,
      cookiePrefix: process.env.DB_NAME === 'ovu_store' ? 'ovu_store' : 'ovu_main',
      useSecureCookies: new URL(baseURL).protocol === 'https:',
      database: { generateId: () => randomUUID() },
    },
    emailAndPassword: {
      enabled: true, minPasswordLength: 12, maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => send(user.email, 'Reset your OVU password', url),
    },
    emailVerification: {
      sendOnSignUp: true, autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => send(user.email, 'Verify your OVU email', url),
    },
    rateLimit: { enabled: true, storage: 'database', modelName: 'auth_rate_limit', window: 60, max: 40 },
    socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
      google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET },
    } : {},
  };
}

export function createIndependentAuth(email?: TransactionalEmail) {
  return betterAuth(authOptions(email));
}
