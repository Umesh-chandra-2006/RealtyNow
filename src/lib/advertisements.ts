import { supabase } from './supabase';

export interface Advertisement {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  ad_type: string;
  position: string;
  image_url?: string;
  mobile_image?: string;
  redirect_url?: string;
  button_text?: string;
  html_content?: string;
  video_url?: string;
  priority: number;
  display_order: number;
  status: string;
  start_date?: string;
  end_date?: string;
  target_page: string;
  target_city: string;
  target_property_type: string;
  device_type: string;
  impressions: number;
  clicks: number;
  ctr: number;
  created_at: string;
}

/**
 * Fetch active advertisements based on the current page and position.
 */
export async function fetchActiveAdvertisements(
  page: string,
  position: string,
  deviceType: 'Desktop' | 'Mobile' | 'All Devices' = 'All Devices'
) {
  const { data, error } = await supabase.rpc('get_active_advertisements', {
    p_target_page: page,
    p_position: position,
    p_device_type: deviceType,
  });

  if (error) {
    console.error('Error fetching advertisements:', error);
    return [];
  }
  return data as Advertisement[];
}

/**
 * Increment the impression counter for an advertisement.
 */
export async function trackAdImpression(adId: string) {
  // Routed through track-analytics so anonymous events are throttled per-IP.
  const { error } = await supabase.functions.invoke('track-analytics', {
    body: { action: 'impression', ad_id: adId },
  });
  if (error) {
    console.error('Error tracking ad impression:', error);
  }
}

/**
 * Increment the click counter for an advertisement.
 */
export async function trackAdClick(adId: string) {
  // Routed through track-analytics so anonymous events are throttled per-IP.
  const { error } = await supabase.functions.invoke('track-analytics', {
    body: { action: 'click', ad_id: adId },
  });
  if (error) {
    console.error('Error tracking ad click:', error);
  }
}
