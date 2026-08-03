'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ServicePage() {
  const [requestTypes, setRequestTypes] = useState([]);
  const [form, setForm] = useState({ clientName: '', email: '', pan: '', requestType: '', detail: '' });
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { request, tatHours }

  useEffect(() => {
    fetch('/api/request-types')
      .then((r) => r.json())
      .then((d) => setRequestTypes(d.requestTypes || []))
      .catch(() => setError('Could not load request types — is the server running?'));
  }, []);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/service-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, pan: form.pan.toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data.errors || [data.error || 'Submission failed.']).join(' '));
        return;
      }
      setResult(data);
    } catch {
      setError('Network error — is the server running?');
    }
  }

  function reset() {
    setForm({ clientName: '', email: '', pan: '', requestType: '', detail: '' });
    setResult(null);
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Sarvam Associates — Service Request</h1>
        <div className="header-actions">
          <Link className="clear-btn" href="/admin">Admin</Link>
          <Link className="clear-btn" href="/">Chat →</Link>
        </div>
      </header>

      <main className="page">
        {result ? (
          <section className="result">
            <h2>✓ Request Submitted</h2>
            <p className="result-line">
              Service Request No.
              <strong>{result.request.requestNo}</strong>
            </p>
            <p className="result-meta">
              Your request will be resolved within {result.tatHours} hours (by{' '}
              {new Date(result.request.dueAt).toLocaleString()}).
            </p>
            <p className="result-meta">
              {result.emailed
                ? `A copy has been emailed to ${result.request.email}.`
                : `Save your request number — keep it handy to track the status.`}
            </p>
            <button className="clear-btn" type="button" onClick={reset}>
              New request
            </button>
          </section>
        ) : (
          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Client Name</span>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Kumar"
                value={form.clientName}
                onChange={(e) => update('clientName', e.target.value)}
              />
            </label>

            <label className="field">
              <span>Email</span>
              <input
                type="email"
                required
                placeholder="client@example.com"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </label>

            <label className="field">
              <span>PAN No.</span>
              <input
                type="text"
                required
                maxLength={10}
                placeholder="ABCDE1234F"
                style={{ textTransform: 'uppercase' }}
                value={form.pan}
                onChange={(e) => update('pan', e.target.value)}
              />
            </label>

            <label className="field">
              <span>Request Type</span>
              <select
                required
                value={form.requestType}
                onChange={(e) => update('requestType', e.target.value)}
              >
                <option value="" disabled>
                  Select a request type…
                </option>
                {requestTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Detail of Query</span>
              <textarea
                rows={4}
                placeholder="Describe your request (optional)"
                value={form.detail}
                onChange={(e) => update('detail', e.target.value)}
              />
            </label>

            <button className="send-btn" type="submit">
              Submit Request
            </button>
            {error && <p className="form-error">{error}</p>}
          </form>
        )}
      </main>
    </div>
  );
}
