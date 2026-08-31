import { supabase } from './supabase';
import { checkListingLimit } from './listing-limits';
import { ensureUserProfile } from './profile-utils';
import type { Property, PropertyStatus } from './types';
import { matchesAllAmenities, getAmenityAliases } from './amenities';

export interface PropertyFilters {
  purpose?: string;
  city_id?: string;
  locality_id?: string;
  property_type_id?: string;
  category?: string;
  type?: string;
  min_price?: number;
  max_price?: number;
  bedrooms?: number;
  bathrooms?: number;
  furnishing?: string;
  q?: string;
  is_featured?: boolean;
  is_luxury?: boolean;
  min_area?: number;
  max_area?: number;
  facing?: string;
  possession_status?: string;
  verified_status?: string;
  parking?: number;
  property_age?: number;
  amenities?: string[];
  sort_by?: 'newest' | 'price_asc' | 'price_desc' | 'ai_recommended' | 'featured' | 'most_viewed' | 'most_contacted';
  limit?: number;
  offset?: number;
}

// Deterministic, explicit alias map for cities with well-known alternate names —
// NOT fuzzy/semantic matching, so "Bangalore" normalizes to "Bengaluru" (the name
// actually stored in public.cities) without any risk of loosely matching an
// unrelated city like Hyderabad or Chennai. Extend this list only with genuine
// former/alternate names, never near-matches.
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

// Normalizes known city aliases to the canonical name, and drops a redundant
// "City" qualifier immediately following one (e.g. "Bangalore City" -> "Bengaluru")
// so every phrasing in { Bangalore, Bengaluru, Bangalore City, Bengaluru City }
// collapses to the same query. ILIKE matching is case-insensitive, so the
// canonical casing here is purely for readable AI/UI text, not match correctness.
export function normalizeCityAliases(text: string): string {
  const words = text.split(' ').filter(Boolean);
  const normalized: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const alias = CITY_ALIASES[words[i].toLowerCase()];
    if (alias) {
      normalized.push(alias);
      if (words[i + 1]?.toLowerCase() === 'city') i++;
      continue;
    }
    normalized.push(words[i]);
  }
  return normalized.join(' ');
}

// Trims, collapses whitespace, and drops characters that aren't meaningful for a
// free-text locality/city/project/title search (also sidesteps '%'/'_' which are
// ILIKE pattern metacharacters) — shared by every search entry point so autocomplete,
// the search bar, and category pages all normalize a query the same way.
export function sanitizeSearchQuery(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalizeCityAliases(cleaned);
}

// ─── Property Term Dictionary ──────────────────────────────────────────────
// Maps plural / synonym / alternate forms → canonical singular DB term.
const PROPERTY_TERM_MAP: Record<string, string> = {
  // Plots / Land
  plots: 'plot',
  plot: 'plot',
  'plot land': 'plot',
  'land plot': 'plot',
  'land plots': 'plot',
  'open plots': 'open plot',
  'open plot': 'open plot',
  'residential plots': 'residential plot',
  'residential plot': 'residential plot',
  'commercial plots': 'commercial plot',
  'commercial plot': 'commercial plot',
  'farm plots': 'farm land',
  'farm plot': 'farm land',
  'farm lands': 'farm land',
  'farm land': 'farm land',
  lands: 'land',
  land: 'land',

  // Apartments / Flats
  apartments: 'apartment',
  apartment: 'apartment',
  apartmnt: 'apartment',
  apartmnts: 'apartment',
  appartment: 'apartment',
  appartments: 'apartment',
  flats: 'flat',
  flat: 'flat',
  'builder floors': 'builder floor',
  'builder floor': 'builder floor',
  penthouses: 'penthouse',
  penthouse: 'penthouse',
  studios: 'studio',
  studio: 'studio',

  // Villas
  villas: 'villa',
  villa: 'villa',
  vilas: 'villa',
  vila: 'villa',
  bungalows: 'bungalow',
  bungalow: 'bungalow',
  duplexes: 'duplex',
  duplex: 'duplex',
  triplex: 'duplex',
  'luxury villa': 'villa',
  'luxury villas': 'villa',
  'gated villa': 'villa',
  'gated villas': 'villa',

  // Houses
  houses: 'house',
  house: 'house',
  homes: 'home',
  home: 'home',
  'row houses': 'row house',
  'row house': 'row house',
  'independent houses': 'independent house',
  'independent house': 'independent house',
  'individual house': 'independent house',
  'individual houses': 'independent house',
  kothi: 'independent house',
  haveli: 'independent house',

  // Offices
  offices: 'office',
  office: 'office',
  'commercial offices': 'commercial office',
  'commercial office': 'commercial office',
  'commercial spaces': 'commercial space',
  'commercial space': 'commercial space',
  'it parks': 'it park',
  'it park': 'it park',

  // Shops
  shops: 'shop',
  shop: 'shop',
  showrooms: 'showroom',
  showroom: 'showroom',
  'retail shops': 'retail shop',
  'retail shop': 'retail shop',

  // Warehouses
  warehouses: 'warehouse',
  warehouse: 'warehouse',
  godowns: 'godown',
  godown: 'godown',

  // Co-working
  coworking: 'co-working',
  'co-working': 'co-working',
  coliving: 'co-working',
  'co-living': 'co-working',
  hostel: 'co-working',
  pg: 'co-working',

  // Projects
  projects: 'project',
  project: 'project',
};

