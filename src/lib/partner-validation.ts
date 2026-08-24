/**
 * partner-validation.ts
 *
 * Single source-of-truth for ALL Partner Registration field validation.
 * Used by:
 *   - src/pages/auth/partner-register.tsx  (client-side form)
 *   - src/components/admin/ApplicationReviewDrawer.tsx  (admin approval guard)
 *
 * Rule: null = valid, string = error message.
 * Optional fields: empty string → null (valid). Non-empty → must pass format check.
 *
 * NEVER add field-specific logic elsewhere. Extend this file instead.
 */

// ─── Partner type constant (single source — imported by the form too) ─────────

export const PARTNER_TYPES = [
  'Individual Partner',
  'Real Estate Consultant',
  'Property Consultant',
  'Broker',
  'Channel Partner',
  'Referral Partner',
  'Corporate Partner',
  'Builder / Developer Partner',
  'Financial Partner',
  'Interior / Home Services Partner',
  'Legal / Documentation Partner',
  'Other',
] as const;

export type PartnerType = (typeof PARTNER_TYPES)[number];

// ─── Cross-field business rules ───────────────────────────────────────────────

export interface PartnerTypeRules {
  gstRequired: boolean;
  panRequired: boolean;
  companyRequired: boolean;
}

/**
 * Returns which fields become mandatory for a given partner type.
 * Keep rules here — never scatter them across UI components.
 */
export function getPartnerTypeRules(partnerType: string): PartnerTypeRules {
  switch (partnerType) {
    case 'Corporate Partner':
    case 'Builder / Developer Partner':
    case 'Financial Partner':
      return { gstRequired: true, panRequired: true, companyRequired: true };

    case 'Legal / Documentation Partner':
    case 'Interior / Home Services Partner':
      return { gstRequired: false, panRequired: true, companyRequired: false };

    case 'Broker':
    case 'Channel Partner':
    case 'Property Consultant':
    case 'Real Estate Consultant':
      return { gstRequired: false, panRequired: false, companyRequired: false };

    case 'Individual Partner':
    case 'Referral Partner':
    case 'Other':
    default:
      return { gstRequired: false, panRequired: false, companyRequired: false };
  }
}

// ─── GSTIN state code map ──────────────────────────────────────────────────────

/**
 * Maps the 2-digit GSTIN state prefix to the canonical Indian state name
 * as stored in the partner address form.
 * Source: GST Council state code list.
 */
export const GSTIN_STATE_CODE_MAP: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

// State name aliases (handles "Telangana" → "36", "AP" → "28"/"37", etc.)
// Used for reverse look-up when cross-checking form state against GSTIN prefix.
const STATE_NAME_TO_CODES: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const [code, name] of Object.entries(GSTIN_STATE_CODE_MAP)) {
    const key = name.toLowerCase().trim();
    if (!map[key]) map[key] = [];
    map[key].push(code);
  }
  return map;
})();

// ─── Individual field validators ───────────────────────────────────────────────

/** 1 — Partner Type */
export function validatePartnerType(value: string): string | null {
  if (!value || !value.trim()) return 'Partner Type is required.';
  if (!(PARTNER_TYPES as readonly string[]).includes(value)) {
    return 'Please select a valid partner type.';
  }
  return null;
}

