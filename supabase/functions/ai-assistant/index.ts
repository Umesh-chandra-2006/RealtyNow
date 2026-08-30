import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o-mini';

interface AIRequestBody {
  task: 'description' | 'seo' | 'title' | 'chat' | 'lead_summary' | 'email' | 'translate' | 'recommend';
  payload: Record<string, unknown>;
}

// ── Server-side real-data guard for property-search-shaped chat messages ──
// Mirrors src/lib/ai.ts's isPropertySearchIntent/answerRealtyNowPropertySearch:
// this function can be called directly (bypassing the client bundle entirely),
// so the "never fabricate a result count" guarantee must not depend solely on
// the client-side intercept — it must also hold here, independent of it.
const BHK_TEST_RE = /\d\s*bhk/i;
const PROPERTY_TYPE_TEST_RE =
  /\b(apartments?|flats?|villas?|independent houses?|houses?|plots?|studios?|penthouses?|for sale|for rent)\b/i;
const PROPERTY_TYPE_MATCH_RE =
  /\b(apartments?|flats?|villas?|independent houses?|houses?|plots?|studios?|penthouses?)\b/i;
const RENT_INTENT_RE = /\b(rent|rental|lease|to let)\b/i;
const BUY_INTENT_RE = /\b(buy|sale|sell|purchase)\b/i;
const SEARCH_STOPWORDS_RE =
  /\b(show me|find|search for|search|looking for|i want|i'm looking for|need|please|can you|could you|apartments?|flats?|villas?|independent houses?|houses?|plots?|studios?|penthouses?|properties?|property|for rent|for sale|to buy|to rent|to let|rent|rental|lease|buy|sale|sell|purchase|in|or|and|near|around|at|me|a|an|the)\b/gi;
const QUESTION_LIKE_RE =
  /[?]|\b(what|how|why|when|who|which|does|do|is|are|can|could|should|would|documents?|requirements?|process|policy)\b/i;
const CITY_ALIASES: Record<string, string> = {
  bangalore: 'Bengaluru',
  bengaluru: 'Bengaluru',
  bombay: 'Mumbai',
  mumbai: 'Mumbai',
  madras: 'Chennai',
  chennai: 'Chennai',
  calcutta: 'Kolkata',
  kolkata: 'Kolkata',
  gurgaon: 'Gurugram',
  gurugram: 'Gurugram',
};
const LAKH_INR = 100_000;
const CRORE_INR = 10_000_000;
const PRICE_AMOUNT_RE = '(\\d+(?:\\.\\d+)?)\\s*(crores?|cr|lakhs?|lac)';
const MAX_PRICE_RE = new RegExp(`\\b(?:under|below|less than|up to|within)\\s+${PRICE_AMOUNT_RE}\\b`, 'i');
const MIN_PRICE_RE = new RegExp(`\\b(?:above|over|more than)\\s+${PRICE_AMOUNT_RE}\\b`, 'i');

function normalizeCityAliases(text: string): string {
  const words = text.split(' ').filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const alias = CITY_ALIASES[words[i].toLowerCase()];
    if (alias) {
      out.push(alias);
      if (words[i + 1]?.toLowerCase() === 'city') i++;
      continue;
    }
    out.push(words[i]);
  }
  return out.join(' ');
}

function priceToInr(amount: number, unit: string): number {
  return Math.round(amount * (/^cr/i.test(unit) ? CRORE_INR : LAKH_INR));
}

function isPropertySearchIntent(message: string): boolean {
  if (BHK_TEST_RE.test(message) || PROPERTY_TYPE_TEST_RE.test(message)) return true;
  const trimmed = message.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  return wordCount > 0 && wordCount <= 4 && !QUESTION_LIKE_RE.test(trimmed);
}

function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

