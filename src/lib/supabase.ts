import { createClient } from "@supabase/supabase-js";
import { cache } from "react";

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Decode JWT to extract project reference ID
const getSupabaseRefFromKey = (key: string): string | null => {
  try {
    const parts = key.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];

    // Decode base64 string safely across client & server Node.js processes
    const decoded =
      typeof window !== "undefined"
        ? atob(payload)
        : Buffer.from(payload, "base64").toString("utf-8");

    const parsed = JSON.parse(decoded);
    return parsed.ref || null;
  } catch (e) {
    return null;
  }
};

// Check if URL is valid HTTP/HTTPS format
const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (e) {
    return false;
  }
};

// Reconstruct derived URL if env URL is invalid
const derivedRef = getSupabaseRefFromKey(envAnonKey);
const derivedUrl = derivedRef ? `https://${derivedRef}.supabase.co` : "";

if (
  process.env.NODE_ENV === "production" &&
  (!envAnonKey || (!isValidUrl(envUrl) && !isValidUrl(derivedUrl)))
) {
  throw new Error(
    "Missing or invalid Supabase configurations in production. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

const supabaseUrl = isValidUrl(envUrl)
  ? envUrl
  : isValidUrl(derivedUrl)
    ? derivedUrl
    : "https://placeholder-url.supabase.co";

const supabaseAnonKey = envAnonKey || "placeholder-anon-key";

// Safe clients creation
const clientSupabase =
  typeof window !== "undefined" ? createClient(supabaseUrl, supabaseAnonKey) : null;

// React-cache scopes this instance to a single request lifecycle on the server
const getServerSupabase = cache(() => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });
});

// Proxy handler to intercept properties/methods dynamically
export const supabase = new Proxy({} as any, {
  get(target, prop) {
    const activeClient = typeof window !== "undefined" ? clientSupabase : getServerSupabase();
    const val = Reflect.get(activeClient as any, prop);
    if (typeof val === "function") {
      return val.bind(activeClient);
    }
    return val;
  },
});

export const isSupabaseConfigured = () => {
  return envAnonKey !== "" && (isValidUrl(envUrl) || isValidUrl(derivedUrl));
};