/** 2 — Full Name (required) */
export function validateFullName(raw: string): string | null {
  const value = raw.trim();
  if (!value) return 'Please enter your full name.';
  if (value.length < 2) return 'Please enter a valid full name.';
  if (value.length > 100) return 'Full name must be 100 characters or fewer.';
  // Allow: A-Z a-z, spaces, hyphens, apostrophes, dots, and common Indian Unicode (Devanagari, Telugu, Tamil, etc.)
  // Reject: digits and most special characters
  if (!/^[\p{L}\s'.\\-]+$/u.test(value)) {
    return 'Please enter a valid full name.';
  }
  // Must have at least one actual letter (not just spaces/separators)
  if (!/[\p{L}]/u.test(value)) {
    return 'Please enter a valid full name.';
  }
  return null;
}

/** 3 — Mobile Number (required, Indian) */
export function validateMobileNumber(raw: string): string | null {
  if (!raw || !raw.trim()) return 'Mobile number is required.';
  // Strip only the +91 prefix and spaces for checking; reject embedded spaces
  const stripped = raw.trim().replace(/^\+91/, '').replace(/^91/, '');
  // If there are any non-digit characters remaining, it's invalid
  if (/\D/.test(stripped)) return 'Please enter a valid 10-digit mobile number.';
  if (stripped.length !== 10) return 'Please enter a valid 10-digit mobile number.';
  if (!/^[6-9]\d{9}$/.test(stripped)) return 'Please enter a valid 10-digit mobile number.';
  return null;
}

/** 4 — Email (always required) */
/* eslint-disable no-misleading-character-class */
export function validateEmail(raw: string, required: boolean = true): string | null {
  const value = raw.trim();
  if (!value) {
    return required ? 'Email address is required.' : null;
  }
  if (value.length > 254) return 'Please enter a valid email address.';
  // Strict: must have exactly one @, valid local part, domain with at least one dot and TLD
  const emailRe = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!emailRe.test(value)) return 'Please enter a valid email address.';
  return null;
}

/** 5 — Business / Company Name (optional) */
export function validateCompanyName(raw: string, required = false): string | null {
  const value = raw.trim();
  if (!value) {
    return required ? 'Business / Company Name is required.' : null;
  }
  if (value.length < 2) return 'Please enter a valid business/company name.';
  if (value.length > 150) return 'Business/company name must be 150 characters or fewer.';
  // Must not be all-digits
  if (/^\d+$/.test(value)) return 'Please enter a valid business/company name.';
  // Must not be all-special characters
  if (/^[^A-Za-z0-9\u0900-\u097F]+$/.test(value)) return 'Please enter a valid business/company name.';
  // Allowed characters: letters (Latin + common Indian scripts), digits, &, ., ,, -, ', (, ), space
  if (!/^[A-Za-z0-9\u0900-\u097F\u0C00-\u0C7F\u0B80-\u0BFF\s&.,\-'()]+$/.test(value)) {
    return 'Please enter a valid business/company name.';
  }
  return null;
}

/** 6 — Years of Experience (optional) */
export function validateYearsOfExperience(raw: string, required = false): string | null {
  const value = raw.trim();
  if (!value) {
    return required ? 'Years of experience is required.' : null;
  }
  // No letters
  if (/[a-zA-Z]/.test(value)) return 'Please enter a valid number of years (0–60).';
  // No special characters (decimals, negatives, etc.)
  if (/[^0-9]/.test(value)) return 'Please enter a valid number of years (0–60).';
  const num = parseInt(value, 10);
  if (isNaN(num)) return 'Please enter a valid number of years (0–60).';
  if (num < 0) return 'Please enter a valid number of years (0–60).';
  if (num > 60) return 'Years of experience must be 60 or fewer.';
  return null;
}

/** 7 — GSTIN (optional) */
export function validateGSTIN(raw: string, required = false): string | null {
  const value = raw.trim().toUpperCase();
  if (!value) {
    return required ? 'GST Number is required.' : null;
  }
  if (value.length !== 15) return 'Please enter a valid GST Number.';
  // Structural GSTIN regex:
  // 2 digits (state code 01-37/38/97/99) + 5 alpha (PAN chars 1-5) +
  // 4 digits (PAN chars 6-9) + 1 alpha (PAN char 10) +
  // 1 alphanumeric (entity number) + Z + 1 alphanumeric (check digit)
  const gstinRe = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  if (!gstinRe.test(value)) return 'Please enter a valid GST Number.';
  // Validate state code exists (01–37, 38, 97, 99)
  const stateCode = value.substring(0, 2);
  if (!GSTIN_STATE_CODE_MAP[stateCode]) return 'Please enter a valid GST Number.';
  // Reject obviously-invalid repeated patterns
  if (/^(.)\1+$/.test(value)) return 'Please enter a valid GST Number.';
  return null;
}

/** 7b — GST state-code cross-check (run at final submission, not Step 1) */
export function validateGSTStateMatch(gstin: string, formState: string): string | null {
  const value = gstin.trim().toUpperCase();
  if (!value || !formState.trim()) return null; // skip if either is empty
  if (validateGSTIN(value) !== null) return null; // skip if GSTIN itself is invalid (already caught)
  const stateCode = value.substring(0, 2);
  const gstStateName = GSTIN_STATE_CODE_MAP[stateCode];
  if (!gstStateName) return null;
  const normalizedFormState = formState.toLowerCase().trim();
  const expectedCodes = STATE_NAME_TO_CODES[normalizedFormState] ?? [];
  if (expectedCodes.length > 0 && !expectedCodes.includes(stateCode)) {
    return `GST Number does not match the selected state (${formState}). Expected state: ${gstStateName}.`;
  }
  return null;
}

/** 8 — PAN Number (optional) */
export function validatePAN(raw: string, required = false): string | null {
  const value = raw.trim().toUpperCase();
  if (!value) {
    return required ? 'PAN Number is required.' : null;
  }
  // Exactly 10 chars: 5 alpha + 4 digits + 1 alpha
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value)) {
    return 'Please enter a valid PAN Number (e.g. ABCDE1234F).';
  }
  return null;
}

