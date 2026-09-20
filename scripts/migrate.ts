/**
 * Applies pending SQL migrations to the Neon Postgres database.
 *
 * - Reads db/migrations/*.sql in filename order
 * - Records every applied file in public.schema_migrations
 * - Runs each migration in a single transaction, one statement per request
 *   (the Neon HTTP driver sends one statement at a time)
 *
 * Run: npm run migrate
 * Preview without touching the database: npm run migrate -- --dry-run
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations');
const DRY_RUN = process.argv.includes('--dry-run');

// tsx does not load .env automatically; Node >= 22.12 exposes loadEnvFile().
try {
  process.loadEnvFile(join(ROOT, '.env'));
} catch {
  // No .env file: rely on the ambient environment (shell export, CI, Railway).
}

function readMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({
      file,
      // Kept as an array rather than one blob: the HTTP driver rejects
      // multi-statement requests, so each statement is sent on its own.
      statements: splitSqlStatements(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
    }));
}

async function main(): Promise<void> {
  const migrations = readMigrations();

  if (DRY_RUN) {
    for (const { file, statements } of migrations) {
      console.log(`${file} → ${statements.length} statement(s)`);
      for (const statement of statements) {
        const firstLine = statement.split('\n')[0]!.trim();
        console.log(`    · ${firstLine.slice(0, 90)}`);
      }
    }
    console.log('✓ Dry run complete: nothing was sent to the database.');
    return;
  }

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    console.error('✗ DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string.');
    process.exit(1);
  }

  const sql = neon(connectionString);

  await sql.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const appliedRows = await sql.query('select filename from public.schema_migrations');
  const applied = new Set(appliedRows.map((row) => String(row.filename)));

  const pending = migrations.filter(({ file }) => !applied.has(file));

  if (pending.length === 0) {
    console.log(`✓ Database is up to date (${migrations.length} migration(s) already applied).`);
    return;
  }

  for (const { file, statements } of pending) {
    if (statements.length === 0) continue;

    await sql.transaction([
      ...statements.map((statement) => sql.query(statement)),
      sql.query('insert into public.schema_migrations (filename) values ($1)', [file])
    ]);

    console.log(`  ✓ applied ${file} (${statements.length} statement(s))`);
  }

  console.log(`✓ ${pending.length} migration(s) applied.`);
}

main().catch((error: unknown) => {
  console.error('✗ Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});

