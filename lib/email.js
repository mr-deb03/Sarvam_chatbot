// Sends a copy of a service request to the client by email.
// Uses SMTP via nodemailer when configured; otherwise degrades to a no-op so
// that submitting a request never fails just because email isn't set up.

import nodemailer from 'nodemailer';
import { STATUS_MESSAGES } from './store';

let transporter;

function getTransporter() {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    transporter = null; // not configured
    return transporter;
  }

  const port = Number(SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendRequestEmail(record) {
  const t = getTransporter();
  if (!t) return { sent: false, reason: 'SMTP not configured' };

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const due = new Date(record.dueAt).toLocaleString();

  const text =
    `Hi ${record.clientName},\n\n` +
    `Thank you — your MF Portal service request has been logged.\n\n` +
    `Request No: ${record.requestNo}\n` +
    `Type: ${record.requestType}\n` +
    `PAN: ${record.pan}\n` +
    (record.detail ? `Details: ${record.detail}\n` : '') +
    `Status: ${record.status}\n` +
    `Expected resolution: within 72 hours (by ${due})\n\n` +
    `We'll keep you posted. You can also check the status anytime by quoting your ` +
    `request number.\n\n— MF Portal`;

  const html =
    `<p>Hi ${record.clientName},</p>` +
    `<p>Thank you — your MF Portal service request has been logged.</p>` +
    `<table cellpadding="6" style="border-collapse:collapse">` +
    `<tr><td><b>Request No</b></td><td>${record.requestNo}</td></tr>` +
    `<tr><td><b>Type</b></td><td>${record.requestType}</td></tr>` +
    `<tr><td><b>PAN</b></td><td>${record.pan}</td></tr>` +
    (record.detail ? `<tr><td><b>Details</b></td><td>${record.detail}</td></tr>` : '') +
    `<tr><td><b>Status</b></td><td>${record.status}</td></tr>` +
    `<tr><td><b>Expected resolution</b></td><td>within 72 hours (by ${due})</td></tr>` +
    `</table>` +
    `<p>We'll keep you posted. You can check the status anytime by quoting your request number.</p>` +
    `<p>— MF Portal</p>`;

  await t.sendMail({
    from,
    to: record.email,
    bcc: process.env.ADMIN_EMAIL || undefined, // notify the admin of new requests
    subject: `MF Portal — Service Request ${record.requestNo} received`,
    text,
    html,
  });

  return { sent: true };
}

// Lets an admin email out the issue they're facing on a request (e.g. to a
// senior / support) along with an explanation, so they can get help solving it.
export async function sendIssueEmail(record, explanation, to) {
  const t = getTransporter();
  if (!t) return { sent: false, reason: 'SMTP not configured' };

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const recipient = to || process.env.ADMIN_EMAIL;
  if (!recipient) return { sent: false, reason: 'No recipient configured' };

  const rows = [
    ['Request No', record.requestNo],
    ['Client', record.clientName],
    ['PAN', record.pan],
    ['Client email', record.email || '—'],
    ['Type', record.requestType],
    ['Status', record.status],
    ['Detail of query', record.detail || '—'],
    ['Internal notes', record.notes || '—'],
  ];

  const text =
    `An issue needs attention on the following service request.\n\n` +
    rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
    `\n\nIssue / explanation from admin:\n${explanation}\n\n— MF Portal Admin`;

  const html =
    `<p>An issue needs attention on the following service request.</p>` +
    `<table cellpadding="6" style="border-collapse:collapse">` +
    rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${v}</td></tr>`).join('') +
    `</table>` +
    `<p><b>Issue / explanation from admin:</b><br>${String(explanation).replace(/\n/g, '<br>')}</p>` +
    `<p>— MF Portal Admin</p>`;

  await t.sendMail({
    from,
    to: recipient,
    subject: `MF Portal — Help needed on ${record.requestNo} (${record.requestType})`,
    text,
    html,
  });

  return { sent: true, to: recipient };
}

// Notifies the client when an admin changes the status of their request.
export async function sendStatusUpdateEmail(record) {
  const t = getTransporter();
  if (!t || !record.email) return { sent: false, reason: 'SMTP not configured or no email' };

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const calming = STATUS_MESSAGES[record.status] || '';

  const text =
    `Hi ${record.clientName},\n\n` +
    `There's an update on your MF Portal service request.\n\n` +
    `Request No: ${record.requestNo}\n` +
    `Type: ${record.requestType}\n` +
    `New status: ${record.status}\n\n` +
    `${calming}\n\n— MF Portal`;

  const html =
    `<p>Hi ${record.clientName},</p>` +
    `<p>There's an update on your MF Portal service request.</p>` +
    `<table cellpadding="6" style="border-collapse:collapse">` +
    `<tr><td><b>Request No</b></td><td>${record.requestNo}</td></tr>` +
    `<tr><td><b>Type</b></td><td>${record.requestType}</td></tr>` +
    `<tr><td><b>New status</b></td><td>${record.status}</td></tr>` +
    `</table>` +
    `<p>${calming}</p>` +
    `<p>— MF Portal</p>`;

  await t.sendMail({
    from,
    to: record.email,
    subject: `MF Portal — Service Request ${record.requestNo} is now ${record.status}`,
    text,
    html,
  });

  return { sent: true };
}