// Category-only terms — when the entire query resolves to one of these,
// it means the user's intent is captured by the category filter alone;
// we skip the redundant search_document ILIKE to avoid over-filtering.
const PURE_CATEGORY_TERMS = new Set([
  'plot', 'plots', 'land', 'lands', 'open plot', 'open plots', 'residential plot',
  'residential plots', 'apartment', 'apartments', 'flat', 'flats',
  'villa', 'villas', 'vilas', 'vila', 'house', 'houses', 'independent house',
  'commercial office', 'office', 'offices', 'retail shop', 'shop', 'shops', 'warehouse',
  'co-working', 'coworking', 'pg',
]);

export const PURE_PURPOSE_TERMS: Record<string, 'Sale' | 'Rent'> = {
  sale: 'Sale',
  'for sale': 'Sale',
  buy: 'Sale',
  'to buy': 'Sale',
  purchase: 'Sale',
  rent: 'Rent',
  'for rent': 'Rent',
  rental: 'Rent',
  lease: 'Rent',
  'to let': 'Rent',
};

/**
 * Normalizes a search query by:
 * 1. Sanitizing (trim, collapse whitespace, strip punctuation)
 * 2. Lowercasing for dictionary lookup
 * 3. Mapping plural/synonym forms → canonical singular property terms
 *
 * Returns { normalized: string; isCategoryOnly: boolean; isPurposeOnly: boolean; detectedPurpose?: 'Sale' | 'Rent' }
 */
export function normalizeSearchQuery(raw: string): {
  normalized: string;
  isCategoryOnly: boolean;
  isPurposeOnly: boolean;
  detectedPurpose?: 'Sale' | 'Rent';
} {
  const sanitized = sanitizeSearchQuery(raw);
  const lower = sanitized.toLowerCase();

  const detectedPurpose = PURE_PURPOSE_TERMS[lower];
  if (detectedPurpose) {
    return {
      normalized: lower,
      isCategoryOnly: false,
      isPurposeOnly: true,
      detectedPurpose,
    };
  }

  // Check if the full phrase matches a known plural/synonym
  if (PROPERTY_TERM_MAP[lower]) {
    const normalized = PROPERTY_TERM_MAP[lower];
    return {
      normalized,
      isCategoryOnly: PURE_CATEGORY_TERMS.has(lower) || PURE_CATEGORY_TERMS.has(normalized),
      isPurposeOnly: false,
    };
  }

  // Token-level normalization: normalize each word that matches a plural
  const tokens = lower.split(/\s+/).filter(Boolean);
  const normalizedTokens = tokens.map((tok) => PROPERTY_TERM_MAP[tok] ?? tok);
  const normalized = normalizedTokens.join(' ');

  return {
    normalized,
    isCategoryOnly: PURE_CATEGORY_TERMS.has(lower) || PURE_CATEGORY_TERMS.has(normalized),
    isPurposeOnly: false,
  };
}

import { normalizeCategorySlug } from './categories';

