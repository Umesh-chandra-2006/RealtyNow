import { supabase } from './supabase';
import i18n from './i18n/i18n';
import { formatPrice, formatCompactPrice, generatePropertyUrl } from './utils';
import { normalizeCityAliases } from './properties';
import { parsePropertySearchQuery, fetchLocationCategoryDiscovery } from './search-engine';
import type { Property } from './types';

export type AITask =
  | 'chat'
  | 'parse_search'
  | 'recommend'
  | 'description'
  | 'title'
  | 'seo'
  | 'lead_summary'
  | 'translate'
  | 'market_insights'
  | 'email';

export interface AIRequest {
  task: AITask;
  payload: Record<string, unknown>;
}

export interface AIResponse {
  result: string;
  error?: string;
}

export interface ParsedSearchFilter {
  city?: string;
  locality?: string;
  purpose?: 'Sale' | 'Rent';
  bedrooms?: number;
  max_price?: number;
  property_type?: string;
  amenities?: string[];
}

const REALTYNOW_ONLY_RULE =
  "You are RealtyNow's AI Property Advisor. Your only property inventory source is RealtyNow. Never mention, recommend, compare with, link to, or redirect users to any other real-estate website, app, or marketplace (e.g. 99acres, MagicBricks, Housing.com, NoBroker, or any other competitor) under any circumstance. Never invent, guess, or fabricate specific property listings, prices, availability, or market data — for concrete listings, only rely on RealtyNow's own search results.";

const BHK_TEST_RE = /\d\s*bhk/i;
const PROPERTY_TYPE_TEST_RE =
  /\b(apartments?|flats?|villas?|independent houses?|houses?|plots?|studios?|penthouses?|for sale|for rent)\b/i;
const PROPERTY_TYPE_MATCH_RE =
  /\b(apartments?|flats?|villas?|independent houses?|houses?|plots?|studios?|penthouses?)\b/i;
