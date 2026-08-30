// supabase/functions/verifyProperty/index.ts
// AI Verified Listings — runs deterministic checks (SQL, via service-role client) plus a
// single AI vision/text call (OpenRouter, gpt-4o-mini) for qualitative checks, combines
// them into an AI Confidence Score (0-100) + Verification Status, upserts the audit trail
// (ai_verifications, verification_logs), syncs the denormalized columns on `properties`
// (via DB trigger on ai_verifications insert), and notifies the property owner.
//
// Mirrors the CORS / Deno.serve / env-fallback conventions of supabase/functions/ai-assistant.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

let corsHeaders: Record<string, string> = {};

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o-mini'; // vision-capable

// India's rough bounding box (lat/lng) — used for the "invalid location" deterministic check.
const INDIA_BOUNDS = { minLat: 6.0, maxLat: 38.0, minLng: 68.0, maxLng: 98.0 };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+?91[-\s]?)?[6-9]\d{9}$/;

interface CheckResult {
  passed: boolean;
  reason: string;
  score?: number;
}
type CheckResults = Record<string, CheckResult>;

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

// ─── Deterministic checks ──────────────────────────────────────────────────

function checkMissingFields(p: Record<string, any>): CheckResult {
  const required = ['title', 'description', 'property_type_id', 'city_id', 'locality_id', 'address'];
  const missing = required.filter((k) => p[k] === null || p[k] === undefined || p[k] === '');
  if (!p.price || Number(p.price) <= 0) missing.push('price');
  const images = Array.isArray(p.images) ? p.images : [];
  if (images.length === 0) missing.push('images');
  return missing.length === 0
    ? { passed: true, reason: 'All required fields present.' }
    : { passed: false, reason: `Missing required fields: ${missing.join(', ')}.` };
}

function checkInvalidLocation(p: Record<string, any>): CheckResult {
  if (!p.city_id || !p.locality_id) {
    return { passed: false, reason: 'City or locality is missing.' };
  }
  if (p.latitude != null && p.longitude != null) {
    const lat = Number(p.latitude);
    const lng = Number(p.longitude);
    const inBounds =
      lat >= INDIA_BOUNDS.minLat && lat <= INDIA_BOUNDS.maxLat && lng >= INDIA_BOUNDS.minLng && lng <= INDIA_BOUNDS.maxLng;
    if (!inBounds) {
      return { passed: false, reason: `Coordinates (${lat}, ${lng}) fall outside India's bounding box.` };
    }
  }
  return { passed: true, reason: 'Location looks valid.' };
}

function checkContactValidation(owner: { email?: string | null; phone?: string | null } | null): CheckResult {
  if (!owner) return { passed: false, reason: 'Owner profile not found.' };
  const emailOk = !!owner.email && EMAIL_RE.test(owner.email);
  const phoneOk = !!owner.phone && PHONE_RE.test(owner.phone.replace(/[\s-]/g, ''));
  if (emailOk && phoneOk) return { passed: true, reason: 'Owner email and phone are valid.' };
  if (emailOk && !phoneOk) return { passed: false, reason: 'Owner phone number looks invalid or missing.' };
  if (!emailOk && phoneOk) return { passed: false, reason: 'Owner email looks invalid or missing.' };
  return { passed: false, reason: 'Owner email and phone both look invalid or missing.' };
}

async function checkPriceAnomaly(
  supabase: ReturnType<typeof createClient>,
  p: Record<string, any>,
): Promise<CheckResult> {
  if (!p.locality_id || !p.property_type_id || !p.price) {
    return { passed: true, reason: 'Not enough data to compare price; skipped.' };
  }
  const { data, error } = await supabase
    .from('properties')
    .select('price')
    .eq('locality_id', p.locality_id)
    .eq('property_type_id', p.property_type_id)
    .neq('id', p.id)
    .not('price', 'is', null)
    .limit(50);

  if (error || !data || data.length < 3) {
    return { passed: true, reason: 'Not enough comparable listings in this locality; skipped.' };
  }
  const prices = data.map((r: any) => Number(r.price)).filter((n: number) => n > 0);
  if (prices.length < 3) return { passed: true, reason: 'Not enough comparable listings; skipped.' };
  const avg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
  const deviation = avg > 0 ? Math.abs(Number(p.price) - avg) / avg : 0;
  // Threshold: >60% deviation from the local average for the same locality + property type
  // is treated as a price anomaly worth a human look, not an automatic rejection (prices are
  // legitimately volatile — this is a "manual review" signal, not a hard fail).
  if (deviation > 0.6) {
    return {
      passed: false,
      reason: `Price deviates ${(deviation * 100).toFixed(0)}% from the local average (₹${Math.round(avg).toLocaleString('en-IN')}).`,
    };
  }
  return { passed: true, reason: 'Price is within a normal range for this locality.' };
}

