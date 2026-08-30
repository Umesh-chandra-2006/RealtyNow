import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Loader2, MapPin, ShieldCheck, Upload, X } from 'lucide-react';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getPortalSections, getAgentSections } from './sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { LocationAutocomplete, type SelectedPlace } from '../../components/location-autocomplete';
import { FieldLabel, InputField, TextAreaField, SectionTitle, compressImage } from './property-form-shared';
import { uploadFile, type StorageBucket } from '../../lib/storage';
import { savePropertyDraft } from '../../lib/properties';
import { ensureUserProfile } from '../../lib/profile-utils';
import { useServiceStatus, SERVICE_KEYS } from '../../lib/service-status';
import { ServiceUnavailable } from '../../components/service-unavailable';
import { cn, formatPrice } from '../../lib/utils';
import { toAreaUnitCode, getPriceUnitLabel, calculateLandEquivalents, normalizeAreaUnit } from '../../lib/plot-pricing';
import { validateUnitPrice, validatePropertyPrice, MIN_PROPERTY_PRICE } from '../../lib/price-validation';

// ─── Plot-specific vocab ──────────────────────────────────────────────────
const PLOT_TYPES = [
  'Open Plot', 'Residential Plot', 'Commercial Plot', 'Agricultural Land',
  'Farm Land', 'Gated Community Plot', 'HMDA Layout Plot', 'DTCP Layout Plot',
  'FCDA Layout Plot',
];
const FACINGS = ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'];
const SELLING_AREA_UNITS = ['Sq. Ft', 'Sq. Yd', 'Acre', 'Gunta'];
const ROAD_FACING = ['Single Road', 'Two Roads', 'Three Roads', 'Four Roads'];
const LAYOUT_TYPES = ['HMDA Approved', 'DTCP Approved', 'FCDA Approved', 'GHMC Approved', 'RERA Registered Layout', 'Panchayat Layout', 'Gram Panchayat', 'Venture', 'Unapproved', 'Other'];
const PLOT_FEATURES = [
  'Gated Community', 'Black Top Roads', 'CC Roads', 'Street Lights', 'Electricity Available',
  'Water Connection', 'Drainage', 'Underground Drainage', 'Avenue Plantation', 'Compound Wall',
  'Security', 'Entrance Arch', 'Park', "Children's Play Area", 'Clubhouse', 'CCTV', 'Solar Street Lights',
];
const DEV_STATUS = ['Fully Developed', 'Partially Developed', 'Under Development', 'Undeveloped'];
const INFRA_ITEMS = ['Road', 'Electricity', 'Water', 'Drainage', 'Street Lights'] as const;
const INFRA_STATES = ['Available', 'Not Available', 'Coming Soon'];
const OWNERSHIP_TYPES = ['Single Owner', 'Joint Owners', 'Company Owned', 'Developer Owned'];
const OWNERSHIP_DOCS = ['Sale Deed', 'Link Documents', 'EC', 'Pattadar Passbook', 'Title Documents', 'Layout Approval', 'RERA Documents', 'Tax Receipts', 'Survey Documents'];
const LAND_TYPES = ['Residential', 'Commercial', 'Agricultural', 'Converted Land', 'NA Conversion', 'Other'];
const NEGOTIABILITY = ['Fixed Price', 'Negotiable', 'Slightly Negotiable'];
const PHOTO_CATEGORIES = ['Front View', 'Road View', 'Plot View', 'Surrounding Area', 'Entrance / Layout'];
const SELLER_TYPES = ['Owner', 'Builder', 'Developer', 'Agent', 'Land Developer'];
const CONTACT_PREFS = ['Phone', 'WhatsApp', 'Both'];

const STEPS = ['Location', 'Plot', 'Approval', 'Features', 'Legal', 'Survey', 'Price', 'Media', 'Seller', 'Submit'];

interface PlotPhoto {
  id: string;
  url: string;
  path: string;
  bucket: StorageBucket;
  category: string;
}
interface PlotDoc {
  id: string;
  label: string;
  url: string;
  path: string;
  bucket: StorageBucket;
}

interface PlotFormState {
  // Location
  address: string; city: string; locality: string; state: string; country: string; pincode: string;
  latitude: number | null; longitude: number | null; placeId: string;
  // Plot details
  propertyTypeName: string;
  purposeIntent: 'Sale' | 'Investment';
  areaInputMethod: 'dimensions' | 'acres';
  acres: string;
  length: string; lengthUnit: 'Ft' | 'Yd';
  width: string; widthUnit: 'Ft' | 'Yd';
  totalArea: string; areaUnit: string;
  facing: string; cornerPlot: 'Yes' | 'No' | ''; roadFacing: string; roadWidth: string;
  plotNumber: string; blockSector: string;
  // Approval
  layoutType: string; approvalAuthority: string; approvalNumber: string; approvalDate: string;
  reraNumber: string; layoutNumber: string; lpNumber: string;
  approvalDocs: PlotDoc[];
  // Features / development
  features: string[];
  devStatus: string;
  infra: Record<string, string>;
  // Legal
  ownershipType: string; ownershipDocs: string[];
  legallyClear: 'Yes' | 'No' | 'Not Sure' | '';
  existingLoan: 'Yes' | 'No' | ''; litigation: 'Yes' | 'No' | ''; litigationDetails: string;
  // Survey
  surveyNumber: string; subDivisionNumber: string; surveyVillage: string; surveyMandal: string;
  surveyDistrict: string; extent: string; landClassification: string; landType: string;
  // Pricing
  expectedPrice: string; pricePerUnit: string; negotiability: string;
  developmentCharges: string; maintenanceCharges: string; registrationCharges: string; otherCharges: string;
  // Media
  photos: PlotPhoto[];
  videos: PlotDoc[];
  documents: PlotDoc[];
  // Description
  whySpecial: string; nearbyLandmarks: string; investmentPotential: string; otherInfo: string;
  // Seller
  ownerName: string; mobileNumber: string; whatsappNumber: string; email: string;
  sellerType: string; contactPreference: string;
}

