import { supabase } from './supabase';
import type { Property } from './types';

const COMPARE_KEY = 'realtynow_compare_ids';
const MAX_COMPARE_ITEMS = 4;

export function getCompareIds(): string[] {
  try {
    const raw = localStorage.getItem(COMPARE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveCompareIds(ids: string[]) {
  try {
    const unique = Array.from(new Set(ids)).slice(0, MAX_COMPARE_ITEMS);
    localStorage.setItem(COMPARE_KEY, JSON.stringify(unique));
    window.dispatchEvent(
      new CustomEvent('realtynow-compare-updated', { detail: { count: unique.length, ids: unique } }),
    );
  } catch {
    /* ignore */
  }
}

// Silent version — writes to localStorage without firing the event (used internally to avoid loops)
function saveCompareIdsSilent(ids: string[]) {
  try {
    const unique = Array.from(new Set(ids)).slice(0, MAX_COMPARE_ITEMS);
    localStorage.setItem(COMPARE_KEY, JSON.stringify(unique));
  } catch {
    /* ignore */
  }
}

export function isCompared(id: string): boolean {
  return getCompareIds().includes(id);
}

export async function toggleCompareProperty(propertyId: string, userId?: string | null): Promise<boolean> {
  const current = getCompareIds();
  const exists = current.includes(propertyId);

  let updated: string[];
  if (exists) {
    updated = current.filter((i) => i !== propertyId);
    if (userId) {
      await supabase
        .from('compare')
        .delete()
        .eq('user_id', userId)
        .eq('property_id', propertyId)
        .then(
          () => {},
          () => {},
        );
    }
  } else {
    if (current.length >= MAX_COMPARE_ITEMS) {
      throw new Error(`You can compare up to ${MAX_COMPARE_ITEMS} properties at a time.`);
    }
    updated = [...current, propertyId];
    if (userId) {
      await supabase
        .from('compare')
        .insert({ user_id: userId, property_id: propertyId })
        .then(
          () => {},
          () => {},
        );
    }
  }

  saveCompareIds(updated);
  return !exists;
}

export async function clearCompareList(userId?: string | null) {
  saveCompareIds([]);
  if (userId) {
    await supabase
      .from('compare')
      .delete()
      .eq('user_id', userId)
      .then(
        () => {},
        () => {},
      );
  }
}

export async function fetchComparedProperties(userId?: string | null): Promise<Property[]> {
  const localIds = getCompareIds();
  let dbIds: string[] = [];

  if (userId) {
    const { data } = await supabase.from('compare').select('property_id').eq('user_id', userId);
    if (data) {
      dbIds = data.map((d) => d.property_id);
    }
  }

  const allIds = Array.from(new Set([...localIds, ...dbIds])).slice(0, MAX_COMPARE_ITEMS);
  if (allIds.length === 0) return [];

  // Sync local storage silently — do NOT dispatch event here or it creates infinite loops in listeners
  saveCompareIdsSilent(allIds);

  const { data, error } = await supabase
    .from('v_properties_search')
    .select('*')
    .in('id', allIds);

  if (error || !data) return [];

  return data as unknown as Property[];
}
