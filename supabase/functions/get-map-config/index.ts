import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { getCorsHeaders } from '../_shared/cors.ts'
import { checkRateLimit } from '../_shared/rate-limit.ts'

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Public anon endpoint: throttle per-IP to keep the config call cheap.
  const rateSupabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  const rate = await checkRateLimit(rateSupabase, req, {
    endpoint: 'get-map-config',
    maxRequests: 120,
    windowSeconds: 60,
  })

  try {
    const headers = { ...corsHeaders, ...rate.headers }
    if (!rate.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        headers: { ...headers, 'Content-Type': 'application/json' },
        status: rate.status,
      })
    }
    // Resolve the caller from the user JWT, if present. Anonymous visitors get
    // enough config to render the map but MUST NOT receive the api_key.
    const authHeader = req.headers.get('Authorization') ?? ''
    let callerId: string | null = null
    let isAdmin = false
    if (authHeader) {
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      )
      const { data } = await supabaseUser.auth.getUser(authHeader.replace('Bearer ', ''))
      callerId = data?.user?.id ?? null
      if (callerId) {
        const { data: profile } = await supabaseUser
          .from('profiles')
          .select('role')
          .eq('id', callerId)
          .maybeSingle()
        isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
      }
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Only resolve the real api_key path when the caller is a signed-in admin.
    // For every other caller, force provider to openstreetmap (no key required),
    // so the committed/map_api_key never reaches anonymous or non-admin visitors.
    let data: Record<string, unknown> | null
    if (isAdmin && callerId) {
      const { data: adminData, error } = await supabaseAdmin
        .from('map_settings')
        .select('provider, api_key, map_style, default_lat, default_lng')
        .eq('is_active', true)
        .limit(1)
        .single()
      if (error) {
        console.warn('Map settings not found, falling back to OpenStreetMap default:', error)
        return jsonFallback(headers)
      }
      data = adminData as Record<string, unknown>
    } else {
      const { data: safeData, error } = await supabaseAdmin
        .from('map_settings')
        .select('provider, map_style, default_lat, default_lng')
        .eq('is_active', true)
        .limit(1)
        .single()
      if (error) {
        console.warn('Map settings not found, falling back to OpenStreetMap default:', error)
        return jsonFallback(headers)
      }
      // Anonymous/public callers always render with OpenStreetMap, never the
      // keyed provider, unless the configured provider is a keyless one.
      const provider = (safeData as Record<string, unknown>).provider
      data = {
        provider: provider === 'openstreetmap' || provider === 'leaflet' ? provider : 'openstreetmap',
        api_key: null,
        map_style: (safeData as Record<string, unknown>).map_style ?? null,
        default_lat: (safeData as Record<string, unknown>).default_lat ?? 17.3850,
        default_lng: (safeData as Record<string, unknown>).default_lng ?? 78.4867,
      }
    }

    return new Response(JSON.stringify(data), {
      headers: { ...headers, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

function jsonFallback(headers: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      provider: 'openstreetmap',
      api_key: null,
      map_style: null,
      default_lat: 17.3850,
      default_lng: 78.4867
    }),
    { headers: { ...headers, 'Content-Type': 'application/json' }, status: 200 }
  )
}