async function checkDuplicate(supabase: ReturnType<typeof createClient>, p: Record<string, any>): Promise<CheckResult> {
  const q = supabase
    .from('properties')
    .select('id, title, price, bedrooms, owner_id')
    .eq('locality_id', p.locality_id)
    .neq('id', p.id)
    .limit(20);
  const { data, error } = await q;
  if (error || !data) return { passed: true, reason: 'Could not check for duplicates; skipped.' };

  const normTitle = String(p.title ?? '').trim().toLowerCase();
  const dup = data.find((r: any) => {
    const sameOwner = r.owner_id === p.owner_id;
    const sameBedrooms = p.bedrooms == null || r.bedrooms === p.bedrooms;
    const priceClose = p.price ? Math.abs(Number(r.price) - Number(p.price)) / Number(p.price) < 0.05 : false;
    const titleClose = normTitle.length > 0 && String(r.title ?? '').trim().toLowerCase() === normTitle;
    return (sameOwner && (titleClose || (priceClose && sameBedrooms))) || (titleClose && priceClose && sameBedrooms);
  });

  return dup
    ? { passed: false, reason: `Very similar to existing listing "${dup.title}" (id: ${dup.id}).` }
    : { passed: true, reason: 'No close duplicate found.' };
}

// ─── AI-assisted checks (single call: fake/blurred images, spam, title & description quality) ──

async function runAiChecks(p: Record<string, any>): Promise<{ results: CheckResults; aiAverage: number; usedAi: boolean }> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  const images: string[] = (Array.isArray(p.images) ? p.images : []).slice(0, 5);

  if (!apiKey) {
    // Graceful fallback so verification never hard-fails without a configured key.
    return fallbackAiChecks(p);
  }

  const textPrompt = `You are a real estate listing quality & fraud reviewer for RealtyNow. Evaluate the listing below and return ONLY strict JSON (no markdown fences) with this exact shape:
{
  "fake_images": { "passed": boolean, "reason": string, "score": number },
  "spam": { "passed": boolean, "reason": string, "score": number },
  "title_quality": { "passed": boolean, "reason": string, "score": number }
}
"score" is 0-100 confidence that the listing is genuine/high-quality for that check.
- fake_images: flag blur, watermarks, stock-photo/duplicate-looking images, or images clearly mismatched to the listing (e.g. a car photo for a house).
- spam: flag promotional spam, phone/website spam in the description, irrelevant or nonsensical text, excessive capitalization/emoji.
- title_quality: flag a title/description that is misleading, too short, keyword-stuffed, or poorly written.

Listing:
Title: ${p.title ?? ''}
Description: ${p.description ?? ''}
Type: ${p.property_type_name ?? p.property_type_id ?? ''}, Purpose: ${p.purpose ?? ''}
Price: ${p.price ?? ''}
Bedrooms: ${p.bedrooms ?? ''}, Bathrooms: ${p.bathrooms ?? ''}, Area: ${p.built_up_area ?? ''} sqft
${images.length === 0 ? 'No images were provided.' : `${images.length} image(s) attached.`}`;

  const content: Record<string, unknown>[] = [{ type: 'text', text: textPrompt }];
  for (const url of images) {
    content.push({ type: 'image_url', image_url: { url } });
  }

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://realtynow.demo',
        'X-Title': 'RealtyNow AI Verification',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are a precise JSON-only listing verification engine. Never include markdown or commentary outside the JSON object.' },
          { role: 'user', content },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== 'string') throw new Error('Empty AI response');

    // Defensive parse: strip markdown fences if the model added them anyway.
    const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    const parsed = JSON.parse(cleaned);

    const results: CheckResults = {
      fake_images: normalizeAiCheck(parsed.fake_images),
      spam: normalizeAiCheck(parsed.spam),
      title_quality: normalizeAiCheck(parsed.title_quality),
    };
    const scores = Object.values(results).map((r) => r.score ?? (r.passed ? 80 : 30));
    const aiAverage = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { results, aiAverage, usedAi: true };
  } catch (err) {
    console.error('AI verification call failed, using fallback:', err);
    return fallbackAiChecks(p);
  }
}

