// supabase/functions/approveProperty/index.ts
// Admin approves (or overrides an AI decision on) a property. Calls the existing
// `admin_approve_property` RPC (which atomically publishes the property and writes
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
    if (!adminProfile || adminProfile.role !== 'admin') {
      return json({ error: 'Unauthorized: admin role required' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const propertyId = body?.property_id;
    const remarks: string | undefined = body?.remarks;
    if (!propertyId) return json({ error: 'property_id is required' }, 400);

    const { data: property } = await supabase.from('properties').select('title, owner_id').eq('id', propertyId).single();
    if (!property) return json({ error: 'Property not found' }, 404);

    const { data: rpcResult, error: rpcErr } = await supabase.rpc('admin_approve_property', {
      p_property_id: propertyId,
      p_admin_id: adminId,
    });
    if (rpcErr) return json({ error: rpcErr.message }, 500);

    // Find the latest verification row (if any) to link the override for audit purposes.
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
        ai_score: 100,
        verification_status: 'AI Verified',
        check_results: { admin_action: { passed: true, reason: 'Manually approved by admin.' } },
        verified_at: new Date().toISOString(),
        verified_by: adminProfile.email ?? adminId,
        admin_override: true,
        admin_remarks: remarks ?? null,
      })
      .select()
      .single();
    if (overrideErr) return json({ error: overrideErr.message }, 500);

    await supabase.from('verification_logs').insert({
      property_id: propertyId,
      ai_verification_id: overrideRow?.id ?? latestVerification?.id ?? null,
      action: 'admin_approve',
      actor: adminProfile.email ?? adminId,
      details: { remarks: remarks ?? null },
    });

    if (property.owner_id) {
      await supabase
        .rpc('notify_user', {
          p_user_id: property.owner_id,
          p_type: 'property_status',
          p_title: 'Property approved',
          p_body: `Your property "${property.title}" has been approved by an admin${remarks ? `: ${remarks}` : '.'}`,
          p_link: `/portal/my-properties`,
        })
        .then(
          () => {},
          () => {},
        );
    }

    return json({ success: true, property_id: propertyId, result: rpcResult });
  } catch (err) {
    console.error('[approveProperty] error:', err);
    return json({ error: 'Approval failed' }, 500);
  }
});
