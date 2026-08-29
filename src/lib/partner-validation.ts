/**
 * partner-validation.ts
 *
 * Validation engine for the simplified 3-step Business Partner Registration flow.
 *
 * Rules:
 *   - No mandatory asterisks in the UI labels.
 *   - Functional validation runs when user attempts step progression (Next / Submit).
 *   - Returns a map of field errors: { [fieldName]: errorMessage }.
 */

export interface PartnerRegistrationFormData {
  // Step 1: Basic Details
  partner_type: string;
  surname: string;
  name: string;
  mobile_number: string;
  email: string;
  business_name: string;
  gst_number: string;
  aadhaar_number: string;
  pan_number: string;
  address: string;

  // Step 2: Location Details
  country?: string;
  state: string;
  city: string;
  area: string;
  district: string;
  google_place_id?: string;
  latitude?: number;
  longitude?: number;
  formatted_address?: string;

  // Step 3: Business & Financial Details
  business_registration: string;
  business_reg_doc: File | null;
  business_reg_doc_url?: string | null;

  aadhaar_doc: File | null;
  aadhaar_doc_url?: string | null;

  pan_doc: File | null;
  pan_doc_url?: string | null;

  bank_account_holder_name: string;
  bank_name: string;
  bank_account_number: string;
  bank_ifsc_code: string;

  gst_doc: File | null;
  gst_doc_url?: string | null;
}

// ─── Format Validation Helpers ────────────────────────────────────────────────

export function cleanMobile(val: string): string {
  return val.replace(/\D/g, '').slice(-10);
}

export function isValidMobile(val: string): boolean {
  const digits = cleanMobile(val);
  return digits.length === 10 && /^[6-9]/.test(digits);
}

export function isValidEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

export function cleanAadhaar(val: string): string {
  return val.replace(/\D/g, '').slice(0, 12);
}

export function isValidAadhaar(val: string): boolean {
  const digits = cleanAadhaar(val);
  return digits.length === 12 && /^\d{12}$/.test(digits);
}

export function cleanPAN(val: string): string {
  return val.trim().toUpperCase().slice(0, 10);
}

export function isValidPAN(val: string): boolean {
  const pan = cleanPAN(val);
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
}

export function cleanGSTIN(val: string): string {
  return val.trim().toUpperCase().slice(0, 15);
}

export function isValidGSTIN(val: string): boolean {
  const gstin = cleanGSTIN(val);
  return /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin);
}

export function cleanIFSC(val: string): string {
  return val.trim().toUpperCase().slice(0, 11);
}

export function isValidIFSC(val: string): boolean {
  const ifsc = cleanIFSC(val);
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
}

// ─── Step Validators ──────────────────────────────────────────────────────────

export type FieldErrors = Record<string, string>;

/**
 * Validates Step 1: Basic Details
 */
export function validateStep1BasicDetails(form: Partial<PartnerRegistrationFormData>): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.partner_type?.trim()) {
    errors.partner_type = 'Please select a partner type.';
  }

  if (!form.surname?.trim()) {
    errors.surname = 'Please enter your surname.';
  }

  if (!form.name?.trim()) {
    errors.name = 'Please enter your name.';
  }

  if (!form.mobile_number?.trim()) {
    errors.mobile_number = 'Please enter your mobile number.';
  } else if (!isValidMobile(form.mobile_number)) {
    errors.mobile_number = 'Enter a valid 10-digit Indian mobile number starting with 6-9.';
  }

  if (!form.email?.trim()) {
    errors.email = 'Please enter your email address.';
  } else if (!isValidEmail(form.email)) {
    errors.email = 'Enter a valid email address (e.g. name@example.com).';
  }

  if (!form.business_name?.trim()) {
    errors.business_name = 'Please enter your business or agency name.';
  }

  if (!form.gst_number?.trim()) {
    errors.gst_number = 'Please enter your GST number.';
  } else if (!isValidGSTIN(form.gst_number)) {
    errors.gst_number = 'Enter a valid 15-digit GSTIN (e.g. 36AABCU9603R1ZM).';
  }

  if (!form.aadhaar_number?.trim()) {
    errors.aadhaar_number = 'Please enter your 12-digit Aadhaar number.';
  } else if (!isValidAadhaar(form.aadhaar_number)) {
    errors.aadhaar_number = 'Aadhaar number must be exactly 12 digits.';
  }

  if (!form.pan_number?.trim()) {
    errors.pan_number = 'Please enter your PAN card number.';
  } else if (!isValidPAN(form.pan_number)) {
    errors.pan_number = 'Enter a valid 10-character PAN (e.g. ABCDE1234F).';
  }

  if (!form.address?.trim()) {
    errors.address = 'Please enter your complete address.';
  }

  return errors;
}

/**
 * Validates Step 2: Location Details
 */
