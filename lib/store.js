// MF Portal service-request store. Requests are persisted to a small JSON
// file under ./data so they survive restarts.

import fs from 'node:fs';
import path from 'node:path';

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

const DATA_FILE = path.join(process.cwd(), 'data', 'service-requests.json');

export function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { seq: 0, requests: [] };
  }
}

export function saveStore(store) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

// Builds a request number like MFSR-20260603-0007.
export function makeRequestNo(seq, now) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `MFSR-${y}${m}${d}-${String(seq).padStart(4, '0')}`;
}
