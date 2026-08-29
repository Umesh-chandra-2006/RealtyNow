import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  FileText,
  Briefcase,
  MapPin,
  Upload,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Building2,
  Star,
  Clock,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';
import { Logo, LogoLight } from '../../components/logo';
import { uploadFile } from '../../lib/storage';
import { uploadProfilePhoto } from '../../lib/profile-photo';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { useServiceStatus, SERVICE_KEYS } from '../../lib/service-status';
import { ServiceUnavailable } from '../../components/service-unavailable';

const SPECIALIZATIONS = [
  'Residential',
  'Commercial',
  'Luxury',
  'Plots & Land',
  'Rental',
  'Builder Projects',
  'Industrial',
];

const STEPS = [
  { id: 1, label: 'Personal Info', icon: User },
  { id: 2, label: 'Professional', icon: Briefcase },
  { id: 3, label: 'Documents', icon: FileText },
  { id: 4, label: 'Review & Submit', icon: CheckCircle2 },
];

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  whatsapp_same_as_phone: boolean;
  company: string;
  bio: string;
  license_number: string;
  specialization: string;
  experience_years: string;
  assigned_areas: string;
  profile_photo: File | null;
  id_doc: File | null;
  license_doc: File | null;
}

const INITIAL: FormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  whatsapp_number: '',
  whatsapp_same_as_phone: true,
  company: '',
  bio: '',
  license_number: '',
  specialization: '',
  experience_years: '',
  assigned_areas: '',
  profile_photo: null,
  id_doc: null,
  license_doc: null,
};

function FileUploadArea({
  label,
  hint,
  file,
  onChange,
  accept = 'image/*,.pdf',
}: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (f: File | null) => void;
  accept?: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-navy-600 mb-1.5">{label}</p>
      <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-200 bg-navy-50/50 px-4 py-5 cursor-pointer hover:border-gold-400 hover:bg-gold-500/5 transition-all">
        <input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="flex items-center gap-2 text-gold-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onChange(null);
              }}
              className="ml-1 text-navy-400 hover:text-error-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-6 w-6 text-navy-400" />
            <span className="text-sm text-navy-600">Click to upload</span>
            <span className="text-xs text-navy-500">{hint}</span>
          </>
        )}
      </label>
    </div>
  );
}

