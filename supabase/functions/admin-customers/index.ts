// supabase/functions/admin-customers/index.ts
//
// The Admin Customers CRM (src/pages/admin/manage.tsx) previously queried
// `public.profiles` directly with the anon-key client. That table's RLS policy
// only allows reads where `auth.uid() = id`, the row's own role is
// agent/admin, or `is_staff()` (which itself checks `auth.uid()`) — an admin
// browser only satisfies that once it holds a real Supabase Auth session.
//
// This edge function routes customer reads/writes through the service-role
// key instead (bypassing RLS), after validating the caller's real Supabase
// Auth session (Authorization: Bearer <access_token>) and requiring
// profiles.role IN ('admin','super_admin') — mirrors admin-security's
// resolveAdminCaller. This mirrors the existing service-role pattern used by
// process-application / admin-security, without loosening RLS on `profiles`
// itself (unlike the pre-existing "_clean" policies on agent_applications /
// builder_applications, which made those tables world-readable — that
// shortcut is not repeated here).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { getCorsHeaders } from '../_shared/cors.ts';

let corsHeaders: Record<string, string> = {};

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

const CUSTOMER_EDITABLE_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'bio', 'company'] as const;
const VALID_STATUSES = ['active', 'inactive', 'suspended', 'blocked'];

async function resolveAdmin(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return { error: 'Authentication required', status: 401 } as const;
  const callerClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await callerClient.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: 'Authentication required', status: 401 } as const;

  const { data: profile } = await supabase.from('profiles').select('role, status').eq('id', userId).maybeSingle();
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) return { error: 'Admin access required', status: 403 } as const;
  if (profile?.status !== 'active') return { error: 'Admin account is not active', status: 403 } as const;

  return { adminId: userId } as const;
}

function monthStartIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
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
    return fail('Invalid JSON body');
  }

  const resolved = await resolveAdmin(req, supabase);
  if ('error' in resolved) return fail(resolved.error, resolved.status);

  // ─── list ──────────────────────────────────────────────────────────────
  if (action === 'list') {
    const search = typeof body.search === 'string' ? body.search.trim() : '';
    const status = typeof body.status === 'string' && body.status !== 'all' ? body.status : null;
    const dateFrom = typeof body.dateFrom === 'string' ? body.dateFrom : null;
    const dateTo = typeof body.dateTo === 'string' ? body.dateTo : null;

    let q = supabase.from('profiles').select('*', { count: 'exact' }).eq('role', 'customer');
    if (status) q = q.eq('status', status);
    if (dateFrom) q = q.gte('created_at', dateFrom);
    if (dateTo) q = q.lte('created_at', dateTo);
    if (search) {
      const like = `%${search}%`;
      q = q.or(
        `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
      );
    }
    q = q.order('created_at', { ascending: false });

    const { data, error, count } = await q;
    if (error) { console.error('[admin-customers] DB error:', error); return fail('Database operation failed', 500); }

    const [{ count: total }, { count: active }, { count: newThisMonth }] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer').eq('status', 'active'),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer')
        .gte('created_at', monthStartIso()),
    ]);

    return json({
      success: true,
      customers: data ?? [],
      filteredCount: count ?? (data ?? []).length,
      stats: {
        total: total ?? 0,
        active: active ?? 0,
        inactive: (total ?? 0) - (active ?? 0),
        newThisMonth: newThisMonth ?? 0,
      },
    });
  }

  // ─── get (single customer detail, with activity counts) ────────────────
  if (action === 'get') {
    const customerId = body.customerId;
    if (typeof customerId !== 'string' || !customerId) return fail('customerId is required');

    const { data: customer, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', customerId)
      .eq('role', 'customer')
      .maybeSingle();
    if (error) { console.error('[admin-customers] DB error:', error); return fail('Database operation failed', 500); }
    if (!customer) return fail('Customer not found', 404);

    const [{ count: properties }, { count: favorites }, { count: enquiries }, { count: appointments }] = await Promise.all([
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('owner_id', customerId),
      supabase.from('favorites').select('id', { count: 'exact', head: true }).eq('user_id', customerId),
      supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
    ]);

    return json({
      success: true,
      customer,
      activity: {
        propertiesListed: properties ?? 0,
        savedProperties: favorites ?? 0,
        enquiries: enquiries ?? 0,
        appointments: appointments ?? 0,
      },
    });
  }

  // ─── update-status ───────────────────────────────────────────────────
  if (action === 'update-status') {
    const customerId = body.customerId;
    const status = body.status;
    if (typeof customerId !== 'string' || !customerId) return fail('customerId is required');
    if (typeof status !== 'string' || !VALID_STATUSES.includes(status)) return fail('Invalid status');

    const { error } = await supabase
      .from('profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', customerId)
      .eq('role', 'customer');
    if (error) { console.error('[admin-customers] DB error:', error); return fail('Database operation failed', 500); }
    return json({ success: true });
  }

  // ─── update-profile ──────────────────────────────────────────────────
  if (action === 'update-profile') {
    const customerId = body.customerId;
    if (typeof customerId !== 'string' || !customerId) return fail('customerId is required');

    const updates: Record<string, unknown> = {};
    for (const field of CUSTOMER_EDITABLE_FIELDS) {
      if (typeof body[field] === 'string') updates[field] = (body[field] as string).trim() || null;
    }
    if (Object.keys(updates).length === 0) return fail('No editable fields provided');
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase.from('profiles').update(updates).eq('id', customerId).eq('role', 'customer');
    if (error) { console.error('[admin-customers] DB error:', error); return fail('Database operation failed', 500); }
    return json({ success: true });
  }

  // ─── delete ────────────────────────────────────────────────────────────
  if (action === 'delete') {
    const customerIds = body.customerIds;
    if (!Array.isArray(customerIds) || customerIds.length === 0) return fail('customerIds is required');

    const { error } = await supabase.from('profiles').delete().in('id', customerIds).eq('role', 'customer');
    if (error) { console.error('[admin-customers] DB error:', error); return fail('Database operation failed', 500); }
    return json({ success: true });
  }

  return fail('Unknown action. Use x-action: list | get | update-status | update-profile | delete');
});
