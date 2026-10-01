/**
 * SQL statement splitting for the migration runner.
 *
 * The Neon HTTP driver sends one statement per request, so a migration file has
 * to be split on top-level semicolons. The splitter is dollar-quote aware: the
 * body of a `$$`-quoted PL/pgSQL function contains semicolons that must not end
 * the statement.
 */

/**
 * Splits a SQL file into individual, trimmed, non-empty statements.
 *
 * Handles:
 * - `--` line comments and C-style block comments
 * - `'…'` string and `"…"` identifier quoting, including doubled-quote escapes
 * - `$$…$$` and `$tag$…$tag$` dollar-quoted bodies
 */
export function splitSqlStatements(source: string): string[] {
  const statements: string[] = [];
  let current = '';
  let index = 0;

  while (index < source.length) {
    const char = source[index]!;
    const next = source[index + 1];

    // -- line comment
    if (char === '-' && next === '-') {
      const end = source.indexOf('\n', index);
      const stop = end === -1 ? source.length : end;
      current += source.slice(index, stop);
      index = stop;
      continue;
    }

    // /* block comment */
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      const stop = end === -1 ? source.length : end + 2;
      current += source.slice(index, stop);
      index = stop;
      continue;
    }

    // quoted string or identifier
    if (char === "'" || char === '"') {
      const [chunk, nextIndex] = readQuoted(source, index, char);
      current += chunk;
      index = nextIndex;
      continue;
    }

    // $$ or $tag$ dollar-quoted body
    if (char === '$') {
      const tag = /^\$[A-Za-z_0-9]*\$/.exec(source.slice(index))?.[0];
      if (tag) {
        const end = source.indexOf(tag, index + tag.length);
        const stop = end === -1 ? source.length : end + tag.length;
        current += source.slice(index, stop);
        index = stop;
        continue;
      }
    }

    if (char === ';') {
      statements.push(current.trim());
      current = '';
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  statements.push(current.trim());
  return statements.filter((statement) => statement.length > 0);
}

/** Reads a quoted literal/identifier, honouring doubled-quote escapes. */
function readQuoted(source: string, start: number, quote: string): [string, number] {
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === quote) {
      if (source[index + 1] === quote) {
        index += 2;
        continue;
      }
      return [source.slice(start, index + 1), index + 1];
    }
    index += 1;
  }
  return [source.slice(start), source.length];
}
