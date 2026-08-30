import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Public buckets used by the authenticated profile-photo path. They are PUBLIC
// READ, so an attacker must never be able to place arbitrary content here —
// hence magic-byte validation below guarantees only genuine JPEG/PNG/WEBP
// images are ever stored.
const BUCKET_FOR_ROLE: Record<string, string> = {
  agent: 'profile-images',
  builder: 'builder-media',
};

// Pre-auth (pending application) uploads run before the caller has an account,
// so there is no verified identity to trust. Their destination must therefore
// be a SINGLE server-fixed, role-neutral pending location — the caller-supplied
// `role` is NOT used to select a bucket or namespace (that would let an
// unauthenticated caller dump files into whichever public bucket they name).
// Role → bucket binding happens later, server-side, from the OTP-verified phone
// during application processing.
const PENDING_BUCKET = 'profile-images';

// AUDIT FIX (High #12): verify the file is a real image by magic bytes rather
// than trusting the browser-declared content type. A script dressed as an
// image must be rejected. Returns the detected MIME type or null.
function sniffImage(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png';
  // WEBP: RIFF .... WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
    bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 &&
    bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp';
  return null;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    if (req.method !== 'POST') throw new Error('Method not allowed');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // per-IP throttle first (before consuming the multipart body) to bound cost.
    const rate = await checkRateLimit(supabase, req, {
      endpoint: 'upload-profile-photo:ip',
      maxRequests: 20,
      windowSeconds: 60,
    });
    if (!rate.allowed) {
      const respHeaders = new Headers({ ...cors, 'Content-Type': 'application/json' });
      for (const [k, v] of Object.entries(rate.headers)) respHeaders.set(k, v);
      return new Response(JSON.stringify({ error: 'Rate limit exceeded', success: false }), {
        status: 429,
        headers: respHeaders,
      });
    }

    // Resolve an authenticated session if present (profile-photo path). Absent
    // for the public pending-application path.
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    let userId: string | null = null;
    let dbRole: string | null = null;
    if (token) {
      const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
      if (!userErr && user) {
        userId = user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();
        dbRole = profile?.role ?? null;
      }
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) throw new Error('file is required');
    if (file.size > MAX_SIZE) throw new Error('File size exceeds 5MB limit');

    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = sniffImage(bytes);
    if (!detected) {
      throw new Error('Uploaded file is not a valid JPEG, PNG, or WEBP image.');
    }
    // Refuse a mismatch between the browser-declared type and the magic bytes.
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.type !== detected) {
      throw new Error('File content does not match its declared type.');
    }

    const ext = detected === 'image/jpeg' ? 'jpg' : detected === 'image/png' ? 'png' : 'webp';

    if (userId && dbRole && BUCKET_FOR_ROLE[dbRole]) {
      // AUDIT FIX (High #12): account-bound destination for authenticated
      // agent/builder profile photos.
      const bucket = BUCKET_FOR_ROLE[dbRole];
      const path = `profiles/${userId}-${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const perUser = await supabase.rpc('fn_check_rate_limit', {
        p_identifier: `upload:${userId}`,
        p_endpoint: 'upload-profile-photo:user',
        p_max_requests: 60,
        p_window_seconds: 3600,
      });
      if (perUser.error || perUser.data?.allowed === false) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded', success: false }), {
          status: 429,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, bytes, {
        contentType: detected,
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) throw new Error('Upload failed. Please try again.');

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
      return new Response(JSON.stringify({ url: publicUrlData.publicUrl, path, bucket }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Pre-auth pending-application path. There is no verified identity to trust
    // here, so the caller-supplied `role` is NEVER used to pick the bucket or a
    // role-specific namespace. Every pre-auth upload lands in the single
    // server-fixed, role-neutral PENDING_BUCKET's pending/ folder; the real
    // role is bound later from the OTP-verified phone during processing. The
    // file is always a magic-byte-verified image.
    const pendingBucket = PENDING_BUCKET;
    const path = `pending/${crypto.randomUUID()}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(pendingBucket).upload(path, bytes, {
      contentType: detected,
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) throw new Error('Upload failed. Please try again.');

    const { data: publicUrlData } = supabase.storage.from(pendingBucket).getPublicUrl(path);
    return new Response(JSON.stringify({ url: publicUrlData.publicUrl, path, bucket: pendingBucket }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('upload-profile-photo error:', err?.message);
    return new Response(
      JSON.stringify({ error: 'Upload failed. Please try again.' }),
      {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
