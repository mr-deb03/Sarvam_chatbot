// Service-request store, backed by Postgres (see ./db.js).

import { q, nextSeq } from './db.js';

// Request types from the MF Portal spec (dropdown options).
export const REQUEST_TYPES = [
  'Addition of New Mutual Funds',
  'SIP Stop',
  'SIP / MF Redemption',
  'Require MF Statement',
  'SIP Start',
  'Lumpsum Investment',
  'Portfolio Review',
  'Specific MF Statements',
  'New CAN ID Creation',
  'CAN ID Cancellation Request',
  'Required Quotation of Medical Insurance',
  'Required Quotation of Term Insurance',
  'Any Other Investments like (One Time Investment - MLD, NCD, Bonds, ETF etc)',
  'Inquiry for PMS and AIS Services',
  'Any Other Services',
];

// Documents a client must provide for specific request types. When a client
// picks one of these in the chat, we list the required documents for them.
export const REQUEST_TYPE_DOCS = {
  'New CAN ID Creation': [
    'Pan card photo',
    'Adhar card photo',
    'Signature photo',
    'Bank cheque photo',
  ],
};

// Extra details to collect for specific request types. Shown in the chat as a
// fill-in template that the client completes; the reply is saved as the detail.
export const REQUEST_TYPE_FIELDS = {
  'New CAN ID Creation': [
    'Client name',
    'Mobile no.',
    'Email id',
    'Birth place',
    'Mother name',
    'Marital status',
    'Occupation',
    'SIP date',
    'SIP amount',
    'Nominee Name',
    'Nominee relation',
    'Nominee birth date',
    'Reference',
  ],
};

// Turnaround time promised to the client, in hours.
export const TAT_HOURS = 72;

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const VALID_STATUSES = ['Open', 'In Progress', 'Resolved'];

// Reassuring message shown to a client when they check a request's status.
export const STATUS_MESSAGES = {
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

// Builds a request number like MFSR-20260603-0007.
export function makeRequestNo(seq, now) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `MFSR-${y}${m}${d}-${String(seq).padStart(4, '0')}`;
}

const iso = (v) => (v ? new Date(v).toISOString() : null);
function rowToReq(r) {
  return {
    requestNo: r.request_no,
    clientName: r.client_name,
    email: r.email,
    pan: r.pan,
    requestType: r.request_type,
    detail: r.detail,
    notes: r.notes,
    status: r.status,
    createdAt: iso(r.created_at),
    dueAt: iso(r.due_at),
    updatedAt: iso(r.updated_at),
  };
}

// List requests (newest first), optionally filtered by status and/or PAN.
export async function listRequests({ status = '', pan = '' } = {}) {
  const conds = [];
  const params = [];
  if (status) {
    params.push(status);
    conds.push(`lower(status) = lower($${params.length})`);
  }
  if (pan) {
    params.push(pan.toUpperCase());
    conds.push(`upper(pan) = $${params.length}`);
  }
  const where = conds.length ? 'where ' + conds.join(' and ') : '';
  const res = await q(`select * from service_requests ${where} order by created_at desc`, params);
  return res.rows.map(rowToReq);
}

// Whole-store counts for the admin dashboard bar.
export async function getRequestStats() {
  const res = await q(
    `select
       count(*)::int as total,
       count(*) filter (where status = 'Open')::int as open,
       count(*) filter (where status = 'In Progress')::int as in_progress,
       count(*) filter (where status = 'Resolved')::int as resolved,
       count(*) filter (where status <> 'Resolved' and due_at < now())::int as overdue,
       count(*) filter (where created_at >= now() - interval '7 days')::int as last7
     from service_requests`,
  );
  const r = res.rows[0];
  return {
    total: r.total,
    open: r.open,
    inProgress: r.in_progress,
    resolved: r.resolved,
    overdue: r.overdue,
    last7: r.last7,
  };
}

export async function getRequestByNo(requestNo) {
  const res = await q('select * from service_requests where request_no = $1', [requestNo]);
  return res.rows[0] ? rowToReq(res.rows[0]) : null;
}

export async function createRequest({ clientName, email, pan, requestType, detail }) {
  const seq = await nextSeq('requests');
  const now = new Date();
  const requestNo = makeRequestNo(seq, now);
  const dueAt = new Date(now.getTime() + TAT_HOURS * 3600 * 1000);
  await q(
    `insert into service_requests
       (request_no, seq, client_name, email, pan, request_type, detail, notes, status, created_at, due_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,'','Open',$8,$9,$8)`,
    [requestNo, seq, clientName, email, pan, requestType, detail, now.toISOString(), dueAt.toISOString()],
  );
  return rowToReq({
    request_no: requestNo, client_name: clientName, email, pan, request_type: requestType,
    detail, notes: '', status: 'Open', created_at: now, due_at: dueAt, updated_at: now,
  });
}

// Update status and/or notes. Returns { record, statusChanged } or null if missing.
export async function updateRequest(requestNo, { status, notes }) {
  const cur = await getRequestByNo(requestNo);
  if (!cur) return null;
  const newStatus = status !== undefined ? status : cur.status;
  const newNotes = notes !== undefined ? String(notes) : cur.notes;
  const statusChanged = status !== undefined && cur.status !== status;
  await q('update service_requests set status=$1, notes=$2, updated_at=now() where request_no=$3', [
    newStatus, newNotes, requestNo,
  ]);
  return { record: await getRequestByNo(requestNo), statusChanged };
}
