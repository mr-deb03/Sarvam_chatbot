import {
  SARVAM_API_KEY,
  SARVAM_BASE_URL,
  SARVAM_MODEL,
  SYSTEM_PROMPT,
} from '@/lib/sarvam';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Streams Sarvam AI chat completions to the browser as Server-Sent Events.
export async function POST(req) {
  if (!SARVAM_API_KEY) {
    return Response.json(
      { error: 'SARVAM_API_KEY is not set. Add it to .env.local.' },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const incoming = Array.isArray(body?.messages) ? body.messages : [];
  const language = String(body?.language ?? '').trim();
  const systemPrompt =
    language && language.toLowerCase() !== 'english'
      ? `${SYSTEM_PROMPT} Always reply in ${language}.`
      : SYSTEM_PROMPT;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...incoming
      .filter(
        (m) =>
          m &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string',
      )
      .map((m) => ({ role: m.role, content: m.content })),
  ];

  if (messages.length === 1) {
    return Response.json({ error: 'No user message provided.' }, { status: 400 });
  }

  const upstream = await fetch(`${SARVAM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Sarvam's chat endpoint is OpenAI-compatible; it accepts the
      // subscription key as a Bearer token. We also send the native
      // header so either gateway configuration works.
      Authorization: `Bearer ${SARVAM_API_KEY}`,
      'api-subscription-key': SARVAM_API_KEY,
    },
    body: JSON.stringify({
      model: SARVAM_MODEL,
      messages,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error(`Sarvam API error ${upstream.status}:`, detail);
    return Response.json(
      { error: `Sarvam API returned ${upstream.status}.`, detail },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buffer = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') {
              controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(payload);
              const token = json?.choices?.[0]?.delta?.content;
              if (token) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
              }
            } catch {
              // Ignore keep-alive comments or partial JSON.
            }
          }
        }
        controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
      } catch (err) {
        console.error('Stream error:', err);
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Stream interrupted.' })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
