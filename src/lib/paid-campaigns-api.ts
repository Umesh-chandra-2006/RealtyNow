import { supabase } from './supabase';
import type { Property, Builder } from './types';

export type CampaignType =
  | 'FEATURED_PROPERTIES'
  | 'TWO_COLUMN_SLIDER'
  | 'EXPLORE_BUILDERS'
  | 'SIGNATURE_COLLECTION'
  | 'THREE_COLUMN_PROPERTIES'
  | 'REALTYNOW_EXCLUSIVE';

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'INACTIVE';
export type CampaignPriority = 'High' | 'Medium' | 'Low';

export interface CampaignItemMeta {
  id: string;
  campaign_id: string;
  property_id?: string | null;
  builder_id?: string | null;
  project_id?: string | null;
  title_override?: string | null;
  subtitle_override?: string | null;
  image_override?: string | null;
  badge_override?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  display_order: number;
  is_active: boolean;
  property?: Property & {
    city_name?: string | null;
    locality_name?: string | null;
    property_type_name?: string | null;
    builder_name?: string | null;
  };
  builder?: Builder & {
    city_name?: string | null;
    locality_name?: string | null;
  };
}

export interface PaidCampaign {
  id: string;
  campaign_type: CampaignType;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  badge_label?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  image_url?: string | null;
  status: CampaignStatus;
  is_active: boolean;
  priority: CampaignPriority;
  display_order: number;
  start_at?: string | null;
  end_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  derived_status: CampaignStatus;
  items?: CampaignItemMeta[];
  primary_property?: (Property & {
    city_name?: string | null;
    locality_name?: string | null;
    property_type_name?: string | null;
    builder_name?: string | null;
  }) | null;
  primary_builder?: (Builder & {
    city_name?: string | null;
    locality_name?: string | null;
  }) | null;
}

export const CAMPAIGN_SECTIONS_CONFIG: Record<
  CampaignType,
  {
    label: string;
    description: string;
    badgeDefault: string;
    ctaDefault: string;
    ctaUrlDefault: string;
    route: string;
    hasProperty: boolean;
    hasBuilder: boolean;
  }
> = {
  FEATURED_PROPERTIES: {
    label: 'Featured Properties',
    description: 'Promoted properties with top visibility on the homepage carousel',
    badgeDefault: 'Featured',
    ctaDefault: 'View Details',
    ctaUrlDefault: '/search?featured=true',
    route: '/admin/paid-campaign/featured-properties',
    hasProperty: true,
    hasBuilder: false,
  },
  TWO_COLUMN_SLIDER: {
    label: 'Two Column Slider Properties',
    description: 'Hero-scale 2-column luxury promotional property slider',
    badgeDefault: 'Sponsored',
    ctaDefault: 'View Collection',
    ctaUrlDefault: '/search',
    route: '/admin/paid-campaign/two-column-slider',
    hasProperty: true,
    hasBuilder: false,
  },
  EXPLORE_BUILDERS: {
    label: 'Explore Builders on RealtyNow',
    description: 'Monetized builder showcases with verified projects and branding',
    badgeDefault: 'Verified Builder',
    ctaDefault: 'View Builder',
    ctaUrlDefault: '/builders',
    route: '/admin/paid-campaign/explore-builders',
    hasProperty: false,
    hasBuilder: true,
  },
  SIGNATURE_COLLECTION: {
    label: 'Signature Collection',
    description: 'Curated ultra-luxury homes and prime villas showcase',
    badgeDefault: 'Signature',
    ctaDefault: 'Explore All',
    ctaUrlDefault: '/search?is_luxury=true',
    route: '/admin/paid-campaign/signature-collection',
    hasProperty: true,
    hasBuilder: false,
  },
  THREE_COLUMN_PROPERTIES: {
    label: 'Three Column Properties',
    description: 'Three-column promotional ad banner tiles with high conversion CTAs',
    badgeDefault: 'Featured Ad',
    ctaDefault: 'Explore Spaces',
    ctaUrlDefault: '/search',
    route: '/admin/paid-campaign/three-column-properties',
    hasProperty: true,
    hasBuilder: false,
  },
  REALTYNOW_EXCLUSIVE: {
    label: 'RealtyNow Exclusive',
    description: 'Sponsored flagship projects, launches, and exclusive builder events',
    badgeDefault: 'Exclusive Project',
    ctaDefault: 'Enquire Now',
    ctaUrlDefault: '/search',
    route: '/admin/paid-campaign/realtynow-exclusive',
    hasProperty: true,
    hasBuilder: true,
  },
};

