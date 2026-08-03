// One-time database setup: create the schema and seed the CAN clients from your
// local data/clients.json into the hosted Postgres.
//
// Usage (after attaching Vercel Postgres and running `vercel env pull .env.local`):
//   npm run db:setup
//
// It reads POSTGRES_URL from .env.local / .env (loaded below). The client PII in
// data/clients.json goes straight to your DB — it never touches the repo.

import fs from 'node:fs';

// Minimal .env loader (no dependency) so the script finds POSTGRES_URL.
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

if (!process.env.POSTGRES_URL) {
  console.error('POSTGRES_URL is not set.\n  1) Attach Vercel Postgres to the project (Vercel → Storage).\n  2) Run:  vercel env pull .env.local\n  3) Re-run: npm run db:setup');
  process.exit(1);
}

const { ensureSchema, sql } = await import('../lib/db.js');
const { KEY_FIELD, NAME_FIELD, EMAIL_FIELD, MOBILE_FIELD, PAN_FIELDS } = await import('../lib/can-fields.js');

console.log('Creating schema…');
await ensureSchema();

const DATA = 'data/clients.json';
if (!fs.existsSync(DATA)) {
  console.log(`No ${DATA} found — schema is ready, nothing to seed.`);
  process.exit(0);
}

const clients = (JSON.parse(fs.readFileSync(DATA, 'utf8')).clients) || [];
console.log(`Seeding ${clients.length} clients…`);

let maxSeq = 0, done = 0;
for (const c of clients) {
  const { id, createdAt, updatedAt, ...fields } = c;
  const pans = [...new Set(PAN_FIELDS.map((f) => (fields[f] || '').toUpperCase()).filter(Boolean))];
  await sql.query(
    `insert into clients (id, can, pans, name, email, mobile, data, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (id) do update set
       can=excluded.can, pans=excluded.pans, name=excluded.name,
       email=excluded.email, mobile=excluded.mobile, data=excluded.data, updated_at=excluded.updated_at`,
    [
      id, fields[KEY_FIELD] || '', pans, fields[NAME_FIELD] || '', fields[EMAIL_FIELD] || '',
      fields[MOBILE_FIELD] || '', JSON.stringify(fields),
      createdAt || new Date().toISOString(), updatedAt || new Date().toISOString(),
    ],
  );
  const n = parseInt(String(id).replace(/\D/g, ''), 10) || 0;
  if (n > maxSeq) maxSeq = n;
  if (++done % 100 === 0) console.log(`  ${done}/${clients.length}`);
}

await sql.query(
  `insert into counters (name, value) values ('clients', $1)
   on conflict (name) do update set value = greatest(counters.value, $1)`,
  [maxSeq],
);

const total = (await sql.query('select count(*)::int n from clients')).rows[0].n;
console.log(`Done. Clients in DB: ${total} (id counter set to ${maxSeq}).`);
process.exit(0);
