import { auth } from '@/auth';
import { getRequestByNo, EMAIL_REGEX } from '@/lib/store';
import { sendIssueEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin emails out the issue they're facing on a request. (Admin only.)
// Body: { explanation, to? }  — if `to` is omitted, the office ADMIN_EMAIL is used.
export async function POST(req, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const { requestNo } = await params;
  const body = await req.json().catch(() => ({}));
  const explanation = String(body?.explanation ?? '').trim();
  const to = String(body?.to ?? '').trim();

  if (!explanation) return Response.json({ error: 'Please describe the issue.' }, { status: 400 });
  if (to && !EMAIL_REGEX.test(to)) return Response.json({ error: 'Recipient email is not valid.' }, { status: 400 });

  const record = await getRequestByNo(requestNo);
  if (!record) return Response.json({ error: 'Request not found.' }, { status: 404 });

  try {
    const result = await sendIssueEmail(record, explanation, to);
    if (!result.sent) return Response.json({ sent: false, error: result.reason || 'Email not configured.' }, { status: 200 });
    return Response.json(result);
  } catch (err) {
    console.error('Failed to send issue email:', err);
    return Response.json({ sent: false, error: 'Failed to send email.' }, { status: 500 });
  }
}
