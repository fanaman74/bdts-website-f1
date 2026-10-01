import type { APIRoute } from 'astro';
import { ADMIN_COOKIE, isSecureRequest } from '../../lib/adminAuth';

export const prerender = false;

/**
 * Signs the operator out. POST-only, so a stray link or prefetch cannot do it.
 *
 * The cookie is expired with the *same attribute set* it was created with,
 * rather than via `cookies.delete()`. Deleting only emits name/path, and if the
 * browser fails to match the original cookie the session survives — which looks
 * exactly like "logout does nothing", because the middleware then bounces
 * /admin/login straight back to /admin.
 */
export const POST: APIRoute = ({ cookies, request }) => {
  cookies.set(ADMIN_COOKIE, '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(request),
    maxAge: 0
  });

  return new Response(null, { status: 303, headers: { Location: '/admin/login?loggedout=1' } });
};
