// CI-only defense against libpq environment-driven routing of disposable DB
// regression suites. A localhost URI alone is insufficient: PGHOSTADDR can
// bypass hostname resolution. This module is never a production DB client.
const ROUTING_KEYS = new Set([
  'PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGDATABASE', 'PGUSER',
  'PGSERVICE', 'PGSERVICEFILE', 'PGSYSCONFDIR',
  'PGOPTIONS', 'PGTARGETSESSIONATTRS', 'PGCONNECT_TIMEOUT',
]);
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export function requireDisposableLocalDatabaseUrl(rawUrl, environment = process.env) {
  for (const [name, value] of Object.entries(environment)) {
    if (ROUTING_KEYS.has(name.toUpperCase()) && value) {
      throw new Error('Refusing inherited libpq routing setting: ' + name);
    }
  }
  let url;
  try { url = new URL(rawUrl ?? ''); }
  catch { throw new Error('Disposable local DATABASE_URL must be a valid PostgreSQL URI'); }

  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !LOOPBACK.has(url.hostname) ||
      !url.port ||
      !url.pathname || url.pathname === '/' ||
      url.search || url.hash) {
    throw new Error(
      'Refusing non-local or ambiguous DATABASE_URL: explicit PostgreSQL loopback host, port and DB path required'
    );
  }
  return url;
}

// Protect the psql child even if the caller's environment changes after
// preflight. Explicit DATABASE_URL supplies the host, port, db and credentials.
export function sanitizedPsqlEnvironment(environment = process.env) {
  return Object.fromEntries(
    Object.entries(environment).filter(([name]) => !name.toUpperCase().startsWith('PG'))
  );
}