/**
 * Derives operational status from is_active and schedule dates
 */
export function deriveCampaignStatus(c: {
  status?: string;
  is_active: boolean;
  start_at?: string | null;
  end_at?: string | null;
}): CampaignStatus {
  if (c.status === 'DRAFT') return 'DRAFT';
  if (!c.is_active) return 'INACTIVE';
  const now = new Date();
  if (c.start_at && new Date(c.start_at) > now) return 'SCHEDULED';
  if (c.end_at && new Date(c.end_at) < now) return 'EXPIRED';
  return 'ACTIVE';
}

/**
 * Fetch stats across all campaign types for the central dashboard
 */
export async function fetchCampaignDashboardStats() {
  try {
    const { data: campaigns, error } = await supabase
      .from('paid_campaigns')
      .select('id, campaign_type, status, is_active, start_at, end_at');

    if (error || !campaigns) {
      return {
        total: 0,
        active: 0,
        scheduled: 0,
        draft: 0,
        expired: 0,
        inactive: 0,
        byType: {
          FEATURED_PROPERTIES: 0,
          TWO_COLUMN_SLIDER: 0,
          EXPLORE_BUILDERS: 0,
          SIGNATURE_COLLECTION: 0,
          THREE_COLUMN_PROPERTIES: 0,
          REALTYNOW_EXCLUSIVE: 0,
        },
      };
    }

    let active = 0;
    let scheduled = 0;
    let draft = 0;
    let expired = 0;
    let inactive = 0;

    const byType: Record<CampaignType, number> = {
      FEATURED_PROPERTIES: 0,
      TWO_COLUMN_SLIDER: 0,
      EXPLORE_BUILDERS: 0,
      SIGNATURE_COLLECTION: 0,
      THREE_COLUMN_PROPERTIES: 0,
      REALTYNOW_EXCLUSIVE: 0,
    };

    for (const c of campaigns) {
      const st = deriveCampaignStatus(c);
      if (st === 'ACTIVE') active++;
      else if (st === 'SCHEDULED') scheduled++;
      else if (st === 'DRAFT') draft++;
      else if (st === 'EXPIRED') expired++;
      else if (st === 'INACTIVE') inactive++;

      if (c.campaign_type in byType) {
        byType[c.campaign_type as CampaignType]++;
      }
    }

    return {
      total: campaigns.length,
      active,
      scheduled,
      draft,
      expired,
      inactive,
      byType,
    };
  } catch (err) {
    console.error('fetchCampaignDashboardStats error:', err);
    return {
      total: 0,
      active: 0,
      scheduled: 0,
      draft: 0,
      expired: 0,
      inactive: 0,
      byType: {
        FEATURED_PROPERTIES: 0,
        TWO_COLUMN_SLIDER: 0,
        EXPLORE_BUILDERS: 0,
        SIGNATURE_COLLECTION: 0,
        THREE_COLUMN_PROPERTIES: 0,
        REALTYNOW_EXCLUSIVE: 0,
      },
    };
  }
}

/**
 * Fetch all campaigns for Admin Management (optionally filtered by campaign_type)
 */
