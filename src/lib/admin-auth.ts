// src/lib/admin-auth.ts
// Centralized Admin Phone Authorization Helper for Client-Side code.
// Normalizes and verifies whether a given phone number is an authorized Administrator
// (Manager or Developer).

import { normalizeIndianMobile } from './phone';

/**
 * NOTE: Authorized admin phone numbers must NEVER be hardcoded in client code.
 * This bundle is shipped to every browser, so any number listed here is public
 * and becomes a targeted-enumeration/OSINT vector. Admin authorization is
 * enforced SERVER-SIDE (see the otp-auth / admin-security edge functions);
 * this client helper is only a UX pre-gate and must not grant anything itself.
 * Configure VITE_ADMIN_PHONE_NUMBERS (comma-separated) if a local pre-gate is
 * wanted in a specific deployment; if unset, no client-side pre-authorization
 * is applied.
 */
const DEFAULT_ADMIN_PHONES: string[] = [];

/**
 * Returns the set of all normalized authorized admin phone numbers (in "91XXXXXXXXXX" format).
 * Sourced ONLY from the import.meta.env.VITE_ADMIN_PHONE_NUMBERS environment variable.
 */
export function getAuthorizedAdminPhones(): Set<string> {
  const envPhones: string = (import.meta.env.VITE_ADMIN_PHONE_NUMBERS as string) || '';

  const rawList = [
    ...DEFAULT_ADMIN_PHONES,
    ...envPhones.split(',').map((p) => p.trim()).filter(Boolean),
  ];

  const normalizedSet = new Set<string>();
  for (const raw of rawList) {
    const normalized = normalizeIndianMobile(raw);
    if (normalized) {
      normalizedSet.add(normalized);
    }
  }
  return normalizedSet;
}

/**
 * Checks whether the given phone number is authorized as an Admin.
 * Handles "9963509329", "+919963509329", and "919963509329" identically.
 */
export function isAuthorizedAdminPhone(rawPhone: string): boolean {
  const normalized = normalizeIndianMobile(rawPhone);
  if (!normalized) return false;
  const authorizedSet = getAuthorizedAdminPhones();
  return authorizedSet.has(normalized);
}
