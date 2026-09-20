import { defineMiddleware } from 'astro:middleware';
import { verifySessionToken, ADMIN_COOKIE } from './lib/adminAuth';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

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
 * server-to-server calls send none, and they carry no session cookie anyway.
 * Session cookies are `SameSite=Lax`, so a cross-site POST cannot act as the
 * operator even if it reached a handler.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return origin === expectedOrigin(request);
}

export const onRequest = defineMiddleware((context, next) => {
  if (!SAFE_METHODS.has(context.request.method) && !isSameOrigin(context.request)) {
    return new Response('Cross-site request forbidden', { status: 403 });
  }

  const { pathname } = context.url;

  if (!pathname.startsWith('/admin')) return next();
  if (pathname === '/admin/login') return next();

  const session = context.cookies.get(ADMIN_COOKIE)?.value;
  if (verifySessionToken(session)) return next();

  const attempted = `${pathname}${context.url.search}`;
  return context.redirect(`/admin/login?next=${encodeURIComponent(attempted)}`);
});
