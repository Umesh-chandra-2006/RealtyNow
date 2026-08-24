/**
 * Search Analytics & Telemetry Service
 *
 * Non-blocking logger for search queries, filter combinations, and click tracking.
 */

import { supabase } from './supabase';

export interface SearchLogPayload {
  query: string;
  parsed_intent?: any;
  filters?: any;
  results_count: number;
  city_id?: string;
  session_id?: string;
}

export async function logSearchQuery(payload: SearchLogPayload): Promise<void> {
  try {
    // Non-blocking write to search_logs if table exists, silently catch if not
    const { data: userAuth } = await supabase.auth.getUser();
    await supabase.from('search_logs').insert({
      query: payload.query,
      parsed_intent: payload.parsed_intent,
      filters: payload.filters,
      results_count: payload.results_count,
      city_id: payload.city_id,
      user_id: userAuth?.user?.id || null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Non-blocking telemetry — silently ignore missing table or network error
  }
}