export async function fetchAdminCampaigns(type?: CampaignType): Promise<PaidCampaign[]> {
  try {
    let q = supabase
      .from('paid_campaigns')
      .select(`
        *,
        items:paid_campaign_items(
          *,
          property:properties(
            *,
            city:cities(name),
            locality:localities(name),
            property_type:property_types(name, category),
            builder:builders(name)
          ),
          builder:builders(
            *,
            cities:city_id(name),
            localities:locality_id(name)
          )
        )
      `)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (type) {
      q = q.eq('campaign_type', type);
    }

    const { data, error } = await q;

    if (error || !data) {
      // Fallback for FEATURED_PROPERTIES if paid_campaigns empty
      if (type === 'FEATURED_PROPERTIES') {
        const { data: legacyRows } = await supabase
          .from('featured_properties')
          .select(`
            *,
            property:properties(
              *,
              city:cities(name),
              locality:localities(name),
              property_type:property_types(name, category),
              builder:builders(name)
            )
          `)
          .order('display_order', { ascending: true });

        if (legacyRows && legacyRows.length > 0) {
          return legacyRows.map((row: any) => {
            const p = row.property || {};
            const flatProp = {
              ...p,
              city_name: p.city?.name || p.city_name || null,
              locality_name: p.locality?.name || p.locality_name || null,
              property_type_name: p.property_type?.name || p.property_type_name || null,
              builder_name: p.builder?.name || p.builder_name || null,
            };
            return {
              id: row.id,
              campaign_type: 'FEATURED_PROPERTIES' as CampaignType,
              title: flatProp.title || 'Featured Property',
              subtitle: [flatProp.locality_name, flatProp.city_name].filter(Boolean).join(', '),
              description: null,
              badge_label: 'Featured',
              cta_label: 'View Details',
              cta_url: `/property/${flatProp.slug || flatProp.id}`,
              image_url: null,
              status: row.is_active ? 'ACTIVE' : 'INACTIVE',
              is_active: row.is_active ?? true,
              priority: row.priority || 'Medium',
              display_order: row.display_order || 1,
              start_at: row.start_at,
              end_at: row.end_at,
              created_by: row.created_by,
              updated_by: null,
              created_at: row.created_at || new Date().toISOString(),
              updated_at: row.updated_at || new Date().toISOString(),
              derived_status: deriveCampaignStatus(row),
              primary_property: flatProp,
              primary_builder: null,
              items: [
                {
                  id: `item-${row.id}`,
                  campaign_id: row.id,
                  property_id: row.property_id,
                  display_order: row.display_order,
                  is_active: row.is_active,
                  property: flatProp,
                },
              ],
            };
          });
        }
      }
      return [];
    }

    return (data || []).map((row: any) => {
      const items = (row.items || []).map((it: any) => {
        const p = it.property;
        const b = it.builder;
        return {
          ...it,
          property: p
            ? {
                ...p,
                city_name: p.city?.name || p.city_name || null,
                locality_name: p.locality?.name || p.locality_name || null,
                property_type_name: p.property_type?.name || p.property_type_name || null,
                builder_name: p.builder?.name || p.builder_name || null,
              }
            : null,
          builder: b
            ? {
                ...b,
                city_name: b.cities?.name || null,
                locality_name: b.localities?.name || null,
              }
            : null,
        };
      });

      const firstItem = items[0] || null;
      const primaryProp = firstItem?.property || null;
      const primaryBuilder = firstItem?.builder || null;

      return {
        ...row,
        derived_status: deriveCampaignStatus(row),
        items,
        primary_property: primaryProp,
        primary_builder: primaryBuilder,
      };
    });
  } catch (err) {
    console.error('fetchAdminCampaigns error:', err);
    return [];
  }
}

/**
 * Fetch active, scheduled campaigns for the Public Homepage section.
 * STRICT SINGLE SOURCE OF TRUTH: ordered by display_order ASC.
 */
