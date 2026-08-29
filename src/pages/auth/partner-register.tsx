import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  MapPin,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  FileCheck,
  Building2,
  Phone,
  Mail,
  ShieldCheck,
  FileText,
  Landmark,
  Sparkles,
  AlertCircle,
  X,
  Search,
  Loader2,
  Navigation,
  Check,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Logo } from '../../components/logo';
import { uploadFile } from '../../lib/storage';
import {
  getIndianStates,
  getCitiesForState,
  getDistrictsForCity,
} from '../../lib/indian-location-data';
import {
  searchGoogleIndianCities,
  searchGoogleCityAreas,
  fetchPopularAreasForCity,
  resolveGooglePlaceDetails,
  geocodeLocationAddress,
  type GooglePlacePrediction,
} from '../../lib/google-location-service';
import {
  type PartnerRegistrationFormData,
  type FieldErrors,
  validateStep1BasicDetails,
  validateStep2Location,
  validateStep3FinancialDetails,
  cleanMobile,
  cleanAadhaar,
  cleanPAN,
  cleanGSTIN,
  cleanIFSC,
} from '../../lib/partner-validation';

export const PARTNER_TYPE_OPTIONS = [
  'Individual Partner',
  'Plumber',
  'Carpenter',
  'Painter',
  'Packers & Movers',
  'Borewell',
  'Interiors',
  'Rental Agent',
  'Real Estate Agent',
  'Electrician',
  'Loan Agent',
  'Interior Designer',
  'Architect',
  'Property Planner',
  'Building Material Supplier',
  'Property Valuer',
  'Other',
];

const STEPS = [
  { id: 1, number: '01', title: 'Basic Details', icon: User },
  { id: 2, number: '02', title: 'Location', icon: MapPin },
  { id: 3, number: '03', title: 'Business & Financial Details', icon: Briefcase },
];

const INITIAL_FORM: PartnerRegistrationFormData = {
  partner_type: '',
  surname: '',
  name: '',
  mobile_number: '',
  email: '',
  business_name: '',
  gst_number: '',
  aadhaar_number: '',
  pan_number: '',
  address: '',
  country: 'India',
  state: '',
  city: '',
  area: '',
  district: '',
  google_place_id: '',
  latitude: undefined,
  longitude: undefined,
  formatted_address: '',
  business_registration: '',
  business_reg_doc: null,
  aadhaar_doc: null,
  pan_doc: null,
  bank_account_holder_name: '',
  bank_name: '',
  bank_account_number: '',
  bank_ifsc_code: '',
  gst_doc: null,
};

