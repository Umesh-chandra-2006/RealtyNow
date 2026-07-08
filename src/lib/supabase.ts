import { createClient } from "@supabase/supabase-js";

const envUrl =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL : "") ||
  (typeof window !== "undefined" ? (import.meta.env?.VITE_SUPABASE_URL as string) : "") ||
  "";

const envAnonKey =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : "") ||
  (typeof window !== "undefined" ? (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) : "") ||
  "";

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

const supabaseUrl = isValidUrl(envUrl)
  ? envUrl
  : isValidUrl(derivedUrl)
    ? derivedUrl
    : "https://placeholder-url.supabase.co";

const supabaseAnonKey = envAnonKey || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = () => {
  return envAnonKey !== "" && (isValidUrl(envUrl) || isValidUrl(derivedUrl));
};
