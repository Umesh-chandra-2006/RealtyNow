import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  FileText,
  Briefcase,
  MapPin,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Handshake,
  Star,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';
import { Logo, LogoLight } from '../../components/logo';
import { DocumentUploadArea } from '../../components/uploader/document-upload-area';
import { uploadFile } from '../../lib/storage';
import { normalizeIndianMobile } from '../../lib/phone';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { useLanguageContext } from '../../lib/i18n/language-context';
import {
  PARTNER_TYPES,
  getPartnerTypeRules,
  validatePartnerDetailsStep,
  validatePartnerDetailsForSubmission,
  normalizeWebsiteUrl,
} from '../../lib/partner-validation';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROPERTY_TYPES = [
  'Residential',
  'Commercial',
  'Open Plots',
  'Villa',
  'Apartment',
  'Farm Land',
  'Industrial',
  'Rental',
  'Other',
];

const PROPERTY_TYPE_KEYS: Record<string, string> = {
  'Residential': 'auth.ptResidential',
  'Commercial': 'auth.ptCommercial',
  'Open Plots': 'auth.ptOpenPlots',
  'Villa': 'auth.ptVilla',
  'Apartment': 'auth.ptApartment',
  'Farm Land': 'auth.ptFarmLand',
  'Industrial': 'auth.ptIndustrial',
  'Rental': 'auth.ptRental',
  'Other': 'auth.ptOther',
};

const STEPS = [
  { id: 1, label: 'Partner Details', labelKey: 'auth.stepPartnerDetails', icon: User },
  { id: 2, label: 'Address', labelKey: 'auth.stepAddress', icon: MapPin },
  { id: 3, label: 'Professional', labelKey: 'auth.stepProfessional', icon: Briefcase },
  { id: 4, label: 'Documents', labelKey: 'auth.stepDocuments', icon: FileText },
  { id: 5, label: 'Review & Submit', labelKey: 'auth.stepReviewSubmit', icon: CheckCircle2 },
];

// ─── Form shape ───────────────────────────────────────────────────────────────

interface FormData {
  partner_type: string;
  full_name: string;
  mobile_number: string;
  email: string;
  company_name: string;
  business_registration_number: string;
  gst_number: string;
  pan_number: string;
  years_of_experience: string;
  website: string;
  address_line_1: string;
  address_line_2: string;
  state: string;
  city: string;
  district: string;
  pincode: string;
  professional_experience: string;
  area_of_expertise: string;
  preferred_property_types: string[];
  preferred_locations: string;
  expected_monthly_leads: string;
  current_business_volume: string;
  real_estate_experience: string;
  description: string;
  pan_doc: File | null;
  id_doc: File | null;
  gst_doc: File | null;
  business_reg_doc: File | null;
  address_proof_doc: File | null;
  agree_privacy: boolean;
  agree_terms: boolean;
  agree_verification: boolean;
}

const INITIAL: FormData = {
  partner_type: '',
  full_name: '',
  mobile_number: '',
  email: '',
  company_name: '',
  business_registration_number: '',
  gst_number: '',
  pan_number: '',
  years_of_experience: '',
  website: '',
  address_line_1: '',
  address_line_2: '',
  state: '',
  city: '',
  district: '',
  pincode: '',
  professional_experience: '',
  area_of_expertise: '',
  preferred_property_types: [],
  preferred_locations: '',
  expected_monthly_leads: '',
  current_business_volume: '',
  real_estate_experience: '',
  description: '',
  pan_doc: null,
  id_doc: null,
  gst_doc: null,
  business_reg_doc: null,
  address_proof_doc: null,
  agree_privacy: false,
  agree_terms: false,
  agree_verification: false,
};

// ─── CSS helpers ──────────────────────────────────────────────────────────────

const baseInputClass =
  'w-full rounded-lg border bg-white shadow-sm px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-navy-500 focus:outline-none focus:ring-2 transition-colors';

function inputClass(hasError: boolean): string {
  return hasError
    ? `${baseInputClass} border-red-500 focus:border-red-500 focus:ring-red-500/30`
    : `${baseInputClass} border-navy-200 focus:border-gold-500 focus:ring-gold-500/30`;
}

