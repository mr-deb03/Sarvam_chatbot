// Postgres data layer via the native Neon serverless driver. Works with the
// connection string Neon/Vercel provides (pooled or direct) over HTTP, in both
// serverless functions and local Node scripts. Replaces the old file-based JSON
// store so data persists on Vercel.
//
// Connection: reads POSTGRES_URL (Vercel/Neon injects it). For local dev/scripts,
// pull it with `vercel env pull .env.local --environment=production`.

import { neon } from '@neondatabase/serverless';

let _sql;
function client() {
  if (_sql) return _sql;
  const conn =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_DATABASE_URL;
  if (!conn) throw new Error('POSTGRES_URL is not set (attach Vercel Postgres / pull env locally).');
  _sql = neon(conn, { fullResults: true });
  return _sql;
}

// Parameterized query. Normalises the result to always expose { rows, rowCount }.
export async function q(text, params = []) {
  await ensureSchema();
  const res = await client().query(text, params);
  return Array.isArray(res) ? { rows: res, rowCount: res.length } : res;
}

// Same as q but without the schema guard (used inside ensureSchema itself).
async function raw(text, params = []) {
  const res = await client().query(text, params);
  return Array.isArray(res) ? { rows: res, rowCount: res.length } : res;
}

// Create tables/indexes once per process (idempotent), so the schema self-heals
// on cold start.
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
