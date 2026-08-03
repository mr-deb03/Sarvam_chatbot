import { auth } from '@/auth';

// Redirect unauthenticated visitors away from /admin to the login page.
// The admin/mutating APIs additionally enforce auth in their handlers.
export default auth((req) => {
  if (!req.auth) {
    const url = new URL('/login', req.nextUrl.origin);
    url.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
