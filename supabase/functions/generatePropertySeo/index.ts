// supabase/functions/generatePropertySeo/index.ts
// AI-generated SEO metadata for a property listing — replaces the old customer-facing
// "SEO & Discoverability" wizard step. Triggered fire-and-forget (mirroring verifyProperty)
// after a property is submitted, resubmitted, or approved/published, and whenever it's
// otherwise updated. Writes seo_title/seo_description/seo_slug/seo_keywords/og_*/twitter_*/
// canonical_url/json_ld/image_alt_text straight onto the properties row.
//
// Mirrors the CORS / Deno.serve / env-fallback / OpenRouter conventions of verifyProperty.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o-mini';
const SITE_URL = 'https://realtynow.in';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });
}

async function resolveCaller(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// Same slug convention as src/lib/utils.ts generatePropertyUrl() — canonical_url must match
// the property's real, live route.
function routeSlug(title: string | null | undefined): string {
  return (title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 60)
    .replace(/-$/, '');
}

interface GeneratedSeo {
  seo_title: string;
  seo_description: string;
  seo_slug: string;
  seo_keywords: string[];
  og_title: string;
  og_description: string;
  twitter_title: string;
  twitter_description: string;
  json_ld_description: string;
  image_alt_text: string[];
}

function fallbackSeo(p: Record<string, any>, imageCount: number): GeneratedSeo {
  // Deterministic, template-based fallback so SEO fields are never left empty
  // even without an OPENROUTER_API_KEY configured.
  const bhk = p.bedrooms ? `${p.bedrooms} BHK ` : '';
  const type = p.property_type_name || p.category || 'Property';
  const purpose = p.purpose === 'Rent' ? 'for Rent' : 'for Sale';
  const locality = p.locality_name || '';
  const city = p.city_name || '';
  const place = [locality, city].filter(Boolean).join(', ');
  const title = `${bhk}${type} ${purpose}${place ? ` in ${place}` : ''}`.replace(/\s+/g, ' ').trim();
  const priceText = p.price ? `₹${Number(p.price).toLocaleString('en-IN')}` : '';
  const description = `${title}${priceText ? ` — ${priceText}` : ''}. ${
    Array.isArray(p.amenities) && p.amenities.length ? `Amenities: ${p.amenities.slice(0, 5).join(', ')}. ` : ''
  }Explore verified listings on RealtyNow.`.slice(0, 160);
  const keywords = [bhk.trim(), type, purpose.replace('for ', ''), locality, city, 'RealtyNow'].filter(Boolean);

  return {
    seo_title: title.slice(0, 70),
    seo_description: description,
    seo_slug: routeSlug(title) || routeSlug(p.title) || p.id,
    seo_keywords: keywords,
    og_title: title.slice(0, 70),
    og_description: description,
    twitter_title: title.slice(0, 70),
    twitter_description: description,
    json_ld_description: description,
    image_alt_text: Array.from({ length: imageCount }, (_, i) => `${title} — photo ${i + 1}`),
  };
}

async function generateWithAi(p: Record<string, any>, imageCount: number): Promise<GeneratedSeo | null> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) return null;

  const prompt = `You are an SEO copywriter for RealtyNow, an Indian real estate portal. Generate SEO metadata for the property listing below. Return ONLY strict JSON (no markdown fences) with this exact shape:
{
  "seo_title": string (<= 70 chars, compelling, keyword-rich),
  "seo_description": string (<= 160 chars, meta description),
  "seo_slug": string (lowercase, hyphenated, URL-safe, no special chars),
  "seo_keywords": string[] (6-10 relevant search keywords),
  "og_title": string (<= 70 chars),
  "og_description": string (<= 160 chars),
  "twitter_title": string (<= 70 chars),
  "twitter_description": string (<= 160 chars),
  "json_ld_description": string (1-2 sentence factual description for structured data),
  "image_alt_text": string[] (exactly ${imageCount} descriptive, accessible alt-text strings, one per photo, in order)
}

Listing:
Title: ${p.title ?? ''}
Purpose: ${p.purpose ?? ''}
Type: ${p.property_type_name ?? ''}
Bedrooms: ${p.bedrooms ?? ''}, Bathrooms: ${p.bathrooms ?? ''}
Locality: ${p.locality_name ?? ''}, City: ${p.city_name ?? ''}
Price: ${p.price ?? p.rent_amount ?? ''}
Builder: ${p.builder_name ?? ''}
Amenities: ${Array.isArray(p.amenities) ? p.amenities.join(', ') : ''}
Description: ${p.description ?? ''}`;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': SITE_URL,
        'X-Title': 'RealtyNow SEO Generator',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are a precise JSON-only SEO metadata generator. Never include markdown or commentary outside the JSON object.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 700,
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== 'string') throw new Error('Empty AI response');
    const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    const parsed = JSON.parse(cleaned);

    return {
      seo_title: String(parsed.seo_title ?? '').slice(0, 70) || fallbackSeo(p, imageCount).seo_title,
      seo_description: String(parsed.seo_description ?? '').slice(0, 160),
      seo_slug: routeSlug(String(parsed.seo_slug ?? '')) || routeSlug(p.title) || p.id,
      seo_keywords: Array.isArray(parsed.seo_keywords) ? parsed.seo_keywords.map(String).slice(0, 10) : [],
      og_title: String(parsed.og_title ?? parsed.seo_title ?? '').slice(0, 70),
      og_description: String(parsed.og_description ?? parsed.seo_description ?? '').slice(0, 160),
      twitter_title: String(parsed.twitter_title ?? parsed.seo_title ?? '').slice(0, 70),
      twitter_description: String(parsed.twitter_description ?? parsed.seo_description ?? '').slice(0, 160),
      json_ld_description: String(parsed.json_ld_description ?? parsed.seo_description ?? ''),
      image_alt_text: Array.isArray(parsed.image_alt_text) && parsed.image_alt_text.length === imageCount
        ? parsed.image_alt_text.map(String)
        : fallbackSeo(p, imageCount).image_alt_text,
    };
  } catch (err) {
    console.error('AI SEO generation call failed, using fallback:', err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const rate = await checkRateLimit(serviceClient(), req, {
    endpoint: 'generatePropertySeo',
    maxRequests: 30,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: rate.status,
      headers: { ...corsHeaders, ...rate.headers, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const propertyId = body?.property_id;
    if (!propertyId) return json({ error: 'property_id is required' }, 400);

    const supabase = serviceClient();

    const callerId = await resolveCaller(req);

    const { data: property, error: propErr } = await supabase
      .from('v_properties_search')
      .select('*')
      .eq('id', propertyId)
      .single();
    if (propErr || !property) return json({ error: 'Property not found' }, 404);

    // This function MUTATES a row via the service key, so it must never run
    // as an anonymous/unknown caller. Only the owner, the assigned agent, or
    // an admin may regenerate a property's SEO.
    if (!callerId) return json({ error: 'Authentication required' }, 401);
    const isOwnerOrAgent = callerId === property.owner_id || callerId === property.assigned_agent_id;
    if (!isOwnerOrAgent) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', callerId).maybeSingle();
      if (!profile || profile.role !== 'admin') return json({ error: 'Unauthorized' }, 403);
    }

    let builderName: string | null = null;
    if (property.builder_id) {
      const { data: builder } = await supabase.from('builders').select('name').eq('id', property.builder_id).maybeSingle();
      builderName = builder?.name ?? null;
    }

    const images: string[] = Array.isArray(property.images) ? property.images : [];
    const seo = (await generateWithAi({ ...property, builder_name: builderName }, images.length)) ?? fallbackSeo(property, images.length);

    const canonicalUrl = `${SITE_URL}/property/${routeSlug(property.title) || seo.seo_slug}-${propertyId}`;
    const priceValue = property.purpose === 'Rent' ? property.rent_amount : property.price;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'RealEstateListing',
      name: seo.seo_title,
      description: seo.json_ld_description,
      url: canonicalUrl,
      image: images.slice(0, 5),
      datePosted: property.created_at,
      address: {
        '@type': 'PostalAddress',
        streetAddress: property.address ?? undefined,
        addressLocality: property.locality_name ?? undefined,
        addressRegion: property.city_name ?? undefined,
        postalCode: property.pincode ?? undefined,
        addressCountry: property.country ?? 'IN',
      },
      ...(priceValue
        ? {
            offers: {
              '@type': 'Offer',
              price: priceValue,
              priceCurrency: 'INR',
              availability: 'https://schema.org/InStock',
            },
          }
        : {}),
      numberOfBedrooms: property.bedrooms ?? undefined,
      numberOfBathroomsTotal: property.bathrooms ?? undefined,
      floorSize: property.built_up_area
        ? { '@type': 'QuantitativeValue', value: property.built_up_area, unitCode: 'FTK' }
        : undefined,
    };

    const { error: updateErr } = await supabase
      .from('properties')
      .update({
        seo_title: seo.seo_title,
        seo_description: seo.seo_description,
        seo_slug: seo.seo_slug,
        seo_keywords: seo.seo_keywords,
        og_title: seo.og_title,
        og_description: seo.og_description,
        og_image: images[0] ?? null,
        twitter_title: seo.twitter_title,
        twitter_description: seo.twitter_description,
        twitter_image: images[0] ?? null,
        canonical_url: canonicalUrl,
        json_ld: jsonLd,
        image_alt_text: seo.image_alt_text,
        seo_generated_at: new Date().toISOString(),
      })
      .eq('id', propertyId);
    if (updateErr) return json({ error: updateErr.message }, 500);

    return json({ success: true, seo_title: seo.seo_title, seo_slug: seo.seo_slug, canonical_url: canonicalUrl });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'SEO generation failed' }, 500);
  }
});
