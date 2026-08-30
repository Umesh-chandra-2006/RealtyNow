/**
 * RealtyNow Global Intelligent Property Search Service
 *
 * Dedicated database-driven search service with:
 * - Natural language intent resolution
 * - Relevance ranking engine
 * - Live suggestions & autocomplete
 * - LocalStorage recent searches caching
 */

import { supabase } from './supabase';
import type { Property } from './types';
import {
  parsePropertySearchQuery,
  type ParsedSearchIntent,
  mapPropertyTypeToCategory,
  SEARCH_HARD_CAP,
} from './search-engine';
import { buildPublishedQuery, type PropertyFilters } from './properties';
import { categorizeProperty, normalizeCategorySlug, type CategorySlug } from './categories';
import { matchesAllAmenities } from './amenities';

export interface GlobalSearchOptions extends PropertyFilters {
  /** Raw natural language query or keyword */
  q?: string;
  /** Force specific sorting */
  sortBy?: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'area_asc' | 'area_desc' | 'most_viewed' | 'featured';
  /** Page number (1-indexed) */
  page?: number;
  /** Page size */
  pageSize?: number;
}

export interface ScoredProperty extends Property {
  _relevanceScore?: number;
  city_name?: string;
  locality_name?: string;
  property_type_name?: string;
  property_type_category?: string;
  builder_name?: string;
  project_name?: string;
}

