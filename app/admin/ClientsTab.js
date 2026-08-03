'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CAN_COLUMNS,
  TABLE_COLUMNS,
  FIELD_GROUPS,
  KEY_FIELD,
  canonicalColumn,
} from '@/lib/can-fields';

const EMPTY = Object.fromEntries(CAN_COLUMNS.map((c) => [c, '']));
const PAGE_SIZE = 50;

function fmt(iso) { return iso ? new Date(iso).toLocaleString() : '—'; }
function FragmentRow({ children }) { return <>{children}</>; }

// Minimal CSV parser that handles quoted fields and escaped quotes.
function parseCSV(text) {
  const rows = []; let field = '', row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// A format hint shown as a placeholder, derived from the field label.
function placeholderFor(label) {
  if (label === KEY_FIELD) return 'e.g. 22091MB001';
  if (/PAN/i.test(label)) return 'ABCDE1234F';
  if (/Email/i.test(label)) return 'name@example.com';
  if (/Mobile/i.test(label)) return '10-digit number';
  if (/DOB/i.test(label)) return 'DD-MMM-YYYY';
  if (/IFSC/i.test(label)) return 'e.g. KKBK0001377';
  if (/MICR/i.test(label)) return '9-digit MICR';
  if (/Account No/i.test(label)) return 'Account number';
  if (/Percentage/i.test(label)) return 'e.g. 100';
  if (/ISD|Country Code/i.test(label)) return 'e.g. 91';
  return '';
}

// Shared grouped form covering all 94 CAN columns.
function GroupedForm({ state, set }) {
  const upd = (k, v) => set({ ...state, [k]: v });
  return (
    <div className="can-form">
      {FIELD_GROUPS.map((g) => (
        <fieldset className="can-group" key={g.title}>
          <legend>{g.title}</legend>
          <div className="can-grid">
            {g.fields.map((f) => (
              <label className="field" key={f}>
                <span>{f}{f === KEY_FIELD ? ' *' : ''}</span>
                <input
                  value={state[f] ?? ''}
                  placeholder={placeholderFor(f)}
                  onChange={(e) => upd(f, e.target.value)}
                  style={f === KEY_FIELD ? { textTransform: 'uppercase' } : undefined}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export default function ClientsTab() {
  const [rows, setRows] = useState(null);   // slim rows for the current page
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [dq, setDq] = useState('');         // debounced query
  const [error, setError] = useState('');
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formLoading, setFormLoading] = useState(false);
  const [clientRequests, setClientRequests] = useState(null); // this client's service requests
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef(null);

  // Debounce the search box so we only hit the server after typing settles.
  useEffect(() => {
    const t = setTimeout(() => setDq(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // A new search resets to the first page.
  useEffect(() => { setPage(1); }, [dq]);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(`/api/clients?q=${encodeURIComponent(dq)}&page=${page}&pageSize=${PAGE_SIZE}`);
      const data = await res.json();
      setRows(data.clients || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch {
      setError('Failed to load — is the server running?');
      setRows([]);
    }
  }, [dq, page]);

  useEffect(() => { load(); }, [load]);

  async function startEdit(c) {
    if (editId === c.id) { setEditId(null); setClientRequests(null); return; }
    setEditId(c.id);
    setForm(EMPTY);
    setFormLoading(true);
    setClientRequests(null);
    // Client 360: pull this client's service requests (matched by primary PAN).
    const pan = c['Primary PAN PEKRN'];
    if (pan) {
      fetch(`/api/service-requests?pan=${encodeURIComponent(pan)}`)
        .then((r) => r.json())
        .then((d) => setClientRequests(d.requests || []))
        .catch(() => setClientRequests([]));
    } else {
      setClientRequests([]);
    }
    try {
      const res = await fetch(`/api/clients/${c.id}`);
      const data = await res.json();
      const full = data.client || {};
      setForm(Object.fromEntries(CAN_COLUMNS.map((f) => [f, full[f] ?? ''])));
    } catch {
      setError('Could not load that record.');
    } finally {
      setFormLoading(false);
    }
  }

  async function saveEdit(id) {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError((data.errors || [data.error]).join(' ')); return; }
      setEditId(null); await load();
    } finally { setBusy(false); }
  }

  async function del(id) {
    if (!confirm('Delete this client?')) return;
    setBusy(true);
    try { await fetch(`/api/clients/${id}`, { method: 'DELETE' }); setEditId(null); await load(); }
    finally { setBusy(false); }
  }

  async function createClient() {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) { setError((data.errors || [data.error]).join(' ')); return; }
      setAddOpen(false); setAddForm(EMPTY);
      if (page === 1) await load(); else setPage(1);
    } finally { setBusy(false); }
  }

  async function onImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setImportMsg(''); setError('');
    try {
      const text = await file.text();
      const allRows = parseCSV(text);
      // The CAN export carries banner rows before the header. Find the row whose
      // first cell is the CAN column.
      const headerIdx = allRows.findIndex((r) => canonicalColumn(r[0]) === KEY_FIELD);
      if (headerIdx === -1) {
        setError('Could not find the header row (expected a "CAN" column). Export the sheet as CSV and retry.');
        return;
      }
      const headerKeys = allRows[headerIdx].map((h) => canonicalColumn(h));
      const imported = allRows.slice(headerIdx + 1).map((cells) => {
        const obj = {};
        headerKeys.forEach((key, i) => { if (key) obj[key] = cells[i]; });
        return obj;
      }).filter((o) => String(o[KEY_FIELD] ?? '').trim() !== '');

      if (!imported.length) { setError('No data rows found under the header.'); return; }

      const res = await fetch('/api/clients/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clients: imported }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Import failed.'); return; }
      setImportMsg(`Imported: ${data.added} added, ${data.updated} updated${data.skipped.length ? `, ${data.skipped.length} skipped` : ''} — ${data.total} total.`);
      if (page === 1) await load(); else setPage(1);
    } catch {
      setError('Could not read that file.');
    } finally { setBusy(false); }
  }

  function downloadCSV(filename, csvRows) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = csvRows.map((r) => r.map(esc).join(','));
    const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplate() {
    downloadCSV('can-clients-template.csv', [CAN_COLUMNS]);
  }

  // Export pulls the full records (all 94 fields) for the current search.
  async function exportCSV() {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/clients?all=1&q=${encodeURIComponent(dq)}`);
      const data = await res.json();
      const all = data.clients || [];
      const cols = ['id', ...CAN_COLUMNS, 'createdAt', 'updatedAt'];
      downloadCSV('can-clients.csv', [cols, ...all.map((c) => cols.map((k) => c[k]))]);
    } finally { setBusy(false); }
  }

  const colCount = TABLE_COLUMNS.length + 1;

  return (
    <>
      <div className="toolbar">
        <button className="filter active" type="button" onClick={() => { setAddOpen((v) => !v); setError(''); }}>
          {addOpen ? '× Cancel' : '+ Add client'}
        </button>
        <div className="toolbar-right">
          <input className="search" type="search" placeholder="Search CAN / name / PAN / mobile / email…"
            value={query} onChange={(e) => setQuery(e.target.value)} />
          <span className="count">{total}</span>
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={onImportFile} />
          <button className="clear-btn" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>Import CSV</button>
          <button className="clear-btn" type="button" onClick={downloadTemplate}>Template</button>
          <button className="clear-btn" type="button" onClick={exportCSV} disabled={busy || !total}>Export CSV</button>
          <button className="clear-btn" type="button" onClick={load}>Refresh</button>
        </div>
      </div>

      {(importMsg || error) && (
        <div className={`banner ${error ? 'banner-error' : ''}`}>{error || importMsg}</div>
      )}

      {addOpen && (
        <div className="add-panel">
          <GroupedForm state={addForm} set={setAddForm} />
          <button className="save-btn small" disabled={busy} onClick={createClient}>
            {busy ? 'Saving…' : 'Create client'}
          </button>
        </div>
      )}

      <main className="page admin-page">
        <table className="table">
          <thead>
            <tr>
              {TABLE_COLUMNS.map((c) => <th key={c}>{c}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={colCount} className="empty">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={colCount} className="empty">{dq ? 'No clients match your search.' : 'No clients yet. Add one or import the CAN CSV.'}</td></tr>
            ) : (
              rows.map((c) => {
                const open = editId === c.id;
                return (
                  <FragmentRow key={c.id}>
                    <tr>
                      {TABLE_COLUMNS.map((k) => (
                        <td key={k} className={k === KEY_FIELD || k === 'Primary PAN PEKRN' ? 'mono' : ''}>
                          {c[k] || '—'}
                        </td>
                      ))}
                      <td><button className="action" onClick={() => startEdit(c)}>{open ? 'Close ▾' : 'View / Edit ▸'}</button></td>
                    </tr>
                    {open && (
                      <tr className="detail-row">
                        <td colSpan={colCount}>
                          <div className="detail">
                            {formLoading ? (
                              <p className="meta-line">Loading record…</p>
                            ) : (
                              <>
                                <GroupedForm state={form} set={setForm} />
                                <p className="meta-line">Updated {fmt(c.updatedAt)} · ID {c.id}</p>

                                <fieldset className="can-group">
                                  <legend>Service Requests ({clientRequests === null ? '…' : clientRequests.length})</legend>
                                  {clientRequests === null ? (
                                    <p className="meta-line" style={{ margin: 0 }}>Loading…</p>
                                  ) : clientRequests.length === 0 ? (
                                    <p className="meta-line" style={{ margin: 0 }}>No service requests yet for this client.</p>
                                  ) : (
                                    <table className="mini-table">
                                      <thead>
                                        <tr><th>Request No.</th><th>Type</th><th>Status</th><th>Created</th><th>Due</th></tr>
                                      </thead>
                                      <tbody>
                                        {clientRequests.map((req) => (
                                          <tr key={req.requestNo}>
                                            <td className="mono">{req.requestNo}</td>
                                            <td>{req.requestType}</td>
                                            <td><span className={`badge ${req.status.replace(/\s+/g, '-').toLowerCase()}`}>{req.status}</span></td>
                                            <td>{fmt(req.createdAt)}</td>
                                            <td>{fmt(req.dueAt)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </fieldset>

                                <div className="form-actions">
                                  <button className="save-btn small" disabled={busy} onClick={() => saveEdit(c.id)}>
                                    {busy ? 'Saving…' : 'Save changes'}
                                  </button>
                                  <button className="danger-btn" disabled={busy} onClick={() => del(c.id)}>Delete</button>
                                </div>
                              </>
                            )}
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

      {total > 0 && (
        <div className="pager">
          <button className="clear-btn" type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
          <span className="pager-info">
            Page {page} of {pages} · {total.toLocaleString()} client{total === 1 ? '' : 's'}
          </span>
          <button className="clear-btn" type="button" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next →</button>
        </div>
      )}
    </>
  );
}
