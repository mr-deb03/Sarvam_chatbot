'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const GREETING =
  '👋 Welcome to Sarvam Associates!\n\n' +
  "I'm your virtual assistant for mutual-fund services. I can help you:\n" +
  '• Raise a service request (SIP, redemption, statements, KYC and more)\n' +
  "• Track an existing request's status\n" +
  '• Answer your mutual-fund questions\n\n' +
  'Pick your language above, tap a quick action below, or just start typing — ' +
  'I understand English and major Indian languages.';

// Languages offered in the selector (label shown to user → name sent to the model).
const LANGUAGES = [
  { label: 'English', value: 'English' },
  { label: 'हिन्दी', value: 'Hindi' },
  { label: 'বাংলা', value: 'Bengali' },
  { label: 'मराठी', value: 'Marathi' },
  { label: 'தமிழ்', value: 'Tamil' },
  { label: 'తెలుగు', value: 'Telugu' },
  { label: 'ಕನ್ನಡ', value: 'Kannada' },
  { label: 'ગુજરાતી', value: 'Gujarati' },
];

// Detects when the user wants to CHECK an existing request's status.
const TRACK_INTENT =
  /\b(track|status|check|where\s+is|follow\s*up\s+on)\b[^.?!]{0,30}\b(request|ticket|complaint|service|sr|application)\b|\brequest\s*(status|number)\b|\bMFSR-\d{8}-\d+\b/i;

// Detects when the user wants to RAISE a new service request.
const SR_INTENT =
  /\bservice\s*request\b|\b(raise|create|lodge|file|open|submit|register|make)\b[^.?!]{0,30}\b(request|ticket|complaint)\b/i;

const CANCEL = /^(cancel|exit|stop|quit|nevermind|never mind)\.?$/i;
const YES = /^(y|yes|yep|yeah|correct|right|confirm|ok|okay|sure|haan|ha)\b/i;
const NO = /^(n|no|nope|wrong|incorrect|nahi|nahin)\b/i;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Reassuring message per status (mirrors lib/store.js STATUS_MESSAGES).
const STATUS_MESSAGES = {
  Open:
    "We've received your request and it's safely in the queue. Our team will pick " +
    'it up shortly — thank you for your patience! 🙏',
  'In Progress':
    'Good news — our team is actively working on your request right now. ' +
    "You're in good hands; we'll have it wrapped up soon. 💪",
  Resolved:
    'Great news — your request has been resolved! ✅ If anything still needs ' +
    'attention, just raise a new request and we’ll be glad to help.',
};

// Split a scripted assistant message into separate chat bubbles at blank lines,
// so long menus/checklists arrive as small chunks instead of one wall of text.
function toChunks(content) {
  return String(content)
    .split(/\n{2,}/)
    .map((c) => ({ role: 'assistant', content: c.trim() }))
    .filter((m) => m.content);
}

