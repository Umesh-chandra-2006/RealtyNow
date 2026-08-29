/**
 * Festive Campaign Feature Flags and Helpers
 * 
 * Manages one-day promotional campaign triggers (e.g. Raksha Bandhan on August 28, 2026).
 * Automatically reverts to standard RealtyNow theme when campaign window expires.
 */

// Master campaign flag — Raksha Bandhan 2026 ended on August 28, 2026
export const RAKSHA_BANDHAN_FEATURE_FLAG = false;

/**
 * Checks if the Raksha Bandhan campaign is active.
 * Active on August 28, 2026 (IST timezone), or when forced via query param / localStorage.
 */
export function isRakshaBandhanActive(): boolean {
  if (typeof window === 'undefined') {
    return RAKSHA_BANDHAN_FEATURE_FLAG;
  }

  // 1. URL Query override: ?rakhi=true / ?festival=raksha_bandhan or ?rakhi=false
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const festivalParam = urlParams.get('festival');
    const rakhiParam = urlParams.get('rakhi');
    if (festivalParam === 'raksha_bandhan' || festivalParam === 'rakhi' || rakhiParam === 'true') {
      return true;
    }
    if (rakhiParam === 'false' || festivalParam === 'none') {
      return false;
    }
  } catch {
    // Ignore URL parse errors
  }

  // 2. LocalStorage override for QA & demo testing
  try {
    const localSetting = localStorage.getItem('realtynow_raksha_bandhan_campaign');
    if (localSetting === 'true') return true;
    if (localSetting === 'false') return false;
  } catch {
    // Ignore storage errors
  }

  // 3. Automated Date Check: August 28, 2026 (IST / Indian Standard Time UTC+5:30)
  try {
    const now = new Date();
    // Convert to IST
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + istOffset);

    const year = istTime.getFullYear();
    const month = istTime.getMonth(); // 0-indexed, 7 is August
    const day = istTime.getDate();

    // Active on August 28, 2026 (or during 2026 Rakhi festive window)
    if (year === 2026 && month === 7 && day === 28) {
      return RAKSHA_BANDHAN_FEATURE_FLAG;
    }

    // Also active if RAKSHA_BANDHAN_FEATURE_FLAG is permanently enabled for this build
    return RAKSHA_BANDHAN_FEATURE_FLAG;
  } catch {
    return RAKSHA_BANDHAN_FEATURE_FLAG;
  }
}
