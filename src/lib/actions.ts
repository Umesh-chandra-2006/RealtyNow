import { supabase, isSupabaseConfigured } from "./supabase";
import { logger } from "./logger";

// Helper to determine if mock credentials and OTP bypass backdoors are active
const isMockAuthEnabled = () => {
  return typeof process !== "undefined" && process.env.ENABLE_MOCK_AUTH === "true";
};

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
export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string,
  phone: string,
  role: string,
) {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        if (isMockAuthEnabled()) {
          logger.warn("Supabase signup failed, falling back to mock user (simulated).", {
            email,
            phone,
            error: error.message,
          });
          return {
            success: true,
            user: { id: "mock-user-uuid-123", email, phone: `+91${phone}` },
            simulated: true,
          };
        }
        throw error;
      }
      if (data.user) {
        // Create user public profile
        const { error: profileError } = await supabase.from("profiles").insert([
          {
            id: data.user.id,
            phone: `+91${phone}`,
            full_name: fullName,
            role,
          },
        ]);
        if (profileError) {
          if (isMockAuthEnabled()) {
            return { success: true, user: data.user, simulated: true };
          }
          throw profileError;
        }
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      if (isMockAuthEnabled()) {
        logger.warn("Supabase signup catch, falling back to mock user.", {
          email,
          error: err.message,
        });
        return {
          success: true,
          user: { id: "mock-user-uuid-123", email, phone: `+91${phone}` },
          simulated: true,
        };
      }
      throw err;
    }
  } else {
    if (!isMockAuthEnabled()) {
      throw new Error(
        "Supabase service is not configured. Real database connections are required in production.",
      );
    }
    // Offline Simulation
    const localUsersKey = "realtynow_registered_users";
    const existingStr =
      typeof window !== "undefined" ? localStorage.getItem(localUsersKey) || "[]" : "[]";
    const existing = JSON.parse(existingStr);

    if (existing.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("An account with this email address already exists.");
    }

    const mockId = crypto.randomUUID ? crypto.randomUUID() : `mock-user-${Date.now()}`;
    const newUser = {
      id: mockId,
      email,
      phone: `+91${phone}`,
      profile: {
        full_name: fullName,
        role,
      },
    };

    // Store user securely without cleartext password
    existing.push(newUser);
    if (typeof window !== "undefined") {
      localStorage.setItem(localUsersKey, JSON.stringify(existing));
    }
    return { success: true, user: newUser };
  }
}

export async function signInWithEmail(email: string, password: string) {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        // Local dev testing bypass fallback if Supabase is configured but user is not in database yet
        if (isMockAuthEnabled() && email === "test@example.com" && password === "password123") {
          const mockUser = {
            id: "mock-user-uuid-123",
            email: "test@example.com",
            phone: "+91 98765 43210",
            profile: { role: "buyer", full_name: "Sandbox User" },
          };
          logger.warn("Simulated test login credentials bypass activated.", { email });
          return { success: true, user: mockUser, simulated: true };
        }
        throw error;
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      if (isMockAuthEnabled() && email === "test@example.com" && password === "password123") {
        const mockUser = {
          id: "mock-user-uuid-123",
          email: "test@example.com",
          phone: "+91 98765 43210",
          profile: { role: "buyer", full_name: "Sandbox User" },
        };
        logger.warn("Simulated test login credentials bypass catch activated.", { email });
        return { success: true, user: mockUser, simulated: true };
      }
      throw err;
    }
  } else {
    if (!isMockAuthEnabled()) {
      throw new Error("Supabase service is not configured.");
    }
    // Local Bypass Sandbox
    if (email === "test@example.com" && password === "password123") {
      const mockUser = {
        id: "mock-user-uuid-123",
        email: "test@example.com",
        phone: "+91 98765 43210",
        profile: { role: "buyer", full_name: "Sandbox User" },
      };
      return { success: true, user: mockUser };
    }

    // Check offline registered users
    const localUsersKey = "realtynow_registered_users";
    const existingStr =
      typeof window !== "undefined" ? localStorage.getItem(localUsersKey) || "[]" : "[]";
    const existing = JSON.parse(existingStr);
    // Since we no longer store passwords, offline mock login simply matches the email
    const matched = existing.find((u: any) => u.email.toLowerCase() === email.toLowerCase());

    if (!matched) {
      throw new Error(
        "Invalid email or password. (For testing, use test@example.com / password123)",
      );
    }

    return { success: true, user: matched };
  }
}

