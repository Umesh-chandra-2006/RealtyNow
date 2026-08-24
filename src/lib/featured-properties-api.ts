import { supabase } from './supabase';
import type { Property } from './types';

export type FeaturedPriority = 'High' | 'Medium' | 'Low';
export type FeaturedStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'INACTIVE';

export interface FeaturedPropertyItem {
  id: string;
  property_id: string;
  is_active: boolean;
  display_order: number;
  priority: FeaturedPriority;
  start_at: string | null;
  end_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  property: Property & {
    city_name?: string | null;
    locality_name?: string | null;
    property_type_name?: string | null;
    property_type_category?: string | null;
    builder_name?: string | null;
    owner_email?: string | null;
  };
  derived_status: FeaturedStatus;
}

/**
 * Calculates the operational status based on active flag and schedule timestamps.
 */
export function deriveFeaturedStatus(item: {
  is_active: boolean;
  start_at?: string | null;
  end_at?: string | null;
}): FeaturedStatus {
  if (!item.is_active) {
    return 'INACTIVE';
  }
  const now = new Date();
  if (item.start_at && new Date(item.start_at) > now) {
    return 'SCHEDULED';
  }
  if (item.end_at && new Date(item.end_at) < now) {
    return 'EXPIRED';
  }
  return 'ACTIVE';
}

/**
 * Fetch all featured properties for Admin management with full details & calculated status.
 */
export async function fetchFeaturedPropertiesAdmin(): Promise<FeaturedPropertyItem[]> {
  const { data: featuredRows, error } = await supabase
    .from('featured_properties')
    .select(`
      *,
      property:properties (
        *,
        city:cities(name),
        locality:localities(name),
        property_type:property_types(name, category),
        builder:builders(name)
      )
    `)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error || !featuredRows || featuredRows.length === 0) {
    // Fallback: check if properties table has any marked as is_featured
    const { data: props, error: pErr } = await supabase
      .from('properties')
      .select(`
        *,
        city:cities(name),
        locality:localities(name),
        property_type:property_types(name, category),
        builder:builders(name)
      `)
      .eq('is_featured', true)
      .order('created_at', { ascending: false });

    if (!pErr && props && props.length > 0) {
      return props.map((p: any, idx: number) => ({
        id: `legacy-${p.id}`,
        property_id: p.id,
        is_active: true,
        display_order: idx + 1,
        priority: (idx < 2 ? 'High' : 'Medium') as FeaturedPriority,
        start_at: null,
        end_at: null,
        created_by: null,
        created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || new Date().toISOString(),
        property: {
          ...p,
          city_name: p.city?.name || p.city_name || null,
          locality_name: p.locality?.name || p.locality_name || null,
          property_type_name: p.property_type?.name || p.property_type_name || null,
          property_type_category: p.property_type?.category || p.property_type_category || null,
          builder_name: p.builder?.name || p.builder_name || null,
        },
        derived_status: 'ACTIVE' as FeaturedStatus,
      }));
    }

    if (error) {
      console.warn('Error fetching featured properties:', error);
    }
    return [];
  }

  return (featuredRows || []).map((row: any) => {
    const p = row.property || {};
    const flatProperty = {
      ...p,
      city_name: p.city?.name || p.city_name || null,
      locality_name: p.locality?.name || p.locality_name || null,
      property_type_name: p.property_type?.name || p.property_type_name || null,
      property_type_category: p.property_type?.category || p.property_type_category || null,
      builder_name: p.builder?.name || p.builder_name || null,
    };

    return {
      ...row,
      property: flatProperty,
      derived_status: deriveFeaturedStatus(row),
    };
  });
}

/**
 * Fetch public eligible featured properties for the homepage carousel.
 */
