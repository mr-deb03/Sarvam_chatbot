import { auth } from '@/auth';
import { loadStore } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// List requests, newest first. (Admin only.)
//   ?status=Open   filter by status
//   ?pan=ABCDE1234F  filter by client PAN (used by the Client 360 view)
// Always returns whole-store `stats` (ignores the filters) for the dashboard bar.
export async function GET(req) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const status = params.get('status');
  const pan = (params.get('pan') || '').trim().toUpperCase();

  const store = loadStore();
  let requests = [...store.requests].reverse();
  if (status) requests = requests.filter((r) => r.status.toLowerCase() === status.toLowerCase());
  if (pan) requests = requests.filter((r) => (r.pan || '').toUpperCase() === pan);

  const counts = store.requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 3600 * 1000;
  const stats = { total: store.requests.length, open: 0, inProgress: 0, resolved: 0, overdue: 0, last7: 0 };
  for (const r of store.requests) {
    if (r.status === 'Open') stats.open += 1;
    else if (r.status === 'In Progress') stats.inProgress += 1;
    else if (r.status === 'Resolved') stats.resolved += 1;
    if (r.status !== 'Resolved' && new Date(r.dueAt).getTime() < now) stats.overdue += 1;
    if (new Date(r.createdAt).getTime() >= weekAgo) stats.last7 += 1;
  }

  return Response.json({ requests, total: store.requests.length, counts, stats });
}
