import type { APIRoute } from 'astro';
import { ADMIN_COOKIE } from '../../lib/adminAuth';

export const prerender = false;

/** POST-only so a stray link or prefetch cannot sign the operator out. */
export const POST: APIRoute = ({ cookies }) => {
  cookies.delete(ADMIN_COOKIE, { path: '/' });
  return new Response(null, { status: 303, headers: { Location: '/admin/login' } });
};