export interface GlobalSearchResult {
  properties: ScoredProperty[];
  totalCount: number;
  baseTotalCount: number;
  categoryCounts: Record<CategorySlug, number>;
  parsedIntent: ParsedSearchIntent;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LiveSearchSuggestionsResult {
  /** Direct property matches */
  properties: Array<{
    id: string;
    title: string;
    price: number;
    rent_amount: number;
    purpose: string;
    locality_name?: string;
    city_name?: string;
    bedrooms?: number;
    property_type_name?: string;
    cover_image?: string;
    images?: string[];
  }>;
  /** Matching localities with counts */
  localities: Array<{
    name: string;
    city_name: string;
    count: number;
  }>;
  /** Smart suggested queries based on intent */
  smartQueries: Array<{
    text: string;
    category?: string;
    locality?: string;
    bhk?: number;
    purpose?: string;
  }>;
  /** Parsed intent from the query */
  parsedIntent: ParsedSearchIntent;
}

// ─── Relevance Scoring Engine ─────────────────────────────────

/**
 * Calculates a relevance score for a property given the user's search query and parsed intent.
 */
export function calculateRelevanceScore(
  property: any,
  rawQuery: string,
  intent: ParsedSearchIntent
): number {
  if (!rawQuery || rawQuery.trim().length === 0) {
    // Default score: slight boost for featured/verified
    return (property.is_featured ? 20 : 0) + (property.is_verified || property.verified_status === 'verified' ? 10 : 0);
  }

  let score = 0;
  const qLower = rawQuery.toLowerCase().trim();
  const title = (property.title || '').toLowerCase();
  const locality = (property.locality_name || property.locality || '').toLowerCase();
  const city = (property.city_name || property.city || '').toLowerCase();
  const propType = (property.property_type_name || '').toLowerCase();
  const projectName = (property.project_name || '').toLowerCase();
  const builderName = (property.builder_name || '').toLowerCase();
  const description = (property.description || '').toLowerCase();
  const amenities = Array.isArray(property.amenities)
    ? property.amenities.join(' ').toLowerCase()
    : (property.amenities || '').toLowerCase();

  // 1. Exact Title match or high overlap (+100)
  if (title === qLower) {
    score += 120;
  } else if (title.includes(qLower)) {
    score += 80;
  }

  // 2. Locality match (+80)
  if (intent.location) {
    const locLower = intent.location.toLowerCase();
    if (locality === locLower || locality.includes(locLower)) {
      score += 85;
    } else if (city === locLower || city.includes(locLower)) {
      score += 60;
    }
  }

  // 3. Property Type match (+70)
  if (intent.propertyType) {
    const catSlug = mapPropertyTypeToCategory(propType);
    if (catSlug === intent.propertyType) {
      score += 75;
    }
  }

  // 4. Project & Builder match (+60)
  if (projectName && (qLower.includes(projectName) || projectName.includes(qLower))) {
    score += 65;
  }
  if (builderName && (qLower.includes(builderName) || builderName.includes(qLower))) {
    score += 55;
  }

  // 5. BHK / Bedroom count match (+50)
  if (intent.bedrooms != null) {
    if (property.bedrooms === intent.bedrooms) {
      score += 50;
    } else if (Math.abs((property.bedrooms || 0) - intent.bedrooms) === 1) {
      score += 15; // Close match
    }
  }

  // 6. Price Target match (+40)
  const price = property.price || property.rent_amount || 0;
  if (intent.maxPrice != null && price > 0) {
    if (price <= intent.maxPrice) {
      score += 40;
    }
  }
  if (intent.minPrice != null && price > 0) {
    if (price >= intent.minPrice) {
      score += 20;
    }
  }

  // 7. Purpose match (+30)
  if (intent.purpose && property.purpose) {
    if (property.purpose.toLowerCase() === intent.purpose.toLowerCase()) {
      score += 30;
    }
  }

  // 8. Amenities match (+25)
  const tokens = qLower.split(/\s+/).filter((t) => t.length > 2);
  for (const token of tokens) {
    if (amenities.includes(token)) {
      score += 15;
    }
    if (description.includes(token)) {
      score += 10;
    }
  }

  // 9. Premium Quality & Subscription Visibility Signals
  if (property.visibility_level === 'Premium' || property.premium_placement) score += 25;
  else if (property.visibility_level === 'Enhanced') score += 15;

  if (property.is_featured) score += 15;
  if (property.is_verified || property.verified_status === 'verified') score += 10;
  if (property.is_luxury) score += 10;

  return score;
}

// ─── Global Property Search Execution ─────────────────────────

// ─── Global Property Search Execution ─────────────────────────

export async function executeGlobalPropertySearch(
  options: GlobalSearchOptions = {}
): Promise<GlobalSearchResult> {
  const {
    q = '',
    sortBy = 'relevance',
    page = 1,
    pageSize = 12,
    ...explicitFilters
  } = options;

  // 1. Parse natural language query
  const parsedIntent = parsePropertySearchQuery(q);

  // 2. Identify the active canonical category slug if explicitly filtered or parsed
  const rawTargetCategory = explicitFilters.category || (parsedIntent.propertyType ? String(parsedIntent.propertyType) : undefined) || explicitFilters.type;
  const activeCategorySlug = normalizeCategorySlug(rawTargetCategory);

  // 3. Synthesize base query filters (strictly omitting category/type so DB returns all context candidates)
  const baseQueryFilters: PropertyFilters = {
    ...explicitFilters,
    category: undefined,
    type: undefined,
    property_type_id: undefined,
    purpose: explicitFilters.purpose || parsedIntent.purpose || undefined,
    bedrooms: explicitFilters.bedrooms ?? (parsedIntent.bedrooms ?? undefined),
    min_price: explicitFilters.min_price ?? (parsedIntent.minPrice ?? undefined),
    max_price: explicitFilters.max_price ?? (parsedIntent.maxPrice ?? undefined),
    min_area: explicitFilters.min_area ?? undefined,
    max_area: explicitFilters.max_area ?? undefined,
    q: q.trim() || undefined,
    limit: SEARCH_HARD_CAP,
    offset: 0,
  };

  // 4. Execute DB query via buildPublishedQuery
  const dbQuery = buildPublishedQuery(baseQueryFilters);
  const { data, error } = await dbQuery;

  if (error) {
    console.error('executeGlobalPropertySearch database error:', error);
    throw error;
  }

  let allCandidates: ScoredProperty[] = (data ?? []) as ScoredProperty[];

  // Strictly filter candidates by requested amenities using smart alias matching
  if (explicitFilters.amenities && explicitFilters.amenities.length > 0) {
    allCandidates = allCandidates.filter((prop) =>
      matchesAllAmenities(prop.amenities, explicitFilters.amenities)
    );
  }

  // Normalize possession_status and attributes from draft_data if missing on root row
  for (const prop of allCandidates) {
    if (!prop.possession_status) {
      const draft = (prop as any).draft_data || {};
      const status = draft.possession_status || draft.construction_status || draft.age_of_property;
      if (status && typeof status === 'string') {
        const s = status.toLowerCase();
        if (s.includes('under') || s.includes('construction') || s.includes('uc')) prop.possession_status = 'Under Construction';
        else if (s.includes('new') || s.includes('launch')) prop.possession_status = 'New Launch';
        else if (s.includes('ready')) prop.possession_status = 'Ready to Move';
      }
    }
  }

  const baseTotalCount = allCandidates.length;

  // 5. Calculate synchronized Category Breakdown strictly using canonical categorizeProperty
  const categoryCounts: Record<CategorySlug, number> = {
    apartment: 0,
    'independent-house': 0,
    villa: 0,
    plots: 0,
    'commercial-office': 0,
    'retail-shop': 0,
    warehouse: 0,
    'co-working': 0,
  };

  for (const prop of allCandidates) {
    const slug = categorizeProperty(prop);
    if (slug && categoryCounts[slug] !== undefined) {
      categoryCounts[slug] += 1;
    }
  }

  // 6. Filter by active category slug using the EXACT same categorization function
  let matchingProperties: ScoredProperty[] = allCandidates;
  if (activeCategorySlug) {
    matchingProperties = allCandidates.filter((p) => categorizeProperty(p) === activeCategorySlug);
  }

  const totalCount = activeCategorySlug ? categoryCounts[activeCategorySlug] || matchingProperties.length : baseTotalCount;

  // 7. Sort matching properties
  const isRelevanceSort = sortBy === 'relevance';
  if (isRelevanceSort) {
    matchingProperties = matchingProperties.map((prop) => ({
      ...prop,
      _relevanceScore: calculateRelevanceScore(prop, q, parsedIntent),
    }));
    matchingProperties.sort((a, b) => (b._relevanceScore ?? 0) - (a._relevanceScore ?? 0));
  } else if (sortBy === 'price_asc') {
    matchingProperties.sort((a, b) => (Number(a.price || a.rent_amount || 0)) - (Number(b.price || b.rent_amount || 0)));
  } else if (sortBy === 'price_desc') {
    matchingProperties.sort((a, b) => (Number(b.price || b.rent_amount || 0)) - (Number(a.price || a.rent_amount || 0)));
  } else if (sortBy === 'most_viewed') {
    matchingProperties.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
  } else if (sortBy === 'featured') {
    matchingProperties.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
  } else {
    // Default newest
    matchingProperties.sort((a, b) => {
      const timeB = new Date(b.published_at || b.created_at || 0).getTime();
      const timeA = new Date(a.published_at || a.created_at || 0).getTime();
      return timeB - timeA;
    });
  }

  // 8. Paginate
  const startIdx = (page - 1) * pageSize;
  const paginatedProperties = matchingProperties.slice(startIdx, startIdx + pageSize);
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return {
    properties: paginatedProperties,
    totalCount,
    baseTotalCount,
    categoryCounts,
    parsedIntent,
    page,
    pageSize,
    totalPages,
  };
}

// ─── Live Search Autocomplete Suggestions ─────────────────────

export async function fetchLiveSearchSuggestions(
  query: string,
  cityId?: string
): Promise<LiveSearchSuggestionsResult> {
  const trimmed = (query || '').trim();
  const parsedIntent = parsePropertySearchQuery(trimmed);

  if (!trimmed || trimmed.length < 2) {
    return {
      properties: [],
      localities: [],
      smartQueries: [],
      parsedIntent,
    };
  }

  try {
    // 1. Fetch matching top published properties (up to 4)
    let propQuery = supabase
      .from('v_properties_search')
      .select('id, title, price, rent_amount, purpose, locality_name, city_name, bedrooms, property_type_name, images, cover_image_url')
      .or('status.eq.published,status.eq.live,is_live.eq.true')
      .or('price.gte.1000,rent_amount.gte.1000')
      .ilike('search_document', `%${parsedIntent.location || trimmed}%`)
      .limit(4);

    if (cityId) {
      propQuery = propQuery.eq('city_id', cityId);
    }

    if (parsedIntent.purpose) {
      propQuery = propQuery.eq('purpose', parsedIntent.purpose);
    }

    const { data: propData } = await propQuery;

    const matchedProps = (propData ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      rent_amount: p.rent_amount,
      purpose: p.purpose,
      locality_name: p.locality_name,
      city_name: p.city_name,
      bedrooms: p.bedrooms,
      property_type_name: p.property_type_name,
      cover_image: p.cover_image_url || (Array.isArray(p.images) ? p.images[0] : null),
      images: p.images,
    }));

