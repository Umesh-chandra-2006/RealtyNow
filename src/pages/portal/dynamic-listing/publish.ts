import { supabase } from '../../../lib/supabase';
import { markDraftSubmitted } from '../../../lib/listing-drafts';
import { triggerAiVerification, triggerPropertySeoGeneration } from '../../../lib/properties';
import { ensureUserProfile } from '../../../lib/profile-utils';
import { validatePropertyPrice, isPropertyPublishable } from '../../../lib/price-validation';
import { RENT_LIKE_PURPOSES } from '../../../lib/utils';
import type { ListingPurpose, WorkflowField } from '../../../lib/listing-config';

interface PublishParams {
  draftId: string;
  ownerId: string;
  purpose: ListingPurpose;
  answers: Record<string, unknown>;
  allFields: WorkflowField[];
}

/**
 * Maps a listing_drafts.answers blob into a normal `properties` insert using
 * each field's maps_to ('properties.<column>' or 'features.<key>'), so the
 * result flows into the existing admin approval pipeline / v_properties_search
 * / my-properties unmodified.
 */
export async function publishDraft({ draftId, ownerId, purpose, answers, allFields }: PublishParams): Promise<string> {
  const payload: Record<string, unknown> = {
    owner_id: ownerId,
    listed_by_user_id: ownerId,
    purpose: purpose.properties_purpose_value,
    status: 'submitted',
    approval_status: 'Pending',
    is_live: false,
    is_draft: false,
  };
  const features: Record<string, unknown> = {};

  for (const field of allFields) {
    if (!field.maps_to) continue;
    const value = answers[field.field_key];
    if (value === undefined) continue;

    if (field.maps_to === 'properties.location') {
      const loc = value as { 
        city_id?: string; locality_id?: string; address?: string;
        location_name?: string; area?: string; locality?: string; city?: string; district?: string;
        state?: string; country?: string; postal_code?: string;
        latitude?: number | null; longitude?: number | null;
        google_place_id?: string; formatted_address?: string;
      };
      if (loc.city_id) payload.city_id = loc.city_id;
      if (loc.locality_id) payload.locality_id = loc.locality_id;
      if (loc.address) payload.address = loc.address;
      if (loc.location_name) payload.location_name = loc.location_name;
      if (loc.area) payload.area = loc.area;
      if (loc.locality) payload.locality = loc.locality;
      if (loc.city) payload.city = loc.city;
      if (loc.district) payload.district = loc.district;
      if (loc.state) payload.state = loc.state;
      if (loc.country) payload.country = loc.country;
      if (loc.postal_code) payload.pincode = loc.postal_code; // maps to existing pincode
      if (loc.latitude) payload.latitude = loc.latitude;
      if (loc.longitude) payload.longitude = loc.longitude;
      if (loc.google_place_id) payload.place_id = loc.google_place_id; // maps to existing place_id
      if (loc.formatted_address) payload.formatted_address = loc.formatted_address;
      continue;
    }

    if (field.maps_to.startsWith('properties.')) {
      const column = field.maps_to.slice('properties.'.length);
      if (field.field_type === 'file') {
        payload[column] = (value as { url: string }[]).map((v) => v.url);
      } else {
        payload[column] = value;
      }
      continue;
    }

    if (field.maps_to.startsWith('features.')) {
      const key = field.maps_to.slice('features.'.length);
      features[key] = value;
    }
  }

  payload.features = features;
  payload.submission_id = draftId;

  // Strict price validation before submitting to database
  const isRent = RENT_LIKE_PURPOSES.includes(purpose.properties_purpose_value);
  const priceValue = isRent ? payload.rent_amount : payload.price;
  const priceError = validatePropertyPrice(priceValue);
  if (priceError) {
    throw new Error(`This property cannot be submitted because the price is invalid: ${priceError}`);
  }

  if (ownerId) {
    await ensureUserProfile(ownerId);
  }

  const executeUpsert = async () => {
    const { data, error } = await supabase
      .from('properties')
      .upsert(payload, { onConflict: 'submission_id' })
      .select('id')
      .single();
    if (error) throw error;
    return data;
  };

  let data: { id: string } | null = null;
  try {
    data = (await executeUpsert()) as { id: string };
  } catch (err: any) {
    if (err?.message?.includes('profiles_fkey') || err?.code === '23503') {
      await ensureUserProfile(ownerId);
      data = (await executeUpsert()) as { id: string };
    } else {
      throw err;
    }
  }

  const propertyId = (data as { id: string }).id;
  await markDraftSubmitted(draftId, propertyId);
  triggerAiVerification(propertyId);
  triggerPropertySeoGeneration(propertyId);
  return propertyId;
}
