import { auth } from '@/auth';
import {
  loadClients,
  saveClients,
  makeClientId,
  pickCanFields,
  slimClient,
  clientMatches,
  KEY_FIELD,
} from '@/lib/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// List clients, newest first, with server-side search + pagination. (Admin only.)
//   ?q=...            search across the grid columns
//   ?page=1&pageSize  paginated slim rows (default page 1, size 50)
//   ?all=1            every matching FULL record (used for CSV export)
export async function GET(req) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const all = url.searchParams.get('all') === '1';

  const store = loadClients();
  const matched = [...store.clients].reverse().filter((c) => clientMatches(c, q));
  const total = matched.length;

  if (all) {
    return Response.json({ clients: matched, total });
  }

  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get('pageSize') || '50', 10) || 50, 1), 200);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(parseInt(url.searchParams.get('page') || '1', 10) || 1, 1), pages);
  const start = (page - 1) * pageSize;
  const clients = matched.slice(start, start + pageSize).map(slimClient);

  return Response.json({ clients, total, page, pageSize, pages });
}

// Create a single client. (Admin only.) Keyed by CAN.
export async function POST(req) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const data = pickCanFields(await req.json().catch(() => ({})));
  const errors = [];
  if (!data[KEY_FIELD]) errors.push('CAN is required.');
  if (errors.length) return Response.json({ errors }, { status: 400 });

  const store = loadClients();
  if (store.clients.some((c) => c[KEY_FIELD] === data[KEY_FIELD])) {
    return Response.json({ error: `A client with CAN ${data[KEY_FIELD]} already exists.` }, { status: 409 });
  }

  const now = new Date().toISOString();
  store.seq += 1;
  const record = { id: makeClientId(store.seq), ...data, createdAt: now, updatedAt: now };
  store.clients.push(record);
  saveClients(store);

  return Response.json({ client: record }, { status: 201 });
}