function AvatarUploadArea({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const previewUrl = file ? URL.createObjectURL(file) : null;
  return (
    <div>
      <p className="text-sm font-medium text-navy-600 mb-1.5">Profile Photo (optional)</p>
      <div className="flex items-center gap-4">
        <label className="relative h-20 w-20 rounded-full border-2 border-dashed border-navy-200 bg-navy-50/50 grid place-items-center cursor-pointer hover:border-gold-400 hover:bg-gold-500/5 transition-all overflow-hidden shrink-0">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
          {previewUrl ? (
            <img src={previewUrl} alt="Profile preview" className="h-full w-full object-cover" />
          ) : (
            <Upload className="h-6 w-6 text-navy-400" />
          )}
        </label>
        <div className="flex-1">
          <p className="text-xs text-navy-500">JPG, PNG or WEBP — max 5MB</p>
          {file && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="mt-1 flex items-center gap-1 text-xs text-navy-400 hover:text-error-400"
            >
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AgentRegisterPage() {
  const { isActive: agentServiceActive, loading: agentServiceLoading } = useServiceStatus(SERVICE_KEYS.AGENT);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // Synchronous guard against double-submit — a fast double-click can invoke
  // submit() twice before the `loading` state re-render disables the button,
  // which previously raced two uploads to the same storage path and hit
  // storage's unique (bucket_id, name) constraint.
  const submittingRef = useRef(false);

  const set = (key: keyof FormData, val: string | File | null | boolean) => setForm((f) => ({ ...f, [key]: val }));

  const validateStep = () => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (step === 1) {
      if (!form.first_name.trim()) errs.first_name = 'Required';
      if (!form.last_name.trim()) errs.last_name = 'Required';
      if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errs.email = 'Valid email required';
      if (form.phone.replace(/\D/g, '').length < 10) errs.phone = 'Valid phone required';
    }
    if (step === 2) {
      if (!form.specialization) errs.specialization = 'Required';
      if (!form.experience_years) errs.experience_years = 'Required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (validateStep()) setStep((s) => s + 1);
  };
  const prev = () => setStep((s) => s - 1);

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setServerError(null);
    try {
      let profile_image: string | null = null;
      let id_doc_url: string | null = null;
      let license_doc_url: string | null = null;

      if (form.profile_photo) {
        // Best-effort: a profile photo upload failure must never block submission
        // of the (required) application itself.
        const r = await uploadProfilePhoto(form.profile_photo, 'agent');
        if (!r.error) profile_image = r.url;
        else console.warn('Profile photo upload failed:', r.error);
      }

      if (form.id_doc) {
        // crypto.randomUUID() (not Date.now()) guarantees a unique storage path even
        // if two uploads race (e.g. a fast double-click on Submit) — storage.objects
        // has a unique (bucket_id, name) constraint, and a timestamp-only path let
        // two concurrent uploads collide on it.
        const r = await uploadFile('agent-documents', form.id_doc, `applications/id-${crypto.randomUUID()}-${form.id_doc.name}`);
        if (r.error) throw new Error(r.error);
        // Store permanent storage PATH (r.path), NOT the temporary signed URL (r.url).
        // Admin portal generates fresh signed URLs on-demand when previewing.
        id_doc_url = r.path || null;
      }
      if (form.license_doc) {
        const r = await uploadFile(
          'agent-documents',
          form.license_doc,
          `applications/lic-${crypto.randomUUID()}-${form.license_doc.name}`,
        );
        if (r.error) throw new Error(r.error);
        license_doc_url = r.path || null;
      }

      const basePayload = {
        // Explicit, not relying on the column default — a prior mismatch between
        // the default ('pending') and the status CHECK constraint (pipeline
        // stages starting at 'submitted') made every insert fail silently.
        status: 'submitted',
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        phone_number: form.phone.trim(),
        whatsapp_number: form.whatsapp_same_as_phone ? form.phone.trim() : (form.whatsapp_number.trim() || form.phone.trim()),
        whatsapp_same_as_phone: form.whatsapp_same_as_phone,
        company: form.company.trim() || null,
        bio: form.bio.trim() || null,
        license_number: form.license_number.trim() || null,
        specialization: form.specialization || null,
        experience_years: form.experience_years ? Number(form.experience_years) : null,
        assigned_areas: form.assigned_areas
          ? form.assigned_areas
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean)
          : null,
        id_doc_url,
        license_doc_url,
      };

      let { error } = await supabase
        .from('agent_applications')
        .insert({ ...basePayload, profile_image });

      // Defensive fallback: if the profile_image column hasn't been migrated
      // onto this database yet, don't let that block the application itself.
      if (error && /profile_image/i.test(error.message)) {
        ({ error } = await supabase.from('agent_applications').insert(basePayload));
      }
      if (error) throw new Error(error.message);
      setSubmitted(true);
    } catch (e: unknown) {
      setServerError(getFriendlyErrorMessage(e));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  if (!agentServiceLoading && !agentServiceActive) {
    return <ServiceUnavailable serviceName="Agent Service" />;
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-navy-50 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center"
        >
          <div className="h-24 w-24 mx-auto rounded-full bg-gold-500/20 flex items-center justify-center mb-6">
            <CheckCircle2 className="h-12 w-12 text-gold-600" />
          </div>
          <h1 className="font-display text-3xl font-bold text-navy-900">Application Submitted!</h1>
          <p className="mt-3 text-navy-600">
            Thank you, <span className="text-gold-300 font-semibold">{form.first_name}</span>! Our team will review your
            application and contact you at <span className="text-gold-300">{form.email}</span> within 2–3 business days.
          </p>
          <div className="mt-6 rounded-xl border border-navy-200 bg-navy-50/50 p-4 text-sm text-navy-500 space-y-2">
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gold-600" /> Review: 2–3 business days
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gold-600" /> Document verification
            </p>
            <p className="flex items-center gap-2">
              <Star className="h-4 w-4 text-gold-600" /> License validation
            </p>
          </div>
          <Link to="/" className="mt-8 inline-block">
            <Button variant="primary" size="lg">
              Back to Home
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="absolute bottom-0 -left-20 h-96 w-96 rounded-full bg-navy-700/20 blur-3xl" />
      </div>

      <div className="relative grid lg:grid-cols-[380px,1fr] min-h-screen">
        {/* LEFT PANEL */}
        <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 border-r border-navy-800 p-10 relative overflow-hidden z-10">
          <LogoLight to="/" size={220} />

          <div>
            <h2 className="font-display text-3xl font-bold text-white leading-tight">
              Join RealtyNow as a Verified Agent
            </h2>
            <p className="mt-3 text-navy-200 text-sm leading-relaxed">
              Connect with serious buyers & renters. Grow your real estate business with AI-powered tools.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                { icon: Building2, text: 'Access verified active listings' },
                { icon: Star, text: 'Priority lead distribution' },
                { icon: ShieldCheck, text: 'Verified agent badge on profile' },
                { icon: Clock, text: '24/7 dedicated agent support' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-navy-200">
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gold-400/20 grid place-items-center">
                    <Icon className="h-4 w-4 text-gold-400" />
                  </div>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <p className="text-xs text-navy-400 uppercase tracking-wide font-semibold">Application progress</p>
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${step === s.id ? 'bg-gold-400/20 text-gold-300' : step > s.id ? 'text-success-400' : 'text-navy-500'}`}
              >
                <s.icon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{s.label}</span>
                {step > s.id && <CheckCircle2 className="h-3.5 w-3.5 ml-auto" />}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex items-start justify-center px-6 py-12 overflow-y-auto">
          <div className="w-full max-w-lg">
            {/* Mobile logo */}
            <div className="lg:hidden flex justify-center mb-8">
              <Logo to="/" size={220} />
            </div>

            {/* Step indicator (mobile) */}
            <div className="lg:hidden flex items-center gap-2 mb-6 justify-center">
              {STEPS.map((s) => (
                <div
                  key={s.id}
                  className={`h-2 rounded-full transition-all ${step === s.id ? 'w-8 bg-gold-500' : step > s.id ? 'w-4 bg-success-500' : 'w-4 bg-white/20'}`}
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
                {/* Step 1 – Personal Info */}
                {step === 1 && (
                  <div>
                    <h1 className="font-display text-2xl font-bold text-navy-900">Personal Information</h1>
                    <p className="mt-1 text-sm text-navy-500">Tell us about yourself</p>
                    <div className="mt-6 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-navy-600 mb-1.5">First Name *</label>
                          <input
                            value={form.first_name}
                            onChange={(e) => set('first_name', e.target.value)}
                            className="w-full rounded-lg border border-navy-200 bg-white shadow-sm px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-navy-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            placeholder="Arjun"
                          />
                          {errors.first_name && <p className="mt-1 text-xs text-error-600">{errors.first_name}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-navy-600 mb-1.5">Last Name *</label>
                          <input
                            value={form.last_name}
                            onChange={(e) => set('last_name', e.target.value)}
                            className="w-full rounded-lg border border-navy-200 bg-white shadow-sm px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-navy-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            placeholder="Sharma"
                          />
                          {errors.last_name && <p className="mt-1 text-xs text-error-600">{errors.last_name}</p>}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-600 mb-1.5">
                          <Mail className="inline h-3.5 w-3.5 mr-1" />
                          Email Address *
                        </label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => set('email', e.target.value)}
                          className="w-full rounded-lg border border-navy-200 bg-white shadow-sm px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-navy-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                          placeholder="arjun@realty.com"
                        />
                        {errors.email && <p className="mt-1 text-xs text-error-600">{errors.email}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-600 mb-1.5">
                          <Phone className="inline h-3.5 w-3.5 mr-1" />
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) => {
                            const val = e.target.value;
                            set('phone', val);
                            if (form.whatsapp_same_as_phone) {
                              set('whatsapp_number', val);
                            }
                          }}
                          className="w-full rounded-lg border border-navy-200 bg-white shadow-sm px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-navy-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                          placeholder="+91 98000 00000"
                        />
                        {errors.phone && <p className="mt-1 text-xs text-error-600">{errors.phone}</p>}

                        <div className="mt-2.5 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="whatsapp_same_as_phone"
                            checked={form.whatsapp_same_as_phone}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              set('whatsapp_same_as_phone', checked);
                              if (checked) {
                                set('whatsapp_number', form.phone);
                              }
                            }}
                            className="h-4 w-4 rounded border-navy-300 text-red-600 focus:ring-red-400 accent-red-600 cursor-pointer"
                          />
                          <label htmlFor="whatsapp_same_as_phone" className="text-xs text-navy-700 font-medium cursor-pointer">
                            WhatsApp number is same as phone number
                          </label>
                        </div>

                        {!form.whatsapp_same_as_phone && (
                          <div className="mt-3">
                            <label className="block text-sm font-medium text-navy-600 mb-1.5">
                              WhatsApp Number
                            </label>
                            <input
                              type="tel"
                              value={form.whatsapp_number}
                              onChange={(e) => set('whatsapp_number', e.target.value)}
                              className="w-full rounded-lg border border-navy-200 bg-white shadow-sm px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-navy-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                              placeholder="+91 98000 00000"
                            />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-600 mb-1.5">
                          Company / Brokerage (optional)
                        </label>
                        <input
                          value={form.company}
                          onChange={(e) => set('company', e.target.value)}
                          className="w-full rounded-lg border border-navy-200 bg-white shadow-sm px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-navy-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                          placeholder="Sharma Realty Pvt Ltd"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2 – Professional */}
                {step === 2 && (
                  <div>
                    <h1 className="font-display text-2xl font-bold text-navy-900">Professional Details</h1>
                    <p className="mt-1 text-sm text-navy-500">Help clients understand your expertise</p>
                    <div className="mt-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-navy-600 mb-1.5">Specialization *</label>
                        <select
                          value={form.specialization}
                          onChange={(e) => set('specialization', e.target.value)}
                          className="w-full rounded-lg border border-navy-200 bg-white shadow-sm px-3.5 py-2.5 text-sm text-navy-900 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                        >
                          <option value="">Select specialization…</option>
                          {SPECIALIZATIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {errors.specialization && (
                          <p className="mt-1 text-xs text-error-600">{errors.specialization}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-600 mb-1.5">Years of Experience *</label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={form.experience_years}
                          onChange={(e) => set('experience_years', e.target.value)}
                          className="w-full rounded-lg border border-navy-200 bg-white shadow-sm px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-navy-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                          placeholder="5"
                        />
                        {errors.experience_years && (
                          <p className="mt-1 text-xs text-error-600">{errors.experience_years}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-600 mb-1.5">
                          RERA License Number (if available)
                        </label>
                        <input
                          value={form.license_number}
                          onChange={(e) => set('license_number', e.target.value)}
                          className="w-full rounded-lg border border-navy-200 bg-white shadow-sm px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-navy-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                          placeholder="MH/RERA/XXXXXX"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-600 mb-1.5">
                          <MapPin className="inline h-3.5 w-3.5 mr-1" />
                          Areas You Cover (comma separated)
                        </label>
                        <input
                          value={form.assigned_areas}
                          onChange={(e) => set('assigned_areas', e.target.value)}
                          className="w-full rounded-lg border border-navy-200 bg-white shadow-sm px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-navy-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                          placeholder="Banjara Hills, Jubilee Hills, Gachibowli"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-600 mb-1.5">Bio / About You</label>
                        <textarea
                          rows={3}
                          value={form.bio}
                          onChange={(e) => set('bio', e.target.value)}
                          className="w-full rounded-lg border border-navy-200 bg-white shadow-sm px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-navy-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 resize-none"
                          placeholder="Tell us about your experience and what makes you a great agent…"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3 – Documents */}
                {step === 3 && (
                  <div>
                    <h1 className="font-display text-2xl font-bold text-navy-900">Upload Documents</h1>
                    <p className="mt-1 text-sm text-navy-500">Help us verify your identity and credentials</p>
                    <div className="mt-6 space-y-5">
                      <AvatarUploadArea file={form.profile_photo} onChange={(f) => set('profile_photo', f)} />
                      <FileUploadArea
                        label="Government ID (Aadhaar / PAN / Passport) *"
                        hint="JPG, PNG or PDF — max 10MB"
                        file={form.id_doc}
                        onChange={(f) => set('id_doc', f)}
                      />
                      <FileUploadArea
                        label="RERA License / Registration Certificate (optional)"
                        hint="JPG, PNG or PDF — max 10MB"
                        file={form.license_doc}
                        onChange={(f) => set('license_doc', f)}
                      />
                      <div className="rounded-xl border border-gold-200 bg-gold-500/5 p-4 text-xs text-navy-500">
                        <ShieldCheck className="h-4 w-4 text-gold-600 mb-2" />
                        <p className="font-semibold text-navy-900">Your documents are safe</p>
                        <p className="mt-1">
                          All documents are encrypted and only reviewed by our verified team. They will not be shared
                          publicly.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4 – Review */}
                {step === 4 && (
                  <div>
                    <h1 className="font-display text-2xl font-bold text-navy-900">Review & Submit</h1>
                    <p className="mt-1 text-sm text-navy-500">Please check your details before submitting</p>
                    <div className="mt-6 space-y-3">
                      {[
                        { label: 'Name', value: `${form.first_name} ${form.last_name}` },
                        { label: 'Email', value: form.email },
                        { label: 'Phone', value: form.phone },
                        { label: 'Company', value: form.company || '—' },
                        { label: 'Specialization', value: form.specialization || '—' },
                        { label: 'Experience', value: form.experience_years ? `${form.experience_years} years` : '—' },
                        { label: 'RERA License', value: form.license_number || '—' },
                        { label: 'Areas', value: form.assigned_areas || '—' },
                        { label: 'Govt ID', value: form.id_doc?.name ?? 'Not uploaded' },
                        { label: 'License Doc', value: form.license_doc?.name ?? 'Not uploaded' },
                      ].map(({ label, value }) => (
                        <div
                          key={label}
                          className="flex justify-between items-start gap-4 rounded-lg border border-navy-200 bg-navy-50/50 px-4 py-2.5"
                        >
                          <span className="text-xs text-navy-500 flex-shrink-0 w-32">{label}</span>
                          <span className="text-sm text-navy-900 text-right break-all">{value}</span>
                        </div>
                      ))}
                    </div>

                    {serverError && (
                      <div className="mt-4 rounded-lg border border-error-500/30 bg-error-500/10 px-3 py-2 text-sm text-error-300">
                        {serverError}
                      </div>
                    )}

                    <p className="mt-4 text-xs text-navy-500">
                      By submitting, you agree to our{' '}
                      <Link to="/terms" className="text-gold-600 hover:underline">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link to="/privacy" className="text-gold-600 hover:underline">
                        Privacy Policy
                      </Link>
                      .
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between gap-3">
              {step > 1 ? (
                <button
                  onClick={prev}
                  className="flex items-center gap-2 text-sm text-navy-500 hover:text-navy-900 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              ) : (
                <Link to="/agent/login" className="text-sm text-navy-500 hover:text-navy-900 transition-colors">
                  Already registered?
                </Link>
              )}

              {step < 4 ? (
                <Button variant="primary" size="lg" icon={<ArrowRight className="h-4 w-4" />} onClick={next}>
                  Continue
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  loading={loading}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={submit}
                >
                  Submit Application
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
