import { auth } from '@/auth';
import { VALID_STATUSES, getRequestByNo, updateRequest } from '@/lib/store';
import { sendStatusUpdateEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Look up the status of an existing request by its number.
export async function GET(_req, { params }) {
  const { requestNo } = await params;
  const record = await getRequestByNo(requestNo);
  if (!record) return Response.json({ error: 'Request not found.' }, { status: 404 });
  return Response.json({ request: record });
}

// Update a request's status and/or internal notes. (Admin only.)
// Accepts any valid status (forward or backward) and/or a notes string; at
// least one must be provided.
export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const { requestNo } = await params;
  const body = await req.json().catch(() => ({}));
  const hasStatus = body?.status !== undefined;
  const hasNotes = body?.notes !== undefined;

  if (!hasStatus && !hasNotes) {
    return Response.json({ error: 'Provide a status and/or notes to update.' }, { status: 400 });
  }

  const status = String(body?.status ?? '').trim();
  if (hasStatus && !VALID_STATUSES.includes(status)) {
    return Response.json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}.` }, { status: 400 });
  }

  const res = await updateRequest(requestNo, {
    status: hasStatus ? status : undefined,
    notes: hasNotes ? body.notes : undefined,
  });
  if (!res) return Response.json({ error: 'Request not found.' }, { status: 404 });

  // Best-effort: email the client only when the status actually changes.
  let emailed = false;
  if (res.statusChanged) {
    try {
      const result = await sendStatusUpdateEmail(res.record);
      emailed = result.sent;
    } catch (err) {
      console.error('Failed to send status-update email:', err);
    }
  }

  return Response.json({ request: res.record, emailed });
}