export async function fetchPublicCampaigns(type: CampaignType): Promise<any[]> {
  try {
    const now = new Date();

    const { data, error } = await supabase
      .from('paid_campaigns')
      .select(`
        *,
        items:paid_campaign_items(
          *,
          property:properties(
            *,
            city:cities(name),
            locality:localities(name),
            property_type:property_types(name, category),
            builder:builders(name)
          ),
          builder:builders(
            *,
            cities:city_id(name),
            localities:locality_id(name)
          )
        )
      `)
      .eq('campaign_type', type)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const eligible = data.filter((c: any) => {
        if (!c.is_active) return false;
        if (c.status === 'DRAFT') return false;
        if (c.start_at && new Date(c.start_at) > now) return false;
        if (c.end_at && new Date(c.end_at) < now) return false;
        return true;
      });

      if (eligible.length > 0) {
        return eligible.map((c: any) => {
          const firstItem = c.items?.[0] || {};
          const prop = firstItem.property
            ? {
                ...firstItem.property,
                city_name: firstItem.property.city?.name || firstItem.property.city_name || null,
                locality_name: firstItem.property.locality?.name || firstItem.property.locality_name || null,
                property_type_name: firstItem.property.property_type?.name || firstItem.property.property_type_name || null,
                builder_name: firstItem.property.builder?.name || firstItem.property.builder_name || null,
              }
            : null;

          const builder = firstItem.builder
            ? {
                ...firstItem.builder,
                city_name: firstItem.builder.cities?.name || null,
                locality_name: firstItem.builder.localities?.name || null,
              }
            : null;

          return {
            id: c.id,
            campaign_id: c.id,
            campaign_type: c.campaign_type,
            title: firstItem.title_override || c.title || prop?.title || builder?.name || '',
            subtitle: firstItem.subtitle_override || c.subtitle || prop?.locality_name || builder?.description || '',
            description: c.description,
            badge: firstItem.badge_override || c.badge_label || 'Featured',
            cta: firstItem.cta_label || c.cta_label || 'View Details',
            link: firstItem.cta_url || c.cta_url || (prop ? `/property/${prop.slug || prop.id}` : builder ? `/builders/${builder.id}` : '/search'),
            image: firstItem.image_override || c.image_url || prop?.images?.[0] || builder?.cover_image || null,
            tag: firstItem.badge_override || c.badge_label || 'Featured',
            display_order: c.display_order,
            priority: c.priority,
            property: prop,
            builder: builder,
            // Keep direct property properties if rendering as a HomePropertyCard
            ...(prop ? { ...prop, _isFeaturedProperty: true } : {}),
            // Keep builder fields if rendering as a BuilderCard
            ...(builder ? { ...builder, name: builder.name, _cover: builder.cover_image || c.image_url } : {}),
          };
        });
      }
    }

    // Fallback if paid_campaigns table is not yet seeded:
    if (type === 'FEATURED_PROPERTIES') {
      const { data: legacyProps } = await supabase
        .from('featured_properties')
        .select(`
          *,
          property:properties(
            *,
            city:cities(name),
            locality:localities(name),
            property_type:property_types(name, category),
            builder:builders(name)
          )
        `)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (legacyProps && legacyProps.length > 0) {
        return legacyProps.map((r: any) => ({
          ...r.property,
          city_name: r.property?.city?.name || r.property?.city_name || null,
          locality_name: r.property?.locality?.name || r.property?.locality_name || null,
          property_type_name: r.property?.property_type?.name || r.property?.property_type_name || null,
          _isFeaturedProperty: true,
        }));
      }
    }

    return [];
  } catch (err) {
    console.error('fetchPublicCampaigns error:', err);
    return [];
  }
}

/**
 * Create a new Paid Campaign with optional linked property or builder
 */
