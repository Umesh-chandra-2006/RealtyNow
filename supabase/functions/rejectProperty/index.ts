// supabase/functions/rejectProperty/index.ts
// Admin rejects (or overrides an AI decision on) a property. Calls the existing
// `admin_reject_property` RPC (which atomically updates status/rejection_reason and writes
// property_status_history) rather than reimplementing that mutation, then additionally
// records the decision in ai_verifications/verification_logs and notifies the owner.
//
// The caller is resolved from the Authorization header and their `profiles.role` is
// checked server-side — a client-supplied admin_id is never trusted for authorization.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { getCorsHeaders } from '../_shared/cors.ts';

let corsHeaders: Record<string, string> = {};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const anonClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await anonClient.auth.getUser();
    const adminId = userData.user?.id;
    if (!adminId) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { persistSession: false },
    });

    const { data: adminProfile } = await supabase.from('profiles').select('role, email').eq('id', adminId).single();
if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'super_admin')) {
return json({ error: 'Unauthorized: admin role required' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const propertyId = body?.property_id;
    const reason: string | undefined = body?.reason;
    const remarks: string | undefined = body?.remarks;
    if (!propertyId) return json({ error: 'property_id is required' }, 400);
    if (!reason || !reason.trim()) return json({ error: 'reason is required' }, 400);

    const { data: property } = await supabase.from('properties').select('title, owner_id').eq('id', propertyId).single();
    if (!property) return json({ error: 'Property not found' }, 404);

    const { data: rpcResult, error: rpcErr } = await supabase.rpc('admin_reject_property', {
      p_property_id: propertyId,
      p_admin_id: adminId,
      p_reason: reason,
    });
    if (rpcErr) { console.error('[rejectProperty] reject RPC error:', rpcErr); return json({ error: 'Rejection failed' }, 500); }

    const { data: latestVerification } = await supabase
      .from('ai_verifications')
      .select('id')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: overrideRow, error: overrideErr } = await supabase
      .from('ai_verifications')
      .insert({
        property_id: propertyId,
        ai_score: 0,
        verification_status: 'Rejected',
        check_results: { admin_action: { passed: false, reason } },
        verified_at: new Date().toISOString(),
        verified_by: adminProfile.email ?? adminId,
        admin_override: true,
        admin_remarks: remarks ?? reason,
      })
      .select()
      .single();
    if (overrideErr) { console.error('[rejectProperty] override error:', overrideErr); return json({ error: 'Rejection failed' }, 500); }

    await supabase.from('verification_logs').insert({
      property_id: propertyId,
      ai_verification_id: overrideRow?.id ?? latestVerification?.id ?? null,
      action: 'admin_reject',
      actor: adminProfile.email ?? adminId,
      details: { reason, remarks: remarks ?? null },
    });

    if (property.owner_id) {
      await supabase
        .rpc('notify_user', {
          p_user_id: property.owner_id,
          p_type: 'property_status',
          p_title: 'Property rejected',
          p_body: `Your property "${property.title}" was rejected by an admin. Reason: ${reason}`,
          p_link: `/portal/my-properties`,
        })
        .then(
          () => {},
          () => {},
        );
    }

    return json({ success: true, property_id: propertyId, result: rpcResult });
  } catch (err) {
    console.error('[rejectProperty] error:', err);
    return json({ error: 'Rejection failed' }, 500);
  }
});
