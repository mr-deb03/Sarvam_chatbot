import { auth } from '@/auth';
import { getClientById, updateClient, deleteClient } from '@/lib/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Full record for one client. (Admin only.)
export async function GET(_req, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const { id } = await params;
  const client = await getClientById(id);
  if (!client) return Response.json({ error: 'Client not found.' }, { status: 404 });
  return Response.json({ client });
}

// Update a client. (Admin only.)
export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const { id } = await params;
  const res = await updateClient(id, await req.json().catch(() => ({})));
  if (res.error) return Response.json({ error: res.error }, { status: res.status || 400 });
  return Response.json({ client: res.client });
}

// Delete a client. (Admin only.)
export async function DELETE(_req, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const { id } = await params;
  const ok = await deleteClient(id);
  if (!ok) return Response.json({ error: 'Client not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
