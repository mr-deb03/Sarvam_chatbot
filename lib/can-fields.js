// CAN data field definitions — pure data, no Node APIs, so this is safe to
// import from both server routes and client components.

// The 94 columns from the MFU CAN export, in source order. Records are stored
// keyed by these exact labels so imports/exports stay loss-free.
export const CAN_COLUMNS = [
  'CAN',
  'Holding Type',
  'CAN Category',
  'Residential Status',
  'Regn Date',
  'CAN Status',
  'Primary PAN PEKRN',
  'Primary Holder Name',
  'Primary Holder DOB',
  'Primary KRA Status',
  'Second Holder PAN',
  'Second Holder Name',
  'Second Holder DOB',
  'Second Holder KRA Status',
  'Third holder PAN',
  'Third holder Name',
  'Third holder DOB',
  'Third Holder KRA Status',
  'Guardian PAN',
  'Guardian Name',
  'Guardian DOB',
  'Guardian KRA Status',
  'Primary Holder Res ISD',
  'Primary Holder Mob Country Code',
  'Primary Holder Primary Mobile No',
  'Primary Holder Primary Email ID',
  'Second Holder Res ISD',
  'Second Holder Mob Country Code',
  'CDSL Client ID',
  'Second Holder Primary Mobile No',
  'NSDL Client ID',
  'Second Holder Primary Email ID',
  'Third Holder Res ISD',
  'Third Holder Mob Country Code',
  'Third Holder Primary Mobile No',
  'Third Holder Primary Email ID',
  'Bank 1 Name',
  'Bank 1 MICR',
  'Bank 1 IFSC',
  'Bank 1 Account No',
  'Bank 1 Account Type',
  'Bank 1 Default Ac Flag',
  'Bank 1 Branch',
  'Bank 2 Name',
  'Bank 2 MICR',
  'Bank 2 IFSC',
  'Bank 2 Account No',
  'Bank 2 Account Type',
  'Bank 2 Default Ac Flag',
  'Bank 2 Branch',
  'Bank 3 Name',
  'Bank 3 MICR',
  'Bank 3 IFSC',
  'Bank 3 Account No',
  'Bank 3 Account Type',
  'Bank 3 Default Ac Flag',
  'Bank 3 Branch',
  'Bank 4 Name',
  'Bank 4 MICR',
  'Bank 4 IFSC',
  'Bank 4 Account No',
  'Bank 4 Account Type',
  'Bank 4 Default Ac Flag',
  'Bank 4 Branch',
  'Bank 5 Name',
  'Bank 5 MICR',
  'Bank 5 IFSC',
  'Bank 5 Account No',
  'Bank 5 Account Type',
  'Bank 5 Default Ac Flag',
  'Bank 5 Branch',
  'Nominee Declaration',
  'Nominee Type',
  'First Nominee Name',
  'First Nominee Percentage',
  'First Nominee Relationship',
  'First Nominee DOB',
  'First Nominee Guardian Name',
  'First Nominee Guardian Relationship',
  'First Nominee Guardian DOB',
  'Second Nominee Name',
  'Second Nominee Percentage',
  'Second Nominee Relationship',
  'Second Nominee DOB',
  'Second Nominee Guardian Name',
  'Second Nominee Guardian Relationship',
  'Second Nominee Guardian DOB',
  'Third Nominee Name',
  'Third Nominee Percentage',
  'Third Nominee Relationship',
  'Third Nominee DOB',
  'Third Nominee Guardian Name',
  'Third Nominee Guardian Relationship',
  'Third Nominee Guardian DOB',
];

// Key / identity fields used across the app.
export const KEY_FIELD = 'CAN'; // unique per record
export const NAME_FIELD = 'Primary Holder Name';
export const EMAIL_FIELD = 'Primary Holder Primary Email ID';
export const MOBILE_FIELD = 'Primary Holder Primary Mobile No';
export const PAN_FIELDS = ['Primary PAN PEKRN', 'Second Holder PAN', 'Third holder PAN', 'Guardian PAN'];

