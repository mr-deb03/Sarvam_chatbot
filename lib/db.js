// Postgres data layer (Vercel Postgres / Neon). Replaces the old file-based
// JSON store so data persists on serverless deployments.
//
// Connection: @vercel/postgres reads POSTGRES_URL from the environment, which
// Vercel injects automatically when you attach a Postgres store. For local dev,
// pull it with `vercel env pull .env.local`.

import { sql } from '@vercel/postgres';

export { sql };

// Create tables/indexes once per process (idempotent). Every query goes through
// q()/nextSeq(), which await this first, so the schema self-heals on cold start.
let ensured;
export function ensureSchema() {
  if (ensured) return ensured;
  ensured = (async () => {
    await sql`create table if not exists clients (
      id text primary key,
      can text unique not null,
      pans text[] not null default '{}',
      name text,
      email text,
      mobile text,
      data jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;
    await sql`create index if not exists clients_pans_idx on clients using gin (pans)`;
    await sql`create table if not exists service_requests (
      request_no text primary key,
      seq int not null,
      client_name text,
      email text,
      pan text,
      request_type text,
      detail text,
      notes text,
      status text not null default 'Open',
      created_at timestamptz not null,
      due_at timestamptz not null,
      updated_at timestamptz not null default now()
    )`;
    await sql`create index if not exists sr_status_idx on service_requests (status)`;
    await sql`create index if not exists sr_pan_idx on service_requests (pan)`;
    await sql`create table if not exists counters (name text primary key, value int not null default 0)`;
  })();
  return ensured;
}

// Parameterized query with schema guaranteed.
export async function q(text, params = []) {
  await ensureSchema();
  return sql.query(text, params);
}

// Atomically increment and return a named counter (for CLI-/MFSR- sequences).
export async function nextSeq(name) {
  await ensureSchema();
  const { rows } = await sql.query(
    `insert into counters (name, value) values ($1, 1)
     on conflict (name) do update set value = counters.value + 1
     returning value`,
    [name],
  );
  return rows[0].value;
}
