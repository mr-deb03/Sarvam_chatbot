import { auth } from '@/auth';
import { upsertClientsByCan } from '@/lib/clients';

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

  const result = await upsertClientsByCan(rows);
  return Response.json(result);
}