/** 8b — IFSC Code (partner_bank_accounts, mirrors chk_partner_bank_ifsc_format DB constraint) */
export function validateIFSC(raw: string): string | null {
  const value = raw.trim().toUpperCase();
  if (!value) return 'IFSC code is required.';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value)) {
    return 'Please enter a valid IFSC code (e.g. HDFC0001234).';
  }
  return null;
}

/** 8c — Bank Account Number (partner_bank_accounts) */
export function validateBankAccountNumber(raw: string): string | null {
  const value = raw.trim();
  if (!value) return 'Account number is required.';
  if (!/^\d{9,18}$/.test(value)) return 'Please enter a valid account number (9-18 digits).';
  return null;
}

/** 9 — Website URL (optional) */
export function validateWebsiteUrl(raw: string, required = false): string | null {
  const value = raw.trim();
  if (!value) {
    return required ? 'Website URL is required.' : null;
  }

  // Reject bare protocol strings that are clearly invalid
  const OBVIOUSLY_INVALID = ['http', 'https', 'http:', 'https:', 'http://', 'https://', 'www', 'ftp'];
  if (OBVIOUSLY_INVALID.includes(value.toLowerCase())) {
    return 'Please enter a valid website URL, e.g. https://example.com';
  }

  // Auto-prefix https:// if user didn't type protocol
  let urlToTest = value;
  if (!/^https?:\/\//i.test(urlToTest)) {
    urlToTest = `https://${urlToTest}`;
  }

  // Try parsing as URL
  let parsed: URL;
  try {
    parsed = new URL(urlToTest);
  } catch {
    return 'Please enter a valid website URL, e.g. https://example.com';
  }

  // Protocol must be http or https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Please enter a valid website URL, e.g. https://example.com';
  }

  // Hostname must not be empty and must contain a dot (real domain)
  const host = parsed.hostname;
  if (!host || !host.includes('.')) {
    return 'Please enter a valid website URL, e.g. https://example.com';
  }

  // Reject hostnames that end with a dot or start with a dot
  if (host.startsWith('.') || host.endsWith('.')) {
    return 'Please enter a valid website URL, e.g. https://example.com';
  }

  // TLD must be at least 2 characters
  const parts = host.split('.');
  const tld = parts[parts.length - 1];
  if (!tld || tld.length < 2) {
    return 'Please enter a valid website URL, e.g. https://example.com';
  }

  return null;
}

/**
 * Normalize a website URL for storage/display.
 * If the user types "example.com" (no protocol), prepend "https://".
 * If the value is clearly invalid (e.g. "https"), return as-is (let validator catch it).
 */
export function normalizeWebsiteUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return value;
  // If already has a protocol, return as-is
  if (/^https?:\/\//i.test(value)) return value;
  // If it looks like a domain (has a dot, no spaces, no protocol characters), prepend https://
  if (!value.includes(' ') && !value.includes(':') && value.includes('.') && value.length > 3) {
    return `https://${value}`;
  }
  return value;
}