const EMPTY_STATE: PlotFormState = {
  address: '', city: '', locality: '', state: '', country: 'India', pincode: '',
  latitude: null, longitude: null, placeId: '',
  propertyTypeName: '', purposeIntent: 'Sale',
  areaInputMethod: 'dimensions',
  acres: '',
  length: '', lengthUnit: 'Ft',
  width: '', widthUnit: 'Ft',
  totalArea: '', areaUnit: 'Sq. Ft',
  facing: '', cornerPlot: '', roadFacing: '', roadWidth: '', plotNumber: '', blockSector: '',
  layoutType: '', approvalAuthority: '', approvalNumber: '', approvalDate: '', reraNumber: '', layoutNumber: '', lpNumber: '',
  approvalDocs: [],
  features: [], devStatus: '', infra: {},
  ownershipType: '', ownershipDocs: [], legallyClear: '', existingLoan: '', litigation: '', litigationDetails: '',
  surveyNumber: '', subDivisionNumber: '', surveyVillage: '', surveyMandal: '', surveyDistrict: '', extent: '', landClassification: '', landType: '',
  expectedPrice: '', pricePerUnit: '', negotiability: 'Negotiable',
  developmentCharges: '', maintenanceCharges: '', registrationCharges: '', otherCharges: '',
  photos: [], videos: [], documents: [],
  whySpecial: '', nearbyLandmarks: '', investmentPotential: '', otherInfo: '',
  ownerName: '', mobileNumber: '', whatsappNumber: '', email: '', sellerType: 'Owner', contactPreference: 'Both',
};

// ─── Small reusable chip selectors ─────────────────────────────────────────
function ChipSelect({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all',
            value === opt
              ? 'border-red-500 bg-red-50 text-red-600 shadow-sm'
              : 'border-navy-150 bg-white text-navy-600 hover:border-navy-300',
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function ChipMultiSelect({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) => onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={cn(
            'flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all',
            value.includes(opt)
              ? 'border-red-500 bg-red-50 text-red-600 shadow-sm'
              : 'border-navy-150 bg-white text-navy-600 hover:border-navy-300',
          )}
        >
          {value.includes(opt) && <Check className="h-3.5 w-3.5" />}
          {opt}
        </button>
      ))}
    </div>
  );
}

