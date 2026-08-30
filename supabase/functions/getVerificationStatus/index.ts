// supabase/functions/getVerificationStatus/index.ts
// Returns the latest ai_verifications row for a property. Used by the admin review UI and
// any owner-facing status display. Relies on RLS (ai_verifications policies: admin full
// read, property owner can read their own property's rows) by querying with the caller's
// own JWT rather than the service role, so access control is enforced by Postgres, not here.

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
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    let propertyId: string | undefined;
    if (req.method === 'GET') {
      propertyId = new URL(req.url).searchParams.get('property_id') ?? undefined;
    } else {
      const body = await req.json().catch(() => ({}));
      propertyId = body?.property_id;
    }
    if (!propertyId) return json({ error: 'property_id is required' }, 400);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return json({ error: 'Unauthorized' }, 401);

    const { data, error } = await supabase
      .from('ai_verifications')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) { console.error('[getVerificationStatus] DB error:', error); return json({ error: 'Request failed' }, 500); }
    if (!data) {
      return json({
        success: true,
        verification: null,
        verification_status: 'Pending AI',
      });
    }

    return json({ success: true, verification: data });
  } catch (err) {
    console.error('[getVerificationStatus] error:', err);
    return json({ error: 'Request failed' }, 500);
  }
});