    // 2. Fetch matching localities with count
    const locQuery = supabase
      .from('localities')
      .select('name, cities(name)')
      .ilike('name', `%${parsedIntent.location || trimmed}%`)
      .limit(5);

    const { data: locData } = await locQuery;

    const localities = (locData ?? []).map((l: any) => ({
      name: l.name,
      city_name: l.cities?.name || 'Hyderabad',
      count: 0,
    }));

    // 3. Generate smart query suggestions
    const smartQueries: LiveSearchSuggestionsResult['smartQueries'] = [];

    // If a location is detected, suggest top categories in that location
    if (parsedIntent.location) {
      smartQueries.push({
        text: `Villas in ${parsedIntent.location}`,
        category: 'villa',
        locality: parsedIntent.location,
        purpose: 'Sale',
      });
      smartQueries.push({
        text: `3 BHK Apartments in ${parsedIntent.location}`,
        category: 'apartment',
        locality: parsedIntent.location,
        bhk: 3,
        purpose: 'Sale',
      });
      smartQueries.push({
        text: `Flats for Rent in ${parsedIntent.location}`,
        category: 'apartment',
        locality: parsedIntent.location,
        purpose: 'Rent',
      });
      smartQueries.push({
        text: `Plots in ${parsedIntent.location}`,
        category: 'plots',
        locality: parsedIntent.location,
        purpose: 'Sale',
      });
    } else if (parsedIntent.propertyType) {
      smartQueries.push({
        text: `${parsedIntent.propertyType.toUpperCase()} in Kokapet`,
        category: parsedIntent.propertyType,
        locality: 'Kokapet',
      });
      smartQueries.push({
        text: `${parsedIntent.propertyType.toUpperCase()} in Jubilee Hills`,
        category: parsedIntent.propertyType,
        locality: 'Jubilee Hills',
      });
      smartQueries.push({
        text: `${parsedIntent.propertyType.toUpperCase()} in Gachibowli`,
        category: parsedIntent.propertyType,
        locality: 'Gachibowli',
      });
    }

