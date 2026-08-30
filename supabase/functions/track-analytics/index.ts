// supabase/functions/track-analytics/index.ts
//
// Throttled entry point for the ad/view counter RPCs (record_property_view,
// increment_ad_click, increment_ad_impression).
//
// Why this exists (Audit High #11 hardening, migration 0148 + 0149): the counter
// RPCs are intentionally callable by `anon` (anonymous visitors are the core ad
// and view audience). Postgres functions cannot see the client IP, so a per-IP
// rate cap cannot be enforced inside the SQL functions. This edge function runs
// where the request IP IS visible (via `x-forwarded-for` / `x-real-ip`) and
// applies a per-IP throttle through the shared `checkRateLimit` helper before
// forwarding to the RPC with the caller's own credentials (so `auth.uid()`
// still drives the per-user limits and dedupe inside the RPCs).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

// Per-IP caps for each action (per window), aligned with the per-user caps the
// RPCs already enforce for signed-in sessions. Generous enough not to break
// legitimate browsing, tight enough to choke a scripted anonymous burst.
const ACTION_CAPS: Record<string, { max: number; window: number }> = {
  view: { max: 120, window: 3600 },
  click: { max: 180, window: 3600 },
  impression: { max: 300, window: 3600 },
};

function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });
}

function json(data: unknown, status = 200, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
function fail(message: string, status = 400, cors: Record<string, string>) {
  return json({ success: false, error: message }, status, cors);
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });
  if (req.method !== 'POST') return fail('Method not allowed', 405, cors);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body', 400, cors);
  }

  const action = String(body.action || '');
  const cap = ACTION_CAPS[action];
  if (!cap) return fail('action must be one of: view, click, impression', 400, cors);

  // Per-IP throttle first (service-role client; fn_check_rate_limit is
  // service_role-only) to bound anonymous bursts before hitting the DB RPCs.
  const svc = serviceClient();
  const rate = await checkRateLimit(svc, req, {
    endpoint: `analytics:ip:${action}`,
    maxRequests: cap.max,
    windowSeconds: cap.window,
  });
  if (!rate.allowed) {
    return json({ success: false, error: 'Rate limit exceeded' }, 429, cors);
  }

  // Forward using the caller's own credentials so auth.uid() inside the RPCs is
  // set for signed-in users. Anonymous callers send no Authorization header.
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') || '';
  const caller = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });

  try {
    if (action === 'view') {
      const propertyId = String(body.property_id || '');
      if (!propertyId) return fail('property_id is required', 400, cors);
      const { data, error } = await caller.rpc('record_property_view', {
        p_property_id: propertyId,
        p_viewer_id: body.viewer_id ? String(body.viewer_id) : null,
      });
      if (error) {
        console.error('[track-analytics] record_property_view error:', error);
        return fail('Could not record view', 500, cors);
      }
      return json({ success: true, count: typeof data === 'number' ? data : 0 }, 200, cors);
    }

    const adId = String(body.ad_id || '');
    if (!adId) return fail('ad_id is required', 400, cors);
    const rpcName = action === 'click' ? 'increment_ad_click' : 'increment_ad_impression';
    const { error } = await caller.rpc(rpcName, { p_ad_id: adId });
    if (error) {
      console.error(`[track-analytics] ${rpcName} error:`, error);
      return fail('Could not record ad event', 500, cors);
    }
    return json({ success: true }, 200, cors);
  } catch (err) {
    console.error('[track-analytics] unexpected error:', (err as Error)?.message);
    return fail('An unexpected error occurred', 500, cors);
  }
});
