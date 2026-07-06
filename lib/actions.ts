import { supabase, isSupabaseConfigured } from "./supabase";

// Interfaces
export interface PropertyListing {
  id: string;
  title: string;
  description: string;
  price: number;
  bhk: number;
  area_sqft: number;
  type: "buy" | "rent" | "pg" | "commercial";
  sub_type: "apartment" | "villa" | "plot" | "shop" | "showroom" | "coliving";
  city: string;
  locality: string;
  address?: string;
  is_verified?: boolean;
  is_rera_approved?: boolean;
  rera_id?: string;
  created_by: string;
  image_urls?: string[];
  created_at?: string;
}

// ----------------------------------------------------
// 1. Authentication Services
// ----------------------------------------------------
export async function signInWithOtp(phone: string) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: `+91${phone}`,
    });
    if (error) throw error;
    return { success: true, data };
  } else {
    console.warn("Supabase not configured. Simulating OTP request for +91", phone);
    return { success: true, simulated: true };
  }
}

export async function verifyOtpCode(phone: string, token: string) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: `+91${phone}`,
      token,
      type: "sms",
    });
    if (error) throw error;
    return { success: true, user: data.user, session: data.session };
  } else {
    console.warn("Supabase not configured. Simulating OTP code verification.");
    if (token === "123456") {
      const mockUser = {
        id: "mock-user-uuid-123",
        phone: `+91${phone}`,
        user_metadata: { role: "buyer", full_name: "Mock User" },
      };
      return { success: true, user: mockUser, session: {} };
    } else {
      throw new Error("Invalid OTP code. Please enter 123456.");
    }
  }
}

// ----------------------------------------------------
// 2. Property Postings (with 5-Listing Quota Check)
// ----------------------------------------------------
export async function createPropertyListing(listing: Omit<PropertyListing, "id" | "created_at">) {
  if (isSupabaseConfigured()) {
    // A. Quota limit check
    const { count, error: countError } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("created_by", listing.created_by);

    if (countError) throw countError;

    if (count !== null && count >= 5) {
      throw new Error(`Property posting limit exceeded. You have already posted ${count} properties.`);
    }

    // B. Save listing
    const { data, error } = await supabase
      .from("properties")
      .insert([listing])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } else {
    // LocalStorage Fallback Simulation
    console.warn("Supabase not configured. Using LocalStorage fallback for property creation.");
    const localKey = "realtynow_properties";
    const existingStr = localStorage.getItem(localKey) || "[]";
    const existing: PropertyListing[] = JSON.parse(existingStr);

    // Count user's current posts
    const userCount = existing.filter((item) => item.created_by === listing.created_by).length;

    if (userCount >= 5) {
      throw new Error(`Property posting limit exceeded. You have already posted ${userCount} properties.`);
    }

    const newListing: PropertyListing = {
      ...listing,
      id: `local-prop-${Date.now()}`,
      created_at: new Date().toISOString(),
      is_verified: true, // Auto-verify locally for convenience
    };

    existing.push(newListing);
    localStorage.setItem(localKey, JSON.stringify(existing));
    return { success: true, data: newListing };
  }
}

// ----------------------------------------------------
// 3. Bookmark Favorites Toggler
// ----------------------------------------------------
export async function toggleFavorite(userId: string, propertyId: string) {
  if (isSupabaseConfigured()) {
    // Check if already favorited
    const { data, error } = await supabase
      .from("favorites")
      .select("*")
      .eq("user_id", userId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      // Delete favorite
      const { error: deleteError } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", userId)
        .eq("property_id", propertyId);

      if (deleteError) throw deleteError;
      return { success: true, isFavorited: false };
    } else {
      // Insert favorite
      const { error: insertError } = await supabase
        .from("favorites")
        .insert([{ user_id: userId, property_id: propertyId }]);

      if (insertError) throw insertError;
      return { success: true, isFavorited: true };
    }
  } else {
    // LocalStorage Fallback Simulation
    console.warn("Supabase not configured. Using LocalStorage fallback for favorites.");
    const localKey = `realtynow_favs_${userId}`;
    const existingStr = localStorage.getItem(localKey) || "[]";
    const existing: string[] = JSON.parse(existingStr);

    const index = existing.indexOf(propertyId);
    let isFavorited = false;

    if (index > -1) {
      existing.splice(index, 1);
    } else {
      existing.push(propertyId);
      isFavorited = true;
    }

    localStorage.setItem(localKey, JSON.stringify(existing));
    return { success: true, isFavorited };
  }
}

// ----------------------------------------------------
// 4. Contact Lead Submissions
// ----------------------------------------------------
export async function submitContactRequest(buyerId: string, propertyId: string, message: string) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from("contact_requests")
      .insert([{ buyer_id: buyerId, property_id: propertyId, message }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } else {
    // LocalStorage Fallback Simulation
    console.warn("Supabase not configured. Using LocalStorage fallback for lead capture.");
    const localKey = "realtynow_leads";
    const existingStr = localStorage.getItem(localKey) || "[]";
    const existing = JSON.parse(existingStr);

    const newLead = {
      id: `lead-${Date.now()}`,
      buyer_id: buyerId,
      property_id: propertyId,
      message,
      created_at: new Date().toISOString(),
    };

    existing.push(newLead);
    localStorage.setItem(localKey, JSON.stringify(existing));
    return { success: true, data: newLead };
  }
}
