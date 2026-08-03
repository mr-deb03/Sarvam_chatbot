import { PAN_REGEX } from '@/lib/store';
import { getClientByPan, KEY_FIELD, NAME_FIELD, EMAIL_FIELD } from '@/lib/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public PAN lookup for the chat flow. Matches any holder PAN and returns only
// the minimal fields the chatbot shows back (CAN, primary holder name, email).
export async function GET(req) {
  const pan = (new URL(req.url).searchParams.get('pan') || '').trim().toUpperCase();
  if (!PAN_REGEX.test(pan)) {
    return Response.json({ error: 'A valid PAN is required.' }, { status: 400 });
  }

  const c = await getClientByPan(pan);
  if (!c) return Response.json({ found: false });

  return Response.json({
    found: true,
    client: { can: c[KEY_FIELD] || '', name: c[NAME_FIELD] || '', email: c[EMAIL_FIELD] || '', pan },
  });
}
