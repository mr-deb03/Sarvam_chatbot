// Client master-data store, modelled on the MFU CAN data export
// ("ARN/RIA CAN Data - Individual & Non-Individual"). Records are keyed by CAN
// and persisted to ./data/clients.json so they survive restarts.
//
// Field definitions live in ./can-fields.js (pure data, no Node APIs) so they
// can be shared with client components. This module adds the fs-backed store.

import fs from 'node:fs';
import path from 'node:path';

import { CAN_COLUMNS, KEY_FIELD, PAN_FIELDS, TABLE_COLUMNS } from './can-fields.js';

export {
  CAN_COLUMNS,
  KEY_FIELD,
  NAME_FIELD,
  EMAIL_FIELD,
  MOBILE_FIELD,
  PAN_FIELDS,
  TABLE_COLUMNS,
  FIELD_GROUPS,
  canonicalColumn,
} from './can-fields.js';

const DATA_FILE = path.join(process.cwd(), 'data', 'clients.json');

// In-memory cache of the store. The file is read once per process and kept in
// memory; every write goes through saveClients(), which refreshes the cache, so
// reads never touch disk after the first load.
let cache = null;

export function loadClients() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    cache = { seq: 0, clients: [] };
  }
  return cache;
}

export function saveClients(store) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  cache = store;
}

// Projection used by the admin grid — only the columns the table renders, so
// the list payload stays small regardless of how many fields a record has.
export function slimClient(c) {
  const out = { id: c.id, updatedAt: c.updatedAt };
  for (const f of TABLE_COLUMNS) out[f] = c[f] ?? '';
  return out;
}

// Case-insensitive match across the grid columns (used for server-side search).
export function clientMatches(c, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return TABLE_COLUMNS.some((f) => String(c[f] ?? '').toLowerCase().includes(needle));
}

export function makeClientId(seq) {
  return `CLI-${String(seq).padStart(4, '0')}`;
}

// Normalises an incoming payload to the known CAN columns (trimmed; CAN and PAN
// fields upper-cased). Unknown keys are dropped.
export function pickCanFields(body) {
  const out = {};
  for (const f of CAN_COLUMNS) {
    let v = String(body?.[f] ?? '').trim();
    if (f === KEY_FIELD || PAN_FIELDS.includes(f)) v = v.toUpperCase();
    out[f] = v;
  }
  return out;
}
