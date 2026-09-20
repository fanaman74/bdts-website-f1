import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

/** The query function returned by Neon's stateless HTTP driver. */
export type SqlClient = NeonQueryFunction<false, false>;

let sqlClient: SqlClient | null | undefined;

/**
 * Returns the server-only Neon client used by API routes.
 *
 * `DATABASE_URL` is intentionally server-only: it carries the Postgres password
 * and must never be exposed through a `PUBLIC_*` variable.
 *
 * The `neon()` HTTP driver opens no sockets and keeps no connection pool, which
 * suits the standalone Astro server on Railway: every query is a single HTTPS
 * request, so an idle-then-resumed Neon database cannot leave stale connections
 * behind. `process.env` is read (rather than `import.meta.env`) so the variable
 * set in the Railway dashboard is picked up at runtime instead of being frozen
 * at build time.
 */
export function getDbClient(): SqlClient | null {
  if (sqlClient !== undefined) return sqlClient;

  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    sqlClient = null;
    return sqlClient;
  }

  let protocol: string;
  try {
    protocol = new URL(connectionString).protocol;
  } catch {
    throw new Error('DATABASE_URL is not a valid connection string.');
  }

  if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must start with postgres:// or postgresql://.');
  }

  sqlClient = neon(connectionString);

  return sqlClient;
}
