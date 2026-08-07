// Postgres data layer via node-postgres (pg) over TCP. Works with the Neon
// pooled connection string both locally (seed) and on Vercel's Node runtime.
// Replaces the old file-based JSON store so data persists on serverless.
//
// Connection: reads POSTGRES_URL (Vercel/Neon injects it at runtime). For local
// dev/scripts, put the real string in .env.local.

import pg from 'pg';

const { Pool } = pg;

// Strip query params (sslmode / channel_binding) — we set TLS explicitly below.
function connString() {
  const raw =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_DATABASE_URL;
  if (!raw) throw new Error('POSTGRES_URL is not set (attach Postgres / set it in .env.local).');
  try {
    const u = new URL(raw);
    u.search = '';
    return u.toString();
  } catch {
    return raw;
  }
}

let _pool;
function pool() {
  if (_pool) return _pool;
  _pool = new Pool({ connectionString: connString(), ssl: { rejectUnauthorized: false }, max: 3 });
  return _pool;
}

export async function q(text, params = []) {
  await ensureSchema();
  return pool().query(text, params);
}

async function raw(text, params = []) {
  return pool().query(text, params);
}

// Create tables/indexes once per process (idempotent) so the schema self-heals.
let ensured;
export function ensureSchema() {
  if (ensured) return ensured;
  ensured = (async () => {
    await raw(`create table if not exists clients (
      id text primary key,
      can text unique not null,
      primary_pan text,
      second_pan text,
      third_pan text,
      guardian_pan text,
      name text,
      email text,
      mobile text,
      data jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`);
    await raw(`create index if not exists clients_primary_pan_idx on clients (primary_pan)`);
    await raw(`create table if not exists service_requests (
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
    )`);
    await raw(`create index if not exists sr_status_idx on service_requests (status)`);
    await raw(`create index if not exists sr_pan_idx on service_requests (pan)`);
    await raw(`create table if not exists counters (name text primary key, value int not null default 0)`);
  })();
  return ensured;
}

// Atomically increment and return a named counter (for CLI-/MFSR- sequences).
export async function nextSeq(name) {
  await ensureSchema();
  const { rows } = await raw(
    `insert into counters (name, value) values ($1, 1)
     on conflict (name) do update set value = counters.value + 1
     returning value`,
    [name],
  );
  return rows[0].value;
}
