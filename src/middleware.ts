import { defineMiddleware } from 'astro:middleware';
import { verifySessionToken, ADMIN_COOKIE } from './lib/adminAuth';

/**
 * Guard for the admin area.
 *
 * Deny by default: any /admin path except the login screen requires a valid
 * signed session cookie. The admin pages are on-demand routes, so this runs per
 * request rather than at build time.
 */
export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;

  if (!pathname.startsWith('/admin')) return next();
  if (pathname === '/admin/login') return next();

  const session = context.cookies.get(ADMIN_COOKIE)?.value;
  if (verifySessionToken(session)) return next();

  const next_ = `${pathname}${context.url.search}`;
  return context.redirect(`/admin/login?next=${encodeURIComponent(next_)}`);
});
