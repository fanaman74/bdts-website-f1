import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null | undefined;

/**
 * Returns the server-only Supabase client used by API routes.
 *
 * A secret key is intentionally required: browser-safe publishable/anon keys
 * must never be used for administrative form-submission writes.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;

  const url = import.meta.env.SUPABASE_URL?.trim();
  const secretKey = import.meta.env.SUPABASE_SECRET_KEY?.trim();

  if (!url && !secretKey) {
    adminClient = null;
    return adminClient;
  }

  if (!url || !secretKey) {
    throw new Error('Supabase is only partially configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY together.');
  }

  try {
    new URL(url);
  } catch {
    throw new Error('SUPABASE_URL is not a valid URL.');
  }

  adminClient = createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  return adminClient;
}