export function validateStep2Location(form: Partial<PartnerRegistrationFormData>): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.city?.trim()) {
    errors.city = 'Please select or search your city.';
  }

  if (!form.area?.trim()) {
    errors.area = 'Please select or enter your area / locality.';
  }

  if (!form.state?.trim()) {
    errors.state = 'Please specify your state.';
  }

  if (!form.district?.trim()) {
    errors.district = 'Please specify your district.';
  }

  return errors;
}

/**
 * Validates Step 3: Business & Financial Details
 */
export function validateStep3FinancialDetails(form: Partial<PartnerRegistrationFormData>): FieldErrors {
  const errors: FieldErrors = {};

  // Business Registration (File or text)
  if (!form.business_reg_doc && !form.business_reg_doc_url && !form.business_registration?.trim()) {
    errors.business_registration = 'Please upload your Business Registration proof or enter details.';
  }

  // Aadhaar Card document
  if (!form.aadhaar_doc && !form.aadhaar_doc_url) {
    errors.aadhaar_doc = 'Please upload a copy of your Aadhaar card.';
  }

  // PAN Card document
  if (!form.pan_doc && !form.pan_doc_url) {
    errors.pan_doc = 'Please upload a copy of your PAN card.';
  }

  // Bank details
  if (!form.bank_account_holder_name?.trim()) {
    errors.bank_account_holder_name = 'Please enter the bank account holder name.';
  }

  if (!form.bank_name?.trim()) {
    errors.bank_name = 'Please enter the bank name.';
  }

  if (!form.bank_account_number?.trim()) {
    errors.bank_account_number = 'Please enter your bank account number.';
  } else if (form.bank_account_number.trim().length < 8) {
    errors.bank_account_number = 'Account number must be at least 8 digits.';
  }

  if (!form.bank_ifsc_code?.trim()) {
    errors.bank_ifsc_code = 'Please enter the bank IFSC code.';
  } else if (!isValidIFSC(form.bank_ifsc_code)) {
    errors.bank_ifsc_code = 'Enter a valid 11-character IFSC code (e.g. HDFC0000123).';
  }

  // GST Certificate document
  if (!form.gst_doc && !form.gst_doc_url) {
    errors.gst_doc = 'Please upload your GST certificate.';
  }

  return errors;
}

/**
 * Validates whole form for submission
 */
export function validatePartnerRegistrationForm(form: Partial<PartnerRegistrationFormData>): {
  isValid: boolean;
  errors: FieldErrors;
  firstInvalidStep: number;
} {
  const step1Errors = validateStep1BasicDetails(form);
  if (Object.keys(step1Errors).length > 0) {
    return { isValid: false, errors: step1Errors, firstInvalidStep: 1 };
  }

  const step2Errors = validateStep2Location(form);
  if (Object.keys(step2Errors).length > 0) {
    return { isValid: false, errors: step2Errors, firstInvalidStep: 2 };
  }

  const step3Errors = validateStep3FinancialDetails(form);
  if (Object.keys(step3Errors).length > 0) {
    return { isValid: false, errors: step3Errors, firstInvalidStep: 3 };
  }

  return { isValid: true, errors: {}, firstInvalidStep: 0 };
}

// ─── Format Validation Functions (null = valid, string = error) ───────────────

export function validateGSTIN(val: string, isRequired = false): string | null {
  if (!val || !val.trim()) return isRequired ? 'GST number is required.' : null;
  return isValidGSTIN(val) ? null : 'Invalid 15-character GSTIN format.';
}

export function validatePAN(val: string, isRequired = false): string | null {
  if (!val || !val.trim()) return isRequired ? 'PAN card number is required.' : null;
  return isValidPAN(val) ? null : 'Invalid 10-character PAN format.';
}

export function validateIFSC(val: string, isRequired = false): string | null {
  if (!val || !val.trim()) return isRequired ? 'IFSC code is required.' : null;
  return isValidIFSC(val) ? null : 'Invalid 11-character IFSC format.';
}

export function validateBankAccountNumber(val: string, isRequired = false): string | null {
  if (!val || !val.trim()) return isRequired ? 'Bank account number is required.' : null;
  const digits = val.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 18 ? null : 'Account number must be 8-18 digits.';
}

export function validateWebsiteUrl(val: string): string | null {
  if (!val || !val.trim()) return null;
  try {
    const url = val.startsWith('http') ? val : `https://${val}`;
    new URL(url);
    return null;
  } catch {
    return 'Invalid website URL format.';
  }
}

export function validateCompanyName(val: string, isRequired = false): string | null {
  if (!val || !val.trim()) return isRequired ? 'Company name is required.' : null;
  return val.trim().length >= 2 ? null : 'Company name must be at least 2 characters.';
}

export function validatePartnerDetailsForSubmission(app: any): { valid: boolean; message?: string } {
  if (!app) return { valid: false, message: 'Application data is missing.' };
  if (!app.mobile_number) return { valid: false, message: 'Mobile number is required.' };
  return { valid: true };
}