    return {
      properties: matchedProps,
      localities,
      smartQueries: smartQueries.slice(0, 4),
      parsedIntent,
    };
  } catch (err) {
    console.error('fetchLiveSearchSuggestions error:', err);
    return {
      properties: [],
      localities: [],
      smartQueries: [],
      parsedIntent,
    };
  }
}

// ─── Recent Searches (LocalStorage Manager) ──────────────────

const RECENT_SEARCHES_KEY = 'realtynow_recent_searches_v2';
const MAX_RECENT_SEARCHES = 8;

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): void {
  const trimmed = (query || '').trim();
  if (!trimmed || trimmed.length < 2) return;

  try {
    const existing = getRecentSearches().filter(
      (item) => item.toLowerCase() !== trimmed.toLowerCase()
    );
    const updated = [trimmed, ...existing].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('realtynow-recent-searches-updated'));
  } catch (err) {
    console.warn('Could not save recent search:', err);
  }
}

export function removeRecentSearch(query: string): void {
  try {
    const existing = getRecentSearches().filter(
      (item) => item.toLowerCase() !== query.toLowerCase()
    );
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(existing));
    window.dispatchEvent(new Event('realtynow-recent-searches-updated'));
  } catch (err) {
    console.warn('Could not remove recent search:', err);
  }
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    window.dispatchEvent(new Event('realtynow-recent-searches-updated'));
  } catch (err) {
    console.warn('Could not clear recent searches:', err);
  }
}
