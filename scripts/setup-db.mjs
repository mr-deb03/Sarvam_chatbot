// One-time database setup: create the schema and seed the CAN clients from your
// local data/clients.json into the hosted Postgres.
//
// Self-contained (doesn't use lib/db.js) so it can resolve the Neon host via a
// public DNS server — some local/ISP resolvers don't return *.aws.neon.tech.
//
// Usage: put the real POSTGRES_URL in .env.local, then:  npm run db:setup

import fs from 'node:fs';
import dns from 'node:dns';
import pg from 'pg';

const { Pool } = pg;

// Minimal .env loader.
for (const file of ['.env.local', '.env']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) {
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
}

const RAW = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!RAW) {
  console.error('POSTGRES_URL is not set. Put the real Neon connection string in .env.local, then re-run.');
  process.exit(1);
}

const u = new URL(RAW);
const host = u.hostname;
const port = Number(u.port) || 5432;
const database = u.pathname.replace(/^\//, '') || 'neondb';
const user = decodeURIComponent(u.username);
const password = decodeURIComponent(u.password);

// Resolve the host via public DNS (bypass a broken local resolver), then connect
// by IP while keeping the real host as the TLS SNI so Neon routes correctly.
dns.setServers(['8.8.8.8', '1.1.1.1']);
let ip = host;
try {
  const addrs = await dns.promises.resolve4(host);
  if (addrs.length) ip = addrs[0];
  console.log(`Resolved ${host} -> ${ip}`);
} catch {
  console.log(`Could not resolve ${host} via public DNS; trying host directly.`);
}

const pool = new Pool({
  host: ip,
  port,
  user,
  password,
  database,
  ssl: { rejectUnauthorized: false, servername: host },
  max: 3,
});
const q = (text, params) => pool.query(text, params);

console.log('Creating schema…');
await q(`create table if not exists clients (
  id text primary key, can text unique not null,
  primary_pan text, second_pan text, third_pan text, guardian_pan text,
  name text, email text, mobile text, data jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
await q(`create index if not exists clients_primary_pan_idx on clients (primary_pan)`);
await q(`create table if not exists service_requests (
  request_no text primary key, seq int not null, client_name text, email text, pan text,
  request_type text, detail text, notes text, status text not null default 'Open',
  created_at timestamptz not null, due_at timestamptz not null, updated_at timestamptz not null default now())`);
await q(`create index if not exists sr_status_idx on service_requests (status)`);
await q(`create index if not exists sr_pan_idx on service_requests (pan)`);
await q(`create table if not exists counters (name text primary key, value int not null default 0)`);

const DATA = 'data/clients.json';
if (!fs.existsSync(DATA)) {
  console.log(`No ${DATA} — schema ready, nothing to seed.`);
  await pool.end();
  process.exit(0);
}

const { KEY_FIELD, NAME_FIELD, EMAIL_FIELD, MOBILE_FIELD, PAN_FIELDS } = await import('../lib/can-fields.js');
const clients = (JSON.parse(fs.readFileSync(DATA, 'utf8')).clients) || [];
console.log(`Seeding ${clients.length} clients…`);

const up = (fields, f) => (fields[f] || '').toUpperCase();
let maxSeq = 0, done = 0;
for (const c of clients) {
  const { id, createdAt, updatedAt, ...fields } = c;
  await q(
    `insert into clients (id, can, primary_pan, second_pan, third_pan, guardian_pan, name, email, mobile, data, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (id) do update set
       can=excluded.can, primary_pan=excluded.primary_pan, second_pan=excluded.second_pan,
       third_pan=excluded.third_pan, guardian_pan=excluded.guardian_pan, name=excluded.name,
       email=excluded.email, mobile=excluded.mobile, data=excluded.data, updated_at=excluded.updated_at`,
    [
      id, fields[KEY_FIELD] || '',
      up(fields, PAN_FIELDS[0]), up(fields, PAN_FIELDS[1]), up(fields, PAN_FIELDS[2]), up(fields, PAN_FIELDS[3]),
      fields[NAME_FIELD] || '', fields[EMAIL_FIELD] || '', fields[MOBILE_FIELD] || '',
      JSON.stringify(fields), createdAt || new Date().toISOString(), updatedAt || new Date().toISOString(),
    ],
  );
  const n = parseInt(String(id).replace(/\D/g, ''), 10) || 0;
  if (n > maxSeq) maxSeq = n;
  if (++done % 100 === 0) console.log(`  ${done}/${clients.length}`);
}

await q(
  `insert into counters (name, value) values ('clients', $1)
   on conflict (name) do update set value = greatest(counters.value, $1)`,
  [maxSeq],
);

const total = (await q('select count(*)::int n from clients')).rows[0].n;
console.log(`Done. Clients in DB: ${total} (id counter set to ${maxSeq}).`);
await pool.end();
process.exit(0);