// ─── Form type for Step 1 ─────────────────────────────────────────────────────

export interface PartnerDetailsForm {
  partner_type: string;
  full_name: string;
  mobile_number: string;
  email: string;
  company_name: string;
  years_of_experience: string;
  gst_number: string;
  pan_number: string;
  website: string;
  // Address state (needed for GST cross-check at final submit)
  state?: string;
}

export type PartnerDetailsErrors = Partial<Record<keyof PartnerDetailsForm, string>>;

// ─── Step-level validator ─────────────────────────────────────────────────────

/**
 * Validate all Step 1 (Partner Details) fields.
 * ALL fields are compulsory — no skipping allowed.
 * Returns an empty object if everything is valid.
 * Returns a map of field → error message for every invalid field.
 */
export function validatePartnerDetailsStep(form: PartnerDetailsForm): PartnerDetailsErrors {
  const errs: PartnerDetailsErrors = {};

  const set = <K extends keyof PartnerDetailsErrors>(key: K, err: string | null) => {
    if (err) errs[key] = err;
  };

  set('partner_type', validatePartnerType(form.partner_type));
  set('full_name', validateFullName(form.full_name));
  set('mobile_number', validateMobileNumber(form.mobile_number));
  set('email', validateEmail(form.email, true));                       // required
  set('company_name', validateCompanyName(form.company_name, false));  // optional
  set('years_of_experience', validateYearsOfExperience(form.years_of_experience, false)); // optional
  set('gst_number', validateGSTIN(form.gst_number, false));            // optional
  set('pan_number', validatePAN(form.pan_number, false));              // optional
  set('website', validateWebsiteUrl(form.website, false));             // optional

  return errs;
}

/**
 * Final-submission validator — runs all steps including GST state cross-check.
 * Call this right before creating the partner application in the database.
 */
export function validatePartnerDetailsForSubmission(
  form: PartnerDetailsForm & { state: string }
): PartnerDetailsErrors {
  const errs = validatePartnerDetailsStep(form);
  // GST state cross-check (requires state from Step 2)
  if (form.gst_number && !errs.gst_number) {
    const stateErr = validateGSTStateMatch(form.gst_number, form.state);
    if (stateErr) errs.gst_number = stateErr;
  }
  return errs;
}

// ─── Test utility (used in unit tests and verification) ───────────────────────

/**
 * Run the spec §28 test suite in-memory.
 * Returns { passed, failed, results }.
 * Import this in tests or a verification script.
 */
