// supabase/functions/bulk-import-admin/index.ts
// Admin-only bulk property import. Validates the caller's real Supabase Auth
// session (Authorization: Bearer <access_token>) and requires
// profiles.role IN ('admin','super_admin') — mirrors admin-security's
// resolveAdminCaller. Then does the actual writes with the service-role key,
// bypassing RLS (the bulk_import_* policies are scoped to auth.uid() =
// created_by OR is_staff(), which would otherwise require per-row ownership
// bookkeeping this endpoint doesn't need).
//
// Actions (via x-action header, matching the otp-auth/admin-security convention):
//   import  — body: { purpose, purposeValue, fileName, totalRows, duplicateStrategy,
//             rows: [{ rowNumber, raw, payload, errors, duplicateOfPropertyId?, duplicateReason? }] }.
//             Runs the same create/update/skip logic as the client-side Customer/Agent
//             path, chunked, and returns the completed job summary synchronously.
//   history — body: {}. Returns past jobs attributed to this admin.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { getCorsHeaders } from '../_shared/cors.ts';

let corsHeaders: Record<string, string> = {};

const CHUNK_SIZE = 25;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function fail(message: string, status = 400) {
  return json({ success: false, error: message }, status);
}

function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });
}

async function resolveAdminCaller(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<{ adminId: string } | { error: string; status: number }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return { error: 'Authentication required', status: 401 };
  const callerClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await callerClient.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: 'Authentication required', status: 401 };

  const { data: profile } = await supabase.from('profiles').select('role, status').eq('id', userId).maybeSingle();
  if (!['admin', 'super_admin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    return { error: 'Admin access required', status: 403 };
  }
  return { adminId: userId };
}

interface ImportRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  payload: Record<string, unknown> | null;
  errors: { field: string | null; message: string }[];
  duplicateOfPropertyId?: string;
  duplicateReason?: string;
  strategy?: 'skip' | 'update' | 'replace' | 'create_new';
}

// Duplicate detection runs here (service-role, unscoped by owner) rather than
// client-side for the admin path specifically: an admin's anon-key browser
// session has no auth.uid() (see file header), so the `properties` RLS SELECT
// policy would only ever show it published rows — a client-side duplicate
// check would silently miss most real duplicates. City/property-type
// resolution stays client-side (those tables are public-readable).
async function detectDuplicates(
  supabase: ReturnType<typeof createClient>,
  rows: ImportRow[],
): Promise<void> {
  const candidates = rows.filter((r) => r.errors.length === 0 && r.payload);
  if (candidates.length === 0) return;

  const referenceIds = candidates.map((r) => r.raw.reference_id).filter((v): v is string => typeof v === 'string' && v.length > 0);
  const foundByRef = new Set<string>();
  if (referenceIds.length > 0) {
    const { data } = await supabase.from('properties').select('id').in('id', referenceIds);
    for (const p of (data as { id: string }[]) ?? []) foundByRef.add(p.id);
  }

  const reraValues = [...new Set(candidates.map((r) => r.raw.rera_number).filter((v): v is string => typeof v === 'string' && v.length > 0))];
  const byRera = new Map<string, string>();
  if (reraValues.length > 0) {
    const { data } = await supabase
      .from('properties')
      .select('id, features')
      .or(reraValues.map((v) => `features->>rera_number.eq.${v}`).join(','));
    for (const p of (data as { id: string; features: Record<string, unknown> }[]) ?? []) {
      const rera = p.features?.rera_number as string | undefined;
      if (rera) byRera.set(rera, p.id);
    }
  }

  const titleCityRows = candidates.filter((r) => typeof r.payload?.title === 'string' && typeof r.payload?.city_id === 'string');
  const byTitleCity = new Map<string, string>();
  if (titleCityRows.length > 0) {
    const titles = [...new Set(titleCityRows.map((r) => (r.payload!.title as string).toLowerCase()))];
    const cityIds = [...new Set(titleCityRows.map((r) => r.payload!.city_id as string))];
    const { data } = await supabase.from('properties').select('id, title, city_id').in('city_id', cityIds).in('title', titles);
    for (const p of (data as { id: string; title: string; city_id: string }[]) ?? []) {
      byTitleCity.set(`${p.title.toLowerCase()}|${p.city_id}`, p.id);
    }
  }

  for (const r of candidates) {
    const refId = r.raw.reference_id as string | undefined;
    if (refId && foundByRef.has(refId)) {
      r.duplicateOfPropertyId = refId;
      r.duplicateReason = 'reference_id';
      continue;
    }
    const rera = r.raw.rera_number as string | undefined;
    if (rera && byRera.has(rera)) {
      r.duplicateOfPropertyId = byRera.get(rera);
      r.duplicateReason = 'rera_number';
      continue;
    }
    const title = r.payload?.title as string | undefined;
    const cityId = r.payload?.city_id as string | undefined;
    if (title && cityId) {
      const match = byTitleCity.get(`${title.toLowerCase()}|${cityId}`);
      if (match) {
        r.duplicateOfPropertyId = match;
        r.duplicateReason = 'title_city_price';
      }
    }
  }
}

