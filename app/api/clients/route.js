import { auth } from '@/auth';
import { listClients, createClient } from '@/lib/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// List clients with server-side search + pagination. (Admin only.)
//   ?q= search   ?page= ?pageSize=   ?all=1 (full records, for export)
export async function GET(req) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const url = new URL(req.url);
  const query = (url.searchParams.get('q') || '').trim();
  const all = url.searchParams.get('all') === '1';
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get('pageSize') || '50', 10) || 50, 1), 200);
  const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10) || 1, 1);

  const data = await listClients({ q: query, all, page, pageSize });
  return Response.json(data);
}

// Create a single client, keyed by CAN. (Admin only.)
export async function POST(req) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const res = await createClient(await req.json().catch(() => ({})));
  if (res.error) return Response.json({ error: res.error }, { status: res.status || 400 });
  return Response.json({ client: res.client }, { status: 201 });
}