export function runPartnerValidationTests(): {
  passed: number;
  failed: number;
  results: { name: string; expected: boolean; actual: boolean; pass: boolean }[];
} {
  type Case = { name: string; fn: () => string | null; expectValid: boolean };
  const cases: Case[] = [
    // Full Name
    { name: 'fullName empty', fn: () => validateFullName(''), expectValid: false },
    { name: 'fullName spaces only', fn: () => validateFullName('   '), expectValid: false },
    { name: 'fullName digits', fn: () => validateFullName('12345'), expectValid: false },
    { name: 'fullName specials', fn: () => validateFullName('@#$%'), expectValid: false },
    { name: 'fullName valid "Sai Kumar"', fn: () => validateFullName('Sai Kumar'), expectValid: true },
    { name: 'fullName valid "Asilu Rebba"', fn: () => validateFullName('Asilu Rebba'), expectValid: true },
    { name: 'fullName single char', fn: () => validateFullName('A'), expectValid: false },
    // Mobile
    { name: 'mobile empty', fn: () => validateMobileNumber(''), expectValid: false },
    { name: 'mobile 9 digits', fn: () => validateMobileNumber('123456789'), expectValid: false },
    { name: 'mobile 11 digits', fn: () => validateMobileNumber('12345678901'), expectValid: false },
    { name: 'mobile alpha', fn: () => validateMobileNumber('abcdefghij'), expectValid: false },
    { name: 'mobile valid 9963509329', fn: () => validateMobileNumber('9963509329'), expectValid: true },
    { name: 'mobile invalid prefix 0000000000', fn: () => validateMobileNumber('0000000000'), expectValid: false },
    { name: 'mobile invalid prefix 1234567890', fn: () => validateMobileNumber('1234567890'), expectValid: false },
    // Email
    { name: 'email empty (optional)', fn: () => validateEmail('', false), expectValid: true },
    { name: 'email "becozr"', fn: () => validateEmail('becozr'), expectValid: false },
    { name: 'email "abc@"', fn: () => validateEmail('abc@'), expectValid: false },
    { name: 'email "@gmail.com"', fn: () => validateEmail('@gmail.com'), expectValid: false },
    { name: 'email "abc@gmail.com"', fn: () => validateEmail('abc@gmail.com'), expectValid: true },
    { name: 'email "becozr@gmail.com"', fn: () => validateEmail('becozr@gmail.com'), expectValid: true },
    // GST
    { name: 'gstin empty (optional)', fn: () => validateGSTIN('', false), expectValid: true },
    { name: 'gstin all-digits 15', fn: () => validateGSTIN('123456789012345'), expectValid: false },
    { name: 'gstin all-alpha 15', fn: () => validateGSTIN('ABCDEFGHIJKLMNO'), expectValid: false },
    { name: 'gstin short "12345"', fn: () => validateGSTIN('12345'), expectValid: false },
    { name: 'gstin partial "22AAAA"', fn: () => validateGSTIN('22AAAA'), expectValid: false },
    { name: 'gstin valid Telangana', fn: () => validateGSTIN('36AABCU9603R1ZM'), expectValid: true },
    // PAN
    { name: 'pan empty (optional)', fn: () => validatePAN('', false), expectValid: true },
    { name: 'pan "ABC123"', fn: () => validatePAN('ABC123'), expectValid: false },
    { name: 'pan "1234567890"', fn: () => validatePAN('1234567890'), expectValid: false },
    { name: 'pan "ABCDE1234F"', fn: () => validatePAN('ABCDE1234F'), expectValid: true },
    { name: 'pan lowercase "abcde1234f"', fn: () => validatePAN('abcde1234f'), expectValid: true }, // normalized
    // Website
    { name: 'website empty (optional)', fn: () => validateWebsiteUrl(''), expectValid: true },
    { name: 'website "https"', fn: () => validateWebsiteUrl('https'), expectValid: false },
    { name: 'website "http"', fn: () => validateWebsiteUrl('http'), expectValid: false },
    { name: 'website "example"', fn: () => validateWebsiteUrl('example'), expectValid: false },
    { name: 'website "www.example"', fn: () => validateWebsiteUrl('www.example'), expectValid: false },
    { name: 'website "https://"', fn: () => validateWebsiteUrl('https://'), expectValid: false },
    { name: 'website "https://example.com"', fn: () => validateWebsiteUrl('https://example.com'), expectValid: true },
    { name: 'website "http://example.com"', fn: () => validateWebsiteUrl('http://example.com'), expectValid: true },
    { name: 'website "https://company.co.in"', fn: () => validateWebsiteUrl('https://company.co.in'), expectValid: true },
    // Years
    { name: 'years empty (optional)', fn: () => validateYearsOfExperience(''), expectValid: true },
    { name: 'years "-2"', fn: () => validateYearsOfExperience('-2'), expectValid: false },
    { name: 'years "3.5"', fn: () => validateYearsOfExperience('3.5'), expectValid: false },
    { name: 'years "abc"', fn: () => validateYearsOfExperience('abc'), expectValid: false },
    { name: 'years "3"', fn: () => validateYearsOfExperience('3'), expectValid: true },
    { name: 'years "10 years"', fn: () => validateYearsOfExperience('10 years'), expectValid: false },
  ];

  const results = cases.map(({ name, fn, expectValid }) => {
    const result = fn();
    const actual = result === null;
    return { name, expected: expectValid, actual, pass: actual === expectValid };
  });

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  return { passed, failed, results };
}