function normalizeAiCheck(v: unknown): CheckResult {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return {
      passed: typeof o.passed === 'boolean' ? o.passed : true,
      reason: typeof o.reason === 'string' ? o.reason : 'No reason provided.',
      score: typeof o.score === 'number' ? Math.max(0, Math.min(100, o.score)) : undefined,
    };
  }
  return { passed: true, reason: 'AI did not return a result for this check; treated as pass.', score: 70 };
}

function fallbackAiChecks(p: Record<string, any>): { results: CheckResults; aiAverage: number; usedAi: boolean } {
  // Deterministic placeholder so the pipeline still works before an OpenRouter key is added.
  // Cannot judge image content without vision, so we only sanity-check text signals.
  const desc = String(p.description ?? '');
  const title = String(p.title ?? '');
  const hasImages = Array.isArray(p.images) && p.images.length > 0;
  const spamSignals = /(www\.|http[s]?:\/\/|call now|100% guarantee|!!!)/i.test(desc);
  const titleOk = title.trim().length >= 10 && title.trim().length <= 100;
  const descOk = desc.trim().length >= 40;

  const results: CheckResults = {
    fake_images: hasImages
      ? { passed: true, reason: 'Images present (no vision model configured to inspect content).', score: 70 }
      : { passed: false, reason: 'No images provided to evaluate.', score: 30 },
    spam: spamSignals
      ? { passed: false, reason: 'Description contains spam-like patterns (links/promotional phrases).', score: 25 }
      : { passed: true, reason: 'No obvious spam patterns detected.', score: 75 },
    title_quality: titleOk && descOk
      ? { passed: true, reason: 'Title and description length look reasonable.', score: 72 }
      : { passed: false, reason: 'Title or description is too short/low quality.', score: 40 },
  };
  const scores = Object.values(results).map((r) => r.score ?? 60);
  const aiAverage = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { results, aiAverage, usedAi: false };
}

// ─── Score + status combination ────────────────────────────────────────────
// Thresholds (documented here since they're not obvious from context):
//  - missing_fields fail OR invalid_location fail => hard "Rejected", score 0, no AI call
//    (these are unsalvageable without owner action, so we don't spend an AI call on them).
//  - Otherwise: deterministic_component = 100 - 30*(duplicate fail) - 15*(price_anomaly fail)
//               - 10*(contact_validation fail), floored at 0.
//    ai_component = average of fake_images/spam/title_quality scores (0-100).
//    final_score = round(0.4 * deterministic_component + 0.6 * ai_component)
//  - final_score >= 80 AND duplicate/price_anomaly/contact_validation/fake_images/spam/
//    title_quality all passed => "AI Verified"
//  - final_score < 40                                                   => "Rejected"
//  - otherwise (40-79, or a soft check failed despite a high score)     => "Manual Review"
function combineResults(checks: CheckResults): { score: number; status: string } {
  const deterministicFailPenalty: Record<string, number> = {
    duplicate: 30,
    price_anomaly: 15,
    contact_validation: 10,
  };
  let deterministicComponent = 100;
  for (const [key, penalty] of Object.entries(deterministicFailPenalty)) {
    if (checks[key] && !checks[key].passed) deterministicComponent -= penalty;
  }
  deterministicComponent = Math.max(0, deterministicComponent);

  const aiKeys = ['fake_images', 'spam', 'title_quality'];
  const aiScores = aiKeys.map((k) => checks[k]?.score ?? (checks[k]?.passed ? 80 : 30));
  const aiComponent = aiScores.reduce((a, b) => a + b, 0) / aiScores.length;

  const finalScore = Math.round(0.4 * deterministicComponent + 0.6 * aiComponent);
  const allSoftPassed = [...Object.keys(deterministicFailPenalty), ...aiKeys].every((k) => checks[k]?.passed !== false);

  let status: string;
  if (finalScore >= 80 && allSoftPassed) status = 'AI Verified';
  else if (finalScore < 40) status = 'Rejected';
  else status = 'Manual Review';

  return { score: Math.max(0, Math.min(100, finalScore)), status };
}