Deno.serve(async (req: Request) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return fail('Method not allowed', 405);

  const action = req.headers.get('x-action') || '';
  const supabase = serviceClient();

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine for 'history' */
  }

  const resolved = await resolveAdminCaller(req, supabase);
  if ('error' in resolved) return fail(resolved.error, resolved.status);
  const { adminId } = resolved;

  // ─── ACTION: history ────────────────────────────────────────────
  if (action === 'history') {
    const { data, error } = await supabase
      .from('bulk_import_jobs')
      .select('*')
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false });
    if (error) { console.error('[bulk-import-admin] DB error:', error); return fail('Database operation failed', 500); }
    return json({ success: true, jobs: data });
  }

  // ─── ACTION: import ─────────────────────────────────────────────
  if (action === 'import') {
    const purposeValue = body.purposeValue as string | undefined;
    const fileName = (body.fileName as string | undefined) ?? 'import';
    const duplicateStrategy = (body.duplicateStrategy as string | undefined) ?? 'skip';
    const rows = (body.rows as ImportRow[] | undefined) ?? [];
    if (!purposeValue || rows.length === 0) return fail('purposeValue and rows are required');

    const { data: jobRow, error: jobErr } = await supabase
      .from('bulk_import_jobs')
      .insert({
        admin_id: adminId,
        created_by_role: 'admin',
        purpose: purposeValue,
        file_name: fileName,
        total_rows: rows.length,
        duplicate_strategy: duplicateStrategy,
        status: 'Processing',
      })
      .select()
      .single();
    if (jobErr || !jobRow) { console.error('[bulk-import-admin] create job error:', jobErr); return fail('Could not create import job', 500); }
    const jobId = jobRow.id as string;

    // properties.owner_id is NOT NULL REFERENCES auth.users(id) — the admin's own
    // `admins.id` is not an auth.users row (see file header), so every importable
    // row's owner must be resolved from its `mobile` column against profiles.phone.
    // Rows that don't resolve fail rather than risk inserting a broken FK.
    const mobiles = [...new Set(rows.map((r) => (r.raw.mobile as string | undefined)?.replace(/[^\d]/g, '')).filter((v): v is string => !!v))];
    const ownerByMobile = new Map<string, string>();
    if (mobiles.length > 0) {
      const { data } = await supabase.from('profiles').select('id, phone').in('phone', mobiles);
      for (const p of (data as { id: string; phone: string }[]) ?? []) ownerByMobile.set(p.phone, p.id);
    }
    for (const r of rows) {
      if (r.errors.length > 0 || !r.payload) continue;
      const mobile = (r.raw.mobile as string | undefined)?.replace(/[^\d]/g, '');
      const ownerId = mobile ? ownerByMobile.get(mobile) : undefined;
      if (!ownerId) {
        r.errors.push({ field: 'mobile', message: mobile ? `No account found for mobile "${mobile}"` : 'mobile is required for admin imports' });
        r.payload = null;
        continue;
      }
      r.payload.owner_id = ownerId;
    }

    await detectDuplicates(supabase, rows);

    let success = 0;
    let failed = 0;
    let skipped = 0;
    const toCreate: ImportRow[] = [];
    const toUpdate: ImportRow[] = [];

    for (const r of rows) {
      if (r.errors.length > 0 || !r.payload) {
        failed++;
        await supabase.from('bulk_import_rows').insert({ job_id: jobId, row_number: r.rowNumber, raw_data: r.raw, status: 'failed' });
        for (const e of r.errors) {
          await supabase.from('bulk_import_errors').insert({ job_id: jobId, row_number: r.rowNumber, field: e.field, message: e.message });
        }
        continue;
      }
      const isDup = !!r.duplicateOfPropertyId;
      const strategy = r.strategy ?? duplicateStrategy;
      if (isDup && strategy === 'skip') {
        skipped++;
        await supabase.from('bulk_import_rows').insert({
          job_id: jobId,
          row_number: r.rowNumber,
          raw_data: r.raw,
          status: 'skipped',
          duplicate_of_property_id: r.duplicateOfPropertyId,
          duplicate_reason: r.duplicateReason,
        });
        continue;
      }
      if (isDup && strategy !== 'create_new') toUpdate.push(r);
      else toCreate.push(r);
    }

    await supabase.from('bulk_import_jobs').update({ success_rows: 0, failed_rows: failed, skipped_rows: skipped }).eq('id', jobId);

    for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
      const chunk = toCreate.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase.from('properties').insert(chunk.map((r) => r.payload)).select('id');
      if (error) {
        for (const r of chunk) {
          failed++;
          await supabase.from('bulk_import_rows').insert({ job_id: jobId, row_number: r.rowNumber, raw_data: r.raw, status: 'failed' });
          await supabase.from('bulk_import_errors').insert({ job_id: jobId, row_number: r.rowNumber, message: error.message });
        }
      } else {
        const ids = (data as { id: string }[]) ?? [];
        for (let idx = 0; idx < chunk.length; idx++) {
          success++;
          await supabase.from('bulk_import_rows').insert({
            job_id: jobId,
            row_number: chunk[idx].rowNumber,
            raw_data: chunk[idx].raw,
            status: 'success',
            resolved_property_id: ids[idx]?.id,
          });
        }
      }
      await supabase.from('bulk_import_jobs').update({ success_rows: success, failed_rows: failed, skipped_rows: skipped }).eq('id', jobId);
    }

    for (const r of toUpdate) {
      const { error } = await supabase.from('properties').update(r.payload).eq('id', r.duplicateOfPropertyId!);
      if (error) {
        failed++;
        await supabase.from('bulk_import_rows').insert({ job_id: jobId, row_number: r.rowNumber, raw_data: r.raw, status: 'failed' });
        await supabase.from('bulk_import_errors').insert({ job_id: jobId, row_number: r.rowNumber, message: error.message });
      } else {
        success++;
        await supabase.from('bulk_import_rows').insert({
          job_id: jobId,
          row_number: r.rowNumber,
          raw_data: r.raw,
          status: 'success',
          resolved_property_id: r.duplicateOfPropertyId,
          duplicate_of_property_id: r.duplicateOfPropertyId,
          duplicate_reason: r.duplicateReason,
        });
      }
    }
    await supabase.from('bulk_import_jobs').update({ success_rows: success, failed_rows: failed, skipped_rows: skipped }).eq('id', jobId);

    const { data: finalJob } = await supabase
      .from('bulk_import_jobs')
      .update({ status: 'Completed', completed_at: new Date().toISOString() })
      .eq('id', jobId)
      .select()
      .single();

    return json({ success: true, job: finalJob });
  }

  return fail('Unknown action. Use x-action: import | history', 400);
});