export default function ChatPage() {
  // messages: { role: 'user' | 'assistant', content, error?, typing? }
  const [messages, setMessages] = useState(() => toChunks(GREETING));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState('English');

  // In-chat wizard. null when inactive.
  // create: { mode: 'create', step, data }
  //   steps: 'pan' -> (lookup) -> 'confirm' | 'newName' -> 'newEmail'
  //          -> 'email' (if known client has no email) -> 'requestType'
  //          -> 'detail' -> 'submitConfirm'
  // track:  { mode: 'track', step: 'requestNo' }
  const [wizard, setWizard] = useState(null);
  const [requestTypes, setRequestTypes] = useState([]);
  const [requestTypeDocs, setRequestTypeDocs] = useState({});
  const [requestTypeFields, setRequestTypeFields] = useState({});
  const [tatHours, setTatHours] = useState(72);

  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetch('/api/request-types')
      .then((r) => r.json())
      .then((d) => {
        setRequestTypes(d.requestTypes || []);
        setRequestTypeDocs(d.requestTypeDocs || {});
        setRequestTypeFields(d.requestTypeFields || {});
        if (d.tatHours) setTatHours(d.tatHours);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const addAssistant = (content) =>
    setMessages((prev) => [...prev, ...toChunks(content)]);

  // Numbered service list where each option is separated by a blank line, so
  // toChunks() renders every single option as its own chat bubble.
  const typeList = () => requestTypes.map((t, i) => `${i + 1}. ${t}`).join('\n\n');

  // Resolve a user's reply to a request type, by number or by name.
  function matchRequestType(input) {
    const text = input.trim();
    if (/^\d+$/.test(text)) {
      const idx = parseInt(text, 10) - 1;
      return requestTypes[idx] ?? null;
    }
    const lower = text.toLowerCase();
    return (
      requestTypes.find((t) => t.toLowerCase() === lower) ||
      requestTypes.find((t) => t.toLowerCase().includes(lower) || lower.includes(t.toLowerCase())) ||
      null
    );
  }

  // --- Service-request wizard ---

  function startWizard() {
    setWizard({ mode: 'create', step: 'pan', data: {} });
    addAssistant(
      "Sure — let's raise a service request.\n\n" +
        'To pull up your account, please share your PAN number (format: ABCDE1234F).\n' +
        "(You can type 'cancel' anytime to stop.)",
    );
  }

  // Look up a client by PAN and branch: known client -> confirm; new -> collect.
  async function lookupPan(pan, data) {
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/lookup?pan=${encodeURIComponent(pan)}`);
      const json = await res.json();
      if (json.found) {
        const c = json.client;
        setWizard({
          mode: 'create',
          step: 'confirm',
          data: { ...data, pan: c.pan, clientName: c.name, email: c.email || '' },
        });
        addAssistant(
          'I found your details:\n\n' +
            (c.can ? `• CAN: ${c.can}\n` : '') +
            `• Name: ${c.name}\n` +
            `• PAN: ${c.pan}\n` +
            `• Email: ${c.email || '— (not on file) —'}\n\n` +
            'Is this correct? (yes / no)',
        );
      } else {
        setWizard({ mode: 'create', step: 'newName', data: { ...data, pan } });
        addAssistant(
          `I couldn't find an account for PAN ${pan}. No problem — let's capture your details.\n\n` +
            'What is your full name?',
        );
      }
    } catch {
      addAssistant('Network error while checking that PAN — is the server running? Please re-enter your PAN.');
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function startTracking() {
    setWizard({ mode: 'track', step: 'requestNo' });
    addAssistant(
      'Sure — I can check that for you.\n\n' +
        'Please share your service request number (e.g. MFSR-20260603-0001).',
    );
  }

  async function processWizard(text) {
    if (CANCEL.test(text.trim())) {
      setWizard(null);
      addAssistant('No problem — cancelled. How else can I help?');
      return;
    }

    if (wizard.mode === 'track') {
      await processTracking(text);
      return;
    }

    const { step, data } = wizard;

    if (step === 'pan') {
      const pan = text.trim().toUpperCase();
      if (!PAN_REGEX.test(pan)) {
        addAssistant(
          'That does not look like a valid PAN. It should be 5 letters, 4 digits, then 1 letter ' +
            '(e.g. ABCDE1234F). Please re-enter the PAN.',
        );
        return;
      }
      await lookupPan(pan, data);
      return;
    }

    if (step === 'confirm') {
      if (YES.test(text.trim())) {
        // Known client confirmed. If we have no email on file, collect one.
        if (!EMAIL_REGEX.test(data.email || '')) {
          setWizard({ mode: 'create', step: 'email', data });
          addAssistant(
            "We don't have a valid email on file for you.\n\n" +
              "What email should we send the request copy to?",
          );
          return;
        }
        setWizard({ mode: 'create', step: 'requestType', data });
        addAssistant(`Great, ${data.clientName.split(' ')[0]}! Which service do you need? Reply with the number:\n\n${typeList()}`);
      } else if (NO.test(text.trim())) {
        setWizard({ mode: 'create', step: 'pan', data: {} });
        addAssistant("No problem — let's try again. Please re-enter your PAN number, or type 'cancel'.");
      } else {
        addAssistant("Please reply 'yes' to confirm, or 'no' to re-enter your PAN.");
      }
      return;
    }

    if (step === 'newName') {
      const clientName = text.trim();
      if (!clientName) {
        addAssistant("Please type your full name.");
        return;
      }
      setWizard({ mode: 'create', step: 'newEmail', data: { ...data, clientName } });
      addAssistant(`Thanks, ${clientName}.\n\nWhat is your email address? We'll send a copy of the request there.`);
      return;
    }

    if (step === 'newEmail' || step === 'email') {
      const email = text.trim();
      if (!EMAIL_REGEX.test(email)) {
        addAssistant('That email does not look right. Please enter a valid email (e.g. name@example.com).');
        return;
      }
      setWizard({ mode: 'create', step: 'requestType', data: { ...data, email } });
      addAssistant(`Thanks. Which service do you need? Reply with the number:\n\n${typeList()}`);
      return;
    }

    if (step === 'requestType') {
      const requestType = matchRequestType(text);
      if (!requestType) {
        addAssistant(`Sorry, I didn't catch that. Please reply with a number from the list:\n\n${typeList()}`);
        return;
      }
      setWizard({ mode: 'create', step: 'detail', data: { ...data, requestType } });
      const docs = requestTypeDocs[requestType];
      const fields = requestTypeFields[requestType];
      const docsMsg =
        docs && docs.length
          ? 'Soft copy of following documents:\n' + docs.map((dd) => `• ${dd}`).join('\n') + '\n\n'
          : '';
      const askMsg =
        fields && fields.length
          ? 'Please share the following details (copy the list and fill in each line):\n\n' +
            fields.map((f) => `${f} :- `).join('\n')
          : 'Please describe your query in a little detail so our team has everything they need.';
      addAssistant(`"${requestType}" — noted.\n\n` + docsMsg + askMsg);
      return;
    }

    if (step === 'detail') {
      const detail = /^skip\.?$/i.test(text.trim()) ? '' : text.trim();
      setWizard({ mode: 'create', step: 'submitConfirm', data: { ...data, detail } });
      addAssistant(
        "Here's a summary of your request:\n\n" +
          `• Name: ${data.clientName}\n` +
          `• PAN: ${data.pan}\n` +
          `• Email: ${data.email}\n` +
          `• Service: ${data.requestType}\n` +
          (detail ? `• Details: ${detail}\n` : '') +
          '\nShall I submit it? (yes / no)',
      );
      return;
    }

    if (step === 'submitConfirm') {
      if (YES.test(text.trim())) {
        await submitRequest(data);
      } else if (NO.test(text.trim())) {
        setWizard(null);
        addAssistant("No problem — I haven't submitted anything. Say \"raise a service request\" whenever you're ready.");
      } else {
        addAssistant("Please reply 'yes' to submit, or 'no' to cancel.");
      }
    }
  }

  // Look up a request number and report its status with a calming message.
  async function processTracking(text) {
    const requestNo = text.trim().toUpperCase();
    setBusy(true);
    try {
      const res = await fetch(`/api/service-request/${encodeURIComponent(requestNo)}`);
      if (res.status === 404) {
        addAssistant(
          `I couldn't find a request with the number "${requestNo}". ` +
            "Please double-check it and try again, or type 'cancel'.",
        );
        return; // keep the wizard open for a retry
      }
      if (!res.ok) {
        addAssistant('Something went wrong while looking that up. Please try again in a moment.');
        setWizard(null);
        return;
      }
      const { request: r } = await res.json();
      const calming = STATUS_MESSAGES[r.status] || '';
      const overdue = r.status !== 'Resolved' && new Date(r.dueAt) < new Date();
      const dueLine =
        r.status === 'Resolved'
          ? ''
          : `\nExpected by: ${new Date(r.dueAt).toLocaleString()}` +
            (overdue
              ? "\n\nWe're sorry this is taking longer than the usual 72 hours — your request has been " +
                'flagged and our team is prioritising it. Thank you for bearing with us.'
              : '');
      addAssistant(
        `Here's the latest on ${r.requestNo}:\n\n` +
          `Client: ${r.clientName}\n` +
          `Type: ${r.requestType}\n` +
          `Status: ${r.status}` +
          dueLine +
          `\n\n${calming}`,
      );
      setWizard(null);
    } catch {
      addAssistant('Network error while looking that up — is the server running? Please try again.');
      setWizard(null);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function submitRequest(data) {
    setBusy(true);
    addAssistant('Submitting your request…');
    try {
      const res = await fetch('/api/service-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        addAssistant(
          'I could not submit the request: ' +
            (json.errors || [json.error || 'Unknown error.']).join(' ') +
            "\nLet's try again — say \"raise a service request\".",
        );
        setWizard(null);
        return;
      }
      const r = json.request;
      addAssistant(
        '✅ Your service request has been submitted!\n\n' +
          `Request No: ${r.requestNo}\n` +
          `Client: ${r.clientName}\n` +
          `Service: ${r.requestType}\n` +
          (r.detail ? `Details: ${r.detail}\n` : '') +
          '\nYour issue will be addressed as soon as possible. 🙏\n\n' +
          (json.emailed
            ? `📧 A copy has been emailed to ${r.email} and to our team.\n\n`
            : '') +
          `You can track its status anytime — just say "track my request" and enter ${r.requestNo}.`,
      );
      setWizard(null);
    } catch {
      addAssistant('Network error while submitting — is the server running? Please try again.');
      setWizard(null);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  // --- LLM chat ---

  async function callLLM(text) {
    const history = [...messages, { role: 'user', content: text }]
      .filter((m) => !m.error && !m.typing && m.content !== GREETING)
      .map((m) => ({ role: m.role, content: m.content }));

    const replyIndex = messages.length + 1;
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: 'Thinking…', typing: true },
    ]);
    setBusy(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, language }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) => {
          const next = [...prev];
          next[replyIndex] = {
            role: 'assistant',
            content: data.error || 'Something went wrong.',
            error: true,
          };
          return next;
        });
        return;
      }

      await readStream(res, replyIndex);
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[replyIndex] = {
          role: 'assistant',
          content: 'Network error — is the server running?',
          error: true,
        };
        return next;
      });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  // Reads the SSE stream and incrementally updates the assistant message.
  async function readStream(res, replyIndex) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let reply = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const evt of events) {
        const dataLine = evt.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        try {
          const json = JSON.parse(dataLine.slice(5).trim());
          if (json.token) {
            reply += json.token;
            setMessages((prev) => {
              const next = [...prev];
              next[replyIndex] = { role: 'assistant', content: reply };
              return next;
            });
          }
        } catch {
          // Ignore done/error envelopes with empty data.
        }
      }
    }

    if (!reply) {
      setMessages((prev) => {
        const next = [...prev];
        next[replyIndex] = { role: 'assistant', content: '(empty response)' };
        return next;
      });
    }
  }

  // --- Input handling ---

  function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');

    if (wizard) {
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      processWizard(text);
      return;
    }

    // Tracking intent is checked before raise-intent, since "track my service
    // request" also contains the words "service request".
    if (TRACK_INTENT.test(text)) {
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      startTracking();
      return;
    }

    if (SR_INTENT.test(text)) {
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      startWizard();
      return;
    }

    callLLM(text);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function clearChat() {
    setWizard(null);
    setMessages(toChunks(GREETING));
  }

  // Quick-action chips — start a flow without the user having to phrase it.
  function quickRaise() {
    if (busy || wizard) return;
    setMessages((prev) => [...prev, { role: 'user', content: 'I want to raise a service request' }]);
    startWizard();
  }

  function quickTrack() {
    if (busy || wizard) return;
    setMessages((prev) => [...prev, { role: 'user', content: 'Track my request status' }]);
    startTracking();
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Sarvam Associates</h1>
        <div className="header-actions">
          <select
            className="lang-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            title="Reply language"
            aria-label="Reply language"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <Link className="clear-btn" href="/admin">Admin</Link>
          <button className="clear-btn" type="button" onClick={clearChat}>
            Clear
          </button>
        </div>
      </header>

      <main className="messages" ref={messagesRef} aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <div className={`bubble ${m.error ? 'error' : ''} ${m.typing ? 'typing' : ''}`.trim()}>
              {m.content}
            </div>
          </div>
        ))}
      </main>

      {!wizard && (
        <div className="chips">
          <button className="chip" type="button" onClick={quickRaise} disabled={busy}>
            📝 Raise a service request
          </button>
          <button className="chip" type="button" onClick={quickTrack} disabled={busy}>
            🔍 Track my request
          </button>
        </div>
      )}

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className="input"
          rows={1}
          placeholder={wizard ? 'Type your answer…' : 'Type a message…'}
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="send-btn" type="submit" disabled={busy}>
          Send
        </button>
      </form>
    </div>
  );
}