export async function signInWithOtp(phone: string) {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: `+91${phone}`,
      });
      if (error) {
        // Catch SMS provider/gateway issues and trigger simulated fallbacks for dev purposes
        if (
          isMockAuthEnabled() &&
          (error.message.toLowerCase().includes("sms") ||
            error.message.toLowerCase().includes("provider") ||
            error.status === 429)
        ) {
          logger.warn(
            "Supabase Phone provider issues detected. Redirecting to Sandbox simulation.",
            { phone },
          );
          return { success: true, simulated: true, warning: error.message };
        }
        throw error;
      }
      return { success: true, data };
    } catch (err: any) {
      if (isMockAuthEnabled()) {
        logger.warn("Supabase Auth request error, falling back to sandbox.", {
          phone,
          error: err.message,
        });
        return { success: true, simulated: true, warning: err.message };
      }
      throw err;
    }
  } else {
    if (!isMockAuthEnabled()) {
      throw new Error(
        "Supabase service is not configured. Please check server environment variables.",
      );
    }
    logger.warn("Supabase not configured. Simulating OTP request for +91.", { phone });
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
      if (token === "123456" && isMockAuthEnabled()) {
        logger.warn("Supabase verification failed. Bypassing using mock session credentials.", {
          phone,
        });
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
    if (!isMockAuthEnabled()) {
      throw new Error("Local simulator authentication is disabled.");
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
    try {
      // Try to execute atomically via database function RPC if configured on Supabase
      const { data, error: rpcError } = await supabase.rpc("create_property_with_quota", {
        p_listing: listing,
      });
      if (!rpcError) {
        return { success: true, data };
      }
      // If the RPC fails due to quota limit trigger message, throw directly
      if (rpcError.message.includes("posting limit exceeded") || rpcError.code === "P0001") {
        throw rpcError;
      }
      // Otherwise fallback to client-side transactions if function is not defined
    } catch (e: any) {
      if (e.message && e.message.includes("posting limit exceeded")) {
        throw e;
      }
    }

    // Client-side fallback check (Time-of-Check to Time-of-Use race condition risk)
    const { count, error: countError } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("created_by", listing.created_by);

    if (countError) throw countError;

    if (count !== null && count >= 5) {
      throw new Error(
        `Property posting limit exceeded. You have already posted ${count} properties.`,
      );
    }

    // B. Save listing
    const { data, error } = await supabase.from("properties").insert([listing]).select().single();

    if (error) throw error;
    return { success: true, data };
  } else {
    // LocalStorage Fallback Simulation
    logger.warn("Supabase not configured or using mock user session. Saving locally.", {
      created_by: listing.created_by,
    });
    const localKey = "realtynow_properties";
    const existingStr =
      typeof window !== "undefined" ? localStorage.getItem(localKey) || "[]" : "[]";
    const existing: PropertyListing[] = JSON.parse(existingStr);

    // Count user's current posts
    const userCount = existing.filter((item) => item.created_by === listing.created_by).length;

    if (userCount >= 5) {
      throw new Error(
        `Property posting limit exceeded. You have already posted ${userCount} properties.`,
      );
    }

    const newListing: PropertyListing = {
      ...listing,
      id: crypto.randomUUID ? `local-prop-${crypto.randomUUID()}` : `local-prop-${Date.now()}`,
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
    try {
      // Try to toggle atomic state using a database RPC function to prevent race conditions
      const { data: rpcData, error: rpcError } = await supabase.rpc("toggle_favorite_atomic", {
        p_user_id: userId,
        p_property_id: propertyId,
      });
      if (!rpcError) {
        return { success: true, isFavorited: rpcData };
      }
    } catch (e) {
      // Fallback to client-side read-then-write
    }

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
    logger.warn("Supabase not configured or using mock user session. Saving locally.", {
      userId,
      propertyId,
    });
    const localKey = `realtynow_favs_${userId}`;
    const existingStr =
      typeof window !== "undefined" ? localStorage.getItem(localKey) || "[]" : "[]";
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
export async function submitContactRequest(
  buyerId: string,
  propertyId: string | null,
  message: string,
) {
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
    logger.warn("Supabase not configured or using mock user session. Saving locally.", {
      buyerId,
      propertyId,
    });
    const localKey = "realtynow_leads";
    const existingStr =
      typeof window !== "undefined" ? localStorage.getItem(localKey) || "[]" : "[]";
    const existing = JSON.parse(existingStr);

    const newLead = {
      id: crypto.randomUUID ? `lead-${crypto.randomUUID()}` : `lead-${Date.now()}`,
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
        logger.warn(
          "Dedicated service_bookings table not found. Storing in contact_requests lead framework.",
          { error: error.message },
        );
        return await submitContactRequest(
          booking.buyer_id,
          null,
          `[Kaam Kaaka Booking] Service: ${booking.service_type}, BHK: ${booking.bhk_size}, Date: ${booking.preferred_date}, Estimate: ${booking.estimate}, Contact: ${booking.name} (${booking.phone})`,
        );
      }
      return { success: true, data };
    } catch (e: any) {
      logger.error("Exception in submitServiceBooking, falling back to contact_requests:", e);
      return await submitContactRequest(
        booking.buyer_id,
        null,
        `[Kaam Kaaka Booking] Service: ${booking.service_type}, BHK: ${booking.bhk_size}, Date: ${booking.preferred_date}, Estimate: ${booking.estimate}, Contact: ${booking.name} (${booking.phone})`,
      );
    }
  } else {
    // LocalStorage Fallback Simulation
    logger.warn(
      "Supabase not configured or using mock user session. Saving service booking locally.",
      { buyer_id: booking.buyer_id },
    );
    const localKey = "realtynow_service_bookings";
    const existingStr =
      typeof window !== "undefined" ? localStorage.getItem(localKey) || "[]" : "[]";
    const existing = JSON.parse(existingStr);

    const newBooking = {
      id: crypto.randomUUID ? `booking-${crypto.randomUUID()}` : `booking-${Date.now()}`,
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
        logger.warn(
          "Dedicated interior_consultations table not found. Storing in contact_requests lead framework.",
          { error: error.message },
        );
        return await submitContactRequest(
          consult.buyer_id,
          null,
          `[Interior Consultation] Style: ${consult.design_style}, BHK: ${consult.bhk_size}, Estimate: ${consult.estimate}, Contact: ${consult.name} (${consult.phone}, ${consult.email}), Msg: ${consult.message}`,
        );
      }
      return { success: true, data };
    } catch (e: any) {
      logger.error("Exception in submitInteriorConsultation, falling back to contact_requests:", e);
      return await submitContactRequest(
        consult.buyer_id,
        null,
        `[Interior Consultation] Style: ${consult.design_style}, BHK: ${consult.bhk_size}, Estimate: ${consult.estimate}, Contact: ${consult.name} (${consult.phone}, ${consult.email}), Msg: ${consult.message}`,
      );
    }
  } else {
    // LocalStorage Fallback Simulation
    logger.warn(
      "Supabase not configured or using mock user session. Saving consultation request locally.",
      { buyer_id: consult.buyer_id },
    );
    const localKey = "realtynow_interior_consultations";
    const existingStr =
      typeof window !== "undefined" ? localStorage.getItem(localKey) || "[]" : "[]";
    const existing = JSON.parse(existingStr);

    const newConsult = {
      id: crypto.randomUUID ? `consult-${crypto.randomUUID()}` : `consult-${Date.now()}`,
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