export function buildPublishedQuery(filters: PropertyFilters = {}) {
  // The v_properties_search VIEW is the single source of truth and now only
  // exposes live listings (see migration 0142: WHERE deleted_at IS NULL AND
  // is_active = true AND (status IN published/live OR approval_status approved
  // OR is_live = true)). We must NOT set the live guard here with .or(): chained
  // .or() calls in supabase-js replace (not AND) one another, so this early
  // guard was silently dropped by later category/purpose/locality .or() filters,
  // leaking non-live rows into public results. Leaving it off lets the remaining
  // .or() groups behave as pure AND-ed filters while the view keeps the rows safe.
  let q = supabase
    .from('v_properties_search')
    .select('*', { count: 'exact' });

  let activePurpose = filters.purpose;
  if (!activePurpose && filters.q) {
    const normalizedInfo = normalizeSearchQuery(filters.q);
    if (normalizedInfo.detectedPurpose) {
      activePurpose = normalizedInfo.detectedPurpose;
    }
  }

  if (activePurpose) {
    if (activePurpose.toLowerCase() === 'pg') {
      q = q.or('purpose.ilike.pg,purpose.ilike.coliving,purpose.ilike.hostel,search_document.ilike.%pg%');
    } else {
      q = q.eq('purpose', activePurpose);
    }
  }

  // Canonical Category Filtering
  const categorySlug = normalizeCategorySlug(filters.category || filters.type);
  if (categorySlug) {
    switch (categorySlug) {
      case 'apartment':
        q = q.or(
          'property_type_name.ilike.%Apartment%,property_type_name.ilike.%Flat%,property_type_name.ilike.%Builder Floor%,property_type_name.ilike.%Studio%,property_type_name.ilike.%Penthouse%,title.ilike.%Apartment%,title.ilike.%Flat%,title.ilike.%Penthouse%'
        );
        break;

      case 'villa':
        q = q.or(
          'property_type_name.ilike.%Villa%,property_type_name.ilike.%Bungalow%,property_type_name.ilike.%Duplex%,title.ilike.%Villa%,title.ilike.%Villas%,title.ilike.%Vilas%,title.ilike.%Duplex%,property_sub_type.ilike.%villa%'
        );
        break;

      case 'independent-house':
        q = q.or(
          'property_type_name.ilike.%Independent House%,property_type_name.ilike.%Row House%,property_type_name.ilike.%Individual House%,title.ilike.%Independent House%,title.ilike.%Row House%,title.ilike.%Individual House%,title.ilike.%House%'
        );
        break;

      case 'commercial-office':
        q = q.or(
          'property_type_name.ilike.%Office%,property_type_name.ilike.%Commercial Space%,property_type_name.ilike.%IT Park%,property_type_name.ilike.%Business Center%,title.ilike.%Office%,title.ilike.%IT Park%'
        );
        break;

      case 'retail-shop':
        q = q.or(
          'property_type_name.ilike.%Shop%,property_type_name.ilike.%Retail%,property_type_name.ilike.%Showroom%,title.ilike.%Shop%,title.ilike.%Showroom%,title.ilike.%Retail%'
        );
        break;

      case 'warehouse':
        q = q.or(
          'property_type_name.ilike.%Warehouse%,property_type_name.ilike.%Godown%,property_type_name.ilike.%Industrial Shed%,property_type_name.ilike.%Cold Storage%,title.ilike.%Warehouse%,title.ilike.%Godown%'
        );
        break;

      case 'plots':
        q = q.or(
          'property_type_category.eq.Plot,property_type_name.ilike.%Plot%,property_type_name.ilike.%Land%,title.ilike.%Plot%,title.ilike.%Plots%,title.ilike.%Land%'
        );
        break;

      case 'co-working':
        q = q.or(
          'purpose.ilike.pg,purpose.ilike.coliving,purpose.ilike.hostel,property_type_name.ilike.%PG%,property_type_name.ilike.%Co-working%,property_type_name.ilike.%Coworking%,property_type_name.ilike.%Shared Office%,title.ilike.%Co-working%,title.ilike.%PG%'
        );
        break;
    }
  } else if (filters.category && !categorySlug) {
    q = q.or(`property_type_category.ilike.%${filters.category}%,property_type_name.ilike.%${filters.category}%,title.ilike.%${filters.category}%`);
  }

  if (filters.city_id) {
    const rawCity = String(filters.city_id).trim();
    const isUuid = /^[0-9a-f-]{36}$/i.test(rawCity);
    const cleanCityName = rawCity.replace(/^city-/i, '').replace(/[-_]/g, ' ').trim();

    const knownMeta = isUuid
      ? filters.city_id === 'fa963656-a6dc-4167-ae42-6dab041befe6' || filters.city_id === '04ec1d24-d2e8-4ee7-91aa-90fb4dfd3b9e'
        ? { name: 'Hyderabad', state: 'Telangana' }
        : filters.city_id === '19e37a80-ae99-4744-a7f5-afa80a562e17'
        ? { name: 'Bengaluru', state: 'Karnataka' }
        : filters.city_id === '55d44733-a456-4658-abad-4703db58746f'
        ? { name: 'Mumbai', state: 'Maharashtra' }
        : filters.city_id === '884978e6-fcff-4131-99ac-ebc433e98fe3'
        ? { name: 'Pune', state: 'Maharashtra' }
        : filters.city_id === 'a2c0d466-47f9-4295-81e4-12ffd4fc7e20'
        ? { name: 'Gurugram', state: 'Haryana' }
        : filters.city_id === '78192cc7-014e-48ea-a019-f2b901598dea'
        ? { name: 'Noida', state: 'Uttar Pradesh' }
        : filters.city_id === '4cf29f86-6208-4f75-aed7-3cb5332a2b46'
        ? { name: 'Chennai', state: 'Tamil Nadu' }
        : filters.city_id === 'f20db5de-d119-4ca6-9a42-1c8d5807cfa9'
        ? { name: 'Delhi', state: 'Delhi' }
        : filters.city_id === 'c9df9489-7115-44d3-bc9d-0f8a7c090727'
        ? { name: 'Kolkata', state: 'West Bengal' }
        : filters.city_id === '4098e626-f00c-4fb0-8052-724927539d6d'
        ? { name: 'Ahmedabad', state: 'Gujarat' }
        : null
      : null;

    const cityName = knownMeta?.name || cleanCityName;
    const stateName = knownMeta?.state || null;

    const parts: string[] = [];
    if (isUuid) {
      parts.push(`city_id.eq.${rawCity}`);
    }
    if (cityName) {
      parts.push(`city_name.ilike.%${cityName}%`);
      parts.push(`city.ilike.%${cityName}%`);
      parts.push(`address.ilike.%${cityName}%`);
      parts.push(`search_document.ilike.%${cityName}%`);
      parts.push(`formatted_address.ilike.%${cityName}%`);
      parts.push(`draft_data->>city_name.ilike.%${cityName}%`);
      parts.push(`draft_data->>locality_name.ilike.%${cityName}%`);
    }
    if (stateName) {
      parts.push(`draft_data->>state_name.ilike.%${stateName}%`);
      parts.push(`state.ilike.%${stateName}%`);
    }
    // If locality is also specified, ensure locality matches satisfy the city filter
    if (filters.locality_id) {
      const cleanLoc = String(filters.locality_id).replace(/^area-[^-]+-/i, '').replace(/[-_]/g, ' ').trim();
      if (cleanLoc && !/^[0-9a-f-]{36}$/i.test(cleanLoc)) {
        parts.push(`locality_name.ilike.%${cleanLoc}%`);
        parts.push(`locality.ilike.%${cleanLoc}%`);
        parts.push(`area.ilike.%${cleanLoc}%`);
        parts.push(`location_name.ilike.%${cleanLoc}%`);
        parts.push(`district.ilike.%${cleanLoc}%`);
        parts.push(`title.ilike.%${cleanLoc}%`);
        parts.push(`address.ilike.%${cleanLoc}%`);
        parts.push(`search_document.ilike.%${cleanLoc}%`);
      }
    }

    if (parts.length > 0) {
      q = q.or(parts.join(','));
    }
  }

  if (filters.locality_id) {
    const rawLocality = String(filters.locality_id).trim();
    const isUuid = /^[0-9a-f-]{36}$/i.test(rawLocality);
    const cleanLocality = rawLocality.replace(/^area-[^-]+-/i, '').replace(/[-_]/g, ' ').trim();

    if (isUuid) {
      q = q.eq('locality_id', rawLocality);
    } else if (cleanLocality) {
      const lowerLoc = cleanLocality.toLowerCase();
      const orParts = new Set<string>();

      orParts.add(`locality_name.ilike.%${cleanLocality}%`);
      orParts.add(`locality.ilike.%${cleanLocality}%`);
      orParts.add(`area.ilike.%${cleanLocality}%`);
      orParts.add(`location_name.ilike.%${cleanLocality}%`);
      orParts.add(`district.ilike.%${cleanLocality}%`);
      orParts.add(`city.ilike.%${cleanLocality}%`);
      orParts.add(`city_name.ilike.%${cleanLocality}%`);
      orParts.add(`address.ilike.%${cleanLocality}%`);
      orParts.add(`formatted_address.ilike.%${cleanLocality}%`);
      orParts.add(`draft_data->>locality_name.ilike.%${cleanLocality}%`);
      orParts.add(`draft_data->>city_name.ilike.%${cleanLocality}%`);
      orParts.add(`draft_data->>address.ilike.%${cleanLocality}%`);
      orParts.add(`search_document.ilike.%${cleanLocality}%`);
      orParts.add(`title.ilike.%${cleanLocality}%`);

      // Special alias/spelling variation handlers
      if (lowerLoc.includes('serlingampall') || lowerLoc.includes('serilingampall') || lowerLoc.includes('lingampall')) {
        orParts.add('locality_name.ilike.%serlingampall%');
        orParts.add('locality_name.ilike.%serilingampall%');
        orParts.add('title.ilike.%serlingampall%');
        orParts.add('title.ilike.%serilingampall%');
        orParts.add('search_document.ilike.%serlingampall%');
        orParts.add('search_document.ilike.%serilingampall%');
      }

      if (lowerLoc.includes('bodup') || lowerLoc.includes('bodi')) {
        orParts.add('locality_name.ilike.%boduppal%');
        orParts.add('title.ilike.%boduppal%');
        orParts.add('search_document.ilike.%boduppal%');
      }

      if (lowerLoc.includes('kphb') || lowerLoc.includes('kukat')) {
        orParts.add('locality_name.ilike.%kphb%');
        orParts.add('locality_name.ilike.%kukatpally%');
        orParts.add('search_document.ilike.%kphb%');
        orParts.add('search_document.ilike.%kukatpally%');
      }

      if (lowerLoc.includes('shadnag') || lowerLoc.includes('shad nagar')) {
        orParts.add('locality_name.ilike.%shadnagar%');
        orParts.add('title.ilike.%shadnagar%');
        orParts.add('search_document.ilike.%shadnagar%');
        orParts.add('city.ilike.%shadnagar%');
        orParts.add('district.ilike.%shadnagar%');
      }

      // Word tokens > 2 chars
      const words = cleanLocality.split(/[\s,()]+/).filter((w) => w.length > 2);
      for (const w of words) {
        orParts.add(`locality_name.ilike.%${w}%`);
        orParts.add(`address.ilike.%${w}%`);
        orParts.add(`search_document.ilike.%${w}%`);
        orParts.add(`title.ilike.%${w}%`);
      }

      q = q.or(Array.from(orParts).join(','));
    }
  }
  if (filters.property_type_id) q = q.eq('property_type_id', filters.property_type_id);
  if (filters.min_price != null) q = q.gte('price', filters.min_price);
  if (filters.max_price != null) q = q.lte('price', filters.max_price);
  if (filters.min_area != null) q = q.gte('built_up_area', filters.min_area);
  if (filters.max_area != null) q = q.lte('built_up_area', filters.max_area);
  if (filters.bedrooms != null) q = (filters.bedrooms === 5) ? q.gte('bedrooms', 5) : q.eq('bedrooms', filters.bedrooms);
  if (filters.bathrooms != null) q = (filters.bathrooms === 5) ? q.gte('bathrooms', 5) : q.eq('bathrooms', filters.bathrooms);
  if (filters.parking != null) q = q.gte('parking', filters.parking);
  if (filters.furnishing) q = q.eq('furnishing', filters.furnishing);
  if (filters.facing) q = q.eq('facing', filters.facing);
  if (filters.possession_status) {
    if (filters.possession_status === 'Under Construction') {
      q = q.or('possession_status.eq.Under Construction,possession_status.ilike.%Under Construction%,draft_data->>construction_status.ilike.%Under Construction%,draft_data->>age_of_property.ilike.%Under Construction%');
    } else if (filters.possession_status === 'New Launch') {
      q = q.or('possession_status.eq.New Launch,possession_status.ilike.%New Launch%,draft_data->>construction_status.ilike.%New Launch%,draft_data->>age_of_property.ilike.%New Launch%');
    } else if (filters.possession_status === 'Ready to Move') {
      q = q.or('possession_status.eq.Ready to Move,possession_status.ilike.%Ready to Move%,draft_data->>construction_status.ilike.%Ready to Move%,draft_data->>age_of_property.ilike.%Ready to Move%');
    } else {
      q = q.ilike('possession_status', `%${filters.possession_status}%`);
    }
  }
  if (filters.verified_status) q = q.eq('verified_status', filters.verified_status);
  if (filters.property_age != null) q = q.lte('age_of_property', filters.property_age);
  if (filters.is_featured) q = q.eq('is_featured', true);
  if (filters.is_luxury) q = q.eq('is_luxury', true);
  
  if (filters.amenities && filters.amenities.length > 0) {
    const allAliases = Array.from(
      new Set(filters.amenities.flatMap((a) => getAmenityAliases(a)))
    );
    if (allAliases.length > 0) {
      q = q.overlaps('amenities', allAliases);
    }
  }

  // ── Multi-Token Full-Text & Keyword Search ────────────────────────────────
  if (filters.q) {
    const rawLower = filters.q.toLowerCase().trim();
    const { normalized: cleaned, isCategoryOnly, isPurposeOnly } = normalizeSearchQuery(filters.q);

    const categoryAlreadyHandled = !!categorySlug && isCategoryOnly;
    const purposeAlreadyHandled = isPurposeOnly;

    if (!categoryAlreadyHandled && !purposeAlreadyHandled) {
      const isNumeric = !isNaN(Number(cleaned));
      if (isNumeric) {
        q = q.or(`search_document.ilike.%${cleaned}%,price.eq.${cleaned},rent_amount.eq.${cleaned},price_per_unit.eq.${cleaned}`);
      } else {
        // Build clean search variations for terms (e.g. villa/villas/vilas, plot/plots, flat/flats/apartment)
        const tokenSet = new Set<string>();
        const sanitized = `${rawLower} ${cleaned}`.replace(/[,()."'%_]/g, ' ').trim();

        const words = sanitized
          .split(/\s+/)
          .filter((w) => w.length > 1 && !['for', 'sale', 'rent', 'buy', 'to', 'in', 'near', 'at', 'with', 'and'].includes(w));

        for (const w of words) {
          tokenSet.add(w);
          if (w === 'villa' || w === 'villas' || w === 'vilas' || w === 'vila') {
            tokenSet.add('villa');
            tokenSet.add('villas');
            tokenSet.add('vilas');
          } else if (w === 'plot' || w === 'plots' || w === 'land' || w === 'lands') {
            tokenSet.add('plot');
            tokenSet.add('plots');
            tokenSet.add('land');
          } else if (w === 'apartment' || w === 'apartments' || w === 'flat' || w === 'flats') {
            tokenSet.add('apartment');
            tokenSet.add('flat');
            tokenSet.add('flats');
          } else if (w === 'house' || w === 'houses') {
            tokenSet.add('house');
            tokenSet.add('independent');
          }
        }

        const targetTokens = Array.from(tokenSet)
          .map((t) => t.trim())
          .filter((t) => t.length > 1 && !t.includes(','));

        if (targetTokens.length > 0) {
          const tokenMatches = targetTokens.map((t) => `search_document.ilike.%${t}%`).join(',');
          q = q.or(tokenMatches);
        }
      }
    }
  }

  const limit = filters.limit ?? 12;
  const offset = filters.offset ?? 0;

  // Sorting Logic
  switch (filters.sort_by) {
    case 'price_asc':
      q = q.order('price', { ascending: true });
      break;
    case 'price_desc':
      q = q.order('price', { ascending: false });
      break;
    case 'ai_recommended':
      q = q.order('ai_score', { ascending: false, nullsFirst: false });
      break;
    case 'most_viewed':
      q = q.order('view_count', { ascending: false, nullsFirst: false });
      break;
    case 'most_contacted':
      // Using view_count as a proxy if most_contacted column doesn't exist
      q = q.order('view_count', { ascending: false, nullsFirst: false });
      break;
    case 'featured':
      q = q.order('is_featured', { ascending: false }).order('created_at', { ascending: false });
      break;
    case 'newest':
    default:
      q = q.order('created_at', { ascending: false });
      break;
  }

  q = q.range(offset, offset + limit - 1);
  return q;
}

export async function fetchPublishedProperties(filters: PropertyFilters = {}) {
  const q = buildPublishedQuery(filters);
  const { data, error, count } = await q;
  if (error) throw error;
  
  let properties = (data ?? []) as Property[];
  if (filters.amenities && filters.amenities.length > 0) {
    properties = properties.filter((p) => matchesAllAmenities(p.amenities, filters.amenities));
  }

  // v_properties_search already returns city_name, locality_name, property_type_name, property_type_category
  return {
    data: properties,
    count: filters.amenities && filters.amenities.length > 0 ? properties.length : (count ?? 0),
  };
}

export async function fetchProperty(id: string) {
  if (!id) return null;
  
  // Extract UUID if present inside slug string
  const uuidMatch = id.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  let targetId = uuidMatch ? uuidMatch[0] : id;

  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(targetId);

  if (!isUuid) {
    // Search fallback if input isn't a 36-char UUID
    const { data: searchMatch } = await supabase
      .from('v_properties_search')
      .select('id')
      .ilike('title', `%${targetId}%`)
      .limit(1)
      .maybeSingle();
    if (searchMatch?.id) {
      targetId = searchMatch.id;
    } else {
      return null;
    }
  }

  const { data, error } = await supabase
    .from('v_properties_search')
    .select('*')
    .eq('id', targetId)
    .maybeSingle();

  if (error) {
    console.warn('fetchProperty error:', error);
    return null;
  }
  if (!data) return null;
  // v_properties_search already carries denormalized city_name, locality_name,
  // property_type_name, property_type_category, builder_name, project_name.
  return data as unknown as Property;
}

export async function trackPropertyView(propertyId: string, viewerId?: string): Promise<number | null> {
  try {
    // Routed through the track-analytics edge function so anonymous events are
    // throttled per-IP (the RPC alone cannot see client IP).
    const { data, error } = await supabase.functions.invoke('track-analytics', {
      body: { action: 'view', property_id: propertyId, viewer_id: viewerId || null },
    });
    if (!error && typeof data?.count === 'number') {
      return data.count;
    }
  } catch {
    // Fallback to direct insert if the function is unavailable.
  }

  try {
    await supabase.from('property_views').insert({ property_id: propertyId, viewer_id: viewerId ?? null });
  } catch (err) {
    console.debug('Direct property_views insert fallback:', err);
  }
  return null;
}

export async function updatePropertyStatus(id: string, status: PropertyStatus, reason?: string) {
  if (status === 'approved' || status === 'published') {
    return approveProperty(id);
  } else if (status === 'rejected') {
    return rejectProperty(id, reason);
  }

  const { data, error } = await supabase
    .from('properties')
    .update({
      status,
      approval_status:
        status === 'submitted' || status === 'pending_verification'
          ? 'Pending'
          : status === 'changes_requested'
            ? 'Changes Requested'
            : null,
      is_live: false,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// The RPC fallback chain below exists for RPC *unavailability* (e.g. an
// environment where the function was never deployed) — it must never
// trigger for a deliberate business-rule rejection from a working RPC
// (wrong price, missing title, unauthorized caller), or a clean rejection
// message like "This property cannot be published. The minimum property
// price is ₹1,000." gets silently discarded and retried via weaker
// fallbacks, eventually hitting the raw UPDATE fallback — which the price
// CHECK constraint also blocks, but with a raw, ugly Postgres error
// instead of the friendly one the RPC already gave us.
function isMissingRpcError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  return err.code === 'PGRST202' || msg.includes('could not find the function') || msg.includes('does not exist');
}

export async function approveProperty(id: string) {
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  // Primary: Atomic RPC procedure
  const { data: rpcData, error: rpcError } = await supabase.rpc('admin_make_property_live', {
    p_property_id: id,
    p_admin_id: currentUser?.id,
  });

  if (!rpcError && rpcData) {
    return rpcData;
  }
  if (rpcError && !isMissingRpcError(rpcError)) {
    throw new Error(rpcError.message);
  }

  // Fallback 1: admin_approve_property RPC
  const { data: rpcData2, error: rpcError2 } = await supabase.rpc('admin_approve_property', {
    p_property_id: id,
    p_admin_id: currentUser?.id,
  });
  if (!rpcError2 && rpcData2) {
    return rpcData2;
  }

  // Fallback 2: Direct atomic table update
  const { data, error } = await supabase
    .from('properties')
    .update({
      status: 'published',
      approval_status: 'Approved',
      is_live: true,
      is_active: true,
      approved_by: currentUser?.id ?? null,
      approved_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function rejectProperty(id: string, reason?: string) {
  const rejReason = reason ?? 'Property listing rejected by admin.';
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('properties')
    .update({
      status: 'rejected',
      approval_status: 'Rejected',
      is_live: false,
      rejection_reason: rejReason,
      reviewed_by: currentUser?.id ?? null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (!error && data) {
    return data;
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('admin_reject_property', {
    p_property_id: id,
    p_reason: rejReason,
  });
  if (rpcError) throw rpcError;
  return rpcData;
}

export async function assignAgentToProperty(propertyId: string, agentId: string) {
  const { data, error } = await supabase.rpc('admin_assign_agent', {
    p_property_id: propertyId,
    p_agent_id: agentId,
  });
  if (error) throw error;
  return data;
}

export async function resubmitProperty(propertyId: string) {
  const { data, error } = await supabase.rpc('customer_resubmit_property', {
    p_property_id: propertyId,
  });
  if (error) throw error;
  triggerAiVerification(propertyId);
  triggerPropertySeoGeneration(propertyId);
  return data;
}

// ─── AI Verified Listings ───────────────────────────────────────────────────

/**
 * Fire-and-forget trigger for the `verifyProperty` edge function. Called after a property
 * is submitted/resubmitted so verification runs in the background without blocking the
 * customer's submit flow. Failures are swallowed (best-effort) — the property still ends
 * up in the admin queue with status 'Pending AI' if verification couldn't run.
 */
export function triggerAiVerification(propertyId: string) {
  supabase.functions.invoke('verifyProperty', { body: { property_id: propertyId } }).catch((err) => {
    console.error('AI verification trigger failed:', err);
  });
}

/**
 * Fire-and-forget trigger for the `generatePropertySeo` edge function. Generates the SEO
 * title, description, slug, keywords, Open Graph and Twitter Card fields, canonical URL,
 * JSON-LD, and image alt text from the property's own details and writes them straight onto
 * the row — replaces the old customer-facing SEO wizard step. Called on submit, resubmit,
 * and admin approve/publish so SEO stays current whenever the underlying listing changes.
 */
export function triggerPropertySeoGeneration(propertyId: string) {
  supabase.functions.invoke('generatePropertySeo', { body: { property_id: propertyId } }).catch((err) => {
    console.error('SEO generation trigger failed:', err);
  });
}

export async function getPropertyVerification(propertyId: string) {
  const { data, error } = await supabase.functions.invoke('getVerificationStatus', {
    body: { property_id: propertyId },
  });
  if (error) throw error;
  return data;
}

// supabase-js's functions.invoke() only sets `error` to a generic
// "Edge Function returned a non-2xx status code" for any non-2xx response
// — the actual { error: "..." } JSON body the function returned (e.g. the
// friendly "minimum property price is ₹1,000" message) is only reachable
// via error.context, a raw Response that must be read/parsed manually.
// Without this, a business-rule rejection surfaces as an opaque generic
// error instead of the message the edge function deliberately returned.
async function extractFunctionErrorMessage(error: any, fallback: string): Promise<string> {
  try {
    const body = await error?.context?.json?.();
    return body?.error || body?.message || fallback;
  } catch {
    return fallback;
  }
}

export async function adminApproveWithAi(propertyId: string, remarks?: string) {
  const { data, error } = await supabase.functions.invoke('approveProperty', {
    body: { property_id: propertyId, remarks },
  });
  if (error) throw new Error(await extractFunctionErrorMessage(error, 'Approval failed'));
  return data;
}

export async function adminRejectWithAi(propertyId: string, reason: string, remarks?: string) {
  const { data, error } = await supabase.functions.invoke('rejectProperty', {
    body: { property_id: propertyId, reason, remarks },
  });
  if (error) throw new Error(await extractFunctionErrorMessage(error, 'Rejection failed'));
  return data;
}

export async function submitPropertyForReview(id: string) {
  return updatePropertyStatus(id, 'submitted');
}

export async function savePropertyDraft(draftId: string | null, payload: any, submissionId?: string) {
  // Database-level protection against empty drafts
  if (!draftId && !payload.purpose && !payload.category && !payload.property_type_id && !payload.address) {
    throw new Error('Cannot create an empty draft property');
  }

  // Ensure owner profile exists in public.profiles table so foreign key constraint is satisfied
  if (payload.owner_id) {
    await ensureUserProfile(payload.owner_id);
  } else {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user?.id) {
      await ensureUserProfile(userData.user.id);
      payload.owner_id = userData.user.id;
    }
  }

  // Monthly listing limit enforcement for new drafts
  if (!draftId) {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const limitStatus = await checkListingLimit(userData.user.id);
      if (!limitStatus.canList) {
        throw new Error('LISTING_LIMIT_REACHED');
      }
    }
  }

  const executeSave = async () => {
    if (draftId) {
      const { data, error } = await supabase
        .from('properties')
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draftId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else if (submissionId) {
      const { data, error } = await supabase
        .from('properties')
        .upsert(
          { ...payload, submission_id: submissionId },
          { onConflict: 'submission_id' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('properties')
        .insert({
          ...payload,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  };

  try {
    return await executeSave();
  } catch (err: any) {
    // If foreign key constraint failed, heal profile and retry once
    if (err?.message?.includes('profiles_fkey') || err?.code === '23503') {
      await ensureUserProfile(payload.owner_id);
      return await executeSave();
    }
    throw err;
  }
}

export async function getDraftProperty(draftId: string) {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', draftId)
    .single();
  if (error) throw error;
  return data;
}
