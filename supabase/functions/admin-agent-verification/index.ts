// supabase/functions/admin-agent-verification/index.ts
//
// RERA verification decisions for agents. Like admin-customers, this validates
// the caller's real Supabase Auth session (Authorization: Bearer
// <access_token>) and requires profiles.role IN ('admin','super_admin')
// before using the service-role key to bypass RLS. Also issues short-lived
// signed URLs for the agent's private RERA document (agent-documents bucket)
// so it is never exposed publicly — only to an authenticated admin, on demand.

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

  const agentId = body.agentId;
  if (typeof agentId !== 'string' || !agentId) return fail('agentId is required');

  const { data: agent } = await supabase.from('profiles').select('id, role, rera_document_url').eq('id', agentId).eq('role', 'agent').maybeSingle();
  if (!agent) return fail('Agent not found', 404);

  // ─── verify ────────────────────────────────────────────────────────────
  if (action === 'verify') {
    const { error } = await supabase
      .from('profiles')
      .update({
        rera_verified: true,
        rera_verification_status: 'verified',
        rera_verified_at: new Date().toISOString(),
        rera_verified_by: resolved.adminId,
        rera_rejection_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentId);
    if (error) return fail(error.message, 500);
    return json({ success: true });
  }

  // ─── reject (reason mandatory) ───────────────────────────────────────
  if (action === 'reject') {
    const reason = body.reason;
    if (typeof reason !== 'string' || !reason.trim()) return fail('A rejection reason is required');

    const { error } = await supabase
      .from('profiles')
      .update({
        rera_verified: false,
        rera_verification_status: 'rejected',
        rera_verified_at: null,
        rera_verified_by: resolved.adminId,
        rera_rejection_reason: reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentId);
    if (error) return fail(error.message, 500);
    return json({ success: true });
  }

  // ─── set-under-review ────────────────────────────────────────────────
  if (action === 'under-review') {
    const { error } = await supabase
      .from('profiles')
      .update({ rera_verification_status: 'under_review', updated_at: new Date().toISOString() })
      .eq('id', agentId);
    if (error) return fail(error.message, 500);
    return json({ success: true });
  }

  // ─── get-document (fresh signed URL, admin-only) ──────────────────────
  if (action === 'get-document') {
    if (!agent.rera_document_url) return fail('No RERA document on file', 404);
    const { data, error } = await supabase.storage.from('agent-documents').createSignedUrl(agent.rera_document_url as string, 600);
    if (error || !data?.signedUrl) return fail(error?.message ?? 'Could not generate document URL', 500);
    return json({ success: true, url: data.signedUrl });
  }

  return fail('Unknown action. Use x-action: verify | reject | under-review | get-document');
});