const RENT_INTENT_RE = /\b(rent|rental|lease|to let)\b/i;
const BUY_INTENT_RE = /\b(buy|sale|sell|purchase)\b/i;
const SEARCH_STOPWORDS_RE =
  /\b(show me|find|search for|search|looking for|i want|i'm looking for|need|please|can you|could you|apartments?|flats?|villas?|independent houses?|houses?|plots?|studios?|penthouses?|properties?|property|for rent|for sale|to buy|to rent|to let|rent|rental|lease|buy|sale|sell|purchase|in|or|and|near|around|at|me|a|an|the)\b/gi;
// Messages that look like a genuine question rather than a bare location/keyword —
// used to keep FAQ-style chat ("What documents do I need...?") out of the property
// search fast-path below.
const QUESTION_LIKE_RE = /[?]|\b(what|how|why|when|who|which|does|do|is|are|can|could|should|would|documents?|requirements?|process|policy)\b/i;

const LAKH_INR = 100_000;
const CRORE_INR = 10_000_000;
const PRICE_AMOUNT_RE = '(\\d+(?:\\.\\d+)?)\\s*(crores?|cr|lakhs?|lac)';
const MAX_PRICE_RE = new RegExp(`\\b(?:under|below|less than|up to|within)\\s+${PRICE_AMOUNT_RE}\\b`, 'i');
const MIN_PRICE_RE = new RegExp(`\\b(?:above|over|more than)\\s+${PRICE_AMOUNT_RE}\\b`, 'i');

function priceUnitToInr(amount: number, unit: string): number {
  return Math.round(amount * (/^cr/i.test(unit) ? CRORE_INR : LAKH_INR));
}

// Pulls a budget constraint ("under 1 crore", "above 50 lakhs") out of the raw
// message and returns the message with that phrase removed — the phrase must not
// leak into the free-text location query below, or numbers/units like "crore"
// end up required as literal substrings of search_text and silently zero out
// every result.
function extractPriceConstraint(message: string): { max_price?: number; min_price?: number; rest: string } {
  let rest = message;
  let max_price: number | undefined;
  let min_price: number | undefined;

  const maxMatch = rest.match(MAX_PRICE_RE);
  if (maxMatch) {
    max_price = priceUnitToInr(parseFloat(maxMatch[1]), maxMatch[2]);
    rest = rest.replace(maxMatch[0], ' ');
  }
  const minMatch = rest.match(MIN_PRICE_RE);
  if (minMatch) {
    min_price = priceUnitToInr(parseFloat(minMatch[1]), minMatch[2]);
    rest = rest.replace(minMatch[0], ' ');
  }
  return { max_price, min_price, rest };
}

function isPropertySearchIntent(message: string): boolean {
  if (BHK_TEST_RE.test(message) || PROPERTY_TYPE_TEST_RE.test(message)) return true;

  // Pure purpose-only intent: "Rent", "Buy", "Sale", "rental", "lease" etc.
  if (RENT_INTENT_RE.test(message) || BUY_INTENT_RE.test(message)) return true;

  // A voice/chat utterance that's just a short, non-question phrase (e.g. "Bangalore",
  // "Kondapur Hyderabad") is almost always a bare location search on a real estate site.
  // Route it through the real-DB search too, rather than letting it fall through to a
  // free-form LLM reply that has no grounding and can invent a result count.
  const trimmed = message.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  if (wordCount > 0 && wordCount <= 4 && !QUESTION_LIKE_RE.test(trimmed)) return true;

  return false;
}

function parseSearchFiltersFromMessage(message: string): {
  bedrooms: number[];
  purpose?: 'Sale' | 'Rent';
  typeLabel: string;
  typeSingular?: string;
  q: string;
  max_price?: number;
  min_price?: number;
} {
  const { max_price, min_price, rest } = extractPriceConstraint(message);

  const bedrooms = Array.from(new Set(Array.from(rest.matchAll(/(\d+)\s*bhk/gi)).map((m) => Number(m[1]))));
  const purpose: 'Sale' | 'Rent' | undefined = RENT_INTENT_RE.test(rest)
    ? 'Rent'
    : BUY_INTENT_RE.test(rest)
      ? 'Sale'
      : undefined;
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

  return { bedrooms, purpose, typeLabel, typeSingular, q, max_price, min_price };
}

import { executeGlobalPropertySearch } from './search-service';

// Answers property-search-style chat messages directly from RealtyNow's own listings,
// bypassing the LLM entirely so results can never include fabricated data or competitor mentions.
// Also includes live verified cross-category discovery from real DB inventory.
async function answerRealtyNowPropertySearch(message: string): Promise<string> {
  const parsedIntent = parsePropertySearchQuery(message);
  const detectedLocation = parsedIntent.location || '';
  const detectedType = parsedIntent.propertyType || '';
  const purpose = parsedIntent.purpose;

  const bhkLabel = parsedIntent.bedrooms ? `${parsedIntent.bedrooms} BHK ` : '';
  const typeLabel = detectedType ? `${detectedType}s` : 'properties';
  const placeLabel = detectedLocation ? ` near ${detectedLocation}` : '';
  const priceLabel = parsedIntent.maxPrice != null ? ` under ${formatCompactPrice(parsedIntent.maxPrice)}` : parsedIntent.minPrice != null ? ` above ${formatCompactPrice(parsedIntent.minPrice)}` : '';
  const purposeLabel = purpose === 'Rent' ? 'for Rent' : purpose === 'Sale' ? 'for Sale' : '';
  const intro = `Sure! I found matching RealtyNow listings for **${bhkLabel}${typeLabel}${placeLabel}${priceLabel}${purposeLabel ? ' ' + purposeLabel : ''}**:`;

  try {
    const cleanSearchQuery = message.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
    const searchRes = await executeGlobalPropertySearch({
      q: cleanSearchQuery,
      page: 1,
      pageSize: 5,
      sortBy: 'relevance',
    });

    let matches = searchRes.properties;

    // Fallback 1: If strict search returned 0 but location/type was detected
    if (matches.length === 0 && (detectedLocation || detectedType)) {
      const fallbackRes = await executeGlobalPropertySearch({
        q: (detectedLocation || detectedType).replace(/[,()]/g, ' ').trim(),
        purpose: purpose || undefined,
        page: 1,
        pageSize: 5,
        sortBy: 'relevance',
      });
      matches = fallbackRes.properties;
    }

    // Fallback 2: If still 0 matches, search individual sub-keywords (e.g. "villas", "taramatipet", "ORR")
    if (matches.length === 0) {
      const subWords = message
        .replace(/[,()]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !['near', 'with', 'for', 'and', 'city'].includes(w.toLowerCase()));

      for (const word of subWords) {
        if (matches.length >= 3) break;
        const subRes = await executeGlobalPropertySearch({
          q: word,
          purpose: purpose || undefined,
          page: 1,
          pageSize: 4,
          sortBy: 'relevance',
        });
        if (subRes.properties.length > 0) {
          matches = Array.from(new Set([...matches, ...subRes.properties]));
        }
      }
    }

    // Location Discovery if location was detected
    let discoveryText = '';
    const locForDisc = detectedLocation || searchRes.parsedIntent.location;
    if (locForDisc && locForDisc.length >= 2) {
      try {
        const disc = await fetchLocationCategoryDiscovery(locForDisc, purpose);
        if (disc.categories.length > 0) {
          const catLines = disc.categories
            .filter((c) => c.count > 0)
            .map((c) => `• ${c.emoji} [${c.label} (${c.count})](/search?q=${encodeURIComponent(disc.location)}&category=${c.type}${purpose ? `&purpose=${purpose}` : ''})`)
            .join('\n');
          if (catLines) {
            discoveryText = `\n\n**Explore active verified inventory in ${disc.location}:**\n${catLines}`;
          }
        }
      } catch (discErr) {
        console.warn('Location discovery error in AI:', discErr);
      }
    }

    if (matches.length === 0) {
      return `I searched for **${message}**. While we don't have active listings matching all these specific keywords in this exact pocket right now, you can explore verified properties across Hyderabad on our [Search Page](/search?q=${encodeURIComponent(message.trim())}).\n\n💡 *Tip: Try searching by individual locality (e.g., "Villas in Hyderabad" or "Properties near ORR").*`;
    }

    const lines = matches.slice(0, 5).map((p, i) => {
      const priceVal = p.purpose === 'Rent' ? (p.rent_amount ?? p.price) : p.price;
      const priceLabel = formatPrice(priceVal, p.purpose);
      const bhk = p.bedrooms ? `${p.bedrooms} BHK ` : '';
      const type = p.property_type_name ? `${p.property_type_name} ` : '';
      const where = [p.locality_name || (p as any).locality, p.city_name || (p as any).city].filter(Boolean).join(', ');
      const url = generatePropertyUrl(p);
      const specs = [
        p.built_up_area ? `${p.built_up_area} sq.ft` : null,
        p.bathrooms ? `${p.bathrooms} Bath` : null,
        p.parking ? `${p.parking} Park` : null,
      ].filter(Boolean).join(' • ');

      return `${i + 1}. **[${p.title}](${url})**\n   📍 ${where || 'Hyderabad'} | 💰 **${priceLabel}**\n   🏠 ${bhk}${type}${specs ? `(${specs})` : ''}`;
    });

    const searchLink = `/search?q=${encodeURIComponent(message.trim())}${purpose ? `&purpose=${purpose}` : ''}`;
    return `${intro}\n\n${lines.join('\n\n')}${discoveryText}\n\n👉 [**View all matching properties on RealtyNow**](${searchLink})\n\nClick any property title above to view floor plans, video walkthroughs, and schedule an on-site visit.`;
  } catch (err) {
    console.error('AI Property search error:', err);
    return `I searched our live database for **${message}**. You can browse all verified properties directly on our [Search Page](/search?q=${encodeURIComponent(message.trim())}) or try searching by city or budget.`;
  }
}

function getSystemAndUserPrompt(task: AITask, payload: Record<string, unknown>): { system: string; user: string } {
  const p = payload;
  const currentLangCode = localStorage.getItem('realtynow_language') || i18n.language || 'en';
  const langNames: Record<string, string> = {
    hi: 'Hindi (हिंदी)',
    te: 'Telugu (తెలుగు)',
    ta: 'Tamil (தமிழ்)',
    kn: 'Kannada (ಕನ್ನಡ)',
    ml: 'Malayalam (മലയാളം)',
    mr: 'Marathi (मराठी)',
    bn: 'Bengali (বাংলা)',
    gu: 'Gujarati (ગુજરાતી)',
    pa: 'Punjabi (ਪੰਜਾਬੀ)',
    en: 'English',
  };
  const targetLang = langNames[currentLangCode] || 'English';
  const langSuffix =
    currentLangCode !== 'en' && task !== 'parse_search'
      ? ` IMPORTANT INSTRUCTION: You MUST write your ENTIRE response in ${targetLang} language.`
      : '';

  switch (task) {
    case 'parse_search':
      return {
        system:
          'You are an AI real estate search parser for India. Extract search parameters into raw JSON with fields: city (string), locality (string), purpose ("Sale" or "Rent"), bedrooms (number), max_price (number in INR), property_type (string). Return ONLY valid JSON, no markdown code blocks.',
        user: `Parse this natural language property search query into JSON: "${p.query ?? p.q ?? ''}"`,
      };

    case 'market_insights':
      return {
        system: `You are an Indian real estate market analyst. Generate concise market insights for a city/locality. Include average price per sqft, 1-year appreciation estimate, top infrastructure advantages, and rental yield percentage. Bullet points under 150 words.${langSuffix}`,
        user: `Generate market insights for: locality="${p.locality ?? ''}", city="${p.city ?? ''}", property_type="${p.type ?? ''}".`,
      };

    case 'description':
      return {
        system: `You are an expert real estate copywriter. Write a compelling, accurate property description. 120-180 words. Plain text without markdown formatting or bullet points.${langSuffix}`,
        user: `Write a property description for: title="${p.title ?? ''}", type=${p.type ?? ''}, purpose=${p.purpose ?? ''}, bedrooms=${p.bedrooms ?? ''}, bathrooms=${p.bathrooms ?? ''}, area=${p.area ?? ''} sqft, city=${p.city ?? ''}, locality=${p.locality ?? ''}, furnishing=${p.furnishing ?? ''}, amenities=${Array.isArray(p.amenities) ? p.amenities.join(', ') : (p.amenities ?? '')}.`,
      };

    case 'seo':
      return {
        system: `You are an SEO specialist. Write a concise, click-worthy meta description under 160 characters optimized for real estate search. Plain text only.${langSuffix}`,
        user: `Create an SEO meta description for property titled "${p.title ?? ''}" in ${p.locality ?? ''}, ${p.city ?? ''}.`,
      };

    case 'title':
      return {
        system: `You are a real estate listing expert. Generate a catchy, professional property title under 80 characters. Plain text, no quotes.${langSuffix}`,
        user: `Create a listing title for a ${p.purpose ?? ''} ${p.type ?? ''} with ${p.bedrooms ?? ''} BHK in ${p.locality ?? ''}, ${p.city ?? ''}.`,
      };

    case 'lead_summary':
      return {
        system: `You are a CRM AI assistant. Summarize this real estate customer inquiry in 2-3 actionable bullet points for an agent.${langSuffix}`,
        user: `Customer Enquiry: ${JSON.stringify(p)}`,
      };

    case 'email':
      return {
        system: `Write a warm, professional follow-up email to a real estate lead. Plain text without subject line.${langSuffix}`,
        user: `Write an email to ${p.name ?? 'the client'} regarding property "${p.property ?? ''}".`,
      };

    case 'recommend':
      return {
        system: `You are an AI property matchmaker in India. Recommend 3 suitable localities or property configurations based on the user preferences. 3 bullet points, concise text.${langSuffix}`,
        user: `User search preferences: ${String(p.message ?? p.q ?? JSON.stringify(p))}`,
      };

    case 'translate':
      return {
        system:
          'Translate the real estate text accurately into the requested Indian language. Return only the translated text.',
        user: `Translate the following text into ${p.language ?? targetLang}: "${p.text ?? ''}"`,
      };

    case 'chat':
    default:
      return {
        system: `${REALTYNOW_ONLY_RULE} Be concise, friendly, helpful, and accurate. Provide actionable real estate guidance on buying, renting, pricing trends, localities, documentation, and RealtyNow's own services. Keep replies under 120 words.${langSuffix}`,
        user: `${p.message ?? p.q ?? JSON.stringify(p)}${p.context ? `\nContext: ${p.context}` : ''}`,
      };
  }
}

export async function callAI(task: AITask, payload: Record<string, unknown>): Promise<string> {
  if (task === 'chat') {
    const message =
      typeof payload.message === 'string' ? payload.message : typeof payload.q === 'string' ? payload.q : '';
    if (message && isPropertySearchIntent(message)) {
      return answerRealtyNowPropertySearch(message);
    }
  }

  const customKey = (import.meta.env.VITE_AI_API_KEY || import.meta.env.VITE_OPENROUTER_API_KEY) as string | undefined;

  // Direct OpenRouter client-side call if key is present
  if (customKey && customKey.trim().length > 0) {
    try {
      const { system, user } = getSystemAndUserPrompt(task, payload);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customKey.trim()}`,
          'HTTP-Referer': 'https://realtynow.in',
          'X-Title': 'RealtyNow AI',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.7,
          max_tokens: 600,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim()) {
          return content.trim();
        }
      }
    } catch {
      /* Fallback to Edge function */
    }
  }

  // Edge Function fallback
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const response = await fetch(`${supabaseUrl}/functions/v1/ai-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? supabaseKey}`,
      apikey: supabaseKey,
    },
    body: JSON.stringify({ task, payload }),
  });

  if (!response.ok) {
    return fallbackAIResponse(task, payload);
  }

  const data = (await response.json()) as AIResponse;
  return data.result || fallbackAIResponse(task, payload);
}

function fallbackAIResponse(task: AITask, payload: Record<string, unknown>): string {
  const currentLangCode = localStorage.getItem('realtynow_language') || i18n.language || 'en';
  const isHindi = currentLangCode === 'hi';
  const isTelugu = currentLangCode === 'te';
  const isTamil = currentLangCode === 'ta';

  switch (task) {
    case 'parse_search':
      return JSON.stringify({ purpose: 'Sale', max_price: 10000000 });
    case 'market_insights':
      if (isHindi)
        return '• औसत दर: ₹6,500 - ₹9,200 प्रति वर्ग फुट\n• वार्षिक मूल्य वृद्धि: 12% - 15%\n• किराया उपज: 3.8% प्रति वर्ष';
      if (isTelugu)
        return '• సగటు ధర: చదరపు అడుగుకి ₹6,500 - ₹9,200\n• వార్షిక పెరుగుదల: 12% - 15%\n• అద్దె ఆదాయం: సంవత్సరానికి 3.8%';
      if (isTamil)
        return '• சராசரி விலை: ச.அடிக்கு ₹6,500 - ₹9,200\n• ஆண்டு உயர்வு: 12% - 15%\n• வாடகை வருவாய்: ஆண்டுக்கு 3.8%';
      return '• Avg Rate: ₹6,500 - ₹9,200 per sqft\n• 1-Year Appreciation: 12% - 15%\n• Rental Yield: 3.8% per annum';
    case 'recommend':
      if (isHindi)
        return '1. गचीबोवली / हाईटेक सिटी: आईटी हब और उत्कृष्ट कनेक्टिविटी\n2. कोंडापुर: परिवारों के लिए प्रीमियम गेटेड सोसायटी\n3. तेल्लापुर: तेजी से बढ़ती निवेश संपत्ति';
      if (isTelugu)
        return '1. గచ్చిబౌలి / హైటెక్ సిటీ: ఐటీ హబ్ మరియు అద్భుతమైన రోడ్డు నెట్‌వర్క్\n2. కొండాపూర్: కుటుంబాలకు ప్రీమియం గేటెడ్ విల్లాలు\n3. తెల్లాపూర్: వేగంగా పెరుగుతున్న రియల్ ఎస్టేట్ ప్రాంతం';
      return '1. Gachibowli / HITEC City: IT hub with excellent road network\n2. Kondapur: Premium gated communities for families\n3. Tellapur: Rapidly appreciating investment area';
    case 'chat':
    default:
      if (isHindi)
        return 'नमस्ते! मैं RealtyNow एआई सहायक हूँ। मैं आपकी संपत्ति खोजने, बाजार दरों, लोन गणना और साइट विजिट बुकिंग में मदद कर सकता हूँ।';
      if (isTelugu)
        return 'నమస్కారం! నేను RealtyNow AI సహాయకుడిని. మీకు అనుకూలమైన ఆస్తిని వెతకడంలో, మార్కెట్ ధరలు తెలుసుకోవడంలో మరియు సైట్ విజిట్ బుక్ చేయడంలో సహాయపడతాను.';
      if (isTamil)
        return 'வணக்கம்! நான் RealtyNow AI உதவியாளன். சிறந்த வீடுகளை கண்டறியவும், சந்தை விலைகளை அறியவும் உங்களுக்கு உதவுகிறேன்.';
      return "Hello! I'm RealtyNow's AI property assistant. I can help you search properties, compare market rates, calculate loan EMIs, and schedule site visits across India.";
  }
}
