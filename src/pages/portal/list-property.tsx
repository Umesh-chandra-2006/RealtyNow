// Trigger HMR
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Save,
  Shield,
  Clock,
  Smartphone,
  Sparkles,
  X,
  MapPin,
  Home,
  Star,
  Camera,
  Eye,
  GripVertical,
  Loader2,
  PlayCircle,
  AlertCircle,
} from 'lucide-react';
import { DashboardLayout } from '../../components/dashboard-layout';
import { getPortalSections, getAgentSections } from './sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Button } from '../../components/ui';
import { propertyWizardSchema, PropertyWizardForm, WIZARD_STEPS } from './wizard-schema';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../hooks/useToast';
import { LocationAutocomplete, type SelectedPlace } from '../../components/location-autocomplete';
import { supabase } from '../../lib/supabase';
import { FREE_PLAN_LIMIT } from '../../lib/listing-limits';
import { triggerAiVerification } from '../../lib/properties';
import { ensureUserProfile } from '../../lib/profile-utils';
import { uploadFile, deleteFile, type StorageBucket } from '../../lib/storage';
import { cn } from '../../lib/utils';
import { validatePropertyPrice } from '../../lib/price-validation';
import { useServiceStatus, SERVICE_KEYS } from '../../lib/service-status';
import { ServiceUnavailable } from '../../components/service-unavailable';
import {
  type MediaItem,
  MAX_MEDIA_FILES,
  MAX_IMAGE_FILE_SIZE,
  MAX_VIDEO_FILE_SIZE,
  ACCEPTED_MEDIA_TYPES,
  compressImage,
  isVideoUrl,
  isValidMediaUrl,
  PURPOSE_OPTIONS,
  AMENITIES_LIST,
  FieldLabel,
  InputField,
  TextAreaField,
  SelectField,
  SectionTitle,
} from './property-form-shared';

export type { MediaItem };