const labelClass = 'block text-sm font-medium text-navy-600 mb-1.5';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-600" role="alert" aria-live="polite">
      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
      {message}
    </p>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PartnerRegisterPage() {
  const { t } = useLanguageContext();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [mobileDuplicateWarning, setMobileDuplicateWarning] = useState<string | null>(null);
  const submittingRef = useRef(false);

  // Refs for auto-focusing first invalid field in Step 1
  const fieldRefs = useRef<Partial<Record<keyof FormData, HTMLElement | null>>>({});

  const set = (key: keyof FormData, val: string | boolean | File | null | string[]) =>
    setForm((f) => ({ ...f, [key]: val }));

  // Clear a specific error when user starts editing that field
  const clearError = (key: keyof FormData) => {
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const togglePropertyType = (type: string) => {
    setForm((f) => ({
      ...f,
      preferred_property_types: f.preferred_property_types.includes(type)
        ? f.preferred_property_types.filter((t) => t !== type)
        : [...f.preferred_property_types, type],
    }));
  };

  // ── Mobile duplicate check (async, fires on blur) ────────────────────────
  const checkMobileDuplicate = useCallback(async (mobile: string) => {
    const normalized = normalizeIndianMobile(mobile);
    if (!normalized) return; // invalid format — the validator will catch it
    try {
      const { data } = await supabase.rpc('check_partner_mobile_exists', { p_mobile: `+${normalized}` });
      if (data) {
        setMobileDuplicateWarning(
          t('auth.mobileDuplicateWarning', 'A partner application already exists for this mobile number. Contact support if this is an error.')
        );
      } else {
        setMobileDuplicateWarning(null);
      }
    } catch {
      // Non-critical: fail silently; the hard check happens server-side
    }
  }, []);

  // ── Step validators ──────────────────────────────────────────────────────

  const focusFirstError = (errs: Partial<Record<keyof FormData, string>>) => {
    // Field order in Step 1 — focus the topmost invalid field
    const STEP1_ORDER: (keyof FormData)[] = [
      'partner_type', 'full_name', 'mobile_number', 'email',
      'company_name', 'years_of_experience', 'gst_number', 'pan_number', 'website',
    ];
    for (const key of STEP1_ORDER) {
      if (errs[key] && fieldRefs.current[key]) {
        (fieldRefs.current[key] as HTMLElement).focus();
        break;
      }
    }
  };

  // Whenever a jump back to Step 1 lands with pending errors (e.g. the final
  // GST/state cross-check at submit time), focus the offending field once
  // Step 1's inputs are actually mounted.
  useEffect(() => {
    if (step === 1) focusFirstError(errors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const validateStep = (): boolean => {
    let errs: Partial<Record<keyof FormData, string>> = {};

    if (step === 1) {
      const step1Errs = validatePartnerDetailsStep({
        partner_type: form.partner_type,
        full_name: form.full_name,
        mobile_number: form.mobile_number,
        email: form.email,
        company_name: form.company_name,
        years_of_experience: form.years_of_experience,
        gst_number: form.gst_number,
        pan_number: form.pan_number,
        website: form.website,
      });
      errs = step1Errs as Partial<Record<keyof FormData, string>>;
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        focusFirstError(errs);
        return false;
      }
    }

    if (step === 2) {
      if (!form.address_line_1.trim()) errs.address_line_1 = t('auth.addressRequired', 'Address is required.');
      if (!form.state.trim()) errs.state = t('auth.stateRequired', 'State is required.');
      if (!form.city.trim()) errs.city = t('auth.cityRequired', 'City is required.');
      if (!/^\d{6}$/.test(form.pincode.trim())) errs.pincode = t('auth.validPincode', 'Enter a valid 6-digit PIN code.');
    }

    if (step === 3) {
      if (form.preferred_property_types.length === 0) {
        errs.preferred_property_types = t('auth.selectPropertyType', 'Select at least one property type.');
      }
    }

    if (step === 4) {
      // Documents step — currently all optional; enforce required docs here if needed in future
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (validateStep()) setStep((s) => s + 1);
  };

  const prev = () => setStep((s) => s - 1);

  // Stepper click: allow going back freely; block forward navigation past invalid steps
  const goToStep = (targetStep: number) => {
    if (targetStep < step) {
      setStep(targetStep);
      return;
    }
    if (targetStep === step) return;
    // Validate current step before allowing forward navigation
    if (validateStep()) {
      setStep(targetStep);
    } else {
      // Errors are already set by validateStep
    }
  };

  // ── Final submit ─────────────────────────────────────────────────────────

  const submit = async () => {
    if (submittingRef.current) return;
    if (!form.agree_privacy || !form.agree_terms || !form.agree_verification) {
      setServerError(t('auth.acceptAllConsent', 'Please accept all three consent checkboxes before submitting.'));
      return;
    }

    // Final re-validation of all Step 1 fields (including GST state cross-check)
    const finalErrs = validatePartnerDetailsForSubmission({
      partner_type: form.partner_type,
      full_name: form.full_name,
      mobile_number: form.mobile_number,
      email: form.email,
      company_name: form.company_name,
      years_of_experience: form.years_of_experience,
      gst_number: form.gst_number,
      pan_number: form.pan_number,
      website: form.website,
      state: form.state,
    });
    if (Object.keys(finalErrs).length > 0) {
      setErrors(finalErrs);
      setStep(1);
      setServerError(
        Object.values(finalErrs)[0] ||
          t('auth.invalidPartnerDetailsFields', 'Some fields in your Partner Details are invalid. Please correct them before submitting.')
      );
      return;
    }

    const mobile = normalizeIndianMobile(form.mobile_number);
    if (!mobile) {
      setServerError(t('auth.validMobile10', 'Enter a valid 10-digit mobile number.'));
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setServerError(null);

    try {
      // Check for duplicate mobile on submission
      const { data: dupExists } = await supabase.rpc('check_partner_mobile_exists', { p_mobile: `+${mobile}` });
      if (dupExists) {
        throw new Error(
          t('auth.mobileDuplicateError', 'A partner application already exists for this mobile number. Please contact support if this is an error.')
        );
      }

      const docUpload = async (file: File | null, prefix: string) => {
        if (!file) return null;
        const r = await uploadFile('partner-documents', file, `applications/${prefix}-${crypto.randomUUID()}-${file.name}`);
        if (r.error) throw new Error(r.error);
        return r.path || null;
      };

      const [pan_doc_url, id_doc_url, gst_doc_url, business_reg_doc_url, address_proof_doc_url] = await Promise.all([
        docUpload(form.pan_doc, 'pan'),
        docUpload(form.id_doc, 'id'),
        docUpload(form.gst_doc, 'gst'),
        docUpload(form.business_reg_doc, 'bizreg'),
        docUpload(form.address_proof_doc, 'addr'),
      ]);

      const { data: applicationNumberResult, error } = await supabase.rpc('submit_partner_application', {
        p_application: {
          partner_type: form.partner_type,
          full_name: form.full_name.trim(),
          mobile_number: `+${mobile}`,
          email: form.email.trim().toLowerCase() || null,
          company_name: form.company_name.trim() || null,
          business_registration_number: form.business_registration_number.trim() || null,
          gst_number: form.gst_number.trim().toUpperCase() || null,
          pan_number: form.pan_number.trim().toUpperCase() || null,
          years_of_experience: form.years_of_experience || null,
          website: form.website.trim() || null,
          address_line_1: form.address_line_1.trim(),
          address_line_2: form.address_line_2.trim() || null,
          state: form.state.trim(),
          city: form.city.trim(),
          district: form.district.trim() || null,
          pincode: form.pincode.trim(),
          professional_experience: form.professional_experience.trim() || null,
          area_of_expertise: form.area_of_expertise.trim() || null,
          preferred_property_types: form.preferred_property_types,
          preferred_locations: form.preferred_locations
            ? form.preferred_locations.split(',').map((l) => l.trim()).filter(Boolean)
            : [],
          expected_monthly_leads: form.expected_monthly_leads || null,
          current_business_volume: form.current_business_volume.trim() || null,
          real_estate_experience: form.real_estate_experience.trim() || null,
          description: form.description.trim() || null,
          pan_doc_url,
          id_doc_url,
          gst_doc_url,
          business_reg_doc_url,
          address_proof_doc_url,
        },
      });

      if (error) throw new Error(error.message);
      setApplicationNumber((applicationNumberResult as string) ?? null);
      setSubmitted(true);
    } catch (e: unknown) {
      setServerError(getFriendlyErrorMessage(e));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  // ── Success screen ───────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen bg-navy-50 flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md text-center">
          <div className="h-24 w-24 mx-auto rounded-full bg-gold-500/20 flex items-center justify-center mb-6">
            <CheckCircle2 className="h-12 w-12 text-gold-600" />
          </div>
          <h1 className="font-display text-3xl font-bold text-navy-900">{t('auth.applicationSubmittedSuccessfully', 'Application Submitted Successfully')}</h1>
          <p className="mt-3 text-navy-600">{t('auth.thankYouForPartnering', 'Thank you for partnering with RealtyNow, {{name}}.').replace('{{name}}', form.full_name)}</p>
          {applicationNumber && (
            <div className="mt-4 inline-block rounded-xl border border-navy-200 bg-navy-50/50 px-4 py-2">
              <p className="text-xs text-navy-500">{t('auth.applicationIdLabel', 'Application ID')}</p>
              <p className="font-mono font-semibold text-navy-900">{applicationNumber}</p>
            </div>
          )}
          <div className="mt-6 rounded-xl border border-navy-200 bg-navy-50/50 p-4 text-sm text-navy-500 space-y-2">
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gold-600" /> {t('auth.teamWillReview', 'Our team will review your application')}
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gold-600" /> {t('auth.signInViaOtpOnceApproved', "You'll be able to sign in via OTP once approved")}
            </p>
          </div>
          <Link to="/" className="mt-8 inline-block">
            <Button variant="primary" size="lg">
              {t('auth.backToHome', 'Back to Home')}
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // ── Current step partner-type rules (for conditional labels) ─────────────
  const ptRules = getPartnerTypeRules(form.partner_type);

  // ── Main form ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-navy-50">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="absolute bottom-0 -left-20 h-96 w-96 rounded-full bg-navy-700/20 blur-3xl" />
      </div>

      <div className="relative grid lg:grid-cols-[380px,1fr] min-h-screen">
        {/* LEFT PANEL — stepper */}
        <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 border-r border-navy-800 p-10 relative overflow-hidden z-10">
          <LogoLight to="/" size={220} />
          <div>
            <h2 className="font-display text-3xl font-bold text-white leading-tight">{t('auth.partnerWithRealtyNow', 'Partner with RealtyNow')}</h2>
            <p className="mt-3 text-navy-200 text-sm leading-relaxed">
              {t('auth.partnerGrowBusiness', 'Grow your business with RealtyNow. Join our partner network and unlock new real-estate business opportunities.')}
            </p>
            <ul className="mt-8 space-y-4">
              {[
                { icon: Handshake, key: 'auth.featAccessNetwork', text: 'Access a trusted partner network' },
                { icon: Star, key: 'auth.featNewOpportunities', text: 'New business opportunities' },
                { icon: ShieldCheck, key: 'auth.featVerifiedBadge', text: 'Verified partner badge' },
                { icon: Clock, key: 'auth.featDedicatedSupport', text: 'Dedicated partner support' },
              ].map(({ icon: Icon, key, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-navy-200">
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gold-400/20 grid place-items-center">
                    <Icon className="h-4 w-4 text-gold-400" />
                  </div>
                  {t(key, text)}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-navy-400 uppercase tracking-wide font-semibold">{t('auth.applicationProgress', 'Application progress')}</p>
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goToStep(s.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 transition-all text-left ${
                  step === s.id
                    ? 'bg-gold-400/20 text-gold-300'
                    : step > s.id
                      ? 'text-green-400 hover:bg-white/5 cursor-pointer'
                      : 'text-navy-500 cursor-not-allowed opacity-60'
                }`}
                aria-current={step === s.id ? 'step' : undefined}
                title={step < s.id ? t('auth.completeCurrentStep', 'Complete the current step to continue') : undefined}
              >
                <s.icon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{t(s.labelKey, s.label)}</span>
                {step > s.id && <CheckCircle2 className="h-3.5 w-3.5 ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL — form */}
        <div className="flex items-start justify-center px-6 py-12 overflow-y-auto">
          <div className="w-full max-w-lg">
            {/* Mobile logo */}
            <div className="lg:hidden flex justify-center mb-8">
              <Logo to="/" size={220} />
            </div>
            {/* Mobile progress dots */}
            <div className="lg:hidden flex items-center gap-2 mb-6 justify-center">
              {STEPS.map((s) => (
                <div
                  key={s.id}
                  className={`h-2 rounded-full transition-all ${step === s.id ? 'w-8 bg-gold-500' : step > s.id ? 'w-4 bg-green-500' : 'w-4 bg-white/20'}`}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* ══ Step 1 — Partner Details ════════════════════════════════════ */}
                {step === 1 && (
                  <div>
                    <h1 className="font-display text-2xl font-bold text-navy-900">{t('auth.partnerDetailsHeading', 'Partner Details')}</h1>
                    <p className="mt-1 text-sm text-navy-500">{t('auth.partnerDetailsSubtitle', 'Tell us who you are and how to reach you')}</p>
                    <div className="mt-6 space-y-4">

                      {/* Partner Type */}
                      <div>
                        <label className={labelClass} htmlFor="partner_type">
                          {t('auth.partnerTypeLabel', 'Partner Type')} <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="partner_type"
                          value={form.partner_type}
                          ref={(el) => { fieldRefs.current.partner_type = el; }}
                          onChange={(e) => {
                            set('partner_type', e.target.value);
                            clearError('partner_type');
                          }}
                          className={inputClass(!!errors.partner_type)}
                          aria-describedby={errors.partner_type ? 'partner_type-error' : undefined}
                        >
                          <option value="">{t('auth.selectPartnerType', 'Select partner type…')}</option>
                          {PARTNER_TYPES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <FieldError message={errors.partner_type} />
                      </div>

                      {/* Full Name */}
                      <div>
                        <label className={labelClass} htmlFor="full_name">
                          <User className="inline h-3.5 w-3.5 mr-1" />
                          {t('auth.fullNameLabel', 'Full Name')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="full_name"
                          value={form.full_name}
                          ref={(el) => { fieldRefs.current.full_name = el; }}
                          onChange={(e) => {
                            set('full_name', e.target.value);
                            clearError('full_name');
                          }}
                          className={inputClass(!!errors.full_name)}
                          placeholder={t('auth.fullNamePlaceholder', 'Arjun Sharma')}
                          maxLength={100}
                          aria-required="true"
                          aria-describedby={errors.full_name ? 'full_name-error' : undefined}
                        />
                        <FieldError message={errors.full_name} />
                      </div>

                      {/* Mobile Number */}
                      <div>
                        <label className={labelClass} htmlFor="mobile_number">
                          <Phone className="inline h-3.5 w-3.5 mr-1" />
                          {t('auth.mobileNumberLabel', 'Mobile Number')} <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                          <span className="flex-shrink-0 rounded-lg border border-navy-200 bg-navy-50 px-3 py-2.5 text-sm text-navy-600 select-none">
                            +91
                          </span>
                          <input
                            id="mobile_number"
                            type="tel"
                            inputMode="numeric"
                            maxLength={10}
                            value={form.mobile_number}
                            ref={(el) => { fieldRefs.current.mobile_number = el; }}
                            onChange={(e) => {
                              // Only allow digits
                              const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                              set('mobile_number', val);
                              clearError('mobile_number');
                              setMobileDuplicateWarning(null);
                            }}
                            onBlur={() => {
                              if (form.mobile_number.length === 10) {
                                checkMobileDuplicate(form.mobile_number);
                              }
                            }}
                            className={`flex-1 ${inputClass(!!errors.mobile_number)}`}
                            placeholder="9800000000"
                            aria-required="true"
                            aria-describedby={errors.mobile_number ? 'mobile_number-error' : undefined}
                          />
                        </div>
                        <FieldError message={errors.mobile_number} />
                        {!errors.mobile_number && mobileDuplicateWarning && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-amber-600" role="alert">
                            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                            {mobileDuplicateWarning}
                          </p>
                        )}
                      </div>

                      {/* Email */}
                      <div>
                        <label className={labelClass} htmlFor="email">
                          <Mail className="inline h-3.5 w-3.5 mr-1" />
                          {t('auth.emailAddressLabel', 'Email Address')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="email"
                          type="email"
                          value={form.email}
                          ref={(el) => { fieldRefs.current.email = el; }}
                          onChange={(e) => {
                            set('email', e.target.value);
                            clearError('email');
                          }}
                          className={inputClass(!!errors.email)}
                          placeholder={t('auth.emailPlaceholder', 'partner@example.com')}
                          maxLength={254}
                          aria-describedby={errors.email ? 'email-error' : undefined}
                        />
                        <FieldError message={errors.email} />
                      </div>

                      {/* Company Name + Years of Experience (Optional) */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass} htmlFor="company_name">
                            {t('auth.companyNameLabel', 'Business / Company Name')}
                          </label>
                          <input
                            id="company_name"
                            value={form.company_name}
                            ref={(el) => { fieldRefs.current.company_name = el; }}
                            onChange={(e) => {
                              set('company_name', e.target.value);
                              clearError('company_name');
                            }}
                            className={inputClass(!!errors.company_name)}
                            placeholder={t('auth.companyNamePlaceholder', 'Your business or company name')}
                            maxLength={150}
                          />
                          <FieldError message={errors.company_name} />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor="years_of_experience">
                            {t('auth.yearsOfExperienceLabel', 'Years of Experience')}
                          </label>
                          <input
                            id="years_of_experience"
                            type="text"
                            inputMode="numeric"
                            value={form.years_of_experience}
                            ref={(el) => { fieldRefs.current.years_of_experience = el; }}
                            onChange={(e) => {
                              // Only allow digits (no decimals, no negatives at input level)
                              const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                              set('years_of_experience', val);
                              clearError('years_of_experience');
                            }}
                            className={inputClass(!!errors.years_of_experience)}
                            placeholder="5"
                          />
                          <FieldError message={errors.years_of_experience} />
                        </div>
                      </div>

                      {/* GST + PAN (Optional) */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass} htmlFor="gst_number">
                            {t('auth.gstNumberLabel', 'GST Number')}
                          </label>
                          <input
                            id="gst_number"
                            value={form.gst_number}
                            ref={(el) => { fieldRefs.current.gst_number = el; }}
                            onChange={(e) => {
                              set('gst_number', e.target.value.toUpperCase().slice(0, 15));
                              clearError('gst_number');
                            }}
                            className={inputClass(!!errors.gst_number)}
                            placeholder="22AAAAA0000A1Z5"
                            maxLength={15}
                          />
                          <FieldError message={errors.gst_number} />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor="pan_number">
                            {t('auth.panNumberLabel', 'PAN Number')}
                          </label>
                          <input
                            id="pan_number"
                            value={form.pan_number}
                            ref={(el) => { fieldRefs.current.pan_number = el; }}
                            onChange={(e) => {
                              set('pan_number', e.target.value.toUpperCase().slice(0, 10));
                              clearError('pan_number');
                            }}
                            className={inputClass(!!errors.pan_number)}
                            placeholder="ABCDE1234F"
                            maxLength={10}
                          />
                          <FieldError message={errors.pan_number} />
                        </div>
                      </div>

                      {/* Website (Optional) */}
                      <div>
                        <label className={labelClass} htmlFor="website">
                          {t('auth.websiteLabel', 'Website')}
                        </label>
                        <input
                          id="website"
                          type="url"
                          value={form.website}
                          ref={(el) => { fieldRefs.current.website = el; }}
                          onChange={(e) => {
                            set('website', e.target.value);
                            clearError('website');
                          }}
                          onBlur={(e) => {
                            const normalized = normalizeWebsiteUrl(e.target.value);
                            if (normalized !== form.website) {
                              set('website', normalized);
                            }
                          }}
                          className={inputClass(!!errors.website)}
                          placeholder="https://example.com"
                        />
                        <FieldError message={errors.website} />
                      </div>

                    </div>
                  </div>
                )}

                {/* ══ Step 2 — Address ════════════════════════════════════════════ */}
                {step === 2 && (
                  <div>
                    <h1 className="font-display text-2xl font-bold text-navy-900">{t('auth.addressDetailsHeading', 'Address Details')}</h1>
                    <p className="mt-1 text-sm text-navy-500">{t('auth.whereAreYouBased', 'Where are you based?')}</p>
                    <div className="mt-6 space-y-4">
                      <div>
                        <label className={labelClass}>{t('auth.addressLine1Label', 'Address Line 1')} <span className="text-red-500">*</span></label>
                        <input
                          value={form.address_line_1}
                          onChange={(e) => { set('address_line_1', e.target.value); clearError('address_line_1'); }}
                          className={inputClass(!!errors.address_line_1)}
                        />
                        <FieldError message={errors.address_line_1} />
                      </div>
                      <div>
                        <label className={labelClass}>{t('auth.addressLine2Label', 'Address Line 2')}</label>
                        <input
                          value={form.address_line_2}
                          onChange={(e) => set('address_line_2', e.target.value)}
                          className={inputClass(false)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>{t('auth.stateLabel', 'State')} <span className="text-red-500">*</span></label>
                          <input
                            value={form.state}
                            onChange={(e) => { set('state', e.target.value); clearError('state'); }}
                            className={inputClass(!!errors.state)}
                          />
                          <FieldError message={errors.state} />
                        </div>
                        <div>
                          <label className={labelClass}>{t('auth.cityLabel', 'City')} <span className="text-red-500">*</span></label>
                          <input
                            value={form.city}
                            onChange={(e) => { set('city', e.target.value); clearError('city'); }}
                            className={inputClass(!!errors.city)}
                          />
                          <FieldError message={errors.city} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>{t('auth.districtLabel', 'District')}</label>
                          <input
                            value={form.district}
                            onChange={(e) => set('district', e.target.value)}
                            className={inputClass(false)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t('auth.pincodeLabel', 'Pincode')} <span className="text-red-500">*</span></label>
                          <input
                            value={form.pincode}
                            onChange={(e) => {
                              set('pincode', e.target.value.replace(/\D/g, ''));
                              clearError('pincode');
                            }}
                            maxLength={6}
                            className={inputClass(!!errors.pincode)}
                          />
                          <FieldError message={errors.pincode} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ══ Step 3 — Professional Details ══════════════════════════════ */}
                {step === 3 && (
                  <div>
                    <h1 className="font-display text-2xl font-bold text-navy-900">{t('auth.professionalDetailsHeading', 'Professional Details')}</h1>
                    <p className="mt-1 text-sm text-navy-500">{t('auth.professionalDetailsSubtitle', 'Help us understand your business')}</p>
                    <div className="mt-6 space-y-4">
                      <div>
                        <label className={labelClass}>
                          {t('auth.preferredPropertyTypesLabel', 'Preferred Property Types')} <span className="text-red-500">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {PROPERTY_TYPES.map((type) => {
                            const active = form.preferred_property_types.includes(type);
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => {
                                  togglePropertyType(type);
                                  clearError('preferred_property_types');
                                }}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'border-gold-500 bg-gold-500/10 text-gold-700' : 'border-navy-200 bg-white text-navy-600 hover:border-gold-300'}`}
                              >
                                {t(PROPERTY_TYPE_KEYS[type], type)}
                              </button>
                            );
                          })}
                        </div>
                        <FieldError message={errors.preferred_property_types} />
                      </div>
                      <div>
                        <label className={labelClass}>
                          <MapPin className="inline h-3.5 w-3.5 mr-1" />
                          {t('auth.preferredLocationsLabel', 'Preferred Locations (comma separated)')}
                        </label>
                        <input
                          value={form.preferred_locations}
                          onChange={(e) => set('preferred_locations', e.target.value)}
                          className={inputClass(false)}
                          placeholder="Banjara Hills, Gachibowli"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>{t('auth.areaOfExpertiseLabel', 'Area of Expertise')}</label>
                        <input
                          value={form.area_of_expertise}
                          onChange={(e) => set('area_of_expertise', e.target.value)}
                          className={inputClass(false)}
                          placeholder={t('auth.areaOfExpertisePlaceholder', 'e.g. Residential resale, NRI clients')}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>{t('auth.expectedMonthlyLeadsLabel', 'Expected Monthly Leads')}</label>
                          <input
                            type="number"
                            min="0"
                            value={form.expected_monthly_leads}
                            onChange={(e) => set('expected_monthly_leads', e.target.value)}
                            className={inputClass(false)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t('auth.currentBusinessVolumeLabel', 'Current Business Volume')}</label>
                          <input
                            value={form.current_business_volume}
                            onChange={(e) => set('current_business_volume', e.target.value)}
                            className={inputClass(false)}
                            placeholder={t('auth.currentBusinessVolumePlaceholder', 'e.g. 10-20 deals/yr')}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>{t('auth.existingRealEstateExperienceLabel', 'Existing Real Estate Experience')}</label>
                        <textarea
                          rows={2}
                          value={form.real_estate_experience}
                          onChange={(e) => set('real_estate_experience', e.target.value)}
                          className={`${inputClass(false)} resize-none`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>{t('auth.tellUsAboutYourselfLabel', 'Tell us about yourself / your business')}</label>
                        <textarea
                          rows={3}
                          value={form.description}
                          onChange={(e) => set('description', e.target.value)}
                          className={`${inputClass(false)} resize-none`}
                          placeholder={t('auth.tellUsAboutYourselfPlaceholder', 'Tell RealtyNow about your experience, business, network, locations and how you would like to partner with us.')}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ══ Step 4 — Documents ══════════════════════════════════════════ */}
                {step === 4 && (
                  <div>
                    <h1 className="font-display text-2xl font-bold text-navy-900">{t('auth.uploadDocumentsHeading', 'Upload Documents')}</h1>
                    <p className="mt-1 text-sm text-navy-500">{t('auth.uploadDocumentsSubtitle', 'Help us verify your identity and business (optional but recommended)')}</p>
                    <div className="mt-6 space-y-5">
                      <DocumentUploadArea label={t('auth.docPanCard', 'PAN Card')} hint={t('auth.docHintSize', 'JPG, PNG or PDF — max 10MB')} file={form.pan_doc} onChange={(f) => set('pan_doc', f)} />
                      <DocumentUploadArea label={t('auth.docAadhaar', 'Aadhaar / Government ID')} hint={t('auth.docHintSize', 'JPG, PNG or PDF — max 10MB')} file={form.id_doc} onChange={(f) => set('id_doc', f)} />
                      <DocumentUploadArea label={t('auth.docGstCertificate', 'GST Certificate')} hint={t('auth.docHintSize', 'JPG, PNG or PDF — max 10MB')} file={form.gst_doc} onChange={(f) => set('gst_doc', f)} />
                      <DocumentUploadArea label={t('auth.docBusinessRegCertificate', 'Business Registration Certificate')} hint={t('auth.docHintSize', 'JPG, PNG or PDF — max 10MB')} file={form.business_reg_doc} onChange={(f) => set('business_reg_doc', f)} />
                      <DocumentUploadArea label={t('auth.docAddressProof', 'Address Proof')} hint={t('auth.docHintSize', 'JPG, PNG or PDF — max 10MB')} file={form.address_proof_doc} onChange={(f) => set('address_proof_doc', f)} />
                      <div className="rounded-xl border border-gold-200 bg-gold-500/5 p-4 text-xs text-navy-500">
                        <ShieldCheck className="h-4 w-4 text-gold-600 mb-2" />
                        <p className="font-semibold text-navy-900">{t('auth.documentsSafeTitle', 'Your documents are safe')}</p>
                        <p className="mt-1">{t('auth.documentsSafeDesc', 'All documents are encrypted and only reviewed by our verified team.')}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ══ Step 5 — Review & Submit ════════════════════════════════════ */}
                {step === 5 && (
                  <div>
                    <h1 className="font-display text-2xl font-bold text-navy-900">{t('auth.reviewSubmitHeading', 'Review & Submit')}</h1>
                    <p className="mt-1 text-sm text-navy-500">{t('auth.reviewSubmitSubtitle', 'Please check your details before submitting')}</p>
                    <div className="mt-6 space-y-3">
                      {[
                        { label: t('auth.partnerTypeLabel', 'Partner Type'), value: form.partner_type || '—' },
                        { label: t('auth.reviewNameLabel', 'Name'), value: form.full_name },
                        { label: t('auth.reviewMobileLabel', 'Mobile'), value: form.mobile_number ? `+91 ${form.mobile_number}` : '—' },
                        { label: t('auth.email', 'Email'), value: form.email || '—' },
                        { label: t('auth.reviewCompanyLabel', 'Company'), value: form.company_name || '—' },
                        { label: t('auth.gstNumberLabel', 'GST Number'), value: form.gst_number || '—' },
                        { label: t('auth.panNumberLabel', 'PAN Number'), value: form.pan_number || '—' },
                        { label: t('auth.websiteLabel', 'Website'), value: form.website || '—' },
                        { label: t('auth.reviewCityStateLabel', 'City / State'), value: `${form.city}, ${form.state}` },
                        { label: t('auth.reviewPropertyTypesLabel', 'Property Types'), value: form.preferred_property_types.join(', ') || '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between items-start gap-4 rounded-lg border border-navy-200 bg-navy-50/50 px-4 py-2.5">
                          <span className="text-xs text-navy-500 flex-shrink-0 w-32">{label}</span>
                          <span className="text-sm text-navy-900 text-right break-all">{value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 space-y-2.5">
                      <label className="flex items-start gap-2.5 text-xs text-navy-600 cursor-pointer">
                        <input type="checkbox" checked={form.agree_privacy} onChange={(e) => set('agree_privacy', e.target.checked)} className="mt-0.5 accent-red-600 cursor-pointer" />
                        {t('auth.iAgreeToThe', 'I agree to the')}{' '}
                        <Link to="/privacy" className="text-red-600 hover:underline">{t('auth.privacyPolicyLink', 'Privacy Policy')}</Link>
                      </label>
                      <label className="flex items-start gap-2.5 text-xs text-navy-600 cursor-pointer">
                        <input type="checkbox" checked={form.agree_terms} onChange={(e) => set('agree_terms', e.target.checked)} className="mt-0.5 accent-red-600 cursor-pointer" />
                        {t('auth.iAgreeToThe', 'I agree to the')}{' '}
                        <Link to="/terms" className="text-red-600 hover:underline">{t('auth.partnerTermsLink', 'Partner Terms & Conditions')}</Link>
                      </label>
                      <label className="flex items-start gap-2.5 text-xs text-navy-600 cursor-pointer">
                        <input type="checkbox" checked={form.agree_verification} onChange={(e) => set('agree_verification', e.target.checked)} className="mt-0.5 accent-red-600 cursor-pointer" />
                        {t('auth.authorizeVerification', 'I authorize RealtyNow to verify the information provided')}
                      </label>
                    </div>

                    {serverError && (
                      <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        {serverError}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between gap-3">
              {step > 1 ? (
                <button onClick={prev} className="flex items-center gap-2 text-sm text-navy-500 hover:text-navy-900 transition-colors">
                  <ArrowLeft className="h-4 w-4" /> {t('auth.back', 'Back')}
                </button>
              ) : (
                <Link to="/login" className="text-sm text-navy-500 hover:text-navy-900 transition-colors">
                  {t('auth.alreadyAPartner', 'Already a Partner?')}
                </Link>
              )}

              {step < 5 ? (
                <Button variant="primary" size="lg" icon={<ArrowRight className="h-4 w-4" />} onClick={next}>
                  {t('auth.continueBtn', 'Continue')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  loading={loading}
                  disabled={!form.agree_privacy || !form.agree_terms || !form.agree_verification}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={submit}
                >
                  {t('auth.submitPartnerApplication', 'Submit Partner Application')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