// Columns surfaced in the admin grid (the rest live in the detail/edit panel).
export const TABLE_COLUMNS = [
  'CAN',
  'Holding Type',
  'CAN Status',
  'Primary Holder Name',
  'Primary PAN PEKRN',
  'Primary Holder Primary Mobile No',
  'Primary Holder Primary Email ID',
  'Bank 1 Name',
];

// Logical groupings for the detail / edit form (covers all 94 columns).
export const FIELD_GROUPS = [
  { title: 'Account', fields: ['CAN', 'Holding Type', 'CAN Category', 'Residential Status', 'Regn Date', 'CAN Status'] },
  { title: 'Primary Holder', fields: ['Primary PAN PEKRN', 'Primary Holder Name', 'Primary Holder DOB', 'Primary KRA Status', 'Primary Holder Res ISD', 'Primary Holder Mob Country Code', 'Primary Holder Primary Mobile No', 'Primary Holder Primary Email ID'] },
  { title: 'Second Holder', fields: ['Second Holder PAN', 'Second Holder Name', 'Second Holder DOB', 'Second Holder KRA Status', 'Second Holder Res ISD', 'Second Holder Mob Country Code', 'Second Holder Primary Mobile No', 'Second Holder Primary Email ID'] },
  { title: 'Third Holder', fields: ['Third holder PAN', 'Third holder Name', 'Third holder DOB', 'Third Holder KRA Status', 'Third Holder Res ISD', 'Third Holder Mob Country Code', 'Third Holder Primary Mobile No', 'Third Holder Primary Email ID'] },
  { title: 'Guardian', fields: ['Guardian PAN', 'Guardian Name', 'Guardian DOB', 'Guardian KRA Status'] },
  { title: 'Demat', fields: ['CDSL Client ID', 'NSDL Client ID'] },
  { title: 'Bank 1', fields: ['Bank 1 Name', 'Bank 1 MICR', 'Bank 1 IFSC', 'Bank 1 Account No', 'Bank 1 Account Type', 'Bank 1 Default Ac Flag', 'Bank 1 Branch'] },
  { title: 'Bank 2', fields: ['Bank 2 Name', 'Bank 2 MICR', 'Bank 2 IFSC', 'Bank 2 Account No', 'Bank 2 Account Type', 'Bank 2 Default Ac Flag', 'Bank 2 Branch'] },
  { title: 'Bank 3', fields: ['Bank 3 Name', 'Bank 3 MICR', 'Bank 3 IFSC', 'Bank 3 Account No', 'Bank 3 Account Type', 'Bank 3 Default Ac Flag', 'Bank 3 Branch'] },
  { title: 'Bank 4', fields: ['Bank 4 Name', 'Bank 4 MICR', 'Bank 4 IFSC', 'Bank 4 Account No', 'Bank 4 Account Type', 'Bank 4 Default Ac Flag', 'Bank 4 Branch'] },
  { title: 'Bank 5', fields: ['Bank 5 Name', 'Bank 5 MICR', 'Bank 5 IFSC', 'Bank 5 Account No', 'Bank 5 Account Type', 'Bank 5 Default Ac Flag', 'Bank 5 Branch'] },
  { title: 'Nominees', fields: ['Nominee Declaration', 'Nominee Type', 'First Nominee Name', 'First Nominee Percentage', 'First Nominee Relationship', 'First Nominee DOB', 'First Nominee Guardian Name', 'First Nominee Guardian Relationship', 'First Nominee Guardian DOB', 'Second Nominee Name', 'Second Nominee Percentage', 'Second Nominee Relationship', 'Second Nominee DOB', 'Second Nominee Guardian Name', 'Second Nominee Guardian Relationship', 'Second Nominee Guardian DOB', 'Third Nominee Name', 'Third Nominee Percentage', 'Third Nominee Relationship', 'Third Nominee DOB', 'Third Nominee Guardian Name', 'Third Nominee Guardian Relationship', 'Third Nominee Guardian DOB'] },
];

// Build a lookup from a normalised header string -> canonical column label.
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const CANON = new Map(CAN_COLUMNS.map((c) => [norm(c), c]));
export function canonicalColumn(header) {
  return CANON.get(norm(header)) || null;
}