export async function createCampaign(payload: {
  campaign_type: CampaignType;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  badge_label?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  image_url?: string | null;
  status?: CampaignStatus;
  is_active?: boolean;
  priority?: CampaignPriority;
  display_order?: number;
  start_at?: string | null;
  end_at?: string | null;
  property_id?: string | null;
  builder_id?: string | null;
}): Promise<string> {
  const { data: userAuth } = await supabase.auth.getUser();

  // If display_order not provided, set to max + 1
  let nextOrder = payload.display_order;
  if (nextOrder == null) {
    const { data: maxRow } = await supabase
      .from('paid_campaigns')
      .select('display_order')
      .eq('campaign_type', payload.campaign_type)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    nextOrder = (maxRow?.display_order ?? 0) + 1;
  }
  nextOrder = Math.max(1, Number(nextOrder) || 1);

  const campaignInsert = {
    campaign_type: payload.campaign_type,
    title: payload.title.trim(),
    subtitle: payload.subtitle?.trim() || null,
    description: payload.description?.trim() || null,
    badge_label: payload.badge_label?.trim() || null,
    cta_label: payload.cta_label?.trim() || null,
    cta_url: payload.cta_url?.trim() || null,
    image_url: payload.image_url?.trim() || null,
    status: payload.status || 'ACTIVE',
    is_active: payload.is_active ?? true,
    priority: payload.priority || 'Medium',
    display_order: nextOrder,
    start_at: payload.start_at ? new Date(payload.start_at).toISOString() : null,
    end_at: payload.end_at ? new Date(payload.end_at).toISOString() : null,
    created_by: userAuth?.user?.id || null,
    updated_by: userAuth?.user?.id || null,
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from('paid_campaigns')
    .insert([campaignInsert])
    .select('id')
    .single();

  if (error) throw error;

  const campaignId = created.id;

  // Insert linked item if property or builder provided
  if (payload.property_id || payload.builder_id) {
    await supabase.from('paid_campaign_items').insert([
      {
        campaign_id: campaignId,
        property_id: payload.property_id || null,
        builder_id: payload.builder_id || null,
        display_order: 1,
        is_active: payload.is_active ?? true,
        image_override: payload.image_url || null,
        badge_override: payload.badge_label || null,
        cta_label: payload.cta_label || null,
        cta_url: payload.cta_url || null,
      },
    ]);
  }

  // If FEATURED_PROPERTIES, sync legacy featured_properties table as well for backwards compatibility
  if (payload.campaign_type === 'FEATURED_PROPERTIES' && payload.property_id) {
    try {
      await supabase.from('featured_properties').upsert(
        {
          property_id: payload.property_id,
          is_active: payload.is_active ?? true,
          display_order: nextOrder,
          priority: payload.priority || 'Medium',
          start_at: campaignInsert.start_at,
          end_at: campaignInsert.end_at,
          created_by: userAuth?.user?.id || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'property_id' }
      );
      await supabase
        .from('properties')
        .update({ is_featured: true, updated_at: new Date().toISOString() })
        .eq('id', payload.property_id);
    } catch {
      // Ignore legacy sync failures
    }
  }

  return campaignId;
}

/**
 * Update an existing Paid Campaign
 */
export async function updateCampaign(
  id: string,
  updates: Partial<{
    title: string;
    subtitle: string | null;
    description: string | null;
    badge_label: string | null;
    cta_label: string | null;
    cta_url: string | null;
    image_url: string | null;
    status: CampaignStatus;
    is_active: boolean;
    priority: CampaignPriority;
    display_order: number;
    start_at: string | null;
    end_at: string | null;
    property_id?: string | null;
    builder_id?: string | null;
  }>
): Promise<void> {
  const { data: userAuth } = await supabase.auth.getUser();

  const payload: any = {
    updated_by: userAuth?.user?.id || null,
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) payload.title = updates.title.trim();
  if (updates.subtitle !== undefined) payload.subtitle = updates.subtitle?.trim() || null;
  if (updates.description !== undefined) payload.description = updates.description?.trim() || null;
  if (updates.badge_label !== undefined) payload.badge_label = updates.badge_label?.trim() || null;
  if (updates.cta_label !== undefined) payload.cta_label = updates.cta_label?.trim() || null;
  if (updates.cta_url !== undefined) payload.cta_url = updates.cta_url?.trim() || null;
  if (updates.image_url !== undefined) payload.image_url = updates.image_url?.trim() || null;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.display_order !== undefined) payload.display_order = Math.max(1, Number(updates.display_order) || 1);
  if (updates.start_at !== undefined) payload.start_at = updates.start_at ? new Date(updates.start_at).toISOString() : null;
  if (updates.end_at !== undefined) payload.end_at = updates.end_at ? new Date(updates.end_at).toISOString() : null;

  const { error } = await supabase.from('paid_campaigns').update(payload).eq('id', id);
  if (error) throw error;

  // Update item relationships if property_id or builder_id specified
  if (updates.property_id !== undefined || updates.builder_id !== undefined) {
    const { data: existingItems } = await supabase
      .from('paid_campaign_items')
      .select('id')
      .eq('campaign_id', id);

    if (existingItems && existingItems.length > 0) {
      await supabase
        .from('paid_campaign_items')
        .update({
          property_id: updates.property_id || null,
          builder_id: updates.builder_id || null,
          is_active: updates.is_active ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq('campaign_id', id);
    } else if (updates.property_id || updates.builder_id) {
      await supabase.from('paid_campaign_items').insert([
        {
          campaign_id: id,
          property_id: updates.property_id || null,
          builder_id: updates.builder_id || null,
          display_order: 1,
          is_active: updates.is_active ?? true,
        },
      ]);
    }
  }
}

/**
 * Delete a campaign and its linked items
 */
export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('paid_campaigns').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Duplicate an existing campaign to Draft state with display_order + 1
 */
export async function duplicateCampaign(id: string): Promise<string> {
  const { data: source, error } = await supabase
    .from('paid_campaigns')
    .select('*, items:paid_campaign_items(*)')
    .eq('id', id)
    .single();

  if (error || !source) throw new Error('Source campaign not found');

  const firstItem = source.items?.[0] || null;

  return await createCampaign({
    campaign_type: source.campaign_type,
    title: `${source.title} (Copy)`,
    subtitle: source.subtitle,
    description: source.description,
    badge_label: source.badge_label,
    cta_label: source.cta_label,
    cta_url: source.cta_url,
    image_url: source.image_url,
    status: 'DRAFT',
    is_active: false,
    priority: source.priority,
    start_at: null,
    end_at: null,
    property_id: firstItem?.property_id || null,
    builder_id: firstItem?.builder_id || null,
  });
}

/**
 * Reorder campaigns in batch with strict 1..N order persistence
 */
export async function reorderCampaigns(
  items: { id: string; display_order: number }[]
): Promise<void> {
  const promises = items.map((item) =>
    supabase
      .from('paid_campaigns')
      .update({
        display_order: Math.max(1, Number(item.display_order) || 1),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
  );

  const results = await Promise.all(promises);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

/**
 * Bulk activate or deactivate campaigns
 */
export async function bulkUpdateCampaignsActive(ids: string[], isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('paid_campaigns')
    .update({
      is_active: isActive,
      status: isActive ? 'ACTIVE' : 'INACTIVE',
      updated_at: new Date().toISOString(),
    })
    .in('id', ids);

  if (error) throw error;
}

/**
 * Bulk delete campaigns
 */
export async function bulkDeleteCampaigns(ids: string[]): Promise<void> {
  const { error } = await supabase.from('paid_campaigns').delete().in('id', ids);
  if (error) throw error;
}

/**
 * Search and fetch eligible properties for campaign item assignment
 */
export async function fetchEligiblePropertiesForCampaign(params?: {
  search?: string;
  type?: string;
  purpose?: string;
  cityId?: string;
  limit?: number;
}): Promise<any[]> {
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
  if (params?.cityId && params.cityId !== 'all') {
    q = q.eq('city_id', params.cityId);
  }

  const { data, error } = await q;

  if (error || !data || data.length === 0) {
    const { data: directProps } = await supabase
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

    return (directProps || []).map((p: any) => ({
      ...p,
      city_name: p.city?.name || p.city_name || 'Hyderabad',
      locality_name: p.locality?.name || p.locality_name || '',
      property_type_name: p.property_type?.name || p.property_type_name || 'Apartment',
      builder_name: p.builder?.name || p.builder_name || '',
    }));
  }

  return data || [];
}

/**
 * Search and fetch eligible builders for campaign item assignment
 */
export async function fetchEligibleBuildersForCampaign(search?: string): Promise<any[]> {
  let q = supabase
    .from('builders')
    .select('*, cities:city_id(name), localities:locality_id(name)')
    .eq('status', 'approved')
    .order('name', { ascending: true })
    .limit(50);

  if (search) {
    q = q.ilike('name', `%${search.trim()}%`);
  }

  const { data } = await q;
  return (data || []).map((b: any) => ({
    ...b,
    city_name: b.cities?.name || '',
    locality_name: b.localities?.name || '',
  }));
}

/* ============================================================
   CENTRALIZED PROPERTY SECTION PUBLISHING API
============================================================ */

export interface PropertySectionAssignment {
  campaign_type: CampaignType;
  campaign_id: string;
  is_active: boolean;
  status: CampaignStatus;
  derived_status: CampaignStatus;
  display_order: number;
  priority: CampaignPriority;
  start_at?: string | null;
  end_at?: string | null;
  created_at?: string;
  badge_label?: string | null;
}

/**
 * Fetch campaign section assignments for a batch of property IDs.
 * Fast, single-query lookup without N+1 overhead.
 */
export async function fetchBatchPropertyCampaignAssignments(
  propertyIds: string[]
): Promise<Record<string, PropertySectionAssignment[]>> {
  const result: Record<string, PropertySectionAssignment[]> = {};
  if (!propertyIds || propertyIds.length === 0) return result;

  // Initialize empty arrays
  for (const id of propertyIds) {
    result[id] = [];
  }

  try {
    // 1. Fetch from paid_campaign_items joined with paid_campaigns
    const { data: campaignItems, error } = await supabase
      .from('paid_campaign_items')
      .select(`
        id,
        property_id,
        campaign_id,
        display_order,
        is_active,
        campaign:paid_campaigns(
          id,
          campaign_type,
          status,
          is_active,
          priority,
          display_order,
          start_at,
          end_at,
          created_at,
          badge_label
        )
      `)
      .in('property_id', propertyIds);

    if (!error && campaignItems) {
      for (const item of campaignItems) {
        if (!item.property_id || !item.campaign) continue;
        const c: any = Array.isArray(item.campaign) ? item.campaign[0] : item.campaign;
        if (!c || !c.campaign_type) continue;

        const derived = deriveCampaignStatus(c);
        const existing = result[item.property_id] || [];

        // Avoid duplicate section entries for the same property
        const alreadyExists = existing.some((e) => e.campaign_type === c.campaign_type);
        if (!alreadyExists) {
          existing.push({
            campaign_type: c.campaign_type as CampaignType,
            campaign_id: c.id,
            is_active: c.is_active && item.is_active,
            status: c.status || 'ACTIVE',
            derived_status: derived,
            display_order: c.display_order ?? item.display_order ?? 1,
            priority: c.priority || 'Medium',
            start_at: c.start_at,
            end_at: c.end_at,
            created_at: c.created_at,
            badge_label: c.badge_label,
          });
          result[item.property_id] = existing;
        }
      }
    }

    // 2. Fetch from legacy featured_properties table to ensure backwards compatibility
    const { data: legacyFeatured } = await supabase
      .from('featured_properties')
      .select('*')
      .in('property_id', propertyIds);

    if (legacyFeatured && legacyFeatured.length > 0) {
      for (const feat of legacyFeatured) {
        if (!feat.property_id) continue;
        const existing = result[feat.property_id] || [];
        const hasFeatured = existing.some((e) => e.campaign_type === 'FEATURED_PROPERTIES');
        if (!hasFeatured) {
          const derived = deriveCampaignStatus(feat);
          existing.push({
            campaign_type: 'FEATURED_PROPERTIES',
            campaign_id: feat.id,
            is_active: feat.is_active ?? true,
            status: feat.is_active ? 'ACTIVE' : 'INACTIVE',
            derived_status: derived,
            display_order: feat.display_order || 1,
            priority: feat.priority || 'Medium',
            start_at: feat.start_at,
            end_at: feat.end_at,
            created_at: feat.created_at,
            badge_label: 'Featured',
          });
          result[feat.property_id] = existing;
        }
      }
    }
  } catch (err) {
    console.error('fetchBatchPropertyCampaignAssignments error:', err);
  }

  return result;
}

/**
 * Fetch campaign section assignments for a single property
 */
export async function fetchPropertyCampaignAssignments(
  propertyId: string
): Promise<PropertySectionAssignment[]> {
  const batch = await fetchBatchPropertyCampaignAssignments([propertyId]);
  return batch[propertyId] || [];
}

/**
 * Toggle or update a property's assignment to a specific Homepage Section.
 * Guarantees single source of truth and immediate persistence to Supabase.
 */
export async function togglePropertyCampaignAssignment({
  propertyId,
  campaignType,
  assign,
  options,
}: {
  propertyId: string;
  campaignType: CampaignType;
  assign: boolean;
  options?: {
    is_active?: boolean;
    priority?: CampaignPriority;
    start_at?: string | null;
    end_at?: string | null;
    display_order?: number;
    badge_label?: string | null;
  };
}): Promise<void> {
  const { data: userAuth } = await supabase.auth.getUser();
  const userId = userAuth?.user?.id || null;

  if (assign) {
    // 1. Check if an assignment already exists in paid_campaign_items for this property & type
    const { data: existingItems } = await supabase
      .from('paid_campaign_items')
      .select('id, campaign_id, campaign:paid_campaigns(id, campaign_type)')
      .eq('property_id', propertyId);

    const match = (existingItems || []).find((it: any) => {
      const c = Array.isArray(it.campaign) ? it.campaign[0] : it.campaign;
      return c?.campaign_type === campaignType;
    });

    if (match) {
      // Re-activate and update existing campaign
      await updateCampaign(match.campaign_id, {
        is_active: options?.is_active ?? true,
        status: (options?.is_active ?? true) ? 'ACTIVE' : 'INACTIVE',
        priority: options?.priority,
        start_at: options?.start_at,
        end_at: options?.end_at,
        display_order: options?.display_order,
        badge_label: options?.badge_label,
      });
    } else {
      // Fetch property details to create a title & metadata
      const { data: prop } = await supabase
        .from('properties')
        .select('id, title, city_id, locality_id, images, price, purpose')
        .eq('id', propertyId)
        .single();

      const config = CAMPAIGN_SECTIONS_CONFIG[campaignType];
      const title = prop?.title || `${config.label} Listing`;

      await createCampaign({
        campaign_type: campaignType,
        title,
        subtitle: null,
        badge_label: options?.badge_label || config.badgeDefault,
        cta_label: config.ctaDefault,
        cta_url: `/property/${propertyId}`,
        image_url: Array.isArray(prop?.images) && prop?.images.length > 0 ? prop.images[0] : null,
        status: 'ACTIVE',
        is_active: options?.is_active ?? true,
        priority: options?.priority || 'Medium',
        display_order: options?.display_order,
        start_at: options?.start_at || null,
        end_at: options?.end_at || null,
        property_id: propertyId,
      });
    }

    // If FEATURED_PROPERTIES, sync legacy featured_properties table & is_featured flag
    if (campaignType === 'FEATURED_PROPERTIES') {
      try {
        await supabase.from('featured_properties').upsert(
          {
            property_id: propertyId,
            is_active: options?.is_active ?? true,
            priority: options?.priority || 'Medium',
            start_at: options?.start_at ? new Date(options.start_at).toISOString() : null,
            end_at: options?.end_at ? new Date(options.end_at).toISOString() : null,
            created_by: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'property_id' }
        );
        await supabase
          .from('properties')
          .update({ is_featured: true, updated_at: new Date().toISOString() })
          .eq('id', propertyId);
      } catch (err) {
        console.warn('Legacy featured sync error:', err);
      }
    }

    // Log to audit_logs
    try {
      await supabase.from('audit_logs').insert([
        {
          actor_id: userId,
          action: 'PUBLISHED',
          entity: 'property_section',
          entity_id: propertyId,
          metadata: { campaign_type: campaignType, ...options },
        },
      ]);
    } catch {
      // ignore audit log failure
    }
  } else {
    // UNPUBLISH / REMOVE
    // 1. Find and delete campaign item & campaign
    const { data: existingItems } = await supabase
      .from('paid_campaign_items')
      .select('id, campaign_id, campaign:paid_campaigns(id, campaign_type)')
      .eq('property_id', propertyId);

    if (existingItems) {
      for (const it of existingItems) {
        const c: any = Array.isArray(it.campaign) ? it.campaign[0] : it.campaign;
        if (c?.campaign_type === campaignType) {
          await supabase.from('paid_campaign_items').delete().eq('id', it.id);
          await supabase.from('paid_campaigns').delete().eq('id', it.campaign_id);
        }
      }
    }

    // If FEATURED_PROPERTIES, remove from legacy featured_properties & unset is_featured
    if (campaignType === 'FEATURED_PROPERTIES') {
      try {
        await supabase.from('featured_properties').delete().eq('property_id', propertyId);
        await supabase
          .from('properties')
          .update({ is_featured: false, updated_at: new Date().toISOString() })
          .eq('id', propertyId);
      } catch (err) {
        console.warn('Legacy featured remove error:', err);
      }
    }

    // Log to audit_logs
    try {
      await supabase.from('audit_logs').insert([
        {
          actor_id: userId,
          action: 'UNPUBLISHED',
          entity: 'property_section',
          entity_id: propertyId,
          metadata: { campaign_type: campaignType },
        },
      ]);
    } catch {
      // ignore audit log failure
    }
  }
}

/**
 * Bulk assign multiple properties to one or more homepage sections
 */
export async function bulkAssignPropertiesToSections({
  propertyIds,
  campaignTypes,
  options,
}: {
  propertyIds: string[];
  campaignTypes: CampaignType[];
  options?: {
    is_active?: boolean;
    priority?: CampaignPriority;
  };
}): Promise<{ successCount: number; failedCount: number }> {
  let successCount = 0;
  let failedCount = 0;

  for (const propertyId of propertyIds) {
    for (const campaignType of campaignTypes) {
      try {
        await togglePropertyCampaignAssignment({
          propertyId,
          campaignType,
          assign: true,
          options,
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to assign property ${propertyId} to ${campaignType}:`, err);
        failedCount++;
      }
    }
  }

  return { successCount, failedCount };
}

/**
 * Bulk remove multiple properties from one or more homepage sections
 */
export async function bulkRemovePropertiesFromSections({
  propertyIds,
  campaignTypes,
}: {
  propertyIds: string[];
  campaignTypes: CampaignType[];
}): Promise<{ successCount: number; failedCount: number }> {
  let successCount = 0;
  let failedCount = 0;

  for (const propertyId of propertyIds) {
    for (const campaignType of campaignTypes) {
      try {
        await togglePropertyCampaignAssignment({
          propertyId,
          campaignType,
          assign: false,
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to remove property ${propertyId} from ${campaignType}:`, err);
        failedCount++;
      }
    }
  }

  return { successCount, failedCount };
}
