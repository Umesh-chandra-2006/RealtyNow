import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const BUCKET_BY_ROLE: Record<string, string> = {
  agent: 'profile-images',
  builder: 'builder-media',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') throw new Error('Method not allowed');

    // This endpoint is fully unauthenticated (caller supplies only `role`),
    // so it is a storage-pollution / DOS surface. Throttle per-IP BEFORE
    // consuming the multipart body to avoid wasting bandwidth on abusers.
    const rateSupabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );
    const rate = await checkRateLimit(rateSupabase, req, {
      endpoint: 'upload-profile-photo',
      maxRequests: 15,
      windowSeconds: 60,
    });
    if (!rate.allowed) {
      const respHeaders = new Headers(corsHeaders);
      respHeaders.set('Content-Type', 'application/json');
      for (const [k, v] of Object.entries(rate.headers)) respHeaders.set(k, v);
      return new Response(JSON.stringify({ error: 'Rate limit exceeded', success: false }), {
        status: 429,
        headers: respHeaders,
      });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const role = String(formData.get('role') || '');

    if (!(file instanceof File)) throw new Error('file is required');
    const bucket = BUCKET_BY_ROLE[role];
    if (!bucket) throw new Error('Invalid role — must be "agent" or "builder"');
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`Invalid file type: ${file.type}. Allowed: JPG, PNG, WEBP`);
    }
    if (file.size > MAX_SIZE) throw new Error('File size exceeds 5MB limit');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `applications/${role}-${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(path, bytes, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);

    return new Response(JSON.stringify({ url: publicUrlData.publicUrl, path, bucket }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('upload-profile-photo error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