Deno.serve(async (req: Request) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const rate = await checkRateLimit(serviceClient(), req, {
    endpoint: 'verifyProperty',
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

    const callerId = await resolveCaller(req);
    const supabase = serviceClient();

    const { data: property, error: propErr } = await supabase.from('properties').select('*').eq('id', propertyId).single();
    if (propErr || !property) return json({ error: 'Property not found' }, 404);

    // This function MUTATES the ai_verifications / verification_logs audit
    // trail and denormalized properties columns, so it must never run as an
    // anonymous/unknown caller. Require an authenticated identity.
    if (!callerId) return json({ error: 'Authentication required' }, 401);

    // Caller must be the owner, the assigned agent, or an admin.
    const isOwnerOrAgent = callerId === property.owner_id || callerId === property.assigned_agent_id;
    if (!isOwnerOrAgent) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', callerId).maybeSingle();
      if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) return json({ error: 'Unauthorized' }, 403);
    }

    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('email, phone')
      .eq('id', property.owner_id)
      .single();

    const missingFields = checkMissingFields(property);
    const invalidLocation = checkInvalidLocation(property);

    let checks: CheckResults;
    let usedAi = false;

    if (!missingFields.passed || !invalidLocation.passed) {
      // Hard fail — no AI call needed.
      checks = {
        missing_fields: missingFields,
        invalid_location: invalidLocation,
        contact_validation: checkContactValidation(ownerProfile ?? null),
        price_anomaly: { passed: true, reason: 'Skipped — listing already rejected on hard checks.' },
        duplicate: { passed: true, reason: 'Skipped — listing already rejected on hard checks.' },
        fake_images: { passed: false, reason: 'Skipped — listing already rejected on hard checks.', score: 0 },
        spam: { passed: false, reason: 'Skipped — listing already rejected on hard checks.', score: 0 },
        title_quality: { passed: false, reason: 'Skipped — listing already rejected on hard checks.', score: 0 },
      };
    } else {
      const [contactValidation, priceAnomaly, duplicate, aiResult] = await Promise.all([
        Promise.resolve(checkContactValidation(ownerProfile ?? null)),
        checkPriceAnomaly(supabase, property),
        checkDuplicate(supabase, property),
        runAiChecks(property),
      ]);
      usedAi = aiResult.usedAi;
      checks = {
        missing_fields: missingFields,
        invalid_location: invalidLocation,
        contact_validation: contactValidation,
        price_anomaly: priceAnomaly,
        duplicate,
        ...aiResult.results,
      };
    }

    const isHardFail = !missingFields.passed || !invalidLocation.passed;
    const { score, status } = isHardFail ? { score: 0, status: 'Rejected' } : combineResults(checks);

    const verifiedAt = new Date().toISOString();
    const { data: verification, error: insertErr } = await supabase
      .from('ai_verifications')
      .insert({
        property_id: propertyId,
        ai_score: score,
        verification_status: status,
        check_results: checks,
        verified_at: verifiedAt,
        verified_by: 'AI',
      })
      .select()
      .single();
    if (insertErr) { console.error('[verifyProperty] insert verification error:', insertErr); return json({ error: 'Verification failed' }, 500); }

    await supabase.from('verification_logs').insert({
      property_id: propertyId,
      ai_verification_id: verification.id,
      action: 'ai_verify_run',
      actor: 'AI',
      details: { score, status, used_ai_model: usedAi },
    });

    // If verification flagged something suspicious, bump the property into pending_verification
    // so it surfaces in the admin review queue even if it was previously 'submitted'.
    if (status === 'Manual Review' || status === 'Rejected') {
      await supabase
        .from('properties')
        .update({ status: property.status === 'draft' ? property.status : 'pending_verification' })
        .eq('id', propertyId)
        .in('status', ['submitted']);
    }

    // Notify the owner of the new verification status (best-effort).
    if (property.owner_id) {
      const title = `AI verification: ${status}`;
      const bodyText =
        status === 'AI Verified'
          ? `Your property "${property.title}" passed AI verification with a score of ${score}/100 and is moving forward for publishing.`
          : status === 'Manual Review'
            ? `Your property "${property.title}" needs a manual review by our team before it can be published (AI score ${score}/100).`
            : `Your property "${property.title}" was flagged by AI verification (score ${score}/100). Please review and resubmit.`;
      await supabase
        .rpc('notify_user', {
          p_user_id: property.owner_id,
          p_type: 'property_verification',
          p_title: title,
          p_body: bodyText,
          p_link: `/portal/my-properties`,
        })
        .then(
          () => {},
          () => {},
        );
    }

    return json({ success: true, verification: { ...verification, check_results: checks, ai_score: score, verification_status: status } });
  } catch (err) {
    console.error('[verifyProperty] error:', err);
    return json({ error: 'Verification failed' }, 500);
  }
});
