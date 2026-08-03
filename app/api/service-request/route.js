import {
  REQUEST_TYPES,
  TAT_HOURS,
  PAN_REGEX,
  EMAIL_REGEX,
  loadStore,
  saveStore,
  makeRequestNo,
} from '@/lib/store';
import { sendRequestEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Create a new service request, email the client a copy, and return the number.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const clientName = String(body?.clientName ?? '').trim();
  const email = String(body?.email ?? '').trim();
  const pan = String(body?.pan ?? '').trim().toUpperCase();
  const requestType = String(body?.requestType ?? '').trim();
  const detail = String(body?.detail ?? '').trim();

  const errors = [];
  if (!clientName) errors.push('Client name is required.');
  if (!EMAIL_REGEX.test(email)) errors.push('A valid email address is required.');
  if (!PAN_REGEX.test(pan)) errors.push('PAN must be in the format ABCDE1234F.');
  if (!REQUEST_TYPES.includes(requestType)) errors.push('A valid request type is required.');
  if (errors.length) return Response.json({ errors }, { status: 400 });

  const now = new Date();
  const store = loadStore();
  store.seq += 1;

  const record = {
    requestNo: makeRequestNo(store.seq, now),
    clientName,
    email,
    pan,
    requestType,
    detail,
    status: 'Open',
    createdAt: now.toISOString(),
    dueAt: new Date(now.getTime() + TAT_HOURS * 3600 * 1000).toISOString(),
  };

  store.requests.push(record);
  saveStore(store);

  // Best-effort email — never let an email failure block the submission.
  let emailed = false;
  try {
    const result = await sendRequestEmail(record);
    emailed = result.sent;
  } catch (err) {
    console.error('Failed to send request email:', err);
  }

  return Response.json({ request: record, tatHours: TAT_HOURS, emailed }, { status: 201 });
}
