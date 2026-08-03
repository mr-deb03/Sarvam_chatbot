import { auth } from '@/auth';
import { loadClients, saveClients, pickCanFields, KEY_FIELD } from '@/lib/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fetch one client's full record (all fields). (Admin only.)
export async function GET(_req, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const { id } = await params;
  const store = loadClients();
  const record = store.clients.find((c) => c.id === id);
  if (!record) return Response.json({ error: 'Client not found.' }, { status: 404 });
  return Response.json({ client: record });
}

// Update a client. (Admin only.)
export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const { id } = await params;
  const data = pickCanFields(await req.json().catch(() => ({})));

  const errors = [];
  if (!data[KEY_FIELD]) errors.push('CAN is required.');
  if (errors.length) return Response.json({ errors }, { status: 400 });

  const store = loadClients();
  const record = store.clients.find((c) => c.id === id);
  if (!record) return Response.json({ error: 'Client not found.' }, { status: 404 });

  // Prevent collapsing two clients onto the same CAN.
  if (store.clients.some((c) => c.id !== id && c[KEY_FIELD] === data[KEY_FIELD])) {
    return Response.json({ error: `Another client already has CAN ${data[KEY_FIELD]}.` }, { status: 409 });
  }

  Object.assign(record, data, { updatedAt: new Date().toISOString() });
  saveClients(store);
  return Response.json({ client: record });
}

// Delete a client. (Admin only.)
export async function DELETE(_req, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const { id } = await params;
  const store = loadClients();
  const idx = store.clients.findIndex((c) => c.id === id);
  if (idx === -1) return Response.json({ error: 'Client not found.' }, { status: 404 });

  store.clients.splice(idx, 1);
  saveClients(store);
  return Response.json({ ok: true });
}