async function answerFromRealtyNowListings(message: string, supabaseUrl: string, anonKey: string): Promise<string> {
  let rest = message;
  let maxPrice: number | undefined;
  let minPrice: number | undefined;
  const maxMatch = rest.match(MAX_PRICE_RE);
  if (maxMatch) {
    maxPrice = priceToInr(parseFloat(maxMatch[1]), maxMatch[2]);
    rest = rest.replace(maxMatch[0], ' ');
  }
  const minMatch = rest.match(MIN_PRICE_RE);
  if (minMatch) {
    minPrice = priceToInr(parseFloat(minMatch[1]), minMatch[2]);
    rest = rest.replace(minMatch[0], ' ');
  }

  const bedrooms = Array.from(new Set(Array.from(rest.matchAll(/(\d+)\s*bhk/gi)).map((m) => Number(m[1]))));
  const purpose = RENT_INTENT_RE.test(rest) ? 'Rent' : BUY_INTENT_RE.test(rest) ? 'Sale' : undefined;
  const typeMatch = rest.match(PROPERTY_TYPE_MATCH_RE);
  const typeLabel = typeMatch ? typeMatch[0].toLowerCase() : 'properties';
  const typeSingular = typeMatch ? typeMatch[0].toLowerCase().replace(/s$/, '') : undefined;
  const q = normalizeCityAliases(
    rest
      .replace(/\d+\s*bhk/gi, ' ')
      .replace(SEARCH_STOPWORDS_RE, ' ')
      .replace(/[^\p{L}\p{N}\s,]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

  const bhkLabel = bedrooms.length > 0 ? `${bedrooms.map((b) => `${b}BHK`).join(' and ')} ` : '';
  const placeLabel = q ? ` in ${q}` : '';
  const priceLabel = maxPrice != null ? ` under ${formatInr(maxPrice)}` : minPrice != null ? ` above ${formatInr(minPrice)}` : '';
  const intro = `Sure! I'll search RealtyNow for available ${bhkLabel}${typeLabel}${placeLabel}${priceLabel}.`;

  try {
    const params = new URLSearchParams();
    params.set('select', '*');
    params.set('or', '(status.eq.published,is_live.eq.true)');
    params.set('order', 'published_at.desc');
    params.set('limit', '5');
    if (purpose) params.set('purpose', `eq.${purpose}`);
    if (bedrooms.length > 0) params.set('bedrooms', `in.(${bedrooms.join(',')})`);
    if (typeSingular) params.set('property_type_name', `ilike.*${typeSingular}*`);
    // PostgREST ANDs repeated query params on the same column, so min/max price
    // and each location token can each be appended independently.
    if (maxPrice != null) params.append('price', `lte.${maxPrice}`);
    if (minPrice != null) params.append('price', `gte.${minPrice}`);
    for (const token of q.split(' ').filter(Boolean)) {
      params.append('search_document', `ilike.*${token}*`);
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/v_properties_search?${params.toString()}`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (!res.ok) throw new Error(`search failed: ${res.status}`);
    const matches = (await res.json()) as Record<string, unknown>[];

    if (matches.length === 0) {
      return `${intro}\n\nI couldn't find an exact match on RealtyNow right now. Try nearby locations or adjust your budget/preferences. You can also browse all current RealtyNow listings${placeLabel} on our search page.`;
    }

    const lines = matches.map((p, i) => {
      const priceVal = (p.purpose === 'Rent' ? p.rent_amount ?? p.price : p.price) as number | null;
      const priceText = priceVal != null ? `${formatInr(priceVal)}${p.purpose === 'Rent' ? '/mo' : ''}` : 'Price on request';
      const bhk = p.bedrooms ? `${p.bedrooms}BHK ` : '';
      const type = p.property_type_name ? `${p.property_type_name} ` : '';
      const where = [p.locality_name, p.city_name].filter(Boolean).join(', ');
      return `${i + 1}. ${p.title} — ${bhk}${type}in ${where} — ${priceText}`;
    });

    return `${intro}\n\nHere's what's currently listed on RealtyNow:\n${lines.join('\n')}\n\nOpen RealtyNow's search page for full details or to schedule a visit.`;
  } catch {
    return `${intro}\n\nI'm having trouble searching RealtyNow listings right now. Please try again in a moment or use the RealtyNow search page directly.`;
  }
}

function buildPrompt(task: string, payload: Record<string, unknown>): { system: string; user: string } {
  const p = payload;
  switch (task) {
    case 'description': {
      return {
        system:
          'You are an expert real estate copywriter. Write compelling, accurate property descriptions. 120-180 words. No markdown. Plain text.',
        user: `Write a property description for: title="${p.title ?? ''}", type=${p.type ?? ''}, purpose=${p.purpose ?? ''}, bedrooms=${p.bedrooms ?? ''}, bathrooms=${p.bathrooms ?? ''}, area=${p.area ?? ''} sqft, city=${p.city ?? ''}, locality=${p.locality ?? ''}, furnishing=${p.furnishing ?? ''}, amenities=${(p.amenities as string[] | undefined)?.join(', ') ?? ''}.`,
      };
    }
    case 'seo': {
      return {
        system:
          'You are an SEO specialist. Write a concise meta description (max 160 chars) optimized for real estate search.',
        user: `Create an SEO meta description for a property titled "${p.title ?? ''}" in ${p.locality ?? ''}, ${p.city ?? ''}. Include key selling points.`,
      };
    }
    case 'title': {
      return {
        system:
          'You are a real estate listing expert. Generate a catchy, accurate property title under 80 characters. Plain text, no quotes.',
        user: `Create a title for a ${p.purpose ?? ''} ${p.type ?? ''} with ${p.bedrooms ?? ''} BHK in ${p.locality ?? ''}, ${p.city ?? ''}.`,
      };
    }
    case 'chat': {
      return {
        system:
          "You are RealtyNow's AI Property Advisor. Your only property inventory source is RealtyNow. Never mention, recommend, compare with, link to, or redirect users to any other real-estate website, app, or marketplace (e.g. 99acres, MagicBricks, Housing.com, NoBroker, or any other competitor) under any circumstance. Never invent, guess, or fabricate specific property listings, prices, availability, or market data. Be concise, helpful, and accurate. If the user asks about specific listings, give general real estate advice and suggest searching on RealtyNow. Keep replies under 120 words.",
        user: `${p.message ?? ''}${p.context ? `\nContext: ${p.context}` : ''}`,
      };
    }
    case 'lead_summary': {
      return {
        system: 'Summarize a lead for an agent in 2-3 bullet points. Plain text.',
        user: `Lead details: ${JSON.stringify(p)}`,
      };
    }
    case 'email': {
      return {
        system: 'Write a professional follow-up email to a property lead. Plain text, no subject line.',
        user: `Write an email to ${p.name ?? 'the lead'} about the property "${p.property ?? ''}".`,
      };
    }
    case 'translate': {
      return {
        system: 'Translate the text accurately. Return only the translation.',
        user: `Translate to ${p.language ?? 'Hindi'}: ${p.text ?? ''}`,
      };
    }
    case 'recommend': {
      return {
        system: "Suggest 3 property search criteria based on the user's preferences. Plain text, short bullets.",
        user: `Preferences: ${JSON.stringify(p)}`,
      };
    }
    default:
      return { system: 'You are a helpful assistant.', user: String(p.message ?? '') };
  }
}

async function callOpenRouter(system: string, user: string): Promise<string> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    // Graceful fallback when the key isn't configured yet — keeps the app working.
    return fallbackResponse(system, user);
  }
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://realtynow.demo',
      'X-Title': 'RealtyNow AI',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      max_tokens: 600,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Empty AI response');
  return content.trim();
}