export async function fetchPublicFeaturedProperties(cityId?: string): Promise<any[]> {
  try {
    const now = new Date();

    // 1. Direct query to featured_properties ordered strictly by display_order ASC
    const { data: featuredRows, error: fErr } = await supabase
      .from('featured_properties')
      .select(`
        id,
        property_id,
        display_order,
        priority,
        start_at,
        end_at,
        is_active
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (!fErr && featuredRows && featuredRows.length > 0) {
      // Filter by active schedule (start_at <= now, end_at >= now)
      const eligibleFeatured = featuredRows.filter((item) => {
        if (!item.is_active) return false;
        if (item.start_at && new Date(item.start_at) > now) return false;
        if (item.end_at && new Date(item.end_at) < now) return false;
        return true;
      });

      if (eligibleFeatured.length > 0) {
        const propIds = eligibleFeatured.map((f) => f.property_id);

        // Fetch properties by IDs from search view
        const { data: properties, error: propErr } = await supabase
          .from('v_properties_search')
          .select('*')
          .in('id', propIds);

        const propsMap = new Map<string, any>();
        if (!propErr && properties) {
          properties.forEach((p) => propsMap.set(p.id, p));
        }

        // Check for any missing properties directly in the properties table
        const missingIds = propIds.filter((id) => !propsMap.has(id));
        if (missingIds.length > 0) {
          const { data: directProps } = await supabase
            .from('properties')
            .select(`
              *,
              city:cities(name),
              locality:localities(name),
              property_type:property_types(name, category),
              builder:builders(name)
            `)
            .in('id', missingIds);

          if (directProps) {
            directProps.forEach((p: any) => {
              propsMap.set(p.id, {
                ...p,
                city_name: p.city?.name || p.city_name || null,
                locality_name: p.locality?.name || p.locality_name || null,
                property_type_name: p.property_type?.name || p.property_type_name || null,
                property_type_category: p.property_type?.category || p.property_type_category || null,
                builder_name: p.builder?.name || p.builder_name || null,
              });
            });
          }
        }

        // Build the final array in the PRECISE order of eligibleFeatured (display_order ASC)
        let targetList = eligibleFeatured;
        if (cityId) {
          const cityMatches = eligibleFeatured.filter((f) => {
            const p = propsMap.get(f.property_id);
            return p && (p.city_id === cityId || p.city_name?.toLowerCase() === cityId.toLowerCase());
          });
          // Only filter by city if there are at least 3 matching properties in that city; otherwise show all featured
          if (cityMatches.length >= 3) {
            targetList = cityMatches;
          }
        }

        const orderedProperties: any[] = [];
        for (const f of targetList) {
          const prop = propsMap.get(f.property_id);
          if (prop) {
            orderedProperties.push({
              ...prop,
              _featuredId: f.id,
              _featuredOrder: f.display_order,
              _featuredPriority: f.priority,
              _isFeaturedProperty: true,
            });
          }
        }

        if (orderedProperties.length > 0) {
          return orderedProperties;
        }
      }
    }

    // 2. Fallback to properties where is_featured = true
    let legacyQuery = supabase
      .from('v_properties_search')
      .select('*')
      .eq('is_featured', true)
      .limit(20);

    const { data: legacyData } = await legacyQuery;
    return (legacyData || []).map((p) => ({
      ...p,
      _isFeaturedProperty: true,
    }));
  } catch (err) {
    console.error('Error fetching public featured properties:', err);
    return [];
  }
}

/**
 * Fetch eligible properties available to be added into Featured.
 */
export async function fetchEligibleProperties(params?: {
  search?: string;
  type?: string;
  purpose?: string;
  minPrice?: number;
  maxPrice?: number;
  cityId?: string;
  limit?: number;
}): Promise<any[]> {
  // First fetch already featured property IDs
  const { data: featuredRows } = await supabase
    .from('featured_properties')
    .select('property_id');
  const existingFeaturedIds = new Set((featuredRows || []).map((r) => r.property_id));

  let q = supabase
    .from('v_properties_search')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(params?.limit || 50);

  if (params?.search) {
    const s = params.search.trim();
    q = q.or(`title.ilike.%${s}%,locality_name.ilike.%${s}%,city_name.ilike.%${s}%,builder_name.ilike.%${s}%`);
  }
  if (params?.type && params.type !== 'all') {
    q = q.eq('property_type_id', params.type);
  }
  if (params?.purpose && params.purpose !== 'all') {
    q = q.eq('purpose', params.purpose);
  }
  if (params?.minPrice) {
    q = q.gte('price', params.minPrice);
  }
  if (params?.maxPrice) {
    q = q.lte('price', params.maxPrice);
  }
  if (params?.cityId && params.cityId !== 'all') {
    q = q.eq('city_id', params.cityId);
  }

  let { data, error } = await q;

  // Fallback to properties table directly if view is empty or errors
  if (error || !data || data.length === 0) {
    let propQ = supabase
      .from('properties')
      .select(`
        *,
        city:cities(name),
        locality:localities(name),
        property_type:property_types(name, category),
        builder:builders(name)
      `)
      .order('created_at', { ascending: false })
      .limit(params?.limit || 50);

    if (params?.search) {
      propQ = propQ.ilike('title', `%${params.search.trim()}%`);
    }

    const { data: directProps } = await propQ;
    if (directProps) {
      data = directProps.map((p: any) => ({
        ...p,
        city_name: p.city?.name || p.city_name || 'Hyderabad',
        locality_name: p.locality?.name || p.locality_name || '',
        property_type_name: p.property_type?.name || p.property_type_name || 'Apartment',
        builder_name: p.builder?.name || p.builder_name || '',
      }));
    }
  }

  return (data || []).map((p) => ({
    ...p,
    is_already_featured: existingFeaturedIds.has(p.id) || !!p.is_featured,
  }));
}

/**
 * Auto-populate featured properties from top existing database properties.
 */
export async function autoPopulateFeaturedProperties(count: number = 6): Promise<number> {
  const { data: props } = await supabase
    .from('properties')
    .select('id, title')
    .order('created_at', { ascending: false })
    .limit(count);

  if (!props || props.length === 0) return 0;

  let added = 0;
  for (let i = 0; i < props.length; i++) {
    await addPropertyToFeatured(props[i].id, {
      priority: i < 2 ? 'High' : 'Medium',
      display_order: i + 1,
    });
    added++;
  }
  return added;
}

/**
 * Add a property to Featured Properties.
 */
export async function addPropertyToFeatured(
  propertyId: string,
  options?: {
    priority?: FeaturedPriority;
    display_order?: number;
    start_at?: string | null;
    end_at?: string | null;
    is_active?: boolean;
  }
): Promise<void> {
  const { data: userAuth } = await supabase.auth.getUser();

  // If display order is not provided, compute current max + 1
  let nextOrder = options?.display_order;
  if (nextOrder == null) {
    const { data: maxRow } = await supabase
      .from('featured_properties')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    nextOrder = (maxRow?.display_order ?? 0) + 1;
  }
  nextOrder = Math.max(1, Number(nextOrder) || 1);

  const payload = {
    property_id: propertyId,
    is_active: options?.is_active ?? true,
    display_order: nextOrder,
    priority: options?.priority ?? 'Medium',
    start_at: options?.start_at ? new Date(options.start_at).toISOString() : null,
    end_at: options?.end_at ? new Date(options.end_at).toISOString() : null,
    created_by: userAuth?.user?.id || null,
    updated_at: new Date().toISOString(),
  };

  try {
    await supabase
      .from('featured_properties')
      .upsert(payload, { onConflict: 'property_id' });
  } catch (err) {
    console.warn('Upsert into featured_properties error, syncing properties table:', err);
  }

  // Sync properties table flag
  await supabase
    .from('properties')
    .update({ is_featured: true, updated_at: new Date().toISOString() })
    .eq('id', propertyId);
}

/**
 * Update an existing featured property configuration.
 */
export async function updateFeaturedProperty(
  id: string,
  updates: Partial<{
    is_active: boolean;
    priority: FeaturedPriority;
    display_order: number;
    start_at: string | null;
    end_at: string | null;
  }>
): Promise<void> {
  const payload: any = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  if (updates.display_order !== undefined) {
    payload.display_order = Math.max(1, Number(updates.display_order) || 1);
  }
  if (updates.start_at !== undefined) {
    payload.start_at = updates.start_at ? new Date(updates.start_at).toISOString() : null;
  }
  if (updates.end_at !== undefined) {
    payload.end_at = updates.end_at ? new Date(updates.end_at).toISOString() : null;
  }

  const { error } = await supabase
    .from('featured_properties')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
}

/**
 * Remove a property from Featured list.
 */
export async function removePropertyFromFeatured(id: string, propertyId?: string): Promise<void> {
  const { error } = await supabase
    .from('featured_properties')
    .delete()
    .eq('id', id);

  if (error) throw error;

  if (propertyId) {
    await supabase
      .from('properties')
      .update({ is_featured: false, updated_at: new Date().toISOString() })
      .eq('id', propertyId);
  }
}

/**
 * Toggle property featured state directly by property_id.
 */
export async function togglePropertyFeatured(
  propertyId: string,
  shouldFeature: boolean,
  priority: FeaturedPriority = 'Medium'
): Promise<void> {
  if (shouldFeature) {
    await addPropertyToFeatured(propertyId, { priority });
  } else {
    await supabase
      .from('featured_properties')
      .delete()
      .eq('property_id', propertyId);

    await supabase
      .from('properties')
      .update({ is_featured: false, updated_at: new Date().toISOString() })
      .eq('id', propertyId);
  }
}

/**
 * Reorder featured properties in batch.
 */
export async function reorderFeaturedProperties(
  items: { id: string; display_order: number }[]
): Promise<void> {
  const promises = items.map((item) =>
    supabase
      .from('featured_properties')
      .update({
        display_order: Math.max(1, Number(item.display_order) || 1),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
  );

  const results = await Promise.all(promises);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error('Error reordering featured properties:', failed.error);
    throw failed.error;
  }
}

/**
 * Bulk activate or deactivate featured properties.
 */
export async function bulkUpdateFeaturedActive(ids: string[], isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('featured_properties')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .in('id', ids);

  if (error) throw error;
}

/**
 * Bulk remove featured properties.
 */
export async function bulkRemoveFeatured(items: { id: string; property_id: string }[]): Promise<void> {
  const ids = items.map((i) => i.id);
  const propertyIds = items.map((i) => i.property_id).filter(Boolean);

  const { error } = await supabase
    .from('featured_properties')
    .delete()
    .in('id', ids);

  if (error) throw error;

  if (propertyIds.length > 0) {
    await supabase
      .from('properties')
      .update({ is_featured: false, updated_at: new Date().toISOString() })
      .in('id', propertyIds);
  }
}