export function PartnerRegisterPage() {
  const [step, setStep] = useState<number>(1);
  const [form, setForm] = useState<PartnerRegistrationFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null);

  // Google Location UI State
  const [citySearchInput, setCitySearchInput] = useState<string>('');
  const [cityPredictions, setCityPredictions] = useState<GooglePlacePrediction[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState<boolean>(false);
  const [showCityDropdown, setShowCityDropdown] = useState<boolean>(false);

  const [areaSearchInput, setAreaSearchInput] = useState<string>('');
  const [areaPredictions, setAreaPredictions] = useState<GooglePlacePrediction[]>([]);
  const [popularAreas, setPopularAreas] = useState<string[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState<boolean>(false);
  const [showAreaDropdown, setShowAreaDropdown] = useState<boolean>(false);

  const [isResolvingPlace, setIsResolvingPlace] = useState<boolean>(false);
  const cityDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const areaDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Available fallback states and districts
  const allStates = useMemo(() => getIndianStates(), []);
  const availableDistricts = useMemo(
    () => (form.state && form.city ? getDistrictsForCity(form.state, form.city) : []),
    [form.state, form.city]
  );

  // Load popular areas whenever city or state changes
  useEffect(() => {
    if (form.city) {
      let isMounted = true;
      setIsLoadingAreas(true);
      fetchPopularAreasForCity(form.city, form.state)
        .then((areas) => {
          if (isMounted) {
            setPopularAreas(areas);
            setIsLoadingAreas(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsLoadingAreas(false);
        });

      return () => {
        isMounted = false;
      };
    } else {
      setPopularAreas([]);
    }
  }, [form.city, form.state]);

  // Field change handler
  const updateField = (field: keyof PartnerRegistrationFormData, value: any) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'state' && prev.state !== value) {
        // If state changed manually, clear city/area/district if not matching
        updated.city = '';
        updated.area = '';
        updated.district = '';
      }
      return updated;
    });

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Google City Search with Debouncing
  const handleCityInputChange = (text: string) => {
    setCitySearchInput(text);
    setShowCityDropdown(true);

    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    if (!text.trim()) {
      setCityPredictions([]);
      setIsSearchingCity(false);
      return;
    }

    setIsSearchingCity(true);
    cityDebounceRef.current = setTimeout(async () => {
      try {
        const preds = await searchGoogleIndianCities(text);
        setCityPredictions(preds);
      } catch {
        setCityPredictions([]);
      } finally {
        setIsSearchingCity(false);
      }
    }, 300);
  };

  // Select City from Google Places Prediction
  const handleSelectCityPrediction = async (prediction: GooglePlacePrediction) => {
    setShowCityDropdown(false);
    setCitySearchInput(prediction.mainText);
    setIsResolvingPlace(true);

    try {
      const details = await resolveGooglePlaceDetails(prediction.placeId);
      if (details) {
        setForm((prev) => ({
          ...prev,
          city: details.city || prediction.mainText,
          state: details.state || prev.state || 'Telangana',
          district: details.district || details.city || prev.district,
          area: '', // reset area for new city
          google_place_id: details.placeId || prediction.placeId,
          latitude: details.latitude,
          longitude: details.longitude,
          formatted_address: details.formattedAddress,
        }));
      } else {
        setForm((prev) => ({
          ...prev,
          city: prediction.mainText,
          area: '',
        }));
      }

      setAreaSearchInput('');
      setErrors((prev) => {
        const next = { ...prev };
        delete next.city;
        delete next.state;
        delete next.district;
        return next;
      });
    } finally {
      setIsResolvingPlace(false);
    }
  };

  // Google Area Search within selected City with Debouncing
  const handleAreaInputChange = (text: string) => {
    setAreaSearchInput(text);
    setShowAreaDropdown(true);

    if (areaDebounceRef.current) clearTimeout(areaDebounceRef.current);
    if (!text.trim() || !form.city) {
      setAreaPredictions([]);
      return;
    }

    areaDebounceRef.current = setTimeout(async () => {
      try {
        const preds = await searchGoogleCityAreas(text, form.city, form.state);
        setAreaPredictions(preds);
      } catch {
        setAreaPredictions([]);
      }
    }, 300);
  };

  // Select Area from Google Places Prediction
  const handleSelectAreaPrediction = async (prediction: GooglePlacePrediction) => {
    setShowAreaDropdown(false);
    const selectedAreaName = prediction.mainText;
    setAreaSearchInput(selectedAreaName);
    setIsResolvingPlace(true);

    try {
      const details = await resolveGooglePlaceDetails(prediction.placeId);
      if (details) {
        setForm((prev) => ({
          ...prev,
          area: details.area || selectedAreaName,
          city: details.city || prev.city,
          state: details.state || prev.state,
          district: details.district || prev.district,
          google_place_id: details.placeId || prediction.placeId,
          latitude: details.latitude ?? prev.latitude,
          longitude: details.longitude ?? prev.longitude,
          formatted_address: details.formattedAddress,
        }));
      } else {
        setForm((prev) => ({
          ...prev,
          area: selectedAreaName,
        }));
      }

      setErrors((prev) => {
        const next = { ...prev };
        delete next.area;
        delete next.district;
        return next;
      });
    } finally {
      setIsResolvingPlace(false);
    }
  };

  // Quick Select Area from Popular Pills
  const handleSelectPopularArea = async (areaName: string) => {
    setAreaSearchInput(areaName);
    setShowAreaDropdown(false);
    setIsResolvingPlace(true);

    try {
      const details = await geocodeLocationAddress(`${areaName}, ${form.city}, ${form.state || 'India'}`);
      if (details) {
        setForm((prev) => ({
          ...prev,
          area: areaName,
          district: details.district || prev.district,
          state: details.state || prev.state,
          google_place_id: details.placeId,
          latitude: details.latitude,
          longitude: details.longitude,
          formatted_address: details.formattedAddress,
        }));
      } else {
        setForm((prev) => ({
          ...prev,
          area: areaName,
        }));
      }

      setErrors((prev) => {
        const next = { ...prev };
        delete next.area;
        return next;
      });
    } finally {
      setIsResolvingPlace(false);
    }
  };

  // Auto-detect Location via browser geolocation + Google Geocoding
  const handleDetectLocation = async () => {
    if (!navigator.geolocation) return;
    setIsResolvingPlace(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
          let details: any = null;

          if (apiKey) {
            const res = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${encodeURIComponent(apiKey)}`
            );
            if (res.ok) {
              const data = await res.json();
              if (data.status === 'OK' && data.results?.[0]) {
                const first = data.results[0];
                const comps = first.address_components || [];
                const get = (t: string) => comps.find((c: any) => c.types.includes(t))?.long_name || '';

                details = {
                  city: get('locality') || get('administrative_area_level_2') || 'Hyderabad',
                  area: get('sublocality_level_1') || get('sublocality') || get('neighborhood') || '',
                  state: get('administrative_area_level_1') || 'Telangana',
                  district: get('administrative_area_level_2') || get('administrative_area_level_3') || 'Hyderabad',
                  placeId: first.place_id,
                  formattedAddress: first.formatted_address,
                  latitude,
                  longitude,
                };
              }
            }
          }

          if (details) {
            setForm((prev) => ({
              ...prev,
              city: details.city,
              area: details.area,
              state: details.state,
              district: details.district,
              google_place_id: details.placeId,
              latitude: details.latitude,
              longitude: details.longitude,
              formatted_address: details.formattedAddress,
            }));
            setCitySearchInput(details.city);
            setAreaSearchInput(details.area);
            setErrors({});
          }
        } catch (err) {
          console.warn('Location detection failed:', err);
        } finally {
          setIsResolvingPlace(false);
        }
      },
      () => {
        setIsResolvingPlace(false);
      },
      { timeout: 8000 }
    );
  };

  // Step 1 -> Step 2 validation
  const handleProceedToStep2 = () => {
    const step1Errors = validateStep1BasicDetails(form);
    if (Object.keys(step1Errors).length > 0) {
      setErrors(step1Errors);
      window.scrollTo({ top: 180, behavior: 'smooth' });
      return;
    }
    setErrors({});
    setStep(2);
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  // Step 2 -> Step 3 validation
  const handleProceedToStep3 = () => {
    const step2Errors = validateStep2Location(form);
    if (Object.keys(step2Errors).length > 0) {
      setErrors(step2Errors);
      window.scrollTo({ top: 180, behavior: 'smooth' });
      return;
    }
    setErrors({});
    setStep(3);
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  // Step 3 submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const step3Errors = validateStep3FinancialDetails(form);
    if (Object.keys(step3Errors).length > 0) {
      setErrors(step3Errors);
      window.scrollTo({ top: 180, behavior: 'smooth' });
      return;
    }

    setErrors({});
    setSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Upload documents in parallel if present
      let businessRegUrl: string | null = null;
      let aadhaarDocUrl: string | null = null;
      let panDocUrl: string | null = null;
      let gstDocUrl: string | null = null;

      const uploadTasks: Promise<void>[] = [];

      if (form.business_reg_doc) {
        uploadTasks.push(
          uploadFile('partner-documents', form.business_reg_doc).then((res) => {
            if (res.path) businessRegUrl = res.path;
          })
        );
      }

      if (form.aadhaar_doc) {
        uploadTasks.push(
          uploadFile('partner-documents', form.aadhaar_doc).then((res) => {
            if (res.path) aadhaarDocUrl = res.path;
          })
        );
      }

      if (form.pan_doc) {
        uploadTasks.push(
          uploadFile('partner-documents', form.pan_doc).then((res) => {
            if (res.path) panDocUrl = res.path;
          })
        );
      }

      if (form.gst_doc) {
        uploadTasks.push(
          uploadFile('partner-documents', form.gst_doc).then((res) => {
            if (res.path) gstDocUrl = res.path;
          })
        );
      }

      await Promise.all(uploadTasks);

      // 2. Build registration payload
      const payload = {
        partner_type: form.partner_type.trim() || 'Individual Partner',
        surname: form.surname.trim(),
        name: form.name.trim(),
        full_name: `${form.name.trim()} ${form.surname.trim()}`.trim(),
        mobile_number: form.mobile_number.trim(),
        email: form.email.trim(),
        business_name: form.business_name.trim(),
        company_name: form.business_name.trim(),
        gst_number: cleanGSTIN(form.gst_number),
        aadhaar_number: cleanAadhaar(form.aadhaar_number),
        pan_number: cleanPAN(form.pan_number),
        address: form.address.trim(),
        address_line_1: form.address.trim(),
        state: form.state.trim(),
        city: form.city.trim(),
        area: form.area.trim(),
        district: form.district.trim(),
        google_place_id: form.google_place_id || null,
        latitude: form.latitude || null,
        longitude: form.longitude || null,
        business_registration: form.business_registration.trim() || null,
        business_reg_doc_url: businessRegUrl,
        aadhaar_doc_url: aadhaarDocUrl,
        id_doc_url: aadhaarDocUrl,
        pan_doc_url: panDocUrl,
        gst_doc_url: gstDocUrl,
        bank_account_details: {
          account_holder_name: form.bank_account_holder_name.trim(),
          bank_name: form.bank_name.trim(),
          account_number: form.bank_account_number.trim(),
          ifsc_code: cleanIFSC(form.bank_ifsc_code),
        },
      };

      // 3. Execute registration via Supabase RPC
      const { data: appNum, error: rpcError } = await supabase.rpc(
        'submit_partner_application',
        { p_application: payload }
      );

      if (rpcError) {
        // Fallback: direct insert if RPC encounters schema discrepancy
        const { data: inserted, error: insertError } = await supabase
          .from('partner_applications')
          .insert({
            status: 'submitted',
            partner_type: payload.partner_type,
            surname: payload.surname,
            name: payload.name,
            full_name: payload.full_name,
            mobile_number: payload.mobile_number,
            email: payload.email,
            business_name: payload.business_name,
            company_name: payload.business_name,
            gst_number: payload.gst_number,
            aadhaar_number: payload.aadhaar_number,
            pan_number: payload.pan_number,
            address_line_1: payload.address,
            state: payload.state,
            city: payload.city,
            area: payload.area,
            district: payload.district,
            google_place_id: payload.google_place_id,
            latitude: payload.latitude,
            longitude: payload.longitude,
            business_registration: payload.business_registration,
            business_reg_doc_url: businessRegUrl,
            aadhaar_doc_url: aadhaarDocUrl,
            pan_doc_url: panDocUrl,
            gst_doc_url: gstDocUrl,
            bank_account_details: payload.bank_account_details,
          })
          .select('application_number')
          .single();

        if (insertError) throw new Error(insertError.message);
        setApplicationNumber(inserted?.application_number || 'Submitted');
      } else {
        setApplicationNumber(appNum || 'RNP-2026-CONFIRMED');
      }

      window.scrollTo({ top: 120, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Registration failed:', err);
      setSubmitError(err.message || 'Registration submission failed. Please check your information and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Render Document Upload Box
  const renderDocUploadBox = (
    label: string,
    field: 'business_reg_doc' | 'aadhaar_doc' | 'pan_doc' | 'gst_doc',
    currentFile: File | null,
    errorKey?: string
  ) => {
    const hasError = !!errors[errorKey || field];

    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-700">{label}</label>
        <div
          className={`relative rounded-2xl border-2 border-dashed p-4 text-center transition-colors ${
            currentFile
              ? 'border-emerald-300 bg-emerald-50/40'
              : hasError
              ? 'border-red-300 bg-red-50/30'
              : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
          }`}
        >
          {currentFile ? (
            <div className="flex items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{currentFile.name}</p>
                  <p className="text-[10px] text-slate-500">{(currentFile.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateField(field, null)}
                className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="cursor-pointer block">
              <Upload className="h-6 w-6 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-slate-700">Click to upload document</p>
              <p className="text-[10px] text-slate-400 mt-0.5">PDF, PNG, JPG up to 10MB</p>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) updateField(field, f);
                }}
                className="sr-only"
              />
            </label>
          )}
        </div>
        {hasError && <p className="text-[11px] font-medium text-red-600">{errors[errorKey || field]}</p>}
      </div>
    );
  };

  // SUCCESS CONFIRMATION VIEW
  if (applicationNumber) {
    return (
      <div className="min-h-screen bg-slate-50/50 py-12 px-4 sm:px-6 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="max-w-md w-full rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/80 shadow-xl text-center"
        >
          <div className="h-16 w-16 rounded-2xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-9 w-9" />
          </div>

          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-700 mb-3">
            <ShieldCheck className="h-3.5 w-3.5" /> Status: Pending Verification
          </span>

          <h2 className="font-display text-2xl font-bold text-slate-900">Application Submitted!</h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
            Thank you for registering as a RealtyNow Business Partner. Your application has been received and is now pending admin review.
          </p>

          <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Application Number</span>
              <span className="font-mono font-bold text-slate-900">{applicationNumber}</span>
            </div>
            <div className="flex justify-between items-center text-xs mt-2 pt-2 border-t border-slate-200">
              <span className="text-slate-500 font-medium">Applicant Name</span>
              <span className="font-semibold text-slate-900">{form.name} {form.surname}</span>
            </div>
            <div className="flex justify-between items-center text-xs mt-2 pt-2 border-t border-slate-200">
              <span className="text-slate-500 font-medium">Registered Mobile</span>
              <span className="font-semibold text-slate-900">{form.mobile_number}</span>
            </div>
            <div className="flex justify-between items-center text-xs mt-2 pt-2 border-t border-slate-200">
              <span className="text-slate-500 font-medium">Business Location</span>
              <span className="font-semibold text-slate-900 truncate max-w-[180px]">
                {[form.area, form.city, form.state].filter(Boolean).join(', ')}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              to="/login"
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-xs"
            >
              Go to Login
            </Link>
            <Link
              to="/"
              className="w-full py-2.5 rounded-xl text-slate-600 hover:text-slate-900 font-semibold text-xs transition-colors"
            >
              Return to Homepage
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/60 py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-3">
            <Logo className="h-8 w-auto mx-auto" />
          </Link>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Business Partner Registration
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Join RealtyNow's verified business partner network
          </p>
        </div>

        {/* 3-Step Stepper Bar */}
        <div className="mb-8 bg-white rounded-2xl p-3 border border-slate-200/90 shadow-xs">
          <div className="grid grid-cols-3 gap-2">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isPast = step > s.id;

              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 p-2 rounded-xl transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : isPast
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-400 bg-slate-50/60'
                  }`}
                >
                  <div
                    className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : isPast
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="h-4 w-4" /> : s.number}
                  </div>
                  <div className="min-w-0 hidden sm:block">
                    <p className="text-[11px] font-bold truncate leading-tight">{s.title}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm">
          {submitError && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-800">Registration Error</p>
                <p className="text-xs text-red-700 mt-0.5">{submitError}</p>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* STEP 1: BASIC DETAILS */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h2 className="text-base font-bold text-slate-900">Step 1 — Basic Details</h2>
                  <p className="text-xs text-slate-500">Enter your personal and business identification details</p>
                </div>

                {/* 1. Partner Type (First Field) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Partner Type</label>
                  <select
                    value={form.partner_type}
                    onChange={(e) => updateField('partner_type', e.target.value)}
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 transition-colors ${
                      errors.partner_type
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                    }`}
                  >
                    <option value="">Select partner type...</option>
                    {PARTNER_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {errors.partner_type && <p className="text-[11px] font-medium text-red-600 mt-1">{errors.partner_type}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Surname */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Surname</label>
                    <input
                      type="text"
                      placeholder="e.g. Rao"
                      value={form.surname}
                      onChange={(e) => updateField('surname', e.target.value)}
                      className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                        errors.surname
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    />
                    {errors.surname && <p className="text-[11px] font-medium text-red-600 mt-1">{errors.surname}</p>}
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Vikram"
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                        errors.name
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    />
                    {errors.name && <p className="text-[11px] font-medium text-red-600 mt-1">{errors.name}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Mobile Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      maxLength={10}
                      value={form.mobile_number}
                      onChange={(e) => updateField('mobile_number', cleanMobile(e.target.value))}
                      className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                        errors.mobile_number
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    />
                    {errors.mobile_number && <p className="text-[11px] font-medium text-red-600 mt-1">{errors.mobile_number}</p>}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="e.g. vikram@realtypartners.in"
                      value={form.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                        errors.email
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    />
                    {errors.email && <p className="text-[11px] font-medium text-red-600 mt-1">{errors.email}</p>}
                  </div>
                </div>

                {/* Business Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Realty & Advisory Services"
                    value={form.business_name}
                    onChange={(e) => updateField('business_name', e.target.value)}
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                      errors.business_name
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                    }`}
                  />
                  {errors.business_name && <p className="text-[11px] font-medium text-red-600 mt-1">{errors.business_name}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* GST */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">GST</label>
                    <input
                      type="text"
                      placeholder="e.g. 36AABCU9603R1ZM"
                      maxLength={15}
                      value={form.gst_number}
                      onChange={(e) => updateField('gst_number', e.target.value.toUpperCase())}
                      className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs font-mono uppercase text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                        errors.gst_number
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    />
                    {errors.gst_number && <p className="text-[11px] font-medium text-red-600 mt-1">{errors.gst_number}</p>}
                  </div>

                  {/* Aadhaar Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Aadhaar Number</label>
                    <input
                      type="text"
                      placeholder="12-digit Aadhaar"
                      maxLength={12}
                      value={form.aadhaar_number}
                      onChange={(e) => updateField('aadhaar_number', cleanAadhaar(e.target.value))}
                      className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                        errors.aadhaar_number
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    />
                    {errors.aadhaar_number && <p className="text-[11px] font-medium text-red-600 mt-1">{errors.aadhaar_number}</p>}
                  </div>

                  {/* PAN Card */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">PAN Card</label>
                    <input
                      type="text"
                      placeholder="e.g. ABCDE1234F"
                      maxLength={10}
                      value={form.pan_number}
                      onChange={(e) => updateField('pan_number', cleanPAN(e.target.value))}
                      className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs font-mono uppercase text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                        errors.pan_number
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    />
                    {errors.pan_number && <p className="text-[11px] font-medium text-red-600 mt-1">{errors.pan_number}</p>}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                  <textarea
                    rows={2}
                    placeholder="Enter complete office or residential street address"
                    value={form.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors resize-none ${
                      errors.address
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                    }`}
                  />
                  {errors.address && <p className="text-[11px] font-medium text-red-600 mt-1">{errors.address}</p>}
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleProceedToStep2}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-colors shadow-xs"
                  >
                    <span>Continue to Location</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: LOCATION DETAILS (POWERED BY GOOGLE LOCATION SERVICES) */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="border-b border-slate-100 pb-3 mb-2 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Step 2 — Location Details</h2>
                    <p className="text-xs text-slate-500">Google-powered real-time geographic location hierarchy</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={isResolvingPlace}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <Navigation className="h-3 w-3 text-red-600" />
                    <span>Detect Location</span>
                  </button>
                </div>

                {/* Country Pill */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="font-semibold text-slate-600">Country</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1">
                    🇮🇳 India
                  </span>
                </div>

                {/* City Search & Select (Google Places Autocomplete) */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type or search Indian city (e.g. Hyderabad, Bengaluru, Mumbai...)"
                      value={citySearchInput || form.city}
                      onChange={(e) => handleCityInputChange(e.target.value)}
                      onFocus={() => setShowCityDropdown(true)}
                      className={`w-full rounded-xl border bg-white pl-9 pr-8 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                        errors.city
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    />
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                    {isSearchingCity && (
                      <Loader2 className="h-4 w-4 text-slate-400 animate-spin absolute right-3 top-3" />
                    )}
                  </div>

                  {/* City Predictions Dropdown */}
                  {showCityDropdown && cityPredictions.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white rounded-2xl border border-slate-200 shadow-xl max-h-56 overflow-y-auto p-1.5">
                      {cityPredictions.map((pred) => (
                        <button
                          key={pred.placeId}
                          type="button"
                          onClick={() => handleSelectCityPrediction(pred)}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{pred.mainText}</p>
                            <p className="text-[10px] text-slate-400">{pred.secondaryText}</p>
                          </div>
                          {form.city === pred.mainText && <Check className="h-4 w-4 text-emerald-600" />}
                        </button>
                      ))}
                    </div>
                  )}
                  {errors.city && <p className="text-[11px] font-medium text-red-600 mt-1">{errors.city}</p>}
                </div>

                {/* Area / Locality (Google Places Autocomplete + Popular Pills) */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Area / Locality</label>
                    {form.city && (
                      <span className="text-[10px] text-slate-400">within {form.city}</span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      disabled={!form.city}
                      placeholder={
                        form.city
                          ? `Search locality in ${form.city} (e.g. Gachibowli, Madhapur...)`
                          : 'First select a City above'
                      }
                      value={areaSearchInput || form.area}
                      onChange={(e) => handleAreaInputChange(e.target.value)}
                      onFocus={() => setShowAreaDropdown(true)}
                      className={`w-full rounded-xl border bg-white pl-9 pr-8 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors disabled:bg-slate-50 disabled:text-slate-400 ${
                        errors.area
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    />
                    <MapPin className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                    {isResolvingPlace && (
                      <Loader2 className="h-4 w-4 text-slate-400 animate-spin absolute right-3 top-3" />
                    )}
                  </div>

                  {/* Area Predictions Dropdown */}
                  {showAreaDropdown && areaPredictions.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white rounded-2xl border border-slate-200 shadow-xl max-h-52 overflow-y-auto p-1.5">
                      {areaPredictions.map((pred) => (
                        <button
                          key={pred.placeId}
                          type="button"
                          onClick={() => handleSelectAreaPrediction(pred)}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{pred.mainText}</p>
                            <p className="text-[10px] text-slate-400">{pred.secondaryText}</p>
                          </div>
                          {form.area === pred.mainText && <Check className="h-4 w-4 text-emerald-600" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Popular Localities in City */}
                  {form.city && popularAreas.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Popular Localities in {form.city}
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-0.5">
                        {popularAreas.slice(0, 14).map((areaName) => (
                          <button
                            key={areaName}
                            type="button"
                            onClick={() => handleSelectPopularArea(areaName)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                              form.area.toLowerCase() === areaName.toLowerCase()
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {areaName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {errors.area && <p className="text-[11px] font-medium text-red-600 mt-1">{errors.area}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* State (Auto-determined / Dropdown) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                    <select
                      value={form.state}
                      onChange={(e) => updateField('state', e.target.value)}
                      className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 transition-colors ${
                        errors.state
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                      }`}
                    >
                      <option value="">Select State</option>
                      {allStates.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    {errors.state && <p className="text-[11px] font-medium text-red-600 mt-1">{errors.state}</p>}
                  </div>

                  {/* District (Auto-determined / Dropdown) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">District</label>
                    {availableDistricts.length > 0 ? (
                      <select
                        value={form.district}
                        onChange={(e) => updateField('district', e.target.value)}
                        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 transition-colors ${
                          errors.district
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                        }`}
                      >
                        <option value="">Select District</option>
                        {availableDistricts.map((dist) => (
                          <option key={dist} value={dist}>
                            {dist}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="e.g. Hyderabad"
                        value={form.district}
                        onChange={(e) => updateField('district', e.target.value)}
                        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 transition-colors ${
                          errors.district
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                        }`}
                      />
                    )}
                    {errors.district && <p className="text-[11px] font-medium text-red-600 mt-1">{errors.district}</p>}
                  </div>
                </div>

                {/* Google Location Verified Summary Banner */}
                {form.city && form.state && (
                  <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-2.5 text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-emerald-900">Google Location Resolved</p>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        {[form.area, form.city, form.district, form.state, 'India'].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Previous</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToStep3}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-colors shadow-xs"
                  >
                    <span>Continue to Financials</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: BUSINESS & FINANCIAL DETAILS */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h2 className="text-base font-bold text-slate-900">Step 3 — Business & Financial Details</h2>
                  <p className="text-xs text-slate-500">Provide registration documents and payout bank credentials</p>
                </div>

                {/* 13. Business Registration */}
                <div>
                  {renderDocUploadBox(
                    'Business Registration',
                    'business_reg_doc',
                    form.business_reg_doc,
                    'business_registration'
                  )}
                  <input
                    type="text"
                    placeholder="Optional: Enter Registration / MSME / CIN number if available"
                    value={form.business_registration}
                    onChange={(e) => updateField('business_registration', e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
                  />
                </div>

                {/* 14. Aadhaar Card & 15. PAN Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderDocUploadBox('Aadhaar Card', 'aadhaar_doc', form.aadhaar_doc)}
                  {renderDocUploadBox('PAN Card', 'pan_doc', form.pan_doc)}
                </div>

                {/* 16. Bank Account Details */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-slate-700" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Bank Account Details
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Account Holder Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Vikram Rao"
                        value={form.bank_account_holder_name}
                        onChange={(e) => updateField('bank_account_holder_name', e.target.value)}
                        className={`w-full rounded-xl border bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                          errors.bank_account_holder_name
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                        }`}
                      />
                      {errors.bank_account_holder_name && (
                        <p className="text-[11px] font-medium text-red-600 mt-0.5">{errors.bank_account_holder_name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC Bank"
                        value={form.bank_name}
                        onChange={(e) => updateField('bank_name', e.target.value)}
                        className={`w-full rounded-xl border bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                          errors.bank_name
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                        }`}
                      />
                      {errors.bank_name && (
                        <p className="text-[11px] font-medium text-red-600 mt-0.5">{errors.bank_name}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Account Number</label>
                      <input
                        type="password"
                        placeholder="Enter bank account number"
                        value={form.bank_account_number}
                        onChange={(e) => updateField('bank_account_number', e.target.value)}
                        className={`w-full rounded-xl border bg-white px-3.5 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                          errors.bank_account_number
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                        }`}
                      />
                      {errors.bank_account_number && (
                        <p className="text-[11px] font-medium text-red-600 mt-0.5">{errors.bank_account_number}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">IFSC Code</label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC0000123"
                        maxLength={11}
                        value={form.bank_ifsc_code}
                        onChange={(e) => updateField('bank_ifsc_code', cleanIFSC(e.target.value))}
                        className={`w-full rounded-xl border bg-white px-3.5 py-2 text-xs font-mono uppercase text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                          errors.bank_ifsc_code
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                        }`}
                      />
                      {errors.bank_ifsc_code && (
                        <p className="text-[11px] font-medium text-red-600 mt-0.5">{errors.bank_ifsc_code}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 17. GST Document */}
                <div>
                  {renderDocUploadBox('GST Certificate', 'gst_doc', form.gst_doc)}
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Previous</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm transition-colors shadow-sm shadow-red-600/20 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>Submitting Application...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Registration</span>
                        <Sparkles className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Note */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-slate-900 hover:text-red-600 font-bold transition-colors">
            Sign In with OTP
          </Link>
        </p>
      </div>
    </div>
  );
}