function fallbackResponse(system: string, user: string): string {
  // Deterministic placeholder so the UI still works before an API key is added.
  if (system.includes('copywriter')) {
    return `This ${user.match(/type=([^,]+)/)?.[1] ?? 'property'} offers a wonderful opportunity for comfortable living. Located in ${user.match(/locality=([^,]+)/)?.[1]?.trim() ?? 'a prime area'}, it features spacious rooms, modern amenities, and excellent connectivity. A perfect home for families looking for quality and convenience.`;
  }
  if (system.includes('SEO')) {
    const title = user.match(/"([^"]+)"/)?.[1] ?? 'Property';
    return `${title} — premium real estate listing with great amenities and prime location. Book a visit today.`.slice(
      0,
      160,
    );
  }
  if (system.includes('title')) {
    const bedrooms = user.match(/(\d+)\s*BHK/)?.[1] ?? '3';
    const locality = user.match(/in ([^,]+),/)?.[1] ?? 'Prime Location';
    return `${bedrooms}BHK Apartment in ${locality} — Modern & Spacious`;
  }
  if (system.includes('real estate assistant')) {
    return "I'd be happy to help with that! You can use the search filters on RealtyNow to find properties that match your needs. Try filtering by city, budget, and bedrooms. If you'd like personalized recommendations, sign up and our AI will suggest listings based on your activity.";
  }
  return 'AI response unavailable. Please configure the OpenRouter API key to enable full AI features.';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Optional auth check (soft): pull user id if token present, don't block anon
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    }

    // Throttle per-IP. AI is the single most abuse-prone surface (every
    // non-search call bills tokens on OpenRouter), so apply a tight cap here,
    // independent of auth, before any prompt is built or LLM contacted.
    const rateSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const rate = await checkRateLimit(rateSupabase, req, {
      endpoint: 'ai-assistant',
      maxRequests: 20,
      windowSeconds: 60,
    });
    if (!rate.allowed) {
      const respHeaders = new Headers(corsHeaders);
      respHeaders.set('Content-Type', 'application/json');
      for (const [k, v] of Object.entries(rate.headers)) respHeaders.set(k, v);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.', success: false }),
        { status: 429, headers: respHeaders },
      );
    }

    const body = (await req.json()) as AIRequestBody;
    if (!body?.task || !body?.payload) {
      return new Response(JSON.stringify({ error: 'Missing task or payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result: string;
    const message = typeof body.payload.message === 'string' ? body.payload.message : '';
    if (body.task === 'chat' && message && isPropertySearchIntent(message)) {
      // Answered directly from real listings — never reaches the LLM, so there's
      // nothing here that can hallucinate a result count or fabricate a listing,
      // regardless of whether this function is called via the client bundle or
      // hit directly.
      result = await answerFromRealtyNowListings(
        message,
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      );
    } else {
      const { system, user } = buildPrompt(body.task, body.payload);
      result = await callOpenRouter(system, user);
    }

    // Log activity (best-effort)
    if (userId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      await supabase
        .from('activity_logs')
        .insert({
          user_id: userId,
          action: `ai_${body.task}`,
          entity: 'ai',
          metadata: { task: body.task },
        })
        .then(
          () => {},
          () => {},
        );
    }

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'AI request failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
