import { REQUEST_TYPES, TAT_HOURS, REQUEST_TYPE_DOCS, REQUEST_TYPE_FIELDS } from '@/lib/store';

export const dynamic = 'force-dynamic';

// List the valid request types (used to build the dropdown) and any per-type
// document checklists / detail templates.
export async function GET() {
  return Response.json({
    requestTypes: REQUEST_TYPES,
    tatHours: TAT_HOURS,
    requestTypeDocs: REQUEST_TYPE_DOCS,
    requestTypeFields: REQUEST_TYPE_FIELDS,
  });
}