// ── Preview Modal ──
function PreviewModal({
  data,
  counters,
  mediaUrls,
  furnishing,
  onClose,
}: {
  data: Partial<PropertyWizardForm>;
  counters: Record<string, number>;
  mediaUrls: string[];
  furnishing: string;
  onClose: () => void;
}) {
  const isSale = data.purpose === 'Sale';
  const priceLabel = isSale ? 'Asking Price' : 'Monthly Rent';
  const priceVal = isSale ? data.price : data.rent_amount;

  return (
    <div
      className="fixed inset-0 bg-navy-900/40 backdrop-blur-md z-[9999] flex items-center justify-center p-4 md:p-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[32px] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-white/50 backdrop-blur-xl hover:bg-white text-navy-900 rounded-full p-2.5 transition-all shadow-sm z-50"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Left Side: Images Gallery */}
        <div className="w-full md:w-5/12 bg-navy-50 relative min-h-[300px] md:min-h-full shrink-0">
          {mediaUrls && mediaUrls.length > 0 ? (
            <div className="w-full h-full relative group">
              <img
                src={mediaUrls[0]}
                alt="Property"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800';
                }}
              />
              {mediaUrls.length > 1 && (
                <div className="absolute bottom-4 right-4 bg-navy-900/80 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                  <Camera className="h-3.5 w-3.5" /> +{mediaUrls.length - 1} Photos
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-navy-300 p-8 text-center bg-gradient-to-br from-navy-50 to-navy-100/50">
              <Home className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-sm font-semibold">No images uploaded yet</p>
            </div>
          )}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md uppercase tracking-wider">
              {data.purpose || 'Sale'}
            </span>
            {data.category && (
              <span className="bg-white/90 backdrop-blur-sm text-navy-900 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-wider">
                {data.category}
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Details Content */}
        <div className="w-full md:w-7/12 p-6 md:p-8 overflow-y-auto flex flex-col gap-8 custom-scrollbar">
          {/* Header section */}
          <div>
            <div className="flex items-center gap-2 text-red-500 mb-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-bold tracking-widest uppercase">Preview Listing</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-navy-900 leading-tight mb-2">
              {data.title || 'Beautiful Property'}
            </h2>
            <div className="flex items-start gap-1.5 text-navy-500">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-sm font-medium leading-relaxed">
                {[data.locality_name, data.city_name].filter(Boolean).join(', ') || 'Location not specified'}
                {data.address && <span className="block text-xs mt-0.5 opacity-80">{data.address}</span>}
              </p>
            </div>
          </div>

          {/* Key Pricing */}
          <div className="flex items-end justify-between p-5 bg-gradient-to-br from-red-50 to-rose-50/30 rounded-2xl border border-red-100">
            <div>
              <p className="text-xs font-bold text-red-800/60 uppercase tracking-widest mb-1">{priceLabel}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-red-600">₹</span>
                <span className="text-3xl font-display font-bold text-red-600">
                  {priceVal ? Number(priceVal).toLocaleString('en-IN') : 'TBD'}
                </span>
                {!isSale && priceVal && <span className="text-sm font-semibold text-red-600/70 ml-1">/mo</span>}
              </div>
            </div>
            {data.security_deposit && (
              <div className="text-right">
                <p className="text-[10px] font-bold text-navy-500 uppercase tracking-widest mb-0.5">Deposit</p>
                <p className="text-sm font-bold text-navy-900">
                  ₹{Number(data.security_deposit).toLocaleString('en-IN')}
                </p>
              </div>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Beds', val: counters.bedrooms, icon: '🛏️' },
              { label: 'Baths', val: counters.bathrooms, icon: '🚿' },
              { label: 'Balcony', val: counters.balconies, icon: '🌿' },
              { label: 'Type', val: furnishing || 'Bare', icon: '🛋️' },
            ].map((s, i) => (
              <div
                key={i}
                className="bg-navy-50 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 border border-navy-100/50"
              >
                <span className="text-xl">{s.icon}</span>
                <span className="text-base font-display font-bold text-navy-900 leading-none">{s.val}</span>
                <span className="text-[10px] text-navy-500 uppercase tracking-widest font-semibold">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Details List */}
          <div className="space-y-4 border-t border-navy-100 pt-6">
            <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">Property Details</h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              {[
                { label: 'Property Type', val: data.property_sub_type },
                {
                  label: 'Floor No.',
                  val:
                    data.floor_number && data.total_floors
                      ? `${data.floor_number} of ${data.total_floors}`
                      : data.floor_number,
                },
                { label: 'Carpet Area', val: data.carpet_area ? `${data.carpet_area} sq.ft` : null },
                { label: 'Super Area', val: data.super_area ? `${data.super_area} sq.ft` : null },
                { label: 'Plot / Land', val: data.plot_area ? `${data.plot_area} sq.ft` : null },
                { label: 'Indoor Parking', val: data.parking_indoor },
                { label: 'Outdoor Parking', val: data.parking_outdoor },
                { label: 'Age', val: data.age_of_property },
                { label: 'Facing', val: data.facing },
                { label: 'Available', val: data.availability_date },
                { label: 'Ownership', val: data.ownership_type },
              ]
                .filter((x) => x.val)
                .map((item, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-navy-400 uppercase tracking-wider">{item.label}</span>
                    <span className="text-sm font-medium text-navy-900">{item.val}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Description */}
          {data.description && (
            <div className="space-y-2 border-t border-navy-100 pt-6">
              <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">About Property</h3>
              <p className="text-sm text-navy-600 leading-relaxed">{data.description}</p>
            </div>
          )}

          {/* Amenities */}
          {data.amenities && data.amenities.length > 0 && (
            <div className="space-y-3 border-t border-navy-100 pt-6 pb-2">
              <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">Amenities</h3>
              <div className="flex flex-wrap gap-2">
                {data.amenities.map((a) => {
                  const found = AMENITIES_LIST.find((x) => x.id === a);
                  return (
                    <span
                      key={a}
                      className="flex items-center gap-1.5 text-xs bg-white border border-navy-200 rounded-full px-3 py-1.5 text-navy-700 font-medium shadow-sm"
                    >
                      <span className="text-sm">{found?.icon || '✨'}</span> {found?.label ?? a}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Source URLs */}
          {data.source_urls && (
            <div className="space-y-3 border-t border-navy-100 pt-6 pb-2">
              <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">Source Links</h3>
              <div className="flex flex-col gap-2">
                {data.source_urls.split(',').map((url: string, i: number) => url.trim() ? (
                  <a key={i} href={url.trim()} target="_blank" rel="noopener noreferrer" className="text-xs text-red-500 hover:underline break-all">
                    {url.trim()}
                  </a>
                ) : null)}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function ListPropertyWizard({ isAdminMode = false, disableLayout = false }: { isAdminMode?: boolean; disableLayout?: boolean } = {}) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = useLanguageContext();
  const wizardSections = profile?.role === 'agent' ? getAgentSections(t) : getPortalSections(t);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [searchParams] = useSearchParams();
  const draftIdParam = searchParams.get('draft_id') || searchParams.get('id');
  const [draftId, setDraftId] = useState<string | null>(draftIdParam);
  const [submissionId] = useState(() => crypto.randomUUID());
  const [showPreview, setShowPreview] = useState(false);

  const [quotaChecked, setQuotaChecked] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const { isActive: listPropertyActive, loading: listPropertyLoading } = useServiceStatus(SERVICE_KEYS.LIST_PROPERTY);

  useEffect(() => {
    if (!user) return;
    
    async function checkQuota() {
      // 1. check if customer
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
      if (profile?.role !== 'customer') {
        setQuotaChecked(true);
        return;
      }
      
      // 2. check if active subscription
      const { count: pkgCount } = await supabase
        .from('agent_packages')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user!.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString());
        
      if (pkgCount && pkgCount > 0) {
        setQuotaChecked(true);
        return;
      }
      
      // 3. check properties listed this calendar month (resets monthly, not
      // lifetime) — drafts don't count as "listed", only real submissions do.
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count: propCount } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user!.id)
        .neq('status', 'draft')
        .gte('created_at', startOfMonth);

      if (propCount && propCount >= FREE_PLAN_LIMIT) {
        setQuotaExceeded(true);
      }
      setQuotaChecked(true);
    }
    
    checkQuota();
  }, [user]);

  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isRestoring, setIsRestoring] = useState(!!draftIdParam);
  // Key of the field that failed validation on the last Next attempt, so the
  // corresponding input can be highlighted — separate from the toast message,
  // which only tells the user *what's* wrong, not *where*.
  const [fieldError, setFieldError] = useState<string | null>(null);

  const focusInvalidField = (fieldId: string) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(fieldId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus();
    });
  };

  // Step 3: Basic Details local state
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [balconies, setBalconies] = useState(1);
  const [furnishing, setFurnishing] = useState('');

  // Step 5: Amenities
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const toggleAmenity = (id: string) =>
    setSelectedAmenities((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Step 6: Media
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [mediaUrlError, setMediaUrlError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverImageUploading, setCoverImageUploading] = useState(false);

  const reindexMedia = (items: MediaItem[]): MediaItem[] => items.map((m, i) => ({ ...m, order: i }));

  // The standalone "Cover Image" box and the "Property Images" gallery used to be two
  // disconnected pieces of state — uploading a cover image only ever set coverImageUrl,
  // never touched mediaItems, so the gallery kept whatever it independently considered
  // isCover. This is the single point that keeps both in sync: the cover image always
  // becomes mediaItems[0] with isCover:true, every other item loses isCover, and an
  // already-present URL is promoted in place instead of being duplicated.
  const applyCoverFromUrl = (url: string, extra?: { bucket?: StorageBucket; path?: string }) => {
    setCoverImageUrl(url);
    setMediaItems((prev) => {
      const existing = prev.find((m) => m.url === url);
      if (existing) {
        return reindexMedia([existing, ...prev.filter((m) => m.id !== existing.id)]).map((m) => ({
          ...m,
          isCover: m.id === existing.id,
        }));
      }
      const newItem: MediaItem = {
        id: crypto.randomUUID(),
        url,
        type: 'image',
        isCover: true,
        order: 0,
        ...extra,
      };
      return reindexMedia([newItem, ...prev.map((m) => ({ ...m, isCover: false }))]);
    });
  };

  const handleCoverImageUpload = async (rawFile: File) => {
    if (!ACCEPTED_MEDIA_TYPES.includes(rawFile.type) || rawFile.type.startsWith('video/')) {
      toast.addToast('error', 'Please select a valid image file (JPG, PNG, WEBP)');
      return;
    }
    setCoverImageUploading(true);
    try {
      const file = await compressImage(rawFile);
      if (file.size > MAX_IMAGE_FILE_SIZE) {
        toast.addToast('error', `${rawFile.name}: exceeds 5MB limit`);
        return;
      }
      const { url, path, error } = await uploadFile('property-images', file);
      if (error) {
        toast.addToast('error', error);
      } else if (url) {
        applyCoverFromUrl(url, { bucket: 'property-images', path });
      }
    } finally {
      setCoverImageUploading(false);
    }
  };

  // Video URL / Virtual Tour URL each support either a pasted external link
  // (YouTube/Vimeo/any URL) or a direct file upload — the uploaded file's own
  // public URL is written into the same media_urls.videos.0 / .virtual_tour
  // field a pasted URL would occupy, so downstream consumers (property detail
  // page, etc.) don't need to know which path produced it. bucket/path are
  // tracked alongside so a later replace can clean up the old storage object.
  const [videoUploading, setVideoUploading] = useState(false);
  const [virtualTourUploading, setVirtualTourUploading] = useState(false);

  const handleVideoFileUpload = async (rawFile: File) => {
    if (!rawFile.type.startsWith('video/')) {
      toast.addToast('error', 'Please select a valid video file (MP4 or MOV)');
      return;
    }
    if (rawFile.size > MAX_VIDEO_FILE_SIZE) {
      toast.addToast('error', `${rawFile.name}: exceeds ${MAX_VIDEO_FILE_SIZE / 1024 / 1024}MB limit`);
      return;
    }
    setVideoUploading(true);
    try {
      const { url, path, error } = await uploadFile('property-videos', rawFile);
      if (error) {
        toast.addToast('error', error);
      } else if (url) {
        setValue('media_urls.videos.0' as any, url, { shouldDirty: true });
        setValue('media_urls.video_bucket' as any, 'property-videos', { shouldDirty: true });
        setValue('media_urls.video_path' as any, path, { shouldDirty: true });
      }
    } finally {
      setVideoUploading(false);
    }
  };

  const handleVirtualTourFileUpload = async (rawFile: File) => {
    if (!ACCEPTED_MEDIA_TYPES.includes(rawFile.type)) {
      toast.addToast('error', 'Unsupported file type for virtual tour');
      return;
    }
    const isVideo = rawFile.type.startsWith('video/');
    if (isVideo && rawFile.size > MAX_VIDEO_FILE_SIZE) {
      toast.addToast('error', `${rawFile.name}: exceeds ${MAX_VIDEO_FILE_SIZE / 1024 / 1024}MB limit`);
      return;
    }
    if (!isVideo && rawFile.size > MAX_IMAGE_FILE_SIZE) {
      toast.addToast('error', `${rawFile.name}: exceeds ${MAX_IMAGE_FILE_SIZE / 1024 / 1024}MB limit`);
      return;
    }
    setVirtualTourUploading(true);
    try {
      const bucket = isVideo ? 'property-videos' : 'property-images';
      const { url, path, error } = await uploadFile(bucket, rawFile);
      if (error) {
        toast.addToast('error', error);
      } else if (url) {
        setValue('media_urls.virtual_tour' as any, url, { shouldDirty: true });
        setValue('media_urls.virtual_tour_bucket' as any, bucket, { shouldDirty: true });
        setValue('media_urls.virtual_tour_path' as any, path, { shouldDirty: true });
      }
    } finally {
      setVirtualTourUploading(false);
    }
  };

  const handleMediaFiles = async (rawFiles: File[]) => {
    const room = MAX_MEDIA_FILES - mediaItems.length;
    if (room <= 0) {
      toast.addToast('error', `Maximum ${MAX_MEDIA_FILES} files allowed`);
      return;
    }
    for (const rawFile of rawFiles.slice(0, room)) {
      if (!ACCEPTED_MEDIA_TYPES.includes(rawFile.type)) {
        toast.addToast('error', `${rawFile.name}: unsupported file type`);
        continue;
      }
      const isVideo = rawFile.type.startsWith('video/');
      if (isVideo && rawFile.size > MAX_VIDEO_FILE_SIZE) {
        toast.addToast('error', `${rawFile.name}: exceeds 20MB limit`);
        continue;
      }
      const file = isVideo ? rawFile : await compressImage(rawFile);
      if (!isVideo && file.size > MAX_IMAGE_FILE_SIZE) {
        toast.addToast('error', `${rawFile.name}: still exceeds 5MB after compression`);
        continue;
      }

      const bucket: StorageBucket = isVideo ? 'property-videos' : 'property-images';

      const tempId = crypto.randomUUID();
      const localUrl = URL.createObjectURL(file);

      setMediaItems((prev) =>
        reindexMedia([
          ...prev,
          { id: tempId, url: localUrl, type: isVideo ? 'video' : 'image', isCover: prev.length === 0, order: 0, uploading: true },
        ]),
      );

      const { url, path, error } = await uploadFile(bucket, file);
      if (error) {
        toast.addToast('error', `${file.name}: ${error}`);
        setMediaItems((prev) => reindexMedia(prev.filter((m) => m.id !== tempId)));
        continue;
      }

      setMediaItems((prev) => {
        // Dedupe: if this exact URL was already added (e.g. double-drop), drop the new one.
        if (prev.some((m) => m.id !== tempId && m.url === url)) {
          return reindexMedia(prev.filter((m) => m.id !== tempId));
        }
        const finalizing = prev.find((m) => m.id === tempId);
        if (finalizing?.isCover && !isVideo && url) setCoverImageUrl(url);
        return reindexMedia(prev.map((m) => (m.id === tempId ? { ...m, url, path, bucket, uploading: false } : m)));
      });
    }
  };

  const addMediaUrl = () => {
    const url = mediaUrlInput.trim();
    if (!url) return;
    if (!isValidMediaUrl(url)) {
      setMediaUrlError('Enter a valid image or video URL (jpg, png, webp, mp4)');
      return;
    }
    if (mediaItems.some((m) => m.url === url)) {
      setMediaUrlError('This media is already added');
      return;
    }
    if (mediaItems.length >= MAX_MEDIA_FILES) {
      setMediaUrlError(`Maximum ${MAX_MEDIA_FILES} files allowed`);
      return;
    }
    setMediaUrlError(null);
    const becomesCover = mediaItems.length === 0;
    if (becomesCover) setCoverImageUrl(url);
    setMediaItems((prev) =>
      reindexMedia([...prev, { id: crypto.randomUUID(), url, type: isVideoUrl(url) ? 'video' : 'image', isCover: becomesCover, order: 0 }]),
    );
    setMediaUrlInput('');
  };

  // Keeps the standalone Cover Image box in sync when a different gallery image is
  // starred as cover — bidirectional with applyCoverFromUrl above.
  const setCoverMedia = (id: string) =>
    setMediaItems((prev) => {
      const target = prev.find((m) => m.id === id);
      if (target) setCoverImageUrl(target.url);
      return prev.map((m) => ({ ...m, isCover: m.id === id }));
    });

  const removeMedia = async (item: MediaItem) => {
    if (item.bucket && item.path) {
      deleteFile(item.bucket, item.path).catch(() => {
        /* best-effort — orphaned storage object is a minor cleanup issue, not a blocking error */
      });
    }
    setMediaItems((prev) => {
      const next = reindexMedia(prev.filter((m) => m.id !== item.id));
      if (item.isCover) {
        if (next.length > 0) {
          next[0] = { ...next[0], isCover: true };
          setCoverImageUrl(next[0].url);
        } else {
          setCoverImageUrl(null);
        }
      }
      return next;
    });
  };

  const reorderMedia = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setMediaItems((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      return reindexMedia(arr);
    });
  };

  // Step 7: Pricing
  const [negotiable, setNegotiable] = useState(true);

  const methods = useForm<PropertyWizardForm>({
    resolver: zodResolver(propertyWizardSchema) as any,
    mode: 'onChange',
    defaultValues: {
      purpose: 'Sale',
      amenities: [],
      images: [],
      negotiable: true,
    },
  });

  const { handleSubmit, watch, register, getValues, setValue } = methods;

  React.useEffect(() => {
    const subscription = watch((value, { name, type }) => {
      if (name === 'carpet_area' && type === 'change') {
        const ca = parseFloat(value.carpet_area || '0');
        if (!isNaN(ca) && ca > 0) {
          setValue('super_area', (ca * 1.25).toFixed(2).replace(/\.00$/, ''));
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, setValue]);

  // Draft recovery
  React.useEffect(() => {
    if (draftIdParam && isRestoring) {
      import('../../lib/properties').then(({ getDraftProperty }) => {
        getDraftProperty(draftIdParam).then((draft) => {
          if (draft) {
            const formData: Partial<PropertyWizardForm> = draft.draft_data || {
              purpose: draft.purpose || 'Sale',
              category: draft.features?.category || '',
              property_sub_type: draft.features?.property_sub_type || '',
              title: draft.title || '',
              description: draft.description || '',
              price: draft.price ? String(draft.price) : '',
              rent_amount: draft.rent_amount ? String(draft.rent_amount) : '',
              security_deposit: draft.security_deposit ? String(draft.security_deposit) : '',
              maintenance: draft.features?.maintenance ? String(draft.features.maintenance) : '',
              negotiable: draft.features?.negotiable !== false,
              address: draft.address || '',
              city_name: draft.features?.city_name || '',
              locality_name: draft.features?.locality_name || '',
              state_name: draft.state || '',
              pincode: draft.pincode || '',
              latitude: draft.latitude ? String(draft.latitude) : '',
              longitude: draft.longitude ? String(draft.longitude) : '',
              place_id: draft.place_id || '',
              carpet_area: draft.carpet_area ? String(draft.carpet_area) : '',
              super_area: draft.built_up_area ? String(draft.built_up_area) : '',
              plot_area: draft.plot_area ? String(draft.plot_area) : '',
              floor_number: draft.floor_number ? String(draft.floor_number) : '',
              total_floors: draft.total_floors ? String(draft.total_floors) : '',
              facing: draft.facing || '',
              age_of_property: draft.age_of_property ? String(draft.age_of_property) : '',
              parking_indoor: draft.features?.parking_indoor ? String(draft.features.parking_indoor) : '',
              parking_outdoor: draft.features?.parking_outdoor ? String(draft.features.parking_outdoor) : '',
              ownership_type: draft.ownership_type || '',
              ownership_role: draft.features?.ownership_role || '',
              rera_number: draft.features?.rera_number || '',
            };
            methods.reset(formData);
            setDraftId(draftIdParam);
            setActiveStep(draft.current_step || 0);
            setCompletedSteps(draft.completed_steps || []);
            setBedrooms(draft.bedrooms || 2);
            setBathrooms(draft.bathrooms || 1);
            setBalconies(draft.balconies || 1);
            setFurnishing(draft.furnishing || '');
            setSelectedAmenities(draft.amenities || []);
            if (draft.features?.media_items?.length) {
              setMediaItems(draft.features.media_items);
            } else if (draft.images?.length) {
              // Older drafts / existing published properties only have the flat
              // images[] column — reconstruct structured items from it so
              // editing still shows every existing photo.
              setMediaItems(
                draft.images.map((url: string, i: number) => ({
                  id: crypto.randomUUID(),
                  url,
                  type: isVideoUrl(url) ? 'video' : 'image',
                  isCover: i === 0,
                  order: i,
                })),
              );
            }
            if (draft.features?.negotiable !== undefined) {
              setNegotiable(draft.features.negotiable);
            }
            // cover_image_url is the authoritative field — reconcile it into the
            // just-restored mediaItems (via applyCoverFromUrl) rather than only
            // setting the standalone box, so a property saved before this fix (or
            // edited by any other path) self-heals to a consistent single cover on
            // every reload instead of re-showing the box/gallery mismatch.
            if (draft.cover_image_url) {
              applyCoverFromUrl(draft.cover_image_url);
            } else {
              setCoverImageUrl(null);
            }
          }
          setIsRestoring(false);
        }).catch(err => {
          console.error("Failed to restore draft", err);
          setIsRestoring(false);
        });
      });
    } else {
      setIsRestoring(false);
    }
  }, [draftIdParam]);

  // Autosave
  React.useEffect(() => {
    if (isRestoring) return;
    const timer = setTimeout(() => {
      handleSaveDraft(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [JSON.stringify(watch()), activeStep, completedSteps, bedrooms, bathrooms, balconies, furnishing, selectedAmenities, mediaItems, negotiable]);

  // Step 4 (Location): fired when the owner picks a Google Places result —
  // auto-fills every location field and keeps them in sync if they pick a
  // different place afterward.
  const handlePlaceSelected = (place: SelectedPlace) => {
    setValue('address', place.address, { shouldValidate: true, shouldDirty: true });
    if (place.city) setValue('city_name', place.city, { shouldValidate: true, shouldDirty: true });
    if (place.locality) setValue('locality_name', place.locality, { shouldValidate: true, shouldDirty: true });
    if (place.state) setValue('state_name', place.state, { shouldDirty: true });
    if (place.country) setValue('country', place.country, { shouldDirty: true });
    if (place.postalCode) setValue('pincode', place.postalCode, { shouldDirty: true });
    setValue('latitude', String(place.latitude), { shouldDirty: true });
    setValue('longitude', String(place.longitude), { shouldDirty: true });
    setValue('place_id', place.placeId, { shouldDirty: true });
  };


  // Reports one failure at a time (first one found) — toast for *what's* wrong,
  // fieldError + focusInvalidField for *where*. Every step that has a required
  // (`*`-marked) field in its JSX must have a case here; a step with no case
  // falls through to `return true`, which is exactly the bug that let Basic
  // Details (and silently any future step) through with nothing filled in.
  const fail = (field: string | null, message: string): false => {
    setFieldError(field);
    toast.addToast('error', message);
    if (field) focusInvalidField(`wizard-field-${field}`);
    return false;
  };

  const isBlank = (v: string | null | undefined) => !v || !v.trim();
  const isInvalidNumber = (v: string | null | undefined) => !!v && v.trim() !== '' && (Number.isNaN(Number(v)) || Number(v) < 0);

  const validateStep = () => {
    const vals = getValues();
    const stepName = WIZARD_STEPS[activeStep];
    setFieldError(null);

    if (stepName === 'Purpose' && !vals.purpose) {
      return fail(null, 'Please select a listing purpose to continue.');
    }

    if (stepName === 'Category' && !vals.category) {
      return fail(null, 'Please select a property category to continue.');
    }

    if (stepName === 'Property Type' && !vals.property_sub_type) {
      return fail(null, 'Please select a property type to continue.');
    }

    if (stepName === 'Basic Details') {
      if (isBlank(vals.title)) return fail('title', 'Title is required.');
      const numericFields: { key: keyof PropertyWizardForm; label: string }[] = [
        { key: 'carpet_area', label: 'Carpet area' },
        { key: 'super_area', label: 'Super area' },
        { key: 'built_up_area', label: 'Built-up area' },
        { key: 'plot_area', label: 'Plot / land area' },
      ];
      for (const { key, label } of numericFields) {
        if (isInvalidNumber(vals[key] as string | undefined)) {
          return fail(key, `${label} must be a valid number.`);
        }
      }
    }

    if (stepName === 'Location') {
      if (!vals.place_id) {
        return fail(null, 'Please search and select a location from Google Maps before continuing.');
      }
      if (isBlank(vals.city_name)) return fail('city_name', 'City is required.');
      if (isBlank(vals.locality_name)) return fail('locality_name', 'Locality is required.');
      if (isBlank(vals.address)) return fail('address', 'Full address is required.');
    }

    // Media validation: At least one cover photo or some images required
    if (stepName === 'Media' && mediaItems.filter((m) => !m.uploading).length === 0) {
      return fail(null, 'Please upload at least one image to continue.');
    }

    if (stepName === 'Pricing') {
      const priceStr = vals.purpose === 'Rent' ? vals.rent_amount : vals.price;
      const priceError = validatePropertyPrice(priceStr);
      if (priceError) {
        return fail(vals.purpose === 'Rent' ? 'rent_amount' : 'price', priceError);
      }
    }

    return true;
  };


  const handleNext = async () => {
    if (!validateStep()) return;
    
    // Redirect to Plot wizard if Land category is selected
    if (activeStep === 1 && watch('category') === 'Land') {
      navigate(profile?.role === 'agent' ? '/agent/list-property/plot' : '/portal/list-property/plot');
      return;
    }

    if (activeStep < WIZARD_STEPS.length - 1) {
      if (!completedSteps.includes(activeStep)) {
        setCompletedSteps(prev => [...prev, activeStep]);
      }
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) setActiveStep((prev) => prev - 1);
  };

  const calculateCompletion = (vals: any, step: number, completed: number[]) => {
    // Simple heuristic for completion percentage based on steps completed
    const baseProgress = Math.round((completed.length / WIZARD_STEPS.length) * 100);
    return Math.min(100, baseProgress);
  };

  const buildPayload = () => {
    const vals = getValues();

    // Map UI furnishing to DB ENUM ('Unfurnished','Semi-Furnished','Fully Furnished')
    let dbFurnishing = null;
    if (furnishing === 'Fully') dbFurnishing = 'Fully Furnished';
    else if (furnishing === 'Semi') dbFurnishing = 'Semi-Furnished';
    else if (furnishing === 'Bare') dbFurnishing = 'Unfurnished';

    // Map UI Purpose to DB ENUM ('Sale', 'Rent')
    const dbPurpose = vals.purpose === 'Sale' ? 'Sale' : 'Rent';

    let ageInt = null;
    if (vals.age_of_property === '0-1 Years') ageInt = 1;
    else if (vals.age_of_property === '1-5 Years') ageInt = 5;
    else if (vals.age_of_property === '5-10 Years') ageInt = 10;
    else if (vals.age_of_property === '10+ Years') ageInt = 15;

    const autoTitle =
      vals.title?.trim() ||
      `${vals.purpose || 'Sale'} - ${vals.property_sub_type || vals.category || 'Property'}${vals.city_name ? ` in ${vals.city_name}` : ''}`;
    const autoAddress =
      vals.address?.trim() || [vals.locality_name, vals.city_name].filter(Boolean).join(', ') || 'Prime Location';

    return {
      owner_id: user?.id,
      status: 'draft' as const,
      is_draft: true,
      current_step: activeStep,
      completed_steps: completedSteps,
      completion_percentage: calculateCompletion(vals, activeStep, completedSteps),
      draft_data: vals,
      purpose: dbPurpose,
      title: autoTitle,
      description: vals.description || null,
      address: autoAddress,
      place_id: vals.place_id || null,
      latitude: vals.latitude ? parseFloat(vals.latitude) : null,
      longitude: vals.longitude ? parseFloat(vals.longitude) : null,
      state: vals.state_name || null,
      country: vals.country || null,
      pincode: vals.pincode || null,
      price: vals.price ? parseFloat(vals.price) : 0,
      rent_amount: vals.rent_amount ? parseFloat(vals.rent_amount) : null,
      security_deposit: vals.security_deposit ? parseFloat(vals.security_deposit) : null,
      bedrooms: bedrooms || 0,
      bathrooms: bathrooms || 0,
      balconies: balconies || 0,
      furnishing: dbFurnishing,
      floor_number: vals.floor_number ? parseInt(vals.floor_number) : null,
      total_floors: vals.total_floors ? parseInt(vals.total_floors) : null,
      built_up_area: vals.built_up_area ? parseFloat(vals.built_up_area) : null,
      carpet_area: vals.carpet_area ? parseFloat(vals.carpet_area) : null,
      plot_area: vals.plot_area ? parseFloat(vals.plot_area) : null,
      parking: (parseInt(vals.parking_indoor || '0') + parseInt(vals.parking_outdoor || '0')) || 0,
      amenities: selectedAmenities,
      images: [...mediaItems]
        .filter((m) => m.type === 'image' && !m.uploading)
        .sort((a, b) => (a.isCover === b.isCover ? a.order - b.order : a.isCover ? -1 : 1))
        .map((m) => m.url),
      cover_image_url: coverImageUrl || null,
      media_urls: vals.media_urls || null,
      ownership_type: vals.ownership_type || null,
      age_of_property: ageInt,
      facing: vals.facing || null,
      nearby_places: vals.nearby_places || null,
      features: {
        original_purpose: vals.purpose,
        category: vals.category,
        property_sub_type: vals.property_sub_type,
        city_name: vals.city_name,
        locality_name: vals.locality_name,
        maintenance: vals.maintenance ? parseFloat(vals.maintenance) : null,
        negotiable,
        rera_number: vals.rera_number,
        ownership_role: vals.ownership_role,
        super_area: vals.super_area ? parseFloat(vals.super_area) : null,
        balcony_size: vals.balcony_size,
        bedroom_size: vals.bedroom_size,
        parking_indoor: vals.parking_indoor ? parseInt(vals.parking_indoor) : 0,
        parking_outdoor: vals.parking_outdoor ? parseInt(vals.parking_outdoor) : 0,
        source_urls: vals.source_urls ? vals.source_urls.split(',').map(s => s.trim()).filter(Boolean) : [],
        media_items: mediaItems
          .filter((m) => !m.uploading)
          .map(({ id, url, type, isCover, order, bucket, path }) => ({ id, url, type, isCover, order, bucket, path })),
      },
    };
  };

  const handleSaveDraft = async (isAutoSave = false) => {
    // Before creating the FIRST database row for a brand-new draft, require
    // at least one real, deliberate selection (a property type). This used
    // to check `!getValues('purpose')`, but `purpose` defaults to 'Sale' in
    // the form's defaultValues, so that check was always false and never
    // actually blocked anything — the autosave effect (fires 1s after mount)
    // was silently creating a ₹0, all-defaults "Sale - Property" draft row
    // the instant a customer so much as opened "List Property" and did
    // nothing at all, even if they immediately navigated away. Confirmed via
    // production data: every such row had current_step=0, no property_type,
    // and updated_at===created_at (never touched again). Manual "Save Draft"
    // clicks (isAutoSave=false) are unaffected — this only gates the silent
    // background autosave for a not-yet-persisted draft.
    if (isAutoSave && !draftId && !getValues('property_type_id') && !getValues('property_sub_type')) return;
    setSaving(true);
    try {
      const payload = buildPayload();

      // Local backup only — never the source of truth. The actual save below
      // must always be attempted; navigator.onLine only reflects the network
      // adapter's state (unreliable behind proxies/VPNs/sandboxed browsers)
      // and previously skipped the real DB write entirely whenever it
      // misreported offline, which is how "Save Draft" could silently do
      // nothing at all.
      localStorage.setItem(`realtynow_draft_${user?.id || 'guest'}`, JSON.stringify(payload));

      const { savePropertyDraft } = await import('../../lib/properties');
      const data = await savePropertyDraft(draftId, payload, submissionId);
      if (!draftId && data?.id) {
        setDraftId(data.id);
        // Update URL without reloading to reflect draft_id
        window.history.replaceState({}, '', `?draft_id=${data.id}`);
      }

      // So "My Properties → Drafts" reflects this save the moment the
      // customer navigates there, without needing a hard refresh.
      queryClient.invalidateQueries({ queryKey: ['portal-my-properties'] });

      if (!isAutoSave) {
        toast.addToast('success', 'Draft saved. You can continue this listing anytime from My Properties → Drafts.');
      }
    } catch (err: any) {
      console.error('Failed to save draft:', err);
      const message =
        err?.message === 'LISTING_LIMIT_REACHED'
          ? `You've reached your free listing limit for this month. Upgrade to save more drafts.`
          : err?.message === 'Cannot create an empty draft property'
            ? 'Enter at least a few property details before saving a draft.'
            : `Failed to save draft: ${err?.message || 'please try again.'}`;
      toast.addToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async () => {
    // The per-step "Pricing" gate only runs when navigating via Next — jumping
    // straight to Review/Submit (via the step pills) bypassed it entirely,
    // which is how ₹0 listings reached admin approval. Re-check here too.
    const finalVals = getValues();
    const finalPriceStr = finalVals.purpose === 'Rent' ? finalVals.rent_amount : finalVals.price;
    const finalPriceError = validatePropertyPrice(finalPriceStr);
    if (finalPriceError) {
      setActiveStep(WIZARD_STEPS.indexOf('Pricing'));
      fail(finalVals.purpose === 'Rent' ? 'rent_amount' : 'price', finalPriceError);
      return;
    }

    setSaving(true);
    try {
      if (user?.id) {
        await ensureUserProfile(user.id);
      }
      const payload = {
        ...buildPayload(),
        status: 'submitted' as const,
        approval_status: 'Pending' as const,
        is_live: false,
      };

      const executeSubmit = async () => {
        if (draftId) {
          const { error } = await supabase.from('properties').update(payload).eq('id', draftId);
          if (error) throw error;
          triggerAiVerification(draftId);
        } else {
          const { data: inserted, error } = await supabase.from('properties').insert(payload).select('id').single();
          if (error) throw error;
          if (inserted?.id) triggerAiVerification(inserted.id);
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

      toast.addToast('success', '🎉 Property submitted for admin review!');
      const targetUrl = profile?.role === 'agent' ? '/agent/properties' : '/portal/my-properties';
      setTimeout(() => {
        navigate(targetUrl);
      }, 1200);
    } catch (err: any) {
      if (err?.message?.includes('PROPERTY_LIMIT_EXCEEDED') || err?.message?.includes('MONTHLY_PROPERTY_LIMIT_EXCEEDED')) {
        toast.addToast('warning', 'You have reached your listing capacity. Please upgrade your subscription plan to list more properties.');
      } else {
        toast.addToast('error', err?.message || 'Submission failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const onFormError = (errors: any) => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      toast.addToast('error', `Missing required field: ${errorKeys[0]}`);
    } else {
      toast.addToast('error', 'Please fill all required fields.');
    }
  };

  const progressPercentage = Math.round((activeStep / (WIZARD_STEPS.length - 1)) * 100);
  const formData = watch();

  if (!quotaChecked) {
    return (
      <DashboardLayout sections={wizardSections} title={t('forms.postProperty', 'List Property')}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!listPropertyLoading && !listPropertyActive) {
    return <ServiceUnavailable serviceName="List Property Service" />;
  }

  if (quotaExceeded) {
    return (
      <DashboardLayout sections={wizardSections} title={t('forms.postProperty', 'List Property')}>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center max-w-lg mx-auto">
          <div className="bg-red-50 p-4 rounded-full mb-4 mx-auto flex items-center justify-center">
            <Shield className="h-12 w-12 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-navy-900 mb-2">Listing Limit Reached</h2>
          <p className="text-navy-600 mb-6">
            You have reached the maximum limit of {FREE_PLAN_LIMIT} properties for free accounts. Please upgrade your plan to list more properties and unlock premium features.
          </p>
          <Button onClick={() => navigate('/portal/subscription')} className="w-full sm:w-auto">
            View Subscription Plans
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout sections={wizardSections} title={t('forms.postProperty', 'List Property')}>
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-red-100/40 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-rose-50/50 blur-[150px]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.01)_1px,transparent_1px)] bg-[size:24px_24px] opacity-30"></div>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <PreviewModal
            data={formData}
            counters={{ bedrooms, bathrooms, balconies }}
            mediaUrls={[...mediaItems]
              .filter((m) => m.type === 'image')
              .sort((a, b) => (a.isCover === b.isCover ? a.order - b.order : a.isCover ? -1 : 1))
              .map((m) => m.url)}
            furnishing={furnishing}
            onClose={() => setShowPreview(false)}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 mx-auto max-w-5xl space-y-6 pb-20 mt-4">
        {/* Top Header Card */}
        <div className="bg-white/90 backdrop-blur-2xl p-5 md:p-6 rounded-[24px] border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-sm shadow-red-500/20">
                Step {activeStep + 1}
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-navy-900 leading-tight">
                  {WIZARD_STEPS[activeStep]}
                </h2>
                <p className="text-sm text-navy-500 font-medium">
                  {progressPercentage}% Complete • ~{WIZARD_STEPS.length - activeStep} mins left
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-navy-900 text-white px-4 py-2 rounded-full shadow-lg shadow-navy-900/10">
              <span className="text-xs font-semibold tracking-wide">Auto-saving</span>
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
            </div>
          </div>
          <div className="w-full bg-navy-100 rounded-full h-1.5 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-500 shadow-sm shadow-red-500/30"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Main Wizard Card */}
        <div className="bg-white/90 backdrop-blur-2xl rounded-[32px] border border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.06)] overflow-hidden">
          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit, onFormError)}>
              <div className="p-6 md:p-10 min-h-[480px] relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="max-w-4xl mx-auto"
                  >
                    {/* ─── STEP 0: Purpose ─── */}
                    {activeStep === 0 && (
                      <div className="space-y-10">
                        <SectionTitle
                          title="What is the purpose of your listing?"
                          sub="Select the primary intent for this property to tailor the remaining steps."
                        />
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                          {PURPOSE_OPTIONS.map((option) => {
                            const isSelected = watch('purpose') === option.id;
                            return (
                              <motion.button
                                whileHover={{ scale: 1.04, y: -2 }}
                                whileTap={{ scale: 0.96 }}
                                key={option.id}
                                type="button"
                                onClick={() => methods.setValue('purpose', option.id as any)}
                                className={`group relative flex flex-col items-center p-5 md:p-6 rounded-[20px] transition-all duration-300 ease-out border-2 overflow-visible ${isSelected ? 'border-red-500 bg-white shadow-[0_12px_24px_rgba(229,57,53,0.12)] z-10 ring-2 ring-red-500/20' : 'border-navy-50 bg-white/70 hover:bg-white shadow-sm hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:border-red-200'}`}
                              >
                                {isSelected && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1 shadow-md z-20"
                                  >
                                    <Check className="h-3 w-3 stroke-[3]" />
                                  </motion.div>
                                )}
                                <div className="h-16 w-16 mb-4 rounded-xl overflow-hidden bg-white flex items-center justify-center">
                                  {option.icon.endsWith('.png') ? (
                                    <img
                                      src={option.icon}
                                      alt={option.label}
                                      className={`w-full h-full object-contain mix-blend-multiply transition-transform duration-500 ${isSelected ? 'scale-110' : 'group-hover:scale-110 group-hover:-rotate-3'}`}
                                    />
                                  ) : (
                                    <span
                                      className={`text-4xl transition-transform duration-500 ${isSelected ? 'scale-125' : 'group-hover:scale-110'}`}
                                    >
                                      {option.icon}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`block font-display font-bold text-lg leading-tight transition-colors ${isSelected ? 'text-red-600' : 'text-navy-800 group-hover:text-red-500'}`}
                                >
                                  {option.label}
                                </span>
                                <span
                                  className={`block text-[11px] font-medium mt-1 transition-colors ${isSelected ? 'text-red-500/80' : 'text-navy-400'}`}
                                >
                                  {option.desc}
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ─── STEP 1: Category ─── */}
                    {activeStep === 1 && (
                      <div className="space-y-10">
                        <SectionTitle title="Select Property Category" sub="What kind of property are you listing?" />
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
                          {[
                            { id: 'Residential', label: 'Residential', desc: 'Homes & Flats', icon: '🏠' },
                            { id: 'Commercial', label: 'Commercial', desc: 'Offices & Shops', icon: '🏢' },
                            { id: 'Land', label: 'Land', desc: 'Plots & Farms', icon: '🌄' },
                            { id: 'Luxury', label: 'Luxury', desc: 'Premium Estates', icon: '✨' },
                            { id: 'Rental Living', label: 'Rental', desc: 'PGs & Co-living', icon: '🛋️' },
                          ].map((cat) => {
                            const isSelected = watch('category') === cat.id;
                            return (
                              <motion.button
                                whileHover={{ scale: 1.04, y: -2 }}
                                whileTap={{ scale: 0.96 }}
                                key={cat.id}
                                type="button"
                                onClick={() => methods.setValue('category', cat.id as any)}
                                className={`group relative flex flex-col items-center p-5 rounded-[20px] border-2 transition-all duration-300 ${isSelected ? 'border-red-500 bg-white shadow-[0_12px_24px_rgba(229,57,53,0.12)] z-10 ring-2 ring-red-500/20' : 'border-navy-50 bg-white/70 hover:bg-white shadow-sm hover:border-red-200'}`}
                              >
                                {isSelected && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1 shadow-md z-20"
                                  >
                                    <Check className="h-3 w-3 stroke-[3]" />
                                  </motion.div>
                                )}
                                <div className="h-14 w-14 mb-3 rounded-xl bg-gradient-to-br from-navy-50 to-white border border-navy-100/50 flex items-center justify-center">
                                  <span
                                    className={`text-3xl transition-transform duration-500 ${isSelected ? 'scale-125' : 'group-hover:scale-110'}`}
                                  >
                                    {cat.icon}
                                  </span>
                                </div>
                                <span
                                  className={`font-display font-bold text-base ${isSelected ? 'text-red-600' : 'text-navy-800'}`}
                                >
                                  {cat.label}
                                </span>
                                <span
                                  className={`text-[10px] mt-0.5 font-medium ${isSelected ? 'text-red-400' : 'text-navy-400'}`}
                                >
                                  {cat.desc}
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ─── STEP 2: Property Type ─── */}
                    {activeStep === 2 && (
                      <div className="space-y-10 max-w-4xl mx-auto">
                        <SectionTitle
                          title="Property Type"
                          sub={`Choose the specific type of ${watch('category')?.toLowerCase() || 'property'}.`}
                        />
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                          {[
                            { id: 'Apartment', icon: '🏢' },
                            { id: 'Independent House', icon: '🏡' },
                            { id: 'Villa', icon: '🏰' },
                            { id: 'Builder Floor', icon: '🏬' },
                            { id: 'Studio', icon: '🛋️' },
                            { id: 'Penthouse', icon: '🌆' },
                            { id: 'Farmhouse', icon: '🌾' },
                            { id: 'Plot', icon: '📐' },
                          ].map((type) => {
                            const isSelected = watch('property_sub_type') === type.id;
                            return (
                              <motion.button
                                whileHover={{ scale: 1.04, y: -2 }}
                                whileTap={{ scale: 0.96 }}
                                key={type.id}
                                type="button"
                                onClick={() => methods.setValue('property_sub_type', type.id)}
                                className={`group relative flex items-center gap-3 p-4 rounded-[18px] border-2 transition-all duration-300 ${isSelected ? 'border-red-500 bg-white shadow-[0_12px_24px_rgba(229,57,53,0.12)] z-10' : 'border-navy-50 bg-white/70 hover:bg-white shadow-sm hover:border-red-200'}`}
                              >
                                {isSelected && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-md z-20"
                                  >
                                    <Check className="h-3 w-3 stroke-[3]" />
                                  </motion.div>
                                )}
                                <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-navy-50 to-white border border-navy-100 flex items-center justify-center">
                                  <span
                                    className={`text-xl transition-transform duration-300 ${isSelected ? 'scale-125' : 'group-hover:scale-110'}`}
                                  >
                                    {type.icon}
                                  </span>
                                </div>
                                <span
                                  className={`font-display font-bold text-sm ${isSelected ? 'text-red-600' : 'text-navy-800'}`}
                                >
                                  {type.id}
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                        {watch('property_sub_type') === 'Plot' && (
                          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-left">
                            <div>
                              <p className="text-sm font-bold text-red-900">Listing an Open Plot or Land?</p>
                              <p className="text-xs text-red-700">Use our specialized Plot Listing Wizard designed specifically for per-unit pricing (₹/Sq. Ft, ₹/Sq. Yd), survey numbers, and layout approvals.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate('/portal/list-property/plot')}
                              className="shrink-0 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-red-700 transition-colors"
                            >
                              Go to Plot Wizard →
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ─── STEP 3: Basic Details ─── */}
                    {activeStep === 3 && (
                      <div className="space-y-5 max-w-3xl mx-auto">
                        <SectionTitle
                          title="Basic Details"
                          sub="Tell us about the property's size and configuration."
                        />
                        <div className="space-y-4">
                          <div>
                            <FieldLabel>Title *</FieldLabel>
                            <InputField
                              {...register('title')}
                              id="wizard-field-title"
                              placeholder="e.g. 3BHK Luxury Apartment in Bandra"
                              className={fieldError === 'title' ? 'border-red-500 ring-2 ring-red-200' : ''}
                            />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="relative">
                              <FieldLabel>Carpet Area</FieldLabel>
                              <div className={cn('relative flex items-center bg-white border rounded-xl overflow-hidden shadow-sm focus-within:border-red-400 transition-all', fieldError === 'carpet_area' ? 'border-red-500 ring-2 ring-red-200' : 'border-navy-150')}>
                                <input id="wizard-field-carpet_area" type="number" {...register('carpet_area')} placeholder="e.g. 1000" className="flex-1 w-full bg-transparent px-3 py-2.5 text-sm font-medium text-navy-900 focus:outline-none placeholder:text-navy-300" />
                                <span className="px-2 py-2.5 text-xs font-bold text-red-500 border-l border-navy-100 bg-navy-50/50">Sq.ft</span>
                              </div>
                            </div>
                            <div className="relative">
                              <FieldLabel>Super Area</FieldLabel>
                              <div className={cn('relative flex items-center bg-white border rounded-xl overflow-hidden shadow-sm focus-within:border-red-400 transition-all', fieldError === 'super_area' ? 'border-red-500 ring-2 ring-red-200' : 'border-navy-150')}>
                                <input id="wizard-field-super_area" type="number" {...register('super_area')} placeholder="Auto (1.25x)" className="flex-1 w-full bg-transparent px-3 py-2.5 text-sm font-medium text-navy-900 focus:outline-none placeholder:text-navy-300" />
                                <span className="px-2 py-2.5 text-xs font-bold text-red-500 border-l border-navy-100 bg-navy-50/50">Sq.ft</span>
                              </div>
                            </div>
                            <div className="relative">
                              <FieldLabel>Built-up Area</FieldLabel>
                              <div className={cn('relative flex items-center bg-white border rounded-xl overflow-hidden shadow-sm focus-within:border-red-400 transition-all', fieldError === 'built_up_area' ? 'border-red-500 ring-2 ring-red-200' : 'border-navy-150')}>
                                <input id="wizard-field-built_up_area" type="number" {...register('built_up_area')} placeholder="e.g. 1100" className="flex-1 w-full bg-transparent px-3 py-2.5 text-sm font-medium text-navy-900 focus:outline-none placeholder:text-navy-300" />
                                <span className="px-2 py-2.5 text-xs font-bold text-red-500 border-l border-navy-100 bg-navy-50/50">Sq.ft</span>
                              </div>
                            </div>
                            <div className="relative">
                              <FieldLabel>Land / Plot Area</FieldLabel>
                              <div className={cn('relative flex items-center bg-white border rounded-xl overflow-hidden shadow-sm focus-within:border-red-400 transition-all', fieldError === 'plot_area' ? 'border-red-500 ring-2 ring-red-200' : 'border-navy-150')}>
                                <input id="wizard-field-plot_area" type="number" {...register('plot_area')} placeholder="e.g. 1500" className="flex-1 w-full bg-transparent px-3 py-2.5 text-sm font-medium text-navy-900 focus:outline-none placeholder:text-navy-300" />
                                <span className="px-2 py-2.5 text-xs font-bold text-red-500 border-l border-navy-100 bg-navy-50/50">Sq.ft</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <FieldLabel>Description</FieldLabel>
                          <TextAreaField
                            {...register('description')}
                            placeholder="Describe the property — highlights, layout, surroundings..."
                            rows={3}
                          />
                        </div>

                        <div>
                          <FieldLabel>Source URLs (Optional)</FieldLabel>
                          <TextAreaField
                            {...register('source_urls')}
                            placeholder="Add reference links (comma separated)"
                            rows={2}
                          />
                        </div>

                        <div>
                          <FieldLabel>Furnishing</FieldLabel>
                          <div className="flex gap-2">
                            {[
                              { label: 'Fully', icon: '🛋️' },
                              { label: 'Semi', icon: '🪑' },
                              { label: 'Bare', icon: '🧱' },
                            ].map((s) => {
                              const isActive = furnishing === s.label;
                              return (
                                <button
                                  key={s.label}
                                  type="button"
                                  onClick={() => setFurnishing(s.label)}
                                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border flex flex-col items-center gap-0.5 ${isActive ? 'border-red-500 bg-red-50 text-red-600 ring-2 ring-red-500/10' : 'border-navy-150 bg-white text-navy-600 hover:border-red-300'}`}
                                >
                                  <span className="text-base">{s.icon}</span>
                                  {s.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: 'Bedrooms', icon: '🛏️', value: bedrooms, set: setBedrooms, min: 0, max: 10, reg: 'bedroom_size', pl: 'Size (sq.ft)' },
                            { label: 'Bathrooms', icon: '🚿', value: bathrooms, set: setBathrooms, min: 0, max: 10 },
                            { label: 'Balconies', icon: '🌿', value: balconies, set: setBalconies, min: 0, max: 10, reg: 'balcony_size', pl: 'Size (sq.ft)' },
                          ].map((room) => (
                            <div
                              key={room.label}
                              className="bg-white border border-navy-150 rounded-2xl p-3 flex flex-col items-center gap-2 shadow-sm"
                            >
                              <span className="text-xl">{room.icon}</span>
                              <span className="text-[10px] font-bold text-navy-500 uppercase tracking-widest">
                                {room.label}
                              </span>
                              <div className="flex items-center gap-2 bg-navy-50 rounded-xl px-1 py-1 w-full justify-between">
                                <button
                                  type="button"
                                  onClick={() => room.set((v) => Math.max(room.min, v - 1))}
                                  disabled={room.value <= room.min}
                                  className="h-7 w-7 bg-white rounded-lg shadow-sm font-bold hover:text-red-600 transition-all flex items-center justify-center text-base disabled:opacity-30 disabled:cursor-not-allowed text-navy-600"
                                >
                                  −
                                </button>
                                <span className="font-display font-bold text-base text-navy-900 min-w-[20px] text-center">
                                  {room.value}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => room.set((v) => Math.min(room.max, v + 1))}
                                  disabled={room.value >= room.max}
                                  className="h-7 w-7 bg-white rounded-lg shadow-sm font-bold hover:text-red-600 transition-all flex items-center justify-center text-base disabled:opacity-30 disabled:cursor-not-allowed text-navy-600"
                                >
                                  +
                                </button>
                              </div>
                              {room.reg && (
                                <input type="number" {...register(room.reg as any)} placeholder={room.pl} className="w-full mt-1 bg-navy-50/50 border border-navy-100 rounded-lg px-2 py-1.5 text-[11px] font-medium text-center focus:outline-none focus:border-red-400 placeholder:text-navy-300" />
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <FieldLabel>Floor No.</FieldLabel>
                            <InputField {...register('floor_number')} type="number" placeholder="e.g. 3" />
                          </div>
                          <div>
                            <FieldLabel>Total Floors</FieldLabel>
                            <InputField {...register('total_floors')} type="number" placeholder="e.g. 10" />
                          </div>
                          <div>
                            <FieldLabel>Facing</FieldLabel>
                            <SelectField {...register('facing')}>
                              <option value="">Select</option>
                              {['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'].map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </SelectField>
                          </div>
                          <div>
                            <FieldLabel>Age of Property</FieldLabel>
                            <SelectField {...register('age_of_property')}>
                              <option value="">Select</option>
                              {['Under Construction', '0-1 Years', '1-5 Years', '5-10 Years', '10+ Years'].map((a) => (
                                <option key={a} value={a}>{a}</option>
                              ))}
                            </SelectField>
                          </div>
                          <div>
                            <FieldLabel>Indoor Parking</FieldLabel>
                            <InputField {...register('parking_indoor')} type="number" placeholder="e.g. 1" />
                          </div>
                          <div>
                            <FieldLabel>Outdoor Parking</FieldLabel>
                            <InputField {...register('parking_outdoor')} type="number" placeholder="e.g. 2" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ─── STEP 4: Location ─── */}
                    {activeStep === 4 && (
                      <div className="space-y-5 max-w-3xl mx-auto">
                        <SectionTitle title="Location Details" sub="Where is the property located?" />
                        <LocationAutocomplete
                          onSelect={handlePlaceSelected}
                          initialAddress={watch('address')}
                          initialLat={watch('latitude') ? parseFloat(watch('latitude') as string) : undefined}
                          initialLng={watch('longitude') ? parseFloat(watch('longitude') as string) : undefined}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <FieldLabel>City *</FieldLabel>
                            <InputField
                              {...register('city_name')}
                              id="wizard-field-city_name"
                              placeholder="e.g. Mumbai"
                              className={fieldError === 'city_name' ? 'border-red-500 ring-2 ring-red-200' : ''}
                            />
                          </div>
                          <div>
                            <FieldLabel>Locality *</FieldLabel>
                            <InputField
                              {...register('locality_name')}
                              id="wizard-field-locality_name"
                              placeholder="e.g. Bandra West"
                              className={fieldError === 'locality_name' ? 'border-red-500 ring-2 ring-red-200' : ''}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <FieldLabel>State</FieldLabel>
                            <InputField {...register('state_name')} placeholder="Auto-filled from map search" />
                          </div>
                          <div>
                            <FieldLabel>Country</FieldLabel>
                            <InputField {...register('country')} placeholder="Auto-filled from map search" />
                          </div>
                          <div>
                            <FieldLabel>Postal Code</FieldLabel>
                            <InputField {...register('pincode')} placeholder="Auto-filled from map search" />
                          </div>
                        </div>
                        <div>
                          <FieldLabel>Full Address *</FieldLabel>
                          <TextAreaField
                            {...register('address')}
                            id="wizard-field-address"
                            placeholder="Building name, Street, Landmark..."
                            rows={2}
                            className={fieldError === 'address' ? 'border-red-500 ring-2 ring-red-200' : ''}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <FieldLabel>Latitude</FieldLabel>
                            <InputField
                              {...register('latitude')}
                              readOnly
                              placeholder="Auto-filled from map search"
                              className="bg-navy-50 text-navy-500 cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <FieldLabel>Longitude</FieldLabel>
                            <InputField
                              {...register('longitude')}
                              readOnly
                              placeholder="Auto-filled from map search"
                              className="bg-navy-50 text-navy-500 cursor-not-allowed"
                            />
                          </div>
                        </div>
                        <div className="bg-navy-50 rounded-2xl p-4 border border-navy-100">
                          <p className="text-xs font-bold text-navy-700 mb-3 uppercase tracking-widest">
                            📍 Nearby Places
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {[
                              { key: 'metro', label: 'Nearest Metro', placeholder: 'e.g. Bandra Station' },
                              { key: 'hospital', label: 'Hospital', placeholder: 'e.g. Lilavati Hospital' },
                              { key: 'school', label: 'School / College', placeholder: 'e.g. IIT Bombay' },
                              { key: 'mall', label: 'Shopping Mall', placeholder: 'e.g. Phoenix Mall' },
                              { key: 'airport', label: 'Airport', placeholder: 'e.g. CSIA - 8 km' },
                            ].map((nb) => (
                              <div key={nb.key}>
                                <FieldLabel>{nb.label}</FieldLabel>
                                <InputField
                                  {...register(`nearby_places.${nb.key}` as any)}
                                  placeholder={nb.placeholder}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ─── STEP 5: Amenities ─── */}
                    {activeStep === 5 && (
                      <div className="space-y-6 max-w-3xl mx-auto">
                        <SectionTitle
                          title="Amenities & Features"
                          sub="Select all available amenities to attract more buyers."
                        />
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {AMENITIES_LIST.map((a) => {
                            const isSelected = selectedAmenities.includes(a.id);
                            return (
                              <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                key={a.id}
                                type="button"
                                onClick={() => toggleAmenity(a.id)}
                                className={`relative flex items-center gap-2.5 p-3 rounded-[16px] border-2 transition-all text-left ${isSelected ? 'border-red-500 bg-red-50 ring-2 ring-red-500/10' : 'border-navy-50 bg-white/70 hover:bg-white hover:border-red-200'}`}
                              >
                                {isSelected && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-0.5 z-20"
                                  >
                                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                                  </motion.div>
                                )}
                                <span className="text-xl">{a.icon}</span>
                                <span
                                  className={`text-xs font-semibold ${isSelected ? 'text-red-700' : 'text-navy-700'}`}
                                >
                                  {a.label}
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                        {selectedAmenities.length > 0 && (
                          <p className="text-center text-xs text-navy-500 font-medium">
                            {selectedAmenities.length} amenities selected
                          </p>
                        )}
                      </div>
                    )}

                    {/* ─── STEP 6: Media ─── */}
                    {activeStep === 6 && (
                      <div className="space-y-5 max-w-3xl mx-auto">
                        <SectionTitle title="Photos & Media" sub="Add photos and videos to showcase the property." />

                        {/* Dropzone — drag & drop or Choose Files */}
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleMediaFiles(Array.from(e.dataTransfer.files));
                          }}
                          className="border-2 border-dashed border-navy-200 rounded-2xl p-8 text-center bg-navy-50/30 hover:bg-navy-50/50 transition-all"
                        >
                          <Camera className="h-8 w-8 text-navy-400 mx-auto mb-3" />
                          <p className="text-sm font-semibold text-navy-700 mb-1">Drag & drop or Upload Photos/Videos</p>
                          <p className="text-xs text-navy-400 mb-4">
                            Images: Max 5MB each. Videos: Max 20MB each. Up to {MAX_MEDIA_FILES} files ({mediaItems.length}/{MAX_MEDIA_FILES} added)
                          </p>
                          <label className="cursor-pointer inline-flex items-center gap-2 bg-navy-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-navy-800 transition-all shadow-md">
                            <Camera className="h-4 w-4" /> Choose Files
                            <input
                              type="file"
                              multiple
                              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime"
                              className="hidden"
                              onChange={(e) => {
                                handleMediaFiles(Array.from(e.target.files || []));
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>

                        {/* ── COVER IMAGE ── */}
                        <div className="rounded-2xl border border-navy-100 bg-navy-50/30 p-4 mb-4">
                          <FieldLabel>COVER IMAGE</FieldLabel>
                          <p className="mb-3 text-xs text-navy-400">
                            Upload the main cover image for your property. Supported: JPG, JPEG, PNG, WEBP. Maximum size: 5 MB.
                          </p>
                          <div className="flex flex-col items-start gap-3 sm:flex-row">
                            <div className="w-full flex-1 space-y-2">
                              <InputField
                                value={coverImageUrl ?? ''}
                                onChange={(e) => setCoverImageUrl(e.target.value || null)}
                                onBlur={() => {
                                  const val = (coverImageUrl || '').trim();
                                  if (val && isValidMediaUrl(val)) applyCoverFromUrl(val);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return;
                                  e.preventDefault();
                                  const val = (coverImageUrl || '').trim();
                                  if (val && isValidMediaUrl(val)) applyCoverFromUrl(val);
                                }}
                                placeholder="Paste cover image URL..."
                              />
                              <div className="flex items-center gap-2">
                                <div className="h-px flex-1 bg-navy-150" />
                                <span className="text-[10px] font-bold uppercase text-navy-300">or</span>
                                <div className="h-px flex-1 bg-navy-150" />
                              </div>
                              <label
                                className={
                                  'inline-flex cursor-pointer items-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2 text-xs font-semibold text-navy-700 shadow-sm transition-all hover:bg-navy-50' +
                                  (coverImageUploading ? ' pointer-events-none opacity-60' : '')
                                }
                              >
                                <Camera className="h-3.5 w-3.5" /> {coverImageUploading ? 'Uploading…' : 'Upload Cover Image'}
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleCoverImageUpload(file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </div>
                            {coverImageUrl && (
                              <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl border border-navy-150 bg-navy-100">
                                <img
                                  src={coverImageUrl}
                                  alt="Cover banner preview"
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200';
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setCoverImageUrl(null)}
                                  title="Remove cover image"
                                  className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Add URL */}
                        <div>
                          <FieldLabel>Or paste image / video URL</FieldLabel>
                          <div className="flex gap-2">
                            <InputField
                              value={mediaUrlInput}
                              onChange={(e) => {
                                setMediaUrlInput(e.target.value);
                                if (mediaUrlError) setMediaUrlError(null);
                              }}
                              placeholder="https://..."
                              className="flex-1"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addMediaUrl();
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={addMediaUrl}
                              className="px-4 py-2.5 bg-navy-900 text-white text-sm font-semibold rounded-xl hover:bg-navy-800 transition-all"
                            >
                              Add
                            </button>
                          </div>
                          {mediaUrlError && (
                            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {mediaUrlError}
                            </p>
                          )}
                        </div>

                        {/* Thumbnail grid — drag to reorder, hover for actions */}
                        {mediaItems.length > 0 && (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {mediaItems.map((item, i) => (
                              <div
                                key={item.id}
                                draggable={!item.uploading}
                                onDragStart={() => setDragIndex(i)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (dragIndex !== null) reorderMedia(dragIndex, i);
                                  setDragIndex(null);
                                }}
                                className="group relative aspect-square rounded-xl overflow-hidden bg-navy-100 shadow-sm cursor-grab active:cursor-grabbing"
                              >
                                {item.type === 'video' ? (
                                  <video src={item.url} className="h-full w-full object-cover" muted />
                                ) : (
                                  <img
                                    src={item.url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200';
                                    }}
                                  />
                                )}

                                {item.type === 'video' && (
                                  <PlayCircle className="pointer-events-none absolute inset-0 m-auto h-8 w-8 text-white drop-shadow" />
                                )}

                                {item.uploading && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                                  </div>
                                )}

                                {item.isCover && !item.uploading && (
                                  <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold text-white shadow">
                                    <Star className="h-2.5 w-2.5 fill-current" /> Cover
                                  </span>
                                )}

                                {!item.uploading && (
                                  <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewItem(item)}
                                      title="Preview"
                                      className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-navy-800 hover:bg-white"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                    {!item.isCover && (
                                      <button
                                        type="button"
                                        onClick={() => setCoverMedia(item.id)}
                                        title="Set as cover"
                                        className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-navy-800 hover:bg-white"
                                      >
                                        <Star className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => removeMedia(item)}
                                      title="Delete"
                                      className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-red-600 hover:bg-red-600 hover:text-white"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}

                                {!item.uploading && (
                                  <GripVertical className="pointer-events-none absolute bottom-1 right-1 h-3.5 w-3.5 text-white/70 drop-shadow" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}



                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <FieldLabel>Video URL (YouTube / Vimeo)</FieldLabel>
                            <InputField
                              {...register('media_urls.videos.0' as any)}
                              placeholder="https://youtube.com/..."
                            />
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-px flex-1 bg-navy-150" />
                              <span className="text-[10px] font-bold uppercase text-navy-300">or</span>
                              <div className="h-px flex-1 bg-navy-150" />
                            </div>
                            <label
                              className={
                                'mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2 text-xs font-semibold text-navy-700 shadow-sm transition-all hover:bg-navy-50' +
                                (videoUploading ? ' pointer-events-none opacity-60' : '')
                              }
                            >
                              <Camera className="h-3.5 w-3.5" /> {videoUploading ? 'Uploading…' : 'Upload Video File'}
                              <input
                                type="file"
                                accept="video/mp4,video/quicktime"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleVideoFileUpload(file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {watch('media_urls.videos.0' as any) && (
                              <video
                                src={watch('media_urls.videos.0' as any) as string}
                                controls
                                className="mt-2 h-28 w-full rounded-xl bg-black object-contain"
                              />
                            )}
                          </div>
                          <div>
                            <FieldLabel>Virtual Tour URL</FieldLabel>
                            <InputField {...register('media_urls.virtual_tour')} placeholder="https://..." />
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-px flex-1 bg-navy-150" />
                              <span className="text-[10px] font-bold uppercase text-navy-300">or</span>
                              <div className="h-px flex-1 bg-navy-150" />
                            </div>
                            <label
                              className={
                                'mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2 text-xs font-semibold text-navy-700 shadow-sm transition-all hover:bg-navy-50' +
                                (virtualTourUploading ? ' pointer-events-none opacity-60' : '')
                              }
                            >
                              <Camera className="h-3.5 w-3.5" /> {virtualTourUploading ? 'Uploading…' : 'Upload Virtual Tour File'}
                              <input
                                type="file"
                                accept={ACCEPTED_MEDIA_TYPES.join(',')}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleVirtualTourFileUpload(file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {watch('media_urls.virtual_tour') && (
                              <p className="mt-2 truncate text-xs font-medium text-navy-500">
                                📎 {watch('media_urls.virtual_tour')}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Lightbox preview */}
                        {previewItem && (
                          <div
                            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
                            onClick={() => setPreviewItem(null)}
                          >
                            <button
                              type="button"
                              onClick={() => setPreviewItem(null)}
                              className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
                            >
                              <X className="h-5 w-5" />
                            </button>
                            {previewItem.type === 'video' ? (
                              <video src={previewItem.url} controls autoPlay className="max-h-[85vh] max-w-full rounded-xl" onClick={(e) => e.stopPropagation()} />
                            ) : (
                              <img
                                src={previewItem.url}
                                alt=""
                                className="max-h-[85vh] max-w-full rounded-xl object-contain"
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ─── STEP 7: Pricing ─── */}
                    {activeStep === 7 && (
                      <div className="space-y-5 max-w-3xl mx-auto">
                        <SectionTitle
                          title="Pricing & Financials"
                          sub="Set the price, deposit, and maintenance details."
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {watch('purpose') === 'Sale' ? (
                            <div>
                              <FieldLabel>Asking Price (₹) *</FieldLabel>
                              <div className={cn('relative flex items-center bg-white border rounded-xl overflow-hidden shadow-sm focus-within:border-red-400 transition-all', fieldError === 'price' ? 'border-red-500 ring-2 ring-red-200' : 'border-navy-150')}>
                                <span className="pl-4 pr-2 text-sm font-bold text-navy-400">₹</span>
                                <input
                                  {...register('price')}
                                  id="wizard-field-price"
                                  type="number"
                                  placeholder="e.g. 8500000"
                                  className="flex-1 bg-transparent px-2 py-2.5 text-sm font-medium focus:outline-none placeholder:text-navy-300"
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <FieldLabel>Monthly Rent (₹) *</FieldLabel>
                              <div className={cn('relative flex items-center bg-white border rounded-xl overflow-hidden shadow-sm focus-within:border-red-400 transition-all', fieldError === 'rent_amount' ? 'border-red-500 ring-2 ring-red-200' : 'border-navy-150')}>
                                <span className="pl-4 pr-2 text-sm font-bold text-navy-400">₹</span>
                                <input
                                  {...register('rent_amount')}
                                  id="wizard-field-rent_amount"
                                  type="number"
                                  placeholder="e.g. 25000"
                                  className="flex-1 bg-transparent px-2 py-2.5 text-sm font-medium focus:outline-none placeholder:text-navy-300"
                                />
                              </div>
                            </div>
                          )}
                          <div>
                            <FieldLabel>Security Deposit (₹)</FieldLabel>
                            <div className="relative flex items-center bg-white border border-navy-150 rounded-xl overflow-hidden shadow-sm focus-within:border-red-400 transition-all">
                              <span className="pl-4 pr-2 text-sm font-bold text-navy-400">₹</span>
                              <input
                                {...register('security_deposit')}
                                type="number"
                                placeholder="e.g. 50000"
                                className="flex-1 bg-transparent px-2 py-2.5 text-sm font-medium focus:outline-none placeholder:text-navy-300"
                              />
                            </div>
                          </div>
                          <div>
                            <FieldLabel>Maintenance (₹/month)</FieldLabel>
                            <InputField {...register('maintenance')} type="number" placeholder="e.g. 2000" />
                          </div>
                          <div>
                            <FieldLabel>Brokerage</FieldLabel>
                            <SelectField {...register('brokerage')}>
                              <option value="">Select</option>
                              <option>No Brokerage</option>
                              <option>15 Days Rent</option>
                              <option>1 Month Rent</option>
                              <option>2 Months Rent</option>
                              <option>Custom</option>
                            </SelectField>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-navy-50 rounded-2xl border border-navy-100">
                          <button
                            type="button"
                            onClick={() => setNegotiable((v) => !v)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${negotiable ? 'bg-red-500' : 'bg-navy-200'}`}
                          >
                            <motion.span
                              animate={{ x: negotiable ? 20 : 2 }}
                              className="inline-block h-4 w-4 bg-white rounded-full shadow-md"
                            />
                          </button>
                          <div>
                            <p className="text-sm font-semibold text-navy-900">Price is Negotiable</p>
                            <p className="text-xs text-navy-400">Buyers can negotiate the price with you</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ─── STEP 8: Availability ─── */}
                    {activeStep === 8 && (
                      <div className="space-y-5 max-w-3xl mx-auto">
                        <SectionTitle
                          title="Availability"
                          sub="When is the property available and how can it be visited?"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <FieldLabel>Available From</FieldLabel>
                            <InputField {...register('availability_date')} type="date" />
                          </div>
                          <div>
                            <FieldLabel>Construction Status</FieldLabel>
                            <SelectField {...register('construction_status')}>
                              <option value="">Select</option>
                              <option>Ready to Move</option>
                              <option>Under Construction</option>
                              <option>New Launch</option>
                            </SelectField>
                          </div>
                          <div>
                            <FieldLabel>Visiting Hours</FieldLabel>
                            <div className="flex items-center gap-2">
                              <InputField 
                                type="time" 
                                className="flex-1 text-center"
                                value={(watch('visiting_hours') || '').split(' to ')[0] || ''}
                                onChange={(e) => {
                                  const parts = (watch('visiting_hours') || '').split(' to ');
                                  setValue('visiting_hours', `${e.target.value} to ${parts[1] || ''}`);
                                }}
                              />
                              <span className="text-navy-400 font-medium text-sm">to</span>
                              <InputField 
                                type="time" 
                                className="flex-1 text-center"
                                value={(watch('visiting_hours') || '').split(' to ')[1] || ''}
                                onChange={(e) => {
                                  const parts = (watch('visiting_hours') || '').split(' to ');
                                  setValue('visiting_hours', `${parts[0] || ''} to ${e.target.value}`);
                                }}
                              />
                            </div>
                          </div>
                          <div>
                            <FieldLabel>Open House Date</FieldLabel>
                            <InputField {...register('open_house_schedule')} type="date" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ─── STEP 9: Ownership ─── */}
                    {activeStep === 9 && (
                      <div className="space-y-5 max-w-3xl mx-auto">
                        <SectionTitle
                          title="Ownership & Legal"
                          sub="Provide ownership and legal documentation details."
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <FieldLabel>Your Role</FieldLabel>
                            <SelectField {...register('ownership_role')}>
                              <option value="">Select Role</option>
                              <option>Owner</option>
                              <option>Broker / Agent</option>
                              <option>Builder</option>
                              <option>Power of Attorney</option>
                            </SelectField>
                          </div>
                          <div>
                            <FieldLabel>Ownership Type</FieldLabel>
                            <SelectField {...register('ownership_type')}>
                              <option value="">Select</option>
                              <option>Freehold</option>
                              <option>Leasehold</option>
                              <option>Co-operative Society</option>
                              <option>Power of Attorney</option>
                            </SelectField>
                          </div>
                          <div>
                            <FieldLabel>RERA Number (optional)</FieldLabel>
                            <InputField {...register('rera_number')} placeholder="e.g. P51800047XXX" />
                          </div>
                          <div>
                            <FieldLabel>Property Tax ID (optional)</FieldLabel>
                            <InputField {...register('property_tax_id')} placeholder="e.g. MUM-2024-XXX" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ─── STEP 10: SEO ─── */}
                    {activeStep === 10 && (
                      <div className="space-y-5 max-w-3xl mx-auto">
                        <SectionTitle
                          title="SEO & Discoverability"
                          sub="Boost visibility in Google and property portals."
                        />
                        <div className="space-y-4">
                          <div>
                            <FieldLabel>SEO Title</FieldLabel>
                            <InputField
                              {...register('seo_metadata.meta_title')}
                              placeholder="e.g. 3BHK Apartment for Sale in Bandra West, Mumbai"
                            />
                          </div>
                          <div>
                            <FieldLabel>Meta Description</FieldLabel>
                            <TextAreaField
                              {...register('seo_metadata.meta_description')}
                              placeholder="A brief, compelling description for search engines..."
                              rows={3}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <FieldLabel>URL Slug</FieldLabel>
                              <InputField {...register('seo_metadata.slug')} placeholder="3bhk-apartment-bandra-west" />
                            </div>
                            <div>
                              <FieldLabel>Keywords</FieldLabel>
                              <InputField
                                {...register('seo_metadata.keywords')}
                                placeholder="3BHK, Bandra, Mumbai apartment"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ─── STEP 11: Review ─── */}
                    {activeStep === 11 && (
                      <div className="space-y-5 max-w-3xl mx-auto">
                        <SectionTitle title="Review Your Listing" sub="Verify all details before submitting." />
                        <div className="space-y-3">
                          {[
                            { label: 'Purpose', val: formData.purpose, icon: '🎯' },
                            { label: 'Category', val: formData.category, icon: '🏷️' },
                            { label: 'Property Type', val: formData.property_sub_type, icon: '🏠' },
                            { label: 'Title', val: formData.title, icon: '📝' },
                            {
                              label: 'Location',
                              val: [formData.locality_name, formData.city_name].filter(Boolean).join(', '),
                              icon: '📍',
                            },
                            {
                              label: 'Price',
                              val:
                                formData.price || formData.rent_amount
                                  ? `₹${Number(formData.price || formData.rent_amount || 0).toLocaleString('en-IN')}`
                                  : undefined,
                              icon: '💰',
                            },
                            { label: 'Bedrooms', val: String(bedrooms), icon: '🛏️' },
                            {
                              label: 'Amenities',
                              val: selectedAmenities.length ? `${selectedAmenities.length} selected` : undefined,
                              icon: '✨',
                            },
                          ]
                            .filter((row) => row.val)
                            .map((row) => (
                              <div
                                key={row.label}
                                className="flex items-center gap-3 p-3.5 bg-navy-50 rounded-xl border border-navy-100"
                              >
                                <span className="text-lg">{row.icon}</span>
                                <div className="flex-1 flex items-center justify-between">
                                  <span className="text-xs text-navy-500 font-semibold uppercase tracking-wider">
                                    {row.label}
                                  </span>
                                  <span className="text-sm font-semibold text-navy-900">{row.val}</span>
                                </div>
                              </div>
                            ))}
                        </div>
                        <div className="bg-green-50 border border-green-100 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <Check className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                            <p className="text-sm text-green-800 font-medium">
                              Your listing looks great! Click <strong>Submit Property</strong> below to send it for admin review. It will
                              go live once approved.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSubmit(onSubmit, onFormError)()}
                            disabled={saving}
                            className="shrink-0 h-10 px-5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {saving ? (
                              <div className="h-3.5 w-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Star className="h-3.5 w-3.5" />
                            )}
                            Submit Property
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Sticky Footer */}
              <div className="bg-white/95 backdrop-blur-2xl border-t border-navy-100/50 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 z-50 rounded-b-[32px] pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={activeStep === 0}
                  className="rounded-xl h-11 px-5 font-medium text-sm hover:bg-navy-50 text-navy-600 transition-colors justify-center sm:justify-start"
                  icon={<ChevronLeft className="h-4 w-4" />}
                >
                  Previous
                </Button>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handleSaveDraft()}
                    disabled={saving}
                    className="h-11 rounded-xl px-5 flex items-center justify-center gap-2 font-medium text-sm bg-white border border-navy-200 text-navy-700 hover:bg-navy-50 hover:text-navy-900 transition-all shadow-sm disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="h-3.5 w-3.5 border-2 border-navy-400/50 border-t-navy-700 rounded-full animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}{' '}
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPreview(true)}
                    className="h-11 rounded-xl px-5 hidden md:flex items-center justify-center gap-2 font-medium text-sm bg-white border border-navy-200 text-navy-700 hover:bg-navy-50 hover:text-navy-900 transition-all shadow-sm"
                  >
                    <Eye className="h-4 w-4" /> Preview
                  </button>
                  {activeStep < WIZARD_STEPS.length - 1 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="h-11 rounded-xl px-7 flex items-center justify-center gap-2 font-semibold text-sm bg-navy-900 hover:bg-navy-950 text-white shadow-md transition-all group"
                    >
                      Next <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={saving}
                      className="h-11 rounded-xl px-7 flex items-center justify-center gap-2 font-semibold text-sm bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-md transition-all disabled:opacity-50"
                    >
                      {saving ? (
                        <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}{' '}
                      Submit Property
                    </button>
                  )}
                </div>
              </div>
            </form>
          </FormProvider>
        </div>

        {/* Bottom Premium Features */}
        <div className="bg-navy-950 rounded-[28px] p-6 md:p-8 border border-navy-800 shadow-2xl relative overflow-hidden mt-8">
          <div className="absolute top-0 left-1/4 w-1/2 h-full bg-red-600/10 blur-[80px] rounded-full pointer-events-none"></div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 relative z-10">
            {[
              { icon: Clock, title: 'Auto Save', desc: 'Saved every 15s' },
              { icon: Save, title: 'Resume Anytime', desc: 'Start where left off' },
              { icon: Shield, title: '100% Safe', desc: 'Data is secure' },
              { icon: Sparkles, title: 'AI Powered', desc: 'Smart suggestions' },
              { icon: Smartphone, title: 'Mobile Friendly', desc: 'List on any device' },
            ].map((feature, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -4, scale: 1.02 }}
                className="flex flex-col items-center md:items-start gap-3 group cursor-default text-center md:text-left"
              >
                <div className="bg-red-500/10 p-3 rounded-2xl border border-red-500/20 group-hover:bg-red-500/20 transition-all">
                  <feature.icon className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">{feature.title}</h4>
                  <p className="text-navy-400 text-xs mt-1">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
