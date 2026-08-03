import { auth } from '@/auth';
import { loadClients, saveClients, makeClientId, pickCanFields, KEY_FIELD } from '@/lib/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Bulk import clients. Body: { clients: [ { CAN, ... }, ... ] }
// Upserts by CAN (existing CAN -> update; new -> create). (Admin only.)
export async function POST(req) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body?.clients) ? body.clients : [];
  if (!rows.length) return Response.json({ error: 'No rows to import.' }, { status: 400 });

  const store = loadClients();
  const byCan = new Map(store.clients.map((c) => [c[KEY_FIELD], c]));
  const now = new Date().toISOString();

  let added = 0, updated = 0;
  const skipped = [];

  rows.forEach((raw, i) => {
    const data = pickCanFields(raw);
    if (!data[KEY_FIELD]) {
      skipped.push({ row: i + 1, reason: 'missing CAN' });
      return;
    }
    const existing = byCan.get(data[KEY_FIELD]);
    if (existing) {
      Object.assign(existing, data, { updatedAt: now });
      updated++;
    } else {
      store.seq += 1;
      const record = { id: makeClientId(store.seq), ...data, createdAt: now, updatedAt: now };
      store.clients.push(record);
      byCan.set(data[KEY_FIELD], record);
      added++;
    }
  });

  saveClients(store);
  return Response.json({ added, updated, skipped, total: store.clients.length });
}