export function OpenPlotWizard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = useLanguageContext();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const draftIdParam = searchParams.get('draft_id');
  const [draftId, setDraftId] = useState<string | null>(draftIdParam);
  const [submissionId] = useState(() => crypto.randomUUID());

  const sections = profile?.role === 'agent' ? getAgentSections(t) : getPortalSections(t);
  const { isActive: serviceActive, loading: serviceLoading } = useServiceStatus(SERVICE_KEYS.LIST_PROPERTY);

  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(!!draftIdParam);
  const [form, setForm] = useState<PlotFormState>(EMPTY_STATE);
  const set = <K extends keyof PlotFormState>(key: K, value: PlotFormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Prefill seller details from the authenticated profile.
  useEffect(() => {
    if (!profile) return;
    setForm((f) => ({
      ...f,
      ownerName: f.ownerName || [profile.first_name, profile.last_name].filter(Boolean).join(' '),
      mobileNumber: f.mobileNumber || profile.phone || '',
      email: f.email || profile.email || '',
    }));
  }, [profile]);

  // Resume an existing draft.
  useEffect(() => {
    if (!draftIdParam) return;
    (async () => {
      const { data } = await supabase.from('properties').select('*').eq('id', draftIdParam).maybeSingle();
      if (data?.plot_details) {
        setForm((f) => ({ ...f, ...(data.plot_details as Partial<PlotFormState>) }));
      }
      setRestoring(false);
    })();
  }, [draftIdParam]);

  const handlePlaceSelected = (place: SelectedPlace) => {
    setForm((f) => ({
      ...f,
      address: place.address, city: place.city, locality: place.locality, state: place.state,
      country: place.country || f.country, pincode: place.postalCode || f.pincode,
      latitude: place.latitude, longitude: place.longitude, placeId: place.placeId,
      surveyVillage: f.surveyVillage || place.locality,
      surveyMandal: f.surveyMandal || place.city,
      surveyDistrict: f.surveyDistrict || place.city,
    }));
  };

  // ─── Real-time Normalized Land Calculation Engine ────────────────────────
  const getBaseSqFt = (): number => {
    if (form.areaInputMethod === 'acres') {
      const ac = parseFloat(form.acres);
      return ac > 0 && !isNaN(ac) ? ac * 43560 : 0;
    }
    const l = parseFloat(form.length);
    const w = parseFloat(form.width);
    if (l > 0 && w > 0 && !isNaN(l) && !isNaN(w)) {
      const lFt = form.lengthUnit === 'Yd' ? l * 3 : l;
      const wFt = form.widthUnit === 'Yd' ? w * 3 : w;
      return lFt * wFt;
    }
    return 0;
  };

  const baseSqFt = getBaseSqFt();
  const equivalents = calculateLandEquivalents(baseSqFt);

  // Exact area value in chosen selling unit
  const getAreaInSellingUnit = (): number => {
    if (baseSqFt <= 0) return 0;
    const norm = normalizeAreaUnit(form.areaUnit) || 'sqft';
    switch (norm) {
      case 'acre':
        return equivalents.acres;
      case 'gunta':
        return equivalents.guntas;
      case 'sqyd':
        return equivalents.sqyd;
      case 'sqft':
      default:
        return equivalents.sqft;
    }
  };

  const areaInSellingUnit = getAreaInSellingUnit();
  const numericRate = parseFloat(form.pricePerUnit);
  const totalPropertyCost = areaInSellingUnit > 0 && numericRate > 0 && !isNaN(numericRate) ? Math.round(areaInSellingUnit * numericRate) : 0;

  // Keep totalArea and expectedPrice continuously synchronized
  useEffect(() => {
    if (baseSqFt > 0) {
      const areaStr = String(areaInSellingUnit);
      if (form.totalArea !== areaStr) {
        set('totalArea', areaStr);
      }
    }
    if (totalPropertyCost > 0) {
      const costStr = String(totalPropertyCost);
      if (form.expectedPrice !== costStr) {
        set('expectedPrice', costStr);
      }
    } else if ((numericRate <= 0 || isNaN(numericRate)) && form.expectedPrice && baseSqFt > 0) {
      if (form.expectedPrice !== '') set('expectedPrice', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseSqFt, areaInSellingUnit, totalPropertyCost, numericRate]);

  // When the customer changes which unit the plot is measured/priced in,
  // a previously entered rate no longer means anything — clear it and prompt.
  const prevAreaUnitRef = useRef(form.areaUnit);
  useEffect(() => {
    if (restoring) {
      prevAreaUnitRef.current = form.areaUnit;
      return;
    }
    if (prevAreaUnitRef.current && prevAreaUnitRef.current !== form.areaUnit && form.pricePerUnit) {
      set('pricePerUnit', '');
      toast.addToast('info', `Selling unit changed to ${form.areaUnit} — please enter the price per ${getPriceUnitLabel(form.areaUnit)}.`);
    }
    prevAreaUnitRef.current = form.areaUnit;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.areaUnit, restoring]);

  const onPricePerUnitChange = (val: string) => set('pricePerUnit', val);

  const buildDescription = () =>
    [form.whySpecial, form.nearbyLandmarks, form.investmentPotential, form.otherInfo].filter(Boolean).join('\n\n');

  const buildPayload = () => ({
    owner_id: user?.id,
    status: 'draft' as const,
    is_draft: true,
    purpose: 'Sale' as const,
    listing_category: 'Plot',
    property_sub_type: form.propertyTypeName || null,
    title: form.propertyTypeName ? `${form.propertyTypeName} in ${form.city || 'prime location'}` : 'Open Plot Listing',
    description: buildDescription() || null,
    address: form.address || [form.locality, form.city].filter(Boolean).join(', ') || null,
    city: form.city || null,
    locality: form.locality || null,
    state: form.state || null,
    country: form.country || null,
    pincode: form.pincode || null,
    place_id: form.placeId || null,
    latitude: form.latitude,
    longitude: form.longitude,
    plot_area: areaInSellingUnit > 0 ? areaInSellingUnit : (form.totalArea ? parseFloat(form.totalArea) : null),
    area_unit: toAreaUnitCode(form.areaUnit),
    price_per_unit: form.pricePerUnit ? parseFloat(form.pricePerUnit) : null,
    facing: form.facing || null,
    ownership_type: form.ownershipType || null,
    price: totalPropertyCost > 0 ? totalPropertyCost : (form.expectedPrice ? parseFloat(form.expectedPrice) : 0),
    amenities: form.features,
    images: form.photos.map((p) => p.url),
    cover_image_url: form.photos[0]?.url || null,
    plot_details: form,
  });

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const data = await savePropertyDraft(draftId, buildPayload(), submissionId);
      if (!draftId && data?.id) {
        setDraftId(data.id);
        window.history.replaceState({}, '', `?draft_id=${data.id}`);
      }
      toast.addToast('success', 'Draft saved.');
    } catch (err: any) {
      console.error('Failed to save plot draft', { message: err?.message, details: err?.details, hint: err?.hint, code: err?.code });
      toast.addToast('error', err?.message === 'LISTING_LIMIT_REACHED'
        ? 'You have reached your free listing limit for this month. Please upgrade to list more.'
        : 'Unable to save your plot right now. Please check your information and try again.');
    } finally {
      setSaving(false);
    }
  };

  const validateStep = (): string | null => {
    if (activeStep === 0 && (!form.city || !form.latitude)) return 'Please select the plot location from the map search.';
    if (activeStep === 1) {
      if (!form.propertyTypeName) return 'Please select a plot type.';
      if (baseSqFt <= 0) {
        return form.areaInputMethod === 'acres'
          ? 'Please enter a valid number of acres.'
          : 'Please enter valid plot length and width dimensions.';
      }
      const unitPriceError = validateUnitPrice(form.pricePerUnit, form.areaUnit);
      if (unitPriceError) return unitPriceError;
    }
    if (activeStep === 6) {
      const totalPriceError = validatePropertyPrice(form.expectedPrice);
      if (totalPriceError) return totalPriceError;
    }
    if (activeStep === 8 && (!form.ownerName || !form.mobileNumber)) return 'Please enter seller name and mobile number.';
    return null;
  };

  const goNext = () => {
    const err = validateStep();
    if (err) {
      toast.addToast('error', err);
      if (activeStep === 1 && validateUnitPrice(form.pricePerUnit)) {
        requestAnimationFrame(() => {
          const el = document.getElementById('wizard-field-pricePerUnit');
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el?.focus();
        });
      }
      return;
    }
    setActiveStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const goBack = () => setActiveStep((s) => Math.max(0, s - 1));

  const handleSubmit = async () => {
    const err = validateStep();
    if (err) {
      toast.addToast('error', err);
      return;
    }
    setSubmitting(true);
    try {
      if (user?.id) {
        await ensureUserProfile(user.id);
      }
      const payload = { ...buildPayload(), status: 'submitted' as const, approval_status: 'Pending' as const, is_live: false };

      const executeSubmit = async () => {
        if (draftId) {
          const { error } = await supabase.from('properties').update(payload).eq('id', draftId);
          if (error) throw error;
        } else {
          const { data: inserted, error } = await supabase.from('properties').insert(payload).select('id').single();
          if (error) throw error;
          setDraftId(inserted?.id ?? null);
        }
      };

      try {
        await executeSubmit();
      } catch (err: any) {
        if (err?.message?.includes('profiles_fkey') || err?.code === '23503') {
          await ensureUserProfile(user?.id);
          await executeSubmit();
        } else {
          throw err;
        }
      }

      toast.addToast('success', '🎉 Plot submitted for admin review!');
      setTimeout(() => navigate(profile?.role === 'agent' ? '/agent/my-properties' : '/portal/my-properties'), 1200);
    } catch (err: any) {
      console.error('Failed to submit plot listing', { message: err?.message, details: err?.details, hint: err?.hint, code: err?.code });
      toast.addToast('error', err?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const uploadPhoto = async (file: File, category: string) => {
    const compressed = await compressImage(file);
    const { url, path, error } = await uploadFile('property-images', compressed);
    if (error) {
      toast.addToast('error', error);
      return;
    }
    setForm((f) => ({ ...f, photos: [...f.photos, { id: crypto.randomUUID(), url, path, bucket: 'property-images', category }] }));
  };
  const removePhoto = (id: string) => setForm((f) => ({ ...f, photos: f.photos.filter((p) => p.id !== id) }));

  const uploadDoc = async (file: File, kind: 'approval' | 'video' | 'document', label: string) => {
    const bucket: StorageBucket = kind === 'video' ? 'property-videos' : 'property-documents';
    const { url, path, error } = await uploadFile(bucket, file);
    if (error) {
      toast.addToast('error', error);
      return;
    }
    const item: PlotDoc = { id: crypto.randomUUID(), label, url, path, bucket };
    if (kind === 'approval') setForm((f) => ({ ...f, approvalDocs: [...f.approvalDocs, item] }));
    else if (kind === 'video') setForm((f) => ({ ...f, videos: [...f.videos, item] }));
    else setForm((f) => ({ ...f, documents: [...f.documents, item] }));
  };

  if (!serviceLoading && !serviceActive) {
    return <ServiceUnavailable serviceName="List Property Service" />;
  }

  if (restoring) {
    return (
      <DashboardLayout sections={sections} title="List an Open Plot">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout sections={sections} title="List an Open Plot" badge="Plot">
      <PageHeader title="List an Open Plot" subtitle="A dedicated flow for plots, land, and layouts — not the standard property form." />

      {/* Stepper */}
      <div className="mb-8 flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center shrink-0">
            <div
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-all',
                i === activeStep ? 'bg-red-600 text-white shadow' : i < activeStep ? 'bg-red-50 text-red-600' : 'bg-navy-50 text-navy-400',
              )}
            >
              {i < activeStep ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
              {label}
            </div>
            {i < STEPS.length - 1 && <div className={cn('h-px w-6', i < activeStep ? 'bg-red-300' : 'bg-navy-100')} />}
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-3xl">
        <AnimatePresence mode="wait">
          <motion.div key={activeStep} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
            {/* ── Step 0: Location ── */}
            {activeStep === 0 && (
              <div className="space-y-5">
                <SectionTitle title="Plot Location" sub="Search and select the exact location on the map." />
                <LocationAutocomplete onSelect={handlePlaceSelected} initialAddress={form.address} initialLat={form.latitude ?? undefined} initialLng={form.longitude ?? undefined} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><FieldLabel>City</FieldLabel><InputField value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Auto-filled from map search" /></div>
                  <div><FieldLabel>Locality / Area</FieldLabel><InputField value={form.locality} onChange={(e) => set('locality', e.target.value)} placeholder="Auto-filled from map search" /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><FieldLabel>State</FieldLabel><InputField value={form.state} onChange={(e) => set('state', e.target.value)} /></div>
                  <div><FieldLabel>PIN Code</FieldLabel><InputField value={form.pincode} onChange={(e) => set('pincode', e.target.value)} /></div>
                  <div><FieldLabel>Landmark</FieldLabel><InputField placeholder="Optional" onChange={() => {}} /></div>
                </div>
                {form.latitude && form.longitude && (
                  <div className="flex items-center gap-2 rounded-xl bg-navy-50 px-4 py-3 text-xs font-semibold text-navy-600">
                    <MapPin className="h-4 w-4 text-red-500" /> Lat: {form.latitude.toFixed(6)} · Lng: {form.longitude.toFixed(6)}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 1: Plot Details ── */}
            {activeStep === 1 && (
              <div className="space-y-6">
                <SectionTitle title="Plot Details" sub="What kind of plot is this, and how big?" />
                <div>
                  <FieldLabel>Property Type</FieldLabel>
                  <ChipSelect options={PLOT_TYPES} value={form.propertyTypeName} onChange={(v) => set('propertyTypeName', v)} />
                </div>
                <div>
                  <FieldLabel>Purpose</FieldLabel>
                  <ChipSelect options={['Sale', 'Investment']} value={form.purposeIntent} onChange={(v) => set('purposeIntent', v as any)} />
                </div>

                {/* 1. Plot Area Section */}
                <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-xs space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-navy-900">Plot Area</h3>
                    <p className="text-xs text-navy-500 mt-0.5">Enter the land dimensions or total land area.</p>
                  </div>

                  {/* Area Input Method Selector */}
                  <div>
                    <FieldLabel>Area Input Method</FieldLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'dimensions', label: 'Dimensions' },
                        { id: 'acres', label: 'Total Acres' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => set('areaInputMethod', opt.id as any)}
                          className={cn(
                            'rounded-xl border py-2.5 px-4 text-sm font-semibold transition-all text-center cursor-pointer',
                            form.areaInputMethod === opt.id
                              ? 'border-red-500 bg-red-50 text-red-600 shadow-xs font-bold'
                              : 'border-navy-150 bg-white text-navy-600 hover:border-navy-300'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* When Dimensions is selected */}
                  {form.areaInputMethod === 'dimensions' && (
                    <div className="space-y-4 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <FieldLabel>Length</FieldLabel>
                          <div className="flex gap-2">
                            <InputField
                              type="number"
                              min="0"
                              step="any"
                              value={form.length}
                              onChange={(e) => set('length', e.target.value)}
                              placeholder="e.g. 200"
                              className="flex-1"
                            />
                            <select
                              value={form.lengthUnit}
                              onChange={(e) => set('lengthUnit', e.target.value as any)}
                              className="w-20 rounded-xl border border-navy-150 bg-white px-3 py-2.5 text-sm font-semibold text-navy-800 focus:border-red-500 focus:outline-none cursor-pointer"
                            >
                              <option value="Ft">Ft</option>
                              <option value="Yd">Yd</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <FieldLabel>Width</FieldLabel>
                          <div className="flex gap-2">
                            <InputField
                              type="number"
                              min="0"
                              step="any"
                              value={form.width}
                              onChange={(e) => set('width', e.target.value)}
                              placeholder="e.g. 435.6"
                              className="flex-1"
                            />
                            <select
                              value={form.widthUnit}
                              onChange={(e) => set('widthUnit', e.target.value as any)}
                              className="w-20 rounded-xl border border-navy-150 bg-white px-3 py-2.5 text-sm font-semibold text-navy-800 focus:border-red-500 focus:outline-none cursor-pointer"
                            >
                              <option value="Ft">Ft</option>
                              <option value="Yd">Yd</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* When Total Acres is selected */}
                  {form.areaInputMethod === 'acres' && (
                    <div className="space-y-1 pt-1">
                      <FieldLabel>No. of Acres</FieldLabel>
                      <InputField
                        type="number"
                        min="0"
                        step="any"
                        value={form.acres}
                        onChange={(e) => set('acres', e.target.value)}
                        placeholder="Enter number of acres"
                      />
                      <p className="mt-1 text-xs text-navy-400">Enter numbers only. Example: 2</p>
                    </div>
                  )}

                  {/* Calculated Area Summary Card */}
                  {baseSqFt > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3 mt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Calculated Area Summary</span>
                        <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-xs">
                          Total Land: <span className="text-red-600 font-extrabold">{equivalents.acresFormatted} Acres</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="rounded-xl bg-white border border-slate-200 p-2.5 text-center shadow-xs">
                          <span className="text-[11px] text-slate-500 block font-medium">Acres</span>
                          <span className="text-sm font-extrabold text-slate-900">{equivalents.acresFormatted}</span>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-200 p-2.5 text-center shadow-xs">
                          <span className="text-[11px] text-slate-500 block font-medium">Sq. Ft</span>
                          <span className="text-sm font-extrabold text-slate-900">{equivalents.sqftFormatted}</span>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-200 p-2.5 text-center shadow-xs">
                          <span className="text-[11px] text-slate-500 block font-medium">Sq. Yd</span>
                          <span className="text-sm font-extrabold text-slate-900">{equivalents.sqydFormatted}</span>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-200 p-2.5 text-center shadow-xs">
                          <span className="text-[11px] text-slate-500 block font-medium">Guntas</span>
                          <span className="text-sm font-extrabold text-slate-900">{equivalents.guntasFormatted}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Selling Price Unit & Dynamic Price Input & Total Cost */}
                <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-xs space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-navy-900">Selling Price Unit</h3>
                    <p className="text-xs text-navy-500 mt-0.5">Choose the unit in which you want to sell this property.</p>
                  </div>

                  {/* Selectable Segmented Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SELLING_AREA_UNITS.map((u) => {
                      const isSelected = form.areaUnit === u || normalizeAreaUnit(form.areaUnit) === normalizeAreaUnit(u);
                      return (
                        <button
                          key={u}
                          type="button"
                          onClick={() => set('areaUnit', u)}
                          className={cn(
                            'rounded-xl border py-2.5 px-3 text-sm font-semibold transition-all text-center cursor-pointer',
                            isSelected
                              ? 'border-red-500 bg-red-50 text-red-600 shadow-xs font-bold'
                              : 'border-navy-150 bg-white text-navy-600 hover:border-navy-300'
                          )}
                        >
                          {u}
                        </button>
                      );
                    })}
                  </div>

                  {/* Dynamic Price Input */}
                  <div>
                    <FieldLabel>Price per {getPriceUnitLabel(form.areaUnit)}</FieldLabel>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400 font-bold text-sm">₹</span>
                      <InputField
                        id="wizard-field-pricePerUnit"
                        type="number"
                        min={MIN_PROPERTY_PRICE}
                        step="any"
                        value={form.pricePerUnit}
                        onChange={(e) => onPricePerUnitChange(e.target.value)}
                        placeholder="e.g. 4,500"
                        className={cn(
                          'pl-8 font-semibold text-navy-900',
                          form.pricePerUnit && validateUnitPrice(form.pricePerUnit, form.areaUnit) ? 'border-red-400 focus:border-red-500 focus:ring-red-400/20' : ''
                        )}
                      />
                    </div>
                    {form.pricePerUnit && validateUnitPrice(form.pricePerUnit, form.areaUnit) ? (
                      <p className="mt-1.5 text-xs font-semibold text-red-600">{validateUnitPrice(form.pricePerUnit, form.areaUnit)}</p>
                    ) : (
                      <p className="mt-1.5 text-xs text-navy-400">Enter the selling price for each {getPriceUnitLabel(form.areaUnit)}.</p>
                    )}
                  </div>

                  {/* 3. Automatic Total Property Cost Card */}
                  {baseSqFt > 0 && parseFloat(form.pricePerUnit) > 0 && (
                    <div className="rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50/90 via-white to-red-50/40 p-5 shadow-xs space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-red-100">
                        <div>
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-red-600 block">Total Property Cost</span>
                          <span className="text-xs text-navy-500">Automatically calculated from land area × price</span>
                        </div>
                        <div className="text-left sm:text-right">
                          <span className="text-2xl sm:text-3xl font-display font-black text-red-600 tracking-tight">
                            {formatPrice(totalPropertyCost)}
                          </span>
                        </div>
                      </div>

                      {/* Transparent Calculation Breakdown */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="rounded-xl bg-white/90 border border-red-100 p-3 shadow-2xs">
                          <span className="text-navy-400 block font-medium">Land Area</span>
                          <span className="font-bold text-navy-800 text-sm mt-0.5 block">
                            {form.areaInputMethod === 'acres' && normalizeAreaUnit(form.areaUnit) !== 'acre'
                              ? `${equivalents.acresFormatted} Acres = ${new Intl.NumberFormat('en-IN').format(areaInSellingUnit)} ${getPriceUnitLabel(form.areaUnit)}s`
                              : `${new Intl.NumberFormat('en-IN').format(areaInSellingUnit)} ${getPriceUnitLabel(form.areaUnit)}s`
                            }
                          </span>
                        </div>
                        <div className="rounded-xl bg-white/90 border border-red-100 p-3 shadow-2xs">
                          <span className="text-navy-400 block font-medium">Price</span>
                          <span className="font-bold text-navy-800 text-sm mt-0.5 block">
                            ₹{new Intl.NumberFormat('en-IN').format(parseFloat(form.pricePerUnit))} / {getPriceUnitLabel(form.areaUnit)}
                          </span>
                        </div>
                        <div className="rounded-xl bg-red-600 text-white p-3 text-center flex flex-col justify-center shadow-xs">
                          <span className="text-red-100 text-[10px] uppercase font-bold tracking-wider">Total Property Cost</span>
                          <span className="font-black text-base">{formatPrice(totalPropertyCost)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Additional Plot Specs */}
                <div><FieldLabel>Facing</FieldLabel><ChipSelect options={FACINGS} value={form.facing} onChange={(v) => set('facing', v)} /></div>
                <div><FieldLabel>Corner Plot</FieldLabel><ChipSelect options={['Yes', 'No']} value={form.cornerPlot} onChange={(v) => set('cornerPlot', v as any)} /></div>
                <div><FieldLabel>Road Facing</FieldLabel><ChipSelect options={ROAD_FACING} value={form.roadFacing} onChange={(v) => set('roadFacing', v)} /></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><FieldLabel>Road Width (ft)</FieldLabel><InputField type="number" value={form.roadWidth} onChange={(e) => set('roadWidth', e.target.value)} /></div>
                  <div><FieldLabel>Plot Number</FieldLabel><InputField value={form.plotNumber} onChange={(e) => set('plotNumber', e.target.value)} /></div>
                  <div><FieldLabel>Block / Sector</FieldLabel><InputField value={form.blockSector} onChange={(e) => set('blockSector', e.target.value)} /></div>
                </div>
              </div>
            )}

            {/* ── Step 2: Layout & Approval ── */}
            {activeStep === 2 && (
              <div className="space-y-5">
                <SectionTitle title="Layout & Approval" sub="Approval status builds buyer trust." />
                <div><FieldLabel>Layout Type</FieldLabel><ChipSelect options={LAYOUT_TYPES} value={form.layoutType} onChange={(v) => set('layoutType', v)} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><FieldLabel>Approval Authority</FieldLabel><InputField value={form.approvalAuthority} onChange={(e) => set('approvalAuthority', e.target.value)} /></div>
                  <div><FieldLabel>Approval Number</FieldLabel><InputField value={form.approvalNumber} onChange={(e) => set('approvalNumber', e.target.value)} /></div>
                  <div><FieldLabel>Approval Date</FieldLabel><InputField type="date" value={form.approvalDate} onChange={(e) => set('approvalDate', e.target.value)} /></div>
                  {form.layoutType === 'RERA Registered Layout' && (
                    <div><FieldLabel>RERA Number</FieldLabel><InputField value={form.reraNumber} onChange={(e) => set('reraNumber', e.target.value)} /></div>
                  )}
                  <div><FieldLabel>Layout Number</FieldLabel><InputField value={form.layoutNumber} onChange={(e) => set('layoutNumber', e.target.value)} /></div>
                  <div><FieldLabel>LP Number</FieldLabel><InputField value={form.lpNumber} onChange={(e) => set('lpNumber', e.target.value)} /></div>
                </div>
                <DocUploader label="Approval Certificate / Layout Plan / RERA Certificate" items={form.approvalDocs} onUpload={(f) => uploadDoc(f, 'approval', f.name)} onRemove={(id) => set('approvalDocs', form.approvalDocs.filter((d) => d.id !== id))} />
                <p className="text-xs font-semibold text-green-600 flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> RealtyNow Team Will Verify These Documents</p>
              </div>
            )}

            {/* ── Step 3: Features & Development ── */}
            {activeStep === 3 && (
              <div className="space-y-5">
                <SectionTitle title="Features & Development" sub="Select everything that applies." />
                <div><FieldLabel>Plot Features</FieldLabel><ChipMultiSelect options={PLOT_FEATURES} value={form.features} onChange={(v) => set('features', v)} /></div>
                <div><FieldLabel>Development Status</FieldLabel><ChipSelect options={DEV_STATUS} value={form.devStatus} onChange={(v) => set('devStatus', v)} /></div>
                <div>
                  <FieldLabel>Infrastructure</FieldLabel>
                  <div className="space-y-3">
                    {INFRA_ITEMS.map((item) => (
                      <div key={item} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-navy-100 p-3">
                        <span className="w-32 text-sm font-semibold text-navy-700">{item}</span>
                        <ChipSelect options={INFRA_STATES} value={form.infra[item] ?? ''} onChange={(v) => set('infra', { ...form.infra, [item]: v })} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 4: Legal & Ownership ── */}
            {activeStep === 4 && (
              <div className="space-y-5">
                <SectionTitle title="Legal & Ownership" sub="Legal clarity is a top buyer priority for plots." />
                <div><FieldLabel>Property Ownership</FieldLabel><ChipSelect options={OWNERSHIP_TYPES} value={form.ownershipType} onChange={(v) => set('ownershipType', v)} /></div>
                <div><FieldLabel>Ownership Documents Available</FieldLabel><ChipMultiSelect options={OWNERSHIP_DOCS} value={form.ownershipDocs} onChange={(v) => set('ownershipDocs', v)} /></div>
                <div><FieldLabel>Is the property legally clear?</FieldLabel><ChipSelect options={['Yes', 'No', 'Not Sure']} value={form.legallyClear} onChange={(v) => set('legallyClear', v as any)} /></div>
                <div><FieldLabel>Existing Loan</FieldLabel><ChipSelect options={['No', 'Yes']} value={form.existingLoan} onChange={(v) => set('existingLoan', v as any)} /></div>
                <div><FieldLabel>Litigation / Dispute</FieldLabel><ChipSelect options={['No', 'Yes']} value={form.litigation} onChange={(v) => set('litigation', v as any)} /></div>
                {form.litigation === 'Yes' && (
                  <div><FieldLabel>Litigation Details</FieldLabel><TextAreaField value={form.litigationDetails} onChange={(e) => set('litigationDetails', e.target.value)} placeholder="Describe the dispute so RealtyNow can review it" /></div>
                )}
              </div>
            )}

            {/* ── Step 5: Survey Details ── */}
            {activeStep === 5 && (
              <div className="space-y-5">
                <SectionTitle title="Survey Details" sub="Official land-record identifiers." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><FieldLabel>Survey Number</FieldLabel><InputField value={form.surveyNumber} onChange={(e) => set('surveyNumber', e.target.value)} /></div>
                  <div><FieldLabel>Sub-Division Number</FieldLabel><InputField value={form.subDivisionNumber} onChange={(e) => set('subDivisionNumber', e.target.value)} /></div>
                  <div><FieldLabel>Village</FieldLabel><InputField value={form.surveyVillage} onChange={(e) => set('surveyVillage', e.target.value)} /></div>
                  <div><FieldLabel>Mandal</FieldLabel><InputField value={form.surveyMandal} onChange={(e) => set('surveyMandal', e.target.value)} /></div>
                  <div><FieldLabel>District</FieldLabel><InputField value={form.surveyDistrict} onChange={(e) => set('surveyDistrict', e.target.value)} /></div>
                  <div><FieldLabel>Extent</FieldLabel><InputField value={form.extent} onChange={(e) => set('extent', e.target.value)} placeholder="e.g. 200 sq. yds" /></div>
                  <div><FieldLabel>Land Classification</FieldLabel><InputField value={form.landClassification} onChange={(e) => set('landClassification', e.target.value)} /></div>
                </div>
                <div><FieldLabel>Land Type</FieldLabel><ChipSelect options={LAND_TYPES} value={form.landType} onChange={(v) => set('landType', v)} /></div>
              </div>
            )}

            {/* ── Step 6: Pricing ── */}
            {activeStep === 6 && (
              <div className="space-y-5">
                <SectionTitle title="Pricing" sub="Keep it simple — we'll do the math." />
                <div className="rounded-2xl border border-navy-100 bg-navy-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-navy-400">Total Land Area</p>
                      <p className="font-semibold text-navy-800">
                        {baseSqFt > 0 ? `${new Intl.NumberFormat('en-IN').format(areaInSellingUnit)} ${getPriceUnitLabel(form.areaUnit)}s (${equivalents.acresFormatted} Acres)` : (form.totalArea ? `${form.totalArea} ${form.areaUnit}` : '—')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-navy-400">Price Per {getPriceUnitLabel(form.areaUnit)}</p>
                      <p className="font-semibold text-navy-800">{form.pricePerUnit ? `₹${new Intl.NumberFormat('en-IN').format(parseFloat(form.pricePerUnit))}` : '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-navy-400">Total Property Cost</p>
                      <p className="font-display text-lg font-extrabold text-red-600">{form.expectedPrice ? formatPrice(parseFloat(form.expectedPrice)) : '—'}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setActiveStep(1)} className="mt-3 text-xs font-bold text-red-600 hover:underline cursor-pointer">Edit plot area & price per unit</button>
                </div>
                <div><FieldLabel>Negotiability</FieldLabel><ChipSelect options={NEGOTIABILITY} value={form.negotiability} onChange={(v) => set('negotiability', v)} /></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><FieldLabel>Development Charges (optional)</FieldLabel><InputField type="number" value={form.developmentCharges} onChange={(e) => set('developmentCharges', e.target.value)} /></div>
                  <div><FieldLabel>Maintenance Charges (optional)</FieldLabel><InputField type="number" value={form.maintenanceCharges} onChange={(e) => set('maintenanceCharges', e.target.value)} /></div>
                  <div><FieldLabel>Registration Charges (optional)</FieldLabel><InputField type="number" value={form.registrationCharges} onChange={(e) => set('registrationCharges', e.target.value)} /></div>
                </div>
              </div>
            )}

            {/* ── Step 7: Media & Documents ── */}
            {activeStep === 7 && (
              <div className="space-y-6">
                <SectionTitle title="Photos, Videos & Documents" sub="At least 5 photos recommended." />
                {PHOTO_CATEGORIES.map((cat) => (
                  <div key={cat}>
                    <FieldLabel>{cat}</FieldLabel>
                    <div className="flex flex-wrap gap-3">
                      {form.photos.filter((p) => p.category === cat).map((p) => (
                        <div key={p.id} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-navy-100">
                          <img src={p.url} alt="" className="h-full w-full object-cover" />
                          <button type="button" onClick={() => removePhoto(p.id)} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"><X className="h-3 w-3" /></button>
                        </div>
                      ))}
                      <label className="grid h-20 w-20 shrink-0 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-navy-200 text-navy-400 hover:border-red-400 hover:text-red-500">
                        <Upload className="h-5 w-5" />
                        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { Array.from(e.target.files ?? []).forEach((f) => uploadPhoto(f, cat)); e.target.value = ''; }} />
                      </label>
                    </div>
                  </div>
                ))}
                <DocUploader label="Videos (walkthrough, road access, surrounding area)" items={form.videos} onUpload={(f) => uploadDoc(f, 'video', f.name)} onRemove={(id) => set('videos', form.videos.filter((d) => d.id !== id))} accept="video/*" />
                <DocUploader label="Documents (EC, title, additional permissions)" items={form.documents} onUpload={(f) => uploadDoc(f, 'document', f.name)} onRemove={(id) => set('documents', form.documents.filter((d) => d.id !== id))} />
                <div className="space-y-3 rounded-2xl border border-navy-100 p-4">
                  <p className="text-sm font-bold text-navy-800">Plot Description (structured — no essay required)</p>
                  <div><FieldLabel>Why is this plot special?</FieldLabel><TextAreaField value={form.whySpecial} onChange={(e) => set('whySpecial', e.target.value)} rows={2} /></div>
                  <div><FieldLabel>Nearby landmarks</FieldLabel><TextAreaField value={form.nearbyLandmarks} onChange={(e) => set('nearbyLandmarks', e.target.value)} rows={2} /></div>
                  <div><FieldLabel>Investment potential</FieldLabel><TextAreaField value={form.investmentPotential} onChange={(e) => set('investmentPotential', e.target.value)} rows={2} /></div>
                  <div><FieldLabel>Other information</FieldLabel><TextAreaField value={form.otherInfo} onChange={(e) => set('otherInfo', e.target.value)} rows={2} /></div>
                </div>
              </div>
            )}

            {/* ── Step 8: Seller Details ── */}
            {activeStep === 8 && (
              <div className="space-y-5">
                <SectionTitle title="Seller Details" sub="Who should buyers reach out to?" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><FieldLabel>Owner Name</FieldLabel><InputField value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} /></div>
                  <div><FieldLabel>Mobile Number</FieldLabel><InputField value={form.mobileNumber} onChange={(e) => set('mobileNumber', e.target.value)} /></div>
                  <div><FieldLabel>WhatsApp Number</FieldLabel><InputField value={form.whatsappNumber} onChange={(e) => set('whatsappNumber', e.target.value)} placeholder="Same as mobile if blank" /></div>
                  <div><FieldLabel>Email</FieldLabel><InputField type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
                </div>
                <div><FieldLabel>Seller Type</FieldLabel><ChipSelect options={SELLER_TYPES} value={form.sellerType} onChange={(v) => set('sellerType', v)} /></div>
                <div><FieldLabel>Contact Preference</FieldLabel><ChipSelect options={CONTACT_PREFS} value={form.contactPreference} onChange={(v) => set('contactPreference', v)} /></div>
              </div>
            )}

            {/* ── Step 9: Review & Submit ── */}
            {activeStep === 9 && (
              <div className="space-y-5">
                <SectionTitle title="Review & Submit" sub="Confirm the details before sending for RealtyNow verification." />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <ReviewRow label="Type" value={form.propertyTypeName} onEdit={() => setActiveStep(1)} />
                  <ReviewRow label="Location" value={[form.locality, form.city].filter(Boolean).join(', ')} onEdit={() => setActiveStep(0)} />
                  <ReviewRow label="Area" value={baseSqFt > 0 ? `${equivalents.acresFormatted} Acres (${new Intl.NumberFormat('en-IN').format(areaInSellingUnit)} ${getPriceUnitLabel(form.areaUnit)}s)` : (form.totalArea ? `${form.totalArea} ${form.areaUnit}` : '')} onEdit={() => setActiveStep(1)} />
                  <ReviewRow label="Facing" value={form.facing} onEdit={() => setActiveStep(1)} />
                  <ReviewRow label="Layout Approval" value={form.layoutType} onEdit={() => setActiveStep(2)} />
                  <ReviewRow label="Legal Status" value={form.legallyClear} onEdit={() => setActiveStep(4)} />
                  <ReviewRow label="Expected Price" value={form.expectedPrice ? `${formatPrice(parseFloat(form.expectedPrice))} (${form.pricePerUnit ? formatPrice(parseFloat(form.pricePerUnit)) : '—'} / ${getPriceUnitLabel(form.areaUnit)})` : ''} onEdit={() => setActiveStep(1)} />
                  <ReviewRow label="Photos" value={`${form.photos.length} uploaded`} onEdit={() => setActiveStep(7)} />
                  <ReviewRow label="Seller" value={form.ownerName} onEdit={() => setActiveStep(8)} />
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-800 flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> RealtyNow Verification — Pending</p>
                  <p className="mt-1 text-xs text-amber-700">Once submitted, our team reviews ownership, documents, approval, and site details before this plot goes live and earns the RealtyNow Verified badge.</p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Sticky nav */}
        <div className="sticky bottom-0 mt-8 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3 border-t border-navy-100 bg-white/95 py-3.5 sm:py-4 backdrop-blur pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))]">
          <Button variant="ghost" onClick={goBack} disabled={activeStep === 0} icon={<ChevronLeft className="h-4 w-4" />}>Previous</Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleSaveDraft} disabled={saving}>{saving ? 'Saving…' : 'Save Draft'}</Button>
            {activeStep < STEPS.length - 1 ? (
              <Button onClick={goNext} icon={<ChevronRight className="h-4 w-4" />}>Next</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Property'}</Button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-navy-100 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">{label}</p>
        <p className="font-semibold text-navy-800">{value || '—'}</p>
      </div>
      <button type="button" onClick={onEdit} className="text-xs font-bold text-red-600 hover:underline">Edit</button>
    </div>
  );
}

function DocUploader({
  label, items, onUpload, onRemove, accept = 'application/pdf,image/*',
}: {
  label: string; items: PlotDoc[]; onUpload: (f: File) => void; onRemove: (id: string) => void; accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="space-y-2">
        {items.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-xl border border-navy-100 px-3 py-2 text-sm">
            <a href={d.url} target="_blank" rel="noreferrer" className="truncate text-navy-700 hover:text-red-600">{d.label}</a>
            <button type="button" onClick={() => onRemove(d.id)}><X className="h-4 w-4 text-navy-400 hover:text-red-500" /></button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-200 py-3 text-sm font-semibold text-navy-500 hover:border-red-400 hover:text-red-500"
        >
          <Upload className="h-4 w-4" /> Upload
        </button>
        <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={(e) => { Array.from(e.target.files ?? []).forEach(onUpload); e.target.value = ''; }} />
      </div>
    </div>
  );
}
