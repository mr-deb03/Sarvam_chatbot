// Postgres data layer via node-postgres (pg) over TCP. Works with the Neon
// pooled connection string both locally (seed) and on Vercel's Node runtime.
// Replaces the old file-based JSON store so data persists on serverless.
//
// Connection: reads POSTGRES_URL (Vercel/Neon injects it at runtime). For local
// dev/scripts, put the real string in .env.local.

import pg from 'pg';
import dns from 'node:dns';

const { Pool } = pg;

// Parse the connection string into discrete parts so we can connect by a
// resolved IP (with the real host kept as TLS SNI) when needed.
function parsed() {
  const raw =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_DATABASE_URL;
  if (!raw) throw new Error('POSTGRES_URL is not set (attach Postgres / set it in .env.local).');
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: Number(u.port) || 5432,
    database: u.pathname.replace(/^\//, '') || 'neondb',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}

// Resolve the host with the system resolver first; if that fails (some local /
// ISP DNS can't resolve *.aws.neon.tech), fall back to public DNS via a scoped
// resolver so we don't touch global DNS settings (safe on Vercel, which uses
// the system path and never hits the fallback).
async function resolveHost(host) {
  try {
    const { address } = await dns.promises.lookup(host);
    return address;
  } catch {
    try {
      const r = new dns.promises.Resolver();
      r.setServers(['8.8.8.8', '1.1.1.1']);
      const addrs = await r.resolve4(host);
      if (addrs.length) return addrs[0];
    } catch {
      /* fall through */
    }
  }
  return host; // let pg attempt its own resolution as a last resort
}

let _poolPromise;
function pool() {
  if (_poolPromise) return _poolPromise;
  _poolPromise = (async () => {
    const p = parsed();
    const ip = await resolveHost(p.host);
    return new Pool({
      host: ip,
      port: p.port,
      user: p.user,
      password: p.password,
      database: p.database,
      ssl: { rejectUnauthorized: false, servername: p.host },
      max: 3,
    });
  })();
  return _poolPromise;
}

export async function q(text, params = []) {
  await ensureSchema();
  return (await pool()).query(text, params);
}

async function raw(text, params = []) {
  return (await pool()).query(text, params);
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
