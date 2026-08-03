import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

// Auth.js (NextAuth v5). A single admin account is validated against
// ADMIN_USERNAME / ADMIN_PASSWORD from the environment — no database needed.
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  // A failed login (wrong username/password) raises CredentialsSignin by design.
  // That's an expected user event, not a server fault — so don't spam the
  // console with its stack trace, but still surface any real auth errors.
  logger: {
    error(err) {
      // The class name is minified in production builds, so match on the stable
      // `type`/`code` fields (and a lowercase message check) instead of `name`.
      const type = err?.type || err?.name || '';
      const msg = String(err?.message || err || '').toLowerCase();
      if (type === 'CredentialsSignin' || err?.code === 'credentials' || msg.includes('credentialssignin')) return;
      console.error('[auth]', err);
    },
    warn(code) {
      console.warn('[auth]', code);
    },
    debug() {},
  },
  providers: [
    Credentials({
      name: 'Admin',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize(credentials) {
        const ok =
          credentials?.username === process.env.ADMIN_USERNAME &&
          credentials?.password === process.env.ADMIN_PASSWORD;
        return ok ? { id: 'admin', name: 'Admin' } : null;
      },
    }),
  ],
});
