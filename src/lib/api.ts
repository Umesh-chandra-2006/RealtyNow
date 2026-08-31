import { supabase } from './supabase';
import { ensureUserProfile } from './profile-utils';
import type { Profile, Property, Enquiry, Appointment, Blog } from './types';

export async function withErrorHandling<T>(fn: () => Promise<T>, context = 'API request'): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : `${context} failed`;
    console.error(`[${context}]`, err);
    throw new Error(message);
  }
}

export async function createProperty(property: Partial<Property>) {
  return withErrorHandling(async () => {
    if (property.owner_id) {
      await ensureUserProfile(property.owner_id);
    }
    const executeInsert = async () => {
      const { data, error } = await supabase.from('properties').insert(property).select().single();
      if (error) throw error;
      return data as Property;
    };
    try {
      return await executeInsert();
    } catch (err: any) {
      if (err?.message?.includes('profiles_fkey') || err?.code === '23503') {
        await ensureUserProfile(property.owner_id);
        return await executeInsert();
      }
      throw err;
    }
  }, 'createProperty');
}

export async function updateProperty(id: string, updates: Partial<Property>) {
  return withErrorHandling(async () => {
    const { data, error } = await supabase.from('properties').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as Property;
  }, 'updateProperty');
}

export async function deleteProperty(id: string) {
  return withErrorHandling(async () => {
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) throw error;
  }, 'deleteProperty');
}

export async function fetchProfile(userId: string) {
  return withErrorHandling(async () => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  }, 'fetchProfile');
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  return withErrorHandling(async () => {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
    if (error) throw error;
    return data as Profile;
  }, 'updateProfile');
}

export async function fetchEnquiries(userId?: string) {
  return withErrorHandling(async () => {
    let q = supabase.from('enquiries').select('*, properties(id, title, images)');
    if (userId) q = q.or(`customer_id.eq.${userId},agent_id.eq.${userId},assigned_to.eq.${userId}`);
    const { data, error } = await q;
    if (error) throw error;
    return data as Enquiry[];
  }, 'fetchEnquiries');
}

export async function createEnquiry(enquiry: Partial<Enquiry>) {
  return withErrorHandling(async () => {
    const { data, error } = await supabase.from('enquiries').insert(enquiry).select().single();
    if (error) throw error;
    return data as Enquiry;
  }, 'createEnquiry');
}

export async function fetchAppointments(userId?: string) {
  return withErrorHandling(async () => {
    let q = supabase.from('appointments').select('*, properties(id, title)');
    if (userId) q = q.or(`customer_id.eq.${userId},agent_id.eq.${userId}`);
    const { data, error } = await q;
    if (error) throw error;
    return data as Appointment[];
  }, 'fetchAppointments');
}

export async function createAppointment(appointment: Partial<Appointment>) {
  return withErrorHandling(async () => {
    const { data, error } = await supabase.from('appointments').insert(appointment).select().single();
    if (error) throw error;
    return data as Appointment;
  }, 'createAppointment');
}

export async function fetchBlogs() {
  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from('blogs')
      .select('*')
      .eq('published', true)
      .order('published_at', { ascending: false });
    if (error) throw error;
    return data as Blog[];
  }, 'fetchBlogs');
}

export async function fetchBlogBySlug(slug: string) {
  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from('blogs')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle();
    if (error) throw error;
    return data as Blog | null;
  }, 'fetchBlogBySlug');
}
