import { SARVAM_API_KEY, SARVAM_BASE_URL, SARVAM_MODEL } from '@/lib/sarvam';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Translates a scripted chat message into the client's chosen language while
// preserving structure the guided flow relies on (numbers, PAN/CAN/request
// codes, emails, bullets, line breaks). Falls back to the original text on any
// failure so the conversation never breaks — it just stays English.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const text = String(body?.text ?? '');
  const language = String(body?.language ?? '').trim();

  if (!text.trim() || !language || language.toLowerCase() === 'english') {
    return Response.json({ text });
  }
  if (!SARVAM_API_KEY) return Response.json({ text });

  const system =
    `You are a professional translator for a mutual-fund service chatbot. ` +
    `Translate the user's message into ${language}. ` +
    `Keep it natural and polite. Follow these rules exactly:\n` +
    `- Do NOT translate or alter any digits, list numbers (like "1.", "2."), ` +
    `PAN codes, CAN numbers, request numbers (like MFSR-20260603-0001), ` +
    `email addresses, or website/format examples such as ABCDE1234F.\n` +
    `- Preserve every line break and the bullet character "•" exactly.\n` +
    `- Keep emojis where they are.\n` +
    `- Output ONLY the translated text, with no quotes, notes, or preamble.`;

  try {
    const upstream = await fetch(`${SARVAM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SARVAM_API_KEY}`,
        'api-subscription-key': SARVAM_API_KEY,
      },
      body: JSON.stringify({
        model: SARVAM_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
        stream: false,
      }),
    });

    if (!upstream.ok) return Response.json({ text });
    const json = await upstream.json().catch(() => null);
    const out = json?.choices?.[0]?.message?.content;
    return Response.json({ text: typeof out === 'string' && out.trim() ? out.trim() : text });
  } catch {
    return Response.json({ text });
  }
}
