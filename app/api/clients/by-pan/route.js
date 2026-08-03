import { auth } from '@/auth';
import { PAN_REGEX } from '@/lib/store';
import { getClientByPan } from '@/lib/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Full client record matched by any holder PAN. (Admin only.) Used by the
// request detail panel to show the linked client's CAN profile.
export async function GET(req) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const pan = (new URL(req.url).searchParams.get('pan') || '').trim().toUpperCase();
  if (!PAN_REGEX.test(pan)) return Response.json({ error: 'A valid PAN is required.' }, { status: 400 });

  const client = await getClientByPan(pan);
  return Response.json({ client: client || null });
}
