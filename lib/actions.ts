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
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: `+91${phone}`,
      });
      if (error) {
        // Catch SMS provider/gateway issues and trigger simulated fallbacks for dev purposes
        if (
          process.env.NODE_ENV !== "production" &&
          (error.message.toLowerCase().includes("sms") || 
           error.message.toLowerCase().includes("provider") || 
           error.status === 429)
        ) {
          console.warn("Supabase Phone provider issues detected. Redirecting to Sandbox simulation.");
          return { success: true, simulated: true, warning: error.message };
        }
        throw error;
      }
      return { success: true, data };
    } catch (err: any) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Supabase Auth request error, falling back to sandbox:", err.message);
        return { success: true, simulated: true, warning: err.message };
      }
      throw err;
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Supabase service is not configured. Please check server environment variables.");
    }
    console.warn("Supabase not configured. Simulating OTP request for +91", phone.replace(/.(?=.{4})/g, "*"));
    return { success: true, simulated: true };
  }
}

export async function verifyOtpCode(phone: string, token: string, isSimulated: boolean = false) {
  if (isSupabaseConfigured() && !isSimulated) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: `+91${phone}`,
        token,
        type: "sms",
      });
      if (error) throw error;
      return { success: true, user: data.user, session: data.session };
    } catch (err: any) {
      // Backdoor bypass logic for dev tests (e.g. if SMS provider fails to register verification codes)
      if (token === "123456" && process.env.NODE_ENV !== "production") {
        console.warn("Supabase verification failed. Bypassing using mock session credentials.");
        const mockUser = {
          id: "mock-user-uuid-123",
          phone: `+91${phone}`,
          user_metadata: { role: "buyer", full_name: "Sandbox User" },
        };
        return { success: true, user: mockUser, session: {}, bypassed: true };
      }
      throw err;
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Local simulator authentication is disabled in production.");
    }
    // Local / Simulator authentication
    if (token === "123456") {
      const mockUser = {
        id: "mock-user-uuid-123",
        phone: `+91${phone}`,
        user_metadata: { role: "buyer", full_name: "Sandbox User" },
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
  if (isSupabaseConfigured() && !listing.created_by.startsWith("mock-")) {
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
    console.warn("Supabase not configured or using mock user session. Saving locally.");
    const localKey = "realtynow_properties";
    const existingStr = typeof window !== "undefined" ? localStorage.getItem(localKey) || "[]" : "[]";
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
    if (typeof window !== "undefined") {
      localStorage.setItem(localKey, JSON.stringify(existing));
    }
    return { success: true, data: newListing };
  }
}

// ----------------------------------------------------
// 3. Bookmark Favorites Toggler
// ----------------------------------------------------
export async function toggleFavorite(userId: string, propertyId: string) {
  if (isSupabaseConfigured() && !userId.startsWith("mock-")) {
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
    console.warn("Supabase not configured or using mock user session. Saving locally.");
    const localKey = `realtynow_favs_${userId}`;
    const existingStr = typeof window !== "undefined" ? localStorage.getItem(localKey) || "[]" : "[]";
    const existing: string[] = JSON.parse(existingStr);

    const index = existing.indexOf(propertyId);
    let isFavorited = false;

    if (index > -1) {
      existing.splice(index, 1);
    } else {
      existing.push(propertyId);
      isFavorited = true;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(localKey, JSON.stringify(existing));
    }
    return { success: true, isFavorited };
  }
}

// ----------------------------------------------------
// 4. Contact Lead Submissions
// ----------------------------------------------------
export async function submitContactRequest(buyerId: string, propertyId: string | null, message: string) {
  if (isSupabaseConfigured() && !buyerId.startsWith("mock-")) {
    const { data, error } = await supabase
      .from("contact_requests")
      .insert([{ buyer_id: buyerId, property_id: propertyId || null, message }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } else {
    // LocalStorage Fallback Simulation
    console.warn("Supabase not configured or using mock user session. Saving locally.");
    const localKey = "realtynow_leads";
    const existingStr = typeof window !== "undefined" ? localStorage.getItem(localKey) || "[]" : "[]";
    const existing = JSON.parse(existingStr);

    const newLead = {
      id: `lead-${Date.now()}`,
      buyer_id: buyerId,
      property_id: propertyId,
      message,
      created_at: new Date().toISOString(),
    };

    existing.push(newLead);
    if (typeof window !== "undefined") {
      localStorage.setItem(localKey, JSON.stringify(existing));
    }
    return { success: true, data: newLead };
  }
}

// ----------------------------------------------------
// 5. Kaam Kaaka Service Bookings
// ----------------------------------------------------
export async function submitServiceBooking(booking: {
  buyer_id: string;
  service_type: string;
  bhk_size: string;
  moving_from?: string;
  moving_to?: string;
  name: string;
  phone: string;
  preferred_date: string;
  estimate: string;
}) {
  if (isSupabaseConfigured() && !booking.buyer_id.startsWith("mock-")) {
    try {
      const { data, error } = await supabase
        .from("service_bookings")
        .insert([booking])
        .select()
        .single();
      
      if (error) {
        console.warn("Dedicated service_bookings table not found. Storing in contact_requests lead framework.");
        return await submitContactRequest(
          booking.buyer_id,
          null,
          `[Kaam Kaaka Booking] Service: ${booking.service_type}, BHK: ${booking.bhk_size}, Date: ${booking.preferred_date}, Estimate: ${booking.estimate}, Contact: ${booking.name} (${booking.phone})`
        );
      }
      return { success: true, data };
    } catch (e) {
      return await submitContactRequest(
        booking.buyer_id,
        null,
        `[Kaam Kaaka Booking] Service: ${booking.service_type}, BHK: ${booking.bhk_size}, Date: ${booking.preferred_date}, Estimate: ${booking.estimate}, Contact: ${booking.name} (${booking.phone})`
      );
    }
  } else {
    // LocalStorage Fallback Simulation
    console.warn("Supabase not configured or using mock user session. Saving service booking locally.");
    const localKey = "realtynow_service_bookings";
    const existingStr = typeof window !== "undefined" ? localStorage.getItem(localKey) || "[]" : "[]";
    const existing = JSON.parse(existingStr);

    const newBooking = {
      id: `booking-${Date.now()}`,
      ...booking,
      created_at: new Date().toISOString(),
    };

    existing.push(newBooking);
    if (typeof window !== "undefined") {
      localStorage.setItem(localKey, JSON.stringify(existing));
    }
    return { success: true, data: newBooking };
  }
}

// ----------------------------------------------------
// 6. Interior Design Consultations
// ----------------------------------------------------
export async function submitInteriorConsultation(consult: {
  buyer_id: string;
  bhk_size: string;
  design_style: string;
  name: string;
  phone: string;
  email: string;
  message?: string;
  estimate: string;
}) {
  if (isSupabaseConfigured() && !consult.buyer_id.startsWith("mock-")) {
    try {
      const { data, error } = await supabase
        .from("interior_consultations")
        .insert([consult])
        .select()
        .single();
      
      if (error) {
        console.warn("Dedicated interior_consultations table not found. Storing in contact_requests lead framework.");
        return await submitContactRequest(
          consult.buyer_id,
          null,
          `[Interior Consultation] Style: ${consult.design_style}, BHK: ${consult.bhk_size}, Estimate: ${consult.estimate}, Contact: ${consult.name} (${consult.phone}, ${consult.email}), Msg: ${consult.message}`
        );
      }
      return { success: true, data };
    } catch (e) {
      return await submitContactRequest(
        consult.buyer_id,
        null,
        `[Interior Consultation] Style: ${consult.design_style}, BHK: ${consult.bhk_size}, Estimate: ${consult.estimate}, Contact: ${consult.name} (${consult.phone}, ${consult.email}), Msg: ${consult.message}`
      );
    }
  } else {
    // LocalStorage Fallback Simulation
    console.warn("Supabase not configured or using mock user session. Saving consultation request locally.");
    const localKey = "realtynow_interior_consultations";
    const existingStr = typeof window !== "undefined" ? localStorage.getItem(localKey) || "[]" : "[]";
    const existing = JSON.parse(existingStr);

    const newConsult = {
      id: `consult-${Date.now()}`,
      ...consult,
      created_at: new Date().toISOString(),
    };

    existing.push(newConsult);
    if (typeof window !== "undefined") {
      localStorage.setItem(localKey, JSON.stringify(existing));
    }
    return { success: true, data: newConsult };
  }
}
