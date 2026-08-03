import { auth } from '@/auth';
import { listRequests, getRequestStats } from '@/lib/store';

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
  const status = params.get('status') || '';
  const pan = (params.get('pan') || '').trim();

  const [requests, stats] = await Promise.all([listRequests({ status, pan }), getRequestStats()]);
  return Response.json({ requests, total: stats.total, stats });
}
