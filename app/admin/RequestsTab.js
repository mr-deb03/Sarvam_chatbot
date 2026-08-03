'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const FILTERS = ['', 'Open', 'In Progress', 'Resolved'];
const STATUSES = ['Open', 'In Progress', 'Resolved'];

function fmt(iso) {
  return iso ? new Date(iso).toLocaleString() : '—';
}
function isOverdue(r) {
  return r.status !== 'Resolved' && new Date(r.dueAt) < new Date();
}

function FragmentRow({ children }) {
  return <>{children}</>;
}

export default function RequestsTab() {
  const [requests, setRequests] = useState(null);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [draft, setDraft] = useState({ status: '', notes: '' });
  const [saving, setSaving] = useState(false);
  // Client 360: the CAN record linked to the expanded request (by PAN).
  const [client, setClient] = useState(null);
  const [clientLoading, setClientLoading] = useState(false);
  // Email-the-issue: admin escalates a query they need help with.
  const [issue, setIssue] = useState({ to: '', text: '' });
  const [emailing, setEmailing] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const res = await fetch(`/api/service-requests${qs}`);
      const data = await res.json();
      setRequests(data.requests);
      setStats(data.stats || null);
    } catch {
      setError('Failed to load — is the server running?');
      setRequests([]);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    if (!requests) return [];
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) =>
      [r.requestNo, r.clientName, r.email, r.pan, r.requestType]
        .some((v) => String(v ?? '').toLowerCase().includes(q)),
    );
  }, [requests, query]);

  async function toggle(r) {
    if (expanded === r.requestNo) { setExpanded(null); setClient(null); return; }
    setExpanded(r.requestNo);
    setDraft({ status: r.status, notes: r.notes ?? '' });
    setIssue({ to: '', text: '' });
    setEmailMsg('');
    setClient(null);
    if (r.pan) {
      setClientLoading(true);
      try {
        const res = await fetch(`/api/clients/by-pan?pan=${encodeURIComponent(r.pan)}`);
        const data = await res.json();
        setClient(data.client);
      } catch {
        setClient(null);
      } finally {
        setClientLoading(false);
      }
    }
  }

  async function save(r) {
    setSaving(true);
    try {
      await fetch(`/api/service-request/${r.requestNo}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: draft.status, notes: draft.notes }),
      });
      setExpanded(null);
      await load();
    } finally { setSaving(false); }
  }

  async function sendIssue(r) {
    if (!issue.text.trim()) { setEmailMsg('Please describe the issue first.'); return; }
    setEmailing(true); setEmailMsg('');
    try {
      const res = await fetch(`/api/service-request/${r.requestNo}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ explanation: issue.text, to: issue.to.trim() }),
      });
      const data = await res.json();
      if (data.sent) { setEmailMsg(`✓ Emailed to ${data.to}.`); setIssue({ to: '', text: '' }); }
      else setEmailMsg(data.error || 'Could not send email.');
    } catch {
      setEmailMsg('Network error — is the server running?');
    } finally { setEmailing(false); }
  }

  function exportCSV() {
    const cols = ['requestNo','clientName','email','pan','requestType','status','detail','notes','createdAt','dueAt','updatedAt'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.join(',')].concat(visible.map((r) => cols.map((c) => esc(r[c])).join(',')));
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'service-requests.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {stats && (
        <div className="stats">
          <button className={`stat ${status === '' ? 'active' : ''}`} onClick={() => setStatus('')}>
            <b>{stats.total}</b><span>Total</span>
          </button>
          <button className={`stat ${status === 'Open' ? 'active' : ''}`} onClick={() => setStatus('Open')}>
            <b>{stats.open}</b><span>Open</span>
          </button>
          <button className={`stat ${status === 'In Progress' ? 'active' : ''}`} onClick={() => setStatus('In Progress')}>
            <b>{stats.inProgress}</b><span>In Progress</span>
          </button>
          <button className={`stat ${status === 'Resolved' ? 'active' : ''}`} onClick={() => setStatus('Resolved')}>
            <b>{stats.resolved}</b><span>Resolved</span>
          </button>
          <div className={`stat ${stats.overdue ? 'stat-warn' : ''}`}>
            <b>{stats.overdue}</b><span>Overdue</span>
          </div>
          <div className="stat">
            <b>{stats.last7}</b><span>New · 7 days</span>
          </div>
        </div>
      )}

      <div className="toolbar">
        <div className="filters">
          {FILTERS.map((f) => (
            <button key={f || 'all'} className={`filter ${status === f ? 'active' : ''}`} onClick={() => setStatus(f)}>
              {f || 'All'}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <input className="search" type="search" placeholder="Search no / client / PAN / email…"
            value={query} onChange={(e) => setQuery(e.target.value)} />
          <span className="count">{visible.length}</span>
          <button className="clear-btn" type="button" onClick={exportCSV} disabled={!visible.length}>Export CSV</button>
          <button className="clear-btn" type="button" onClick={load}>Refresh</button>
        </div>
      </div>

      <main className="page admin-page">
        <table className="table">
          <thead>
            <tr>
              <th>Request No.</th><th>Client</th><th>Email</th><th>PAN</th><th>Type</th>
              <th>Status</th><th>Remark</th><th>Created</th><th>Due</th><th></th>
            </tr>
          </thead>
          <tbody>
            {requests === null ? (
              <tr><td colSpan={10} className="empty">Loading…</td></tr>
            ) : error ? (
              <tr><td colSpan={10} className="empty">{error}</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={10} className="empty">No requests found.</td></tr>
            ) : (
              visible.map((r) => {
                const badge = r.status.replace(/\s+/g, '-').toLowerCase();
                const open = expanded === r.requestNo;
                return (
                  <FragmentRow key={r.requestNo}>
                    <tr className={isOverdue(r) ? 'overdue' : ''}>
                      <td className="mono">{r.requestNo}</td>
                      <td>{r.clientName}</td>
                      <td>{r.email || '—'}</td>
                      <td className="mono">{r.pan}</td>
                      <td>{r.requestType}</td>
                      <td><span className={`badge ${badge}`}>{r.status}</span></td>
                      <td className="remark" title={r.notes || ''}>
                        {r.notes ? (r.notes.length > 40 ? r.notes.slice(0, 40) + '…' : r.notes) : '—'}
                      </td>
                      <td>{fmt(r.createdAt)}</td>
                      <td>{fmt(r.dueAt)}{isOverdue(r) ? ' ⚠️' : ''}</td>
                      <td><button className="action" onClick={() => toggle(r)}>{open ? 'Close ▾' : 'Manage ▸'}</button></td>
                    </tr>
                    {open && (
                      <tr className="detail-row">
                        <td colSpan={10}>
                          <div className="detail">
                            <div className="detail-grid">
                              <div>
                                <span className="lbl">Detail of Query</span>
                                <p className="detail-text">{r.detail || '— (none provided) —'}</p>
                                <span className="lbl">Internal notes (admin only)</span>
                                <textarea className="notes" rows={3} placeholder="Add a note for your team…"
                                  value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />

                                <span className="lbl" style={{ marginTop: 16 }}>Client on file (CAN)</span>
                                {clientLoading ? (
                                  <p className="meta-line">Looking up client…</p>
                                ) : client ? (
                                  <dl className="meta linked-client">
                                    <dt>CAN</dt><dd className="mono">{client['CAN'] || '—'}</dd>
                                    <dt>Name</dt><dd>{client['Primary Holder Name'] || '—'}</dd>
                                    <dt>Mobile</dt><dd>{client['Primary Holder Primary Mobile No'] || '—'}</dd>
                                    <dt>Email</dt><dd>{client['Primary Holder Primary Email ID'] || '—'}</dd>
                                    <dt>Bank</dt><dd>{client['Bank 1 Name'] || '—'}</dd>
                                    <dt>CAN Status</dt><dd>{client['CAN Status'] || '—'}</dd>
                                  </dl>
                                ) : (
                                  <p className="meta-line">No CAN record matches this PAN.</p>
                                )}
                              </div>
                              <div className="detail-side">
                                <span className="lbl">Status</span>
                                <select className="status-select" value={draft.status}
                                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <dl className="meta">
                                  <dt>Created</dt><dd>{fmt(r.createdAt)}</dd>
                                  <dt>Due</dt><dd>{fmt(r.dueAt)}</dd>
                                  <dt>Updated</dt><dd>{fmt(r.updatedAt)}</dd>
                                </dl>
                                {draft.status !== r.status && <p className="hint">Changing status will email the client.</p>}
                                <button className="save-btn small" disabled={saving} onClick={() => save(r)}>
                                  {saving ? 'Saving…' : 'Save changes'}
                                </button>
                              </div>
                            </div>

                            <div className="issue-box">
                              <span className="lbl">Need help solving this query? Email the issue</span>
                              <input className="issue-to" type="email" placeholder="Recipient email (leave blank to send to the office email)"
                                value={issue.to} onChange={(e) => setIssue({ ...issue, to: e.target.value })} />
                              <textarea className="notes" rows={3} placeholder="Explain the issue you're facing so it can be resolved…"
                                value={issue.text} onChange={(e) => setIssue({ ...issue, text: e.target.value })} />
                              <div className="form-actions">
                                <button className="save-btn small" disabled={emailing} onClick={() => sendIssue(r)}>
                                  {emailing ? 'Sending…' : '✉ Send email'}
                                </button>
                                {emailMsg && <span className="issue-msg">{emailMsg}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                );
              })
            )}
          </tbody>
        </table>
      </main>
    </>
  );
}
