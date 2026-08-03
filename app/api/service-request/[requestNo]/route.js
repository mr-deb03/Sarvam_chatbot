import { auth } from '@/auth';
import { VALID_STATUSES, loadStore, saveStore } from '@/lib/store';
import { sendStatusUpdateEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Look up the status of an existing request by its number.
export async function GET(_req, { params }) {
  const { requestNo } = await params;
  const store = loadStore();
  const record = store.requests.find((r) => r.requestNo === requestNo);
  if (!record) return Response.json({ error: 'Request not found.' }, { status: 404 });
  return Response.json({ request: record });
}

// Update a request's status and/or internal notes. (Admin only.)
// Accepts any of the valid statuses (forward or backward) and/or a notes string;
// at least one must be provided.
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
    return Response.json(
      { error: `Status must be one of: ${VALID_STATUSES.join(', ')}.` },
      { status: 400 },
    );
  }

  const store = loadStore();
  const record = store.requests.find((r) => r.requestNo === requestNo);
  if (!record) return Response.json({ error: 'Request not found.' }, { status: 404 });

  let statusChanged = false;
  if (hasStatus) {
    statusChanged = record.status !== status;
    record.status = status;
  }
  if (hasNotes) {
    record.notes = String(body.notes);
  }
  record.updatedAt = new Date().toISOString();
  saveStore(store);

  // Best-effort: email the client only when the status actually changes.
  let emailed = false;
  if (statusChanged) {
    try {
      const result = await sendStatusUpdateEmail(record);
      emailed = result.sent;
    } catch (err) {
      console.error('Failed to send status-update email:', err);
    }
  }

  return Response.json({ request: record, emailed });
}
