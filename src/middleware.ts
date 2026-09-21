import { defineMiddleware } from 'astro:middleware';
import { ADMIN_COOKIE, verifySessionToken } from './lib/adminAuth';
import { findUserById } from './lib/users';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Reachable without a session; everything else under /admin is not. */
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/admin/register']);

/**
 * The origin the browser actually used.
 *
 * Astro's own check cannot be relied on here: the Node adapter ignores
 * `x-forwarded-proto`, so behind Railway's TLS termination it computes
 * `http://host` while the browser sends `https://host`, and every form-encoded
 * POST is refused. Reading the forwarded headers restores the correct origin.
 */
function expectedOrigin(request: Request): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();

  const protocol = forwardedProto || new URL(request.url).protocol.replace(':', '');
  const host = forwardedHost || request.headers.get('host') || new URL(request.url).host;

  return `${protocol}://${host}`;
}

/**
 * Cross-site request check.
 *
 * A missing `Origin` is allowed, matching Astro's own semantics: curl, tests and
 * server-to-server calls send none and carry no session cookie anyway. Session
 * cookies are `SameSite=Lax`, so a cross-site POST cannot act as a user even if
 * it reached a handler.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return origin === expectedOrigin(request);
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!SAFE_METHODS.has(context.request.method) && !isSameOrigin(context.request)) {
    return new Response('Cross-site request forbidden', { status: 403 });
  }

  const { pathname } = context.url;
  if (!pathname.startsWith('/admin')) return next();

  // Resolve the account from the session. Role is always read fresh, so a
  // suspended or demoted account loses access on its next request.
  const token = context.cookies.get(ADMIN_COOKIE)?.value;
  const session = verifySessionToken(token);
  const user = session ? await findUserById(session.userId) : null;

  if (user) {
    context.locals.user = user;
  } else if (token) {
    context.cookies.delete(ADMIN_COOKIE, { path: '/' });
  }

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return user ? context.redirect('/admin') : next();
  }

  if (!user) {
    const attempted = `${pathname}${context.url.search}`;
    return context.redirect(`/admin/login?next=${encodeURIComponent(attempted)}`);
  }

  // A self-registered account can sign in but sees nothing until an admin
  // approves it — the inbox holds customer personal data.
  if (user.role === 'pending' && pathname !== '/admin/pending') {
    return context.redirect('/admin/pending');
  }

  // Account management is for admins only.
  if (pathname.startsWith('/admin/users') && user.role !== 'admin') {
    return new Response('Accès réservé aux administrateurs.', { status: 403 });
  }

  return next();
});
