// Client master-data store (CAN data), backed by Postgres. Records are keyed by
// CAN; all 94 CAN fields live in a jsonb column, with CAN/holder-PANs/name/email/
// mobile extracted into columns for indexed lookups.
//
// Field definitions live in ./can-fields.js (pure data, safe for client
// components). This module adds the DB access.

import { q, nextSeq } from './db.js';
import {
  CAN_COLUMNS,
  KEY_FIELD,
  NAME_FIELD,
  EMAIL_FIELD,
  MOBILE_FIELD,
  PAN_FIELDS,
  TABLE_COLUMNS,
} from './can-fields.js';

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

// Extract the indexed columns from a full 94-field record.
export function deriveCols(fields) {
  const up = (f) => (fields[f] || '').toUpperCase();
  return {
    can: fields[KEY_FIELD] || '',
    primaryPan: up(PAN_FIELDS[0]),
    secondPan: up(PAN_FIELDS[1]),
    thirdPan: up(PAN_FIELDS[2]),
    guardianPan: up(PAN_FIELDS[3]),
    name: fields[NAME_FIELD] || '',
    email: fields[EMAIL_FIELD] || '',
    mobile: fields[MOBILE_FIELD] || '',
  };
}

const iso = (v) => (v ? new Date(v).toISOString() : null);
function rowToClient(row) {
  return { id: row.id, ...row.data, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}

// List clients (newest first) with server-side search + pagination.
export async function listClients({ q: query = '', all = false, page = 1, pageSize = 50 } = {}) {
  const conds = [];
  const params = [];
  if (query) {
    params.push('%' + query.toLowerCase() + '%');
    conds.push(`lower(data::text) like $${params.length}`);
  }
  const where = conds.length ? 'where ' + conds.join(' and ') : '';

  const total = (await q(`select count(*)::int n from clients ${where}`, params)).rows[0].n;

  if (all) {
    const res = await q(`select id, data, created_at, updated_at from clients ${where} order by created_at desc`, params);
    return { clients: res.rows.map(rowToClient), total };
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(page, 1), pages);
  const res = await q(
    `select id, data, updated_at from clients ${where} order by created_at desc limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, pageSize, (p - 1) * pageSize],
  );
  const clients = res.rows.map((r) => {
    const c = { id: r.id, updatedAt: iso(r.updated_at) };
    for (const f of TABLE_COLUMNS) c[f] = r.data[f] ?? '';
    return c;
  });
  return { clients, total, page: p, pages, pageSize };
}

export async function getClientById(id) {
  const res = await q('select id, data, created_at, updated_at from clients where id = $1', [id]);
  return res.rows[0] ? rowToClient(res.rows[0]) : null;
}

// Match against any holder PAN (used by chat lookup + admin by-pan).
export async function getClientByPan(pan) {
  const res = await q(
    `select id, data, created_at, updated_at from clients
     where $1 in (primary_pan, second_pan, third_pan, guardian_pan) limit 1`,
    [pan.toUpperCase()],
  );
  return res.rows[0] ? rowToClient(res.rows[0]) : null;
}

const INSERT_COLS =
  '(id, can, primary_pan, second_pan, third_pan, guardian_pan, name, email, mobile, data, created_at, updated_at)';
function insertParams(id, data, d) {
  return [id, d.can, d.primaryPan, d.secondPan, d.thirdPan, d.guardianPan, d.name, d.email, d.mobile, JSON.stringify(data)];
}

export async function createClient(body) {
  const data = pickCanFields(body);
  if (!data[KEY_FIELD]) return { error: 'CAN is required.', status: 400 };
  const dup = await q('select 1 from clients where can = $1', [data[KEY_FIELD]]);
  if (dup.rows.length) return { error: `A client with CAN ${data[KEY_FIELD]} already exists.`, status: 409 };

  const id = makeClientId(await nextSeq('clients'));
  const d = deriveCols(data);
  const now = new Date().toISOString();
  await q(`insert into clients ${INSERT_COLS} values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), now())`, insertParams(id, data, d));
  return { client: { id, ...data, createdAt: now, updatedAt: now } };
}

export async function updateClient(id, body) {
  const data = pickCanFields(body);
  if (!data[KEY_FIELD]) return { error: 'CAN is required.', status: 400 };
  const existing = await q('select 1 from clients where id = $1', [id]);
  if (!existing.rows.length) return { error: 'Client not found.', status: 404 };
  const dup = await q('select 1 from clients where can = $1 and id <> $2', [data[KEY_FIELD], id]);
  if (dup.rows.length) return { error: `Another client already has CAN ${data[KEY_FIELD]}.`, status: 409 };

  const d = deriveCols(data);
  await q(
    `update clients set can=$1, primary_pan=$2, second_pan=$3, third_pan=$4, guardian_pan=$5,
       name=$6, email=$7, mobile=$8, data=$9, updated_at=now() where id=$10`,
    [d.can, d.primaryPan, d.secondPan, d.thirdPan, d.guardianPan, d.name, d.email, d.mobile, JSON.stringify(data), id],
  );
  return { client: await getClientById(id) };
}

export async function deleteClient(id) {
  const res = await q('delete from clients where id = $1 returning id', [id]);
  return res.rows.length > 0;
}

// Bulk upsert by CAN (CSV import).
export async function upsertClientsByCan(rows) {
  let added = 0, updated = 0;
  const skipped = [];
  for (let i = 0; i < rows.length; i++) {
    const data = pickCanFields(rows[i]);
    if (!data[KEY_FIELD]) {
      skipped.push({ row: i + 1, reason: 'missing CAN' });
      continue;
    }
    const d = deriveCols(data);
    const existing = await q('select id from clients where can = $1', [data[KEY_FIELD]]);
    if (existing.rows.length) {
      await q(
        `update clients set primary_pan=$1, second_pan=$2, third_pan=$3, guardian_pan=$4,
           name=$5, email=$6, mobile=$7, data=$8, updated_at=now() where can=$9`,
        [d.primaryPan, d.secondPan, d.thirdPan, d.guardianPan, d.name, d.email, d.mobile, JSON.stringify(data), data[KEY_FIELD]],
      );
      updated += 1;
    } else {
      const id = makeClientId(await nextSeq('clients'));
      await q(`insert into clients ${INSERT_COLS} values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), now())`, insertParams(id, data, d));
      added += 1;
    }
  }
  const total = (await q('select count(*)::int n from clients')).rows[0].n;
  return { added, updated, skipped, total };
}
