import { PAN_REGEX } from '@/lib/store';
import { loadClients, NAME_FIELD, EMAIL_FIELD, KEY_FIELD, PAN_FIELDS } from '@/lib/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public PAN lookup for the chat flow. A returning client enters their PAN; we
// match it against any holder PAN on a CAN record and return only the minimal
// fields the chatbot shows back (CAN, primary holder name, primary email). No
// admin auth — but we never expose bank / demat / nominee / contact internals,
// and require a well-formed PAN to avoid enumeration of arbitrary strings.
export async function GET(req) {
  const pan = (new URL(req.url).searchParams.get('pan') || '').trim().toUpperCase();
  if (!PAN_REGEX.test(pan)) {
    return Response.json({ error: 'A valid PAN is required.' }, { status: 400 });
  }

  const { clients } = loadClients();
  const match = clients.find((c) => PAN_FIELDS.some((f) => (c[f] || '').toUpperCase() === pan));
  if (!match) return Response.json({ found: false });

  return Response.json({
    found: true,
    client: {
      can: match[KEY_FIELD] || '',
      name: match[NAME_FIELD] || '',
      email: match[EMAIL_FIELD] || '',
      pan,
    },
  });
}
