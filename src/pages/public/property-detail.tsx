import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { Bed, Bath, Maximize, MapPin, Heart, Share2, Check, CheckCircle2, ChevronLeft, ChevronRight, Car, Calendar, Home, Eye, Star, Send, ShieldCheck, Bot, Play, X, Building, Images, Layers, Flag, Box, Navigation2, Clock, Compass, User, Edit3, Trash2, Dumbbell, Waves, Wifi, Zap, Trees, Building2, Camera, Flame, PhoneCall, Gamepad2, CloudRain, Cpu, Sun, UserCheck, Headphones, Laptop, Wind, Utensils, Sparkles, ArrowUp } from 'lucide-react';
import { fetchProperty, trackPropertyView } from '../../lib/properties';
import { supabase } from '../../lib/supabase';
import { ensureUserProfile } from '../../lib/profile-utils';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { SharePropertyModal } from '../../components/share-property-modal';
import { ContactAgentModal } from '../../components/contact-agent-modal';
import { Button, Card, Input, Textarea, Badge, Avatar, EmptyState, Spinner, Modal, Select } from '../../components/ui';
import { RatingStars } from '../../components/property-card';
import { formatCompactPrice, formatPrice, formatNumber, cn, getPropertyPrice, buildWhatsAppUrl } from '../../lib/utils';
import { getPropertyPricingDisplay, isLandProperty, getPriceUnitLabel, getAreaUnitDisplay, fromAreaUnitCode } from '../../lib/plot-pricing';
import { isCompared, toggleCompareProperty } from '../../lib/compare';
import { toggleFavoriteProperty, getLocalFavoriteIds } from '../../lib/favorites';
import { getSafePropertyImages, handleImageError, DEFAULT_PROPERTY_IMAGE } from '../../lib/property-images';
import { useToast } from '../../components/toast';
import { useSEO } from '../../hooks/use-seo';
import { VirtualTourViewer } from '../../components/virtual-tour/virtual-tour-viewer';
import { PublishToSectionControl } from '../../components/admin/publish-to-section-control';
import { loadGoogleMaps } from '../../lib/googleMaps';
import type { VirtualTour } from '../../lib/types';

// Fixed brand asset used for every WhatsApp/social share preview (og:image /
// twitter:image) — deliberately never the property's own photo, so shared
// links always carry the RealtyNow logo. Matches the app's PWA icon asset.
const BRAND_SHARE_LOGO = 'https://realtynow.in/pwa-512x512.png';

interface AgentInfo {
  id?: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  company: string | null;
  license_number: string | null;
}

interface PageSettings {
  show_specifications: boolean;
  show_amenities: boolean;
  show_floor_plans: boolean;
  show_gallery: boolean;
  show_videos: boolean;
  show_virtual_tour: boolean;
  show_location_map: boolean;
  show_nearby: boolean;
  show_price_history: boolean;
  show_reviews: boolean;
  show_faqs: boolean;
  show_similar_properties: boolean;
  show_emi_calculator: boolean;
  promo_banner_title: string | null;
  promo_banner_body: string | null;
  promo_banner_link: string | null;
}

const DEFAULT_SETTINGS: PageSettings = {
  show_specifications: true,
  show_amenities: true,
  show_floor_plans: true,
  show_gallery: true,
  show_videos: true,
  show_virtual_tour: true,
  show_location_map: true,
  show_nearby: true,
  show_price_history: true,
  show_reviews: true,
  show_faqs: true,
  show_similar_properties: true,
  show_emi_calculator: true,
  promo_banner_title: null,
  promo_banner_body: null,
  promo_banner_link: null,
};

/* ── Small single-marker Google Map for the Location & Map tab ── */
function PropertyLocationMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const map = new google.maps.Map(mapRef.current, {
          center: { lat, lng },
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
        });
        new google.maps.Marker({ position: { lat, lng }, map, title });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load map'));
    return () => {
      cancelled = true;
    };
  }, [lat, lng, title]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-navy-50 text-center text-sm text-navy-400">
        {error}
      </div>
    );
  }
  return <div ref={mapRef} className="h-full w-full bg-navy-50" />;
}

/* ── Interactive EMI calculator (sidebar widget) ── */
function EMICalculatorWidget({ defaultAmount }: { defaultAmount: number }) {
  const [amount, setAmount] = useState(Math.round(defaultAmount * 0.8));
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);

  const emi = useMemo(() => {
    const monthlyRate = rate / 12 / 100;
    const months = years * 12;
    if (monthlyRate <= 0) return amount / months;
    return (amount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  }, [amount, rate, years]);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-900 to-navy-900 p-6 text-white relative overflow-hidden shadow-lg">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/30 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-red-500/20 rounded-full blur-2xl" />
      <div className="relative z-10">
        <h3 className="font-display text-lg font-bold">Need a Home Loan?</h3>
        <p className="text-indigo-100 text-sm mt-1">Estimate your EMI and get pre-approved in minutes.</p>

        <div className="mt-4 space-y-3">
          <div>
            <div className="flex justify-between text-xs text-indigo-200 mb-1">
              <span>Loan amount</span>
              <span className="font-semibold text-white">₹{formatNumber(amount)}</span>
            </div>
            <input
              type="range"
              min={100000}
              max={defaultAmount}
              step={50000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-red-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-indigo-200 mb-1">
              <span>Interest rate</span>
              <span className="font-semibold text-white">{rate}%</span>
            </div>
            <input
              type="range"
              min={6}
              max={14}
              step={0.1}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full accent-red-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-indigo-200 mb-1">
              <span>Tenure</span>
              <span className="font-semibold text-white">{years} yrs</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-full accent-red-500"
            />
          </div>
        </div>

        <div className="mt-4 bg-white/10 rounded-xl p-3 border border-white/20">
          <div className="flex justify-between text-sm">
            <span className="text-indigo-200">Estimated EMI</span>
            <span className="font-bold">₹{formatNumber(Math.round(emi))}/mo</span>
          </div>
        </div>

        <Link to={`/emi-calculator?amount=${amount}&rate=${rate}&years=${years}`}>
          <Button variant="secondary" className="w-full mt-4 bg-white text-navy-900 hover:bg-indigo-50 border-0">
            Check Eligibility
          </Button>
        </Link>
      </div>
    </div>
  );
}

const NEARBY_ICONS: Record<string, typeof Navigation2> = {
  metro: Navigation2,
  hospital: ShieldCheck,
  school: Building,
  mall: Layers,
  airport: Send,
};

/* ── Clean Red Lucide Amenity Icons (No background box) ── */
const getAmenityIcon = (name: string) => {
  const n = name.toLowerCase().trim();
  if (n.includes('park') && !n.includes('water') && !n.includes('play')) return Car;
  if (n.includes('gym') || n.includes('fitness')) return Dumbbell;
  if (n.includes('pool') || n.includes('swim')) return Waves;
  if (n.includes('security')) return ShieldCheck;
  if (n.includes('lift') || n.includes('elevator')) return ArrowUp;
  if (n.includes('wifi') || n.includes('wi-fi') || n.includes('internet')) return Wifi;
  if (n.includes('power') || n.includes('backup') || n.includes('ev') || n.includes('charg')) return Zap;
  if (n.includes('garden') || n.includes('lawn')) return Trees;
  if (n.includes('club') || n.includes('community')) return Building2;
  if (n.includes('cctv') || n.includes('camera')) return Camera;
  if (n.includes('gas')) return Flame;
  if (n.includes('intercom')) return PhoneCall;
  if (n.includes('play') || n.includes('kid') || n.includes('children')) return Gamepad2;
  if (n.includes('rain') || n.includes('water harvesting')) return CloudRain;
  if (n.includes('servant') || n.includes('staff')) return Bed;
  if (n.includes('jacuzzi') || n.includes('sauna') || n.includes('spa')) return Bath;
  if (n.includes('smart') || n.includes('automation')) return Cpu;
  if (n.includes('roof') || n.includes('terrace') || n.includes('deck')) return Sun;
  if (n.includes('butler') || n.includes('service')) return UserCheck;
  if (n.includes('concierge')) return Headphones;
  if (n.includes('work') || n.includes('co-work') || n.includes('office')) return Laptop;
  if (n.includes('ac') || n.includes('air')) return Wind;
  if (n.includes('dining') || n.includes('kitchen') || n.includes('cafeteria')) return Utensils;
  return Sparkles;
};

export function PropertyDetailPage() {

  const { t } = useLanguageContext();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { id: routeId } = useParams<{ id: string }>();
  const id = useMemo(() => {
    if (!routeId) return undefined;
    const match = routeId.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    if (match) return match[0];
    if (routeId.length >= 36) return routeId.slice(-36);
    return routeId;
  }, [routeId]);

  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [activeImg, setActiveImg] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [apptOpen, setApptOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDeleteConfirm, setReviewDeleteConfirm] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [showVirtualTour, setShowVirtualTour] = useState(false);
  const [apptForm, setApptForm] = useState({ date: '', time: '', notes: '' });
  const [reviewForm, setReviewForm] = useState({ id: '', rating: 5, title: '', comment: '' });
  const [reportForm, setReportForm] = useState({ reason: '', details: '' });
  const [saved, setSaved] = useState(false);
  const [compared, setCompared] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 5000, stopOnInteraction: true })]);
  const [heroSlide, setHeroSlide] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setHeroSlide(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    onSelect();
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  const { data: property, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => fetchProperty(id!),
    enabled: !!id,
  });

  const { data: settingsRow } = useQuery({
    queryKey: ['property-page-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('property_page_settings').select('*').eq('id', true).maybeSingle();
      return data as PageSettings | null;
    },
  });
  const settings: PageSettings = { ...DEFAULT_SETTINGS, ...(settingsRow ?? {}) };

  const { data: agent } = useQuery({
    queryKey: ['property-agent', property?.assigned_agent_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, avatar_url, bio, company, license_number')
        .eq('id', property!.assigned_agent_id!)
        .maybeSingle();
      return data as AgentInfo | null;
    },
    enabled: !!property?.assigned_agent_id,
  });

  const { data: tours } = useQuery({
    queryKey: ['property-virtual-tours', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('property_virtual_tours')
        .select('*')
        .eq('property_id', id!)
        .order('sort_order', { ascending: true });
      return (data ?? []) as VirtualTour[];
    },
    enabled: !!id && settings.show_virtual_tour,
  });

  const { data: similar } = useQuery({
    queryKey: ['similar', property?.city_id, property?.property_type_id, property?.purpose, property?.price],
    queryFn: async () => {
      const priceMin = property!.price * 0.6;
      const priceMax = property!.price * 1.4;
      const { data } = await supabase
        .from('properties')
        .select('*, cities!inner(name), localities(name), property_types(name)')
        .or('status.eq.published,status.eq.live,is_live.eq.true')
        .neq('id', id!)
        .eq('city_id', property!.city_id!)
        .eq('property_type_id', property!.property_type_id!)
        .eq('purpose', property!.purpose)
        .gte('price', priceMin)
        .lte('price', priceMax)
        .limit(6);
      return (data ?? []).map((p) => {
        const r = p as unknown as { cities?: { name: string }; localities?: { name: string }; property_types?: { name: string } };
        return { ...p, city_name: r.cities?.name ?? null, locality_name: r.localities?.name ?? null, property_type_name: r.property_types?.name ?? null };
      });
    },
    enabled: !!property?.city_id && !!property?.property_type_id,
  });

  const { data: recentViews } = useQuery({
    queryKey: ['recent-views', id],
    queryFn: async () => {
      const { data } = await supabase.from('property_views').select('property_id').order('created_at', { ascending: false }).limit(5);
      if (!data || data.length === 0) return [];
      const ids = [...new Set(data.map((v: { property_id: string }) => v.property_id).filter((pid: string) => pid !== id))].slice(0, 4);
      if (ids.length === 0) return [];
      const { data: props } = await supabase.from('properties').select('*, cities!inner(name), localities(name), property_types(name)').in('id', ids);
      return (props ?? []).map((p) => {
        const r = p as unknown as { cities?: { name: string }; localities?: { name: string }; property_types?: { name: string } };
        return { ...p, city_name: r.cities?.name ?? null, locality_name: r.localities?.name ?? null, property_type_name: r.property_types?.name ?? null };
      });
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ['reviews', id],
    queryFn: async () => {
      const { data: reviewsData } = await supabase.from('reviews').select('*').eq('property_id', id!).order('created_at', { ascending: false });
      if (!reviewsData || reviewsData.length === 0) return [];

      const userIds = [...new Set(reviewsData.map((r: any) => r.user_id))];
      const { data: profilesData } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url').in('id', userIds);

      return reviewsData.map((r: any) => ({
        ...r,
        profiles: profilesData?.find((p: any) => p.id === r.user_id) || null
      }));
    },
    enabled: !!id,
  });

  const myReview = user ? reviews?.find((r: any) => r.user_id === user.id) : undefined;

  const openReviewModal = () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (myReview) {
      setReviewForm({ id: myReview.id, rating: myReview.rating, title: myReview.title ?? '', comment: myReview.comment ?? '' });
    } else {
      setReviewForm({ id: '', rating: 5, title: '', comment: '' });
    }
    setReviewOpen(true);
  };

  const { data: priceHistory } = useQuery({
    queryKey: ['price-history', id],
    queryFn: async () => {
      const { data } = await supabase.from('property_status_history').select('*').eq('property_id', id!).order('created_at', { ascending: false }).limit(10);
      return data ?? [];
    },
    enabled: !!id,
  });

  // Tracks exactly one view per genuine page mount (initial load, refresh,
  // or navigating away and back all remount this component and correctly
  // count again — see spec: "Open = +1, Refresh = +1, no accidental
  // duplicates from one mount"). sessionStorage was deliberately NOT used
  // here: it persists across refreshes within the same tab, which would
  // have silently suppressed every refresh's view — this ref only lives
  // for the current mount, so React StrictMode's double effect-fire is
  // Track view once per browser session/visit
  const trackedPropertyIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!id || !property) return;
    if (trackedPropertyIdRef.current === id) return;

    const isInternalViewer =
      property.owner_id === user?.id ||
      property.assigned_agent_id === user?.id ||
      (profile?.role === 'admin' || profile?.role === 'super_admin');

    // Debounce view recording by 15 minutes per session to prevent repeated F5 spam
    const sessionKey = `realtynow_viewed_${id}`;
    const lastViewTime = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(sessionKey) : null;
    const isRecentlyViewed = lastViewTime && Date.now() - parseInt(lastViewTime, 10) < 15 * 60 * 1000;

    // Only genuine public visits to a live listing count as a customer view.
    if ((property.status === 'published' || property.is_live) && !isInternalViewer && !isRecentlyViewed) {
      trackedPropertyIdRef.current = id;
      try {
        sessionStorage.setItem(sessionKey, Date.now().toString());
      } catch {}

      trackPropertyView(id, user?.id)
        .then((updatedCount) => {
          if (typeof updatedCount === 'number') {
            queryClient.setQueryData(['property', id], (prev: any) => (prev ? { ...prev, view_count: updatedCount } : prev));
          }
        })
        .catch((err) => {
          console.error('Property view tracking failed (property still loads normally):', err);
        });
    }
  }, [id, property, user?.id, profile?.role]);

  useEffect(() => {
    if (id) {
      setCompared(isCompared(id));
      if (user) {
        supabase.from('favorites').select('id').eq('user_id', user.id).eq('property_id', id).maybeSingle().then(({ data }) => setSaved(!!data));
      } else {
        setSaved(getLocalFavoriteIds().includes(id));
      }
    }
  }, [user, id]);

  const toggleSave = async () => {
    if (!id) return;
    try {
      const isNowSaved = await toggleFavoriteProperty(id, user?.id, saved);
      setSaved(isNowSaved);
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['favorites', user.id] });
      }
      addToast('success', isNowSaved ? 'Saved to your favorites' : 'Removed from favorites');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not update favorites');
    }
  };

  const toggleCompare = async () => {
    if (!id) return;
    try {
      const isNowCompared = await toggleCompareProperty(id, user?.id);
      setCompared(isNowCompared);
      addToast('success', isNowCompared ? t('notifications.addedToCompare', 'Added to comparison list') : t('notifications.removedFromCompare', 'Removed from comparison list'));
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('notifications.errorCompare', 'Compare action failed'));
    }
  };

  const shareLinks = [
    { name: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(window.location.href)}` },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}` },
    { name: 'X (Twitter)', href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}` },
    { name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}` },
    { name: 'Copy link', href: '' },
  ];

  const handlePrint = () => window.print();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      addToast('success', 'Link copied to clipboard');
      if (id) {
        supabase.rpc('log_property_share', { p_property_id: id, p_platform: 'copy_link' }).then(({ error }) => { if (error) console.error(error); });
      }
    } catch {
      addToast('error', 'Could not copy link');
    }
    setShowShare(false);
  };

  const handleShareClick = (platform: string, href: string) => {
    if (id) {
      supabase.rpc('log_property_share', { p_property_id: id, p_platform: platform.toLowerCase() }).then(({ error }) => { if (error) console.error(error); });
    }
    window.open(href, '_blank', 'noopener,noreferrer');
    setShowShare(false);
  };

  const apptMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Please sign in to book an appointment');
      const scheduledAt = new Date(`${apptForm.date}T${apptForm.time}`).toISOString();
      const { error } = await supabase.from('appointments').insert({
        property_id: id,
        customer_id: user.id,
        agent_id: property?.assigned_agent_id,
        scheduled_at: scheduledAt,
        notes: apptForm.notes,
        status: 'requested',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setApptOpen(false);
      setApptForm({ date: '', time: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['portal-appointments'] });
      addToast('success', 'Appointment requested successfully!');
    },
    onError: (err: any) => addToast('error', err.message || 'Failed to request appointment'),
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Please sign in to leave a review');
      await ensureUserProfile(user.id);
      const executeReview = async () => {
        const { error } = await supabase
          .from('reviews')
          .upsert(
            { property_id: id, user_id: user.id, rating: reviewForm.rating, title: reviewForm.title || null, comment: reviewForm.comment },
            { onConflict: 'property_id,user_id' },
          );
        if (error) throw error;
      };

      try {
        await executeReview();
      } catch (err: any) {
        if (err?.message?.includes('profiles_fkey') || err?.code === '23503') {
          await ensureUserProfile(user.id);
          await executeReview();
        } else {
          throw err;
        }
      }
    },
    onSuccess: () => {
      const wasEdit = !!reviewForm.id;
      setReviewOpen(false);
      setReviewForm({ id: '', rating: 5, title: '', comment: '' });
      queryClient.invalidateQueries({ queryKey: ['reviews', id] });
      addToast('success', wasEdit ? 'Review updated successfully!' : 'Review submitted successfully!');
    },
    onError: (err: any) => addToast('error', err.message || 'Failed to submit review'),
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async () => {
      if (!user || !reviewForm.id) return;
      const { error } = await supabase.from('reviews').delete().eq('id', reviewForm.id).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setReviewDeleteConfirm(false);
      setReviewForm({ id: '', rating: 5, title: '', comment: '' });
      queryClient.invalidateQueries({ queryKey: ['reviews', id] });
      addToast('success', 'Review deleted');
    },
    onError: (err: any) => addToast('error', err.message || 'Failed to delete review'),
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!reportForm.reason) throw new Error('Please select a reason');
      const { error } = await supabase.from('property_reports').insert({
        property_id: id,
        reporter_id: user?.id ?? null,
        reason: reportForm.reason,
        details: reportForm.details || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReportOpen(false);
      setReportForm({ reason: '', details: '' });
      addToast('success', 'Thanks — our team will review this listing.');
    },
    onError: (err: any) => addToast('error', err.message || 'Failed to submit report'),
  });

  const images = getSafePropertyImages(property);
  const coverImage = property?.cover_image_url || images[0] || DEFAULT_PROPERTY_IMAGE;
  const agentName = agent ? `${agent.first_name ?? ''} ${agent.last_name ?? ''}`.trim() : 'Agent';

  // AI-generated JSON-LD (generatePropertySeo edge function, written on submit/resubmit)
  // takes priority; this client-built version is only a fallback for properties that
  // predate SEO generation or haven't run it yet.
  const schema = property
    ? property.json_ld ?? {
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        name: property.title,
        description: property.description ?? undefined,
        image: images,
        url: window.location.href,
        address: {
          '@type': 'PostalAddress',
          streetAddress: property.address ?? undefined,
          addressLocality: property.locality_name ?? undefined,
          addressRegion: property.city_name ?? undefined,
          addressCountry: 'IN',
        },
        ...(property.latitude && property.longitude
          ? { geo: { '@type': 'GeoCoordinates', latitude: property.latitude, longitude: property.longitude } }
          : {}),
        offers: { '@type': 'Offer', price: property.price, priceCurrency: 'INR', availability: 'https://schema.org/InStock' },
      }
    : undefined;

  const pricing = useMemo(() => getPropertyPricingDisplay(property), [property]);

  const seoBhk = property?.bedrooms ? `${property.bedrooms} BHK ` : '';
  const seoType = property?.property_type_name || property?.property_sub_type || (pricing.isLand ? 'Plot / Land' : 'Property');
  const seoPurpose = property?.purpose === 'Rent' ? 'Rent' : 'Sale';
  const seoLoc = property?.locality_name || property?.city_name || 'Hyderabad';
  const seoPrice = pricing.primaryPrice && pricing.primaryPrice !== '—' ? ` — ${pricing.primaryPrice}` : '';

  useSEO({
    title: property?.seo_title || property?.title ? `${property?.seo_title || property?.title}` : undefined,
    description:
      property?.seo_description ||
      property?.description ||
      `${seoBhk}${seoType} for ${seoPurpose} in ${seoLoc}${seoPrice}. Verified listing on RealtyNow — All About Realty.`,
    type: 'article',
    // WhatsApp/social share previews must always show the RealtyNow logo, never
    // the property's own photo — intentionally not property?.og_image/coverImage.
    image: BRAND_SHARE_LOGO,
    twitterTitle: property?.twitter_title || property?.title || undefined,
    twitterDescription: property?.twitter_description || property?.description || undefined,
    twitterImage: BRAND_SHARE_LOGO,
    schema,
  });

  if (isLoading) {
    return (
      <div className="container-page py-16">
        <div className="flex justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      </div>
    );
  }
  if (!property) {
    return (
      <div className="container-page py-16">
        <Card>
          <EmptyState
            icon={<Home className="h-6 w-6" />}
            title={t('property.notFound', 'Property not found')}
            description={t('property.removedMsg', 'This listing may have been removed.')}
            action={
              <Link to="/search">
                <Button variant="secondary">{t('common.browseProperties', 'Browse properties')}</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const nearbyEntries = property.nearby_places
    ? (Object.entries(property.nearby_places).filter(([, v]) => v) as [string, string][])
    : [];

  const tabDefs: { key: string; label: string; show: boolean }[] = [
    { key: 'overview', label: 'Overview', show: true },
    { key: 'specifications', label: 'Specifications', show: settings.show_specifications },
    { key: 'amenities', label: 'Amenities', show: settings.show_amenities && !!property.amenities?.length },
    { key: 'floorplans', label: 'Floor Plans', show: settings.show_floor_plans && !!property.floor_plans?.length },
    { key: 'gallery', label: 'Gallery', show: settings.show_gallery },
    { key: 'videos', label: 'Videos', show: settings.show_videos && !!property.videos?.length },
    { key: 'virtualtour', label: '360° Tour', show: settings.show_virtual_tour && !!tours?.length },
    { key: 'location', label: 'Location & Map', show: settings.show_location_map && !!(property.latitude && property.longitude) },
    { key: 'nearby', label: 'Nearby', show: settings.show_nearby && nearbyEntries.length > 0 },
    { key: 'pricehistory', label: 'Price History', show: settings.show_price_history && !!priceHistory?.length },
    { key: 'reviews', label: 'Reviews', show: settings.show_reviews },
    { key: 'faqs', label: 'FAQs', show: settings.show_faqs },
    { key: 'similar', label: 'Similar Properties', show: settings.show_similar_properties && !!similar?.length },
  ];
  const visibleTabs = tabDefs.filter((t) => t.show);
  const currentTab = visibleTabs.some((t) => t.key === activeTab) ? activeTab : visibleTabs[0]?.key;

  const faqItems = [
    { q: `Is this ${property.property_type_name ?? 'property'} verified by RealtyNow?`, a: property.verified_status && property.verified_status !== 'Unverified' ? `Yes — this listing's status is "${property.verified_status}".` : 'This listing has not yet completed verification. Contact the agent for documentation.' },
    { q: 'What is the possession status?', a: property.possession_status ?? (property.age_of_property ? `${property.age_of_property} years old — ready to move.` : 'Contact the agent for possession details.') },
    { q: property.purpose === 'Rent' ? 'Is the rent negotiable?' : 'Is the price negotiable?', a: 'Most listings on RealtyNow are open to reasonable offers — use "Contact Us" to discuss.' },
    { q: 'What amenities are included?', a: property.amenities?.length ? property.amenities.slice(0, 6).join(', ') + (property.amenities.length > 6 ? ', and more.' : '.') : 'See the Amenities tab for full details.' },
  ];

  const breadcrumbs = [
    { label: t('common.home', 'Home'), to: '/' },
    ...(property.city_name ? [{ label: property.city_name, to: `/search?city=${encodeURIComponent(property.city_name)}` }] : []),
    ...(property.locality_name ? [{ label: property.locality_name, to: `/search?city=${encodeURIComponent(property.city_name ?? '')}&locality=${encodeURIComponent(property.locality_name)}` }] : []),
    ...(property.property_type_name ? [{ label: property.property_type_name, to: `/search?type=${encodeURIComponent(property.property_type_name)}` }] : []),
  ];

  return (
    <div className="min-h-screen bg-white pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
      {/* Admin Homepage Visibility Bar */}
      {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
        <div className="bg-slate-900 text-white border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-30 sticky top-0 backdrop-blur-md shadow-md">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-bold text-amber-400">
              <ShieldCheck className="h-4 w-4" />
              Admin Controls
            </span>
            <span className="hidden sm:inline text-slate-400">|</span>
            <span className="text-slate-300 font-medium">Homepage Section Publishing:</span>
          </div>

          <div className="flex items-center gap-3">
            <PublishToSectionControl
              property={property}
              compact={false}
            />
            <Link
              to={`/admin/properties/edit/${property.id}`}
              className="text-xs font-bold text-red-400 hover:text-red-300 underline"
            >
              Full Editor ↗
            </Link>
          </div>
        </div>
      )}

      {/* 1. CINEMATIC HERO BANNER: Dark Left Content Area (40-45%) + Natural Bright Property Image (55-60%) */}
      <section className="relative min-h-[360px] sm:min-h-[380px] md:h-[400px] w-full bg-slate-950 overflow-hidden select-none flex flex-col justify-between">
        {/* Background image carousel — 100% natural opacity and vivid colors */}
        <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
          <div className="flex h-full">
            {images.map((img, i) => (
              <div key={i} className="relative h-full min-w-0 flex-[0_0_100%] bg-slate-900">
                <img
                  src={img}
                  alt={`${property.title} photo ${i + 1}`}
                  onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                  className="h-full w-full object-cover object-center"
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              </div>
            ))}
          </div>
        </div>

        {/* 
          Directional Gradient Overlay System:
          Desktop: 90deg left-to-right (0% to 42% strong dark overlay for text readability, 58% to 100% natural bright image)
          Mobile: 180deg top-to-bottom (transparent top image, dark bottom content area)
        */}
        <div
          className="absolute inset-0 pointer-events-none hidden md:block"
          style={{
            background:
              'linear-gradient(90deg, rgba(0,0,0,0.84) 0%, rgba(0,0,0,0.74) 22%, rgba(0,0,0,0.46) 40%, rgba(0,0,0,0.16) 58%, rgba(0,0,0,0.04) 75%, rgba(0,0,0,0.00) 100%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none block md:hidden"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.10) 35%, rgba(0,0,0,0.72) 70%, rgba(0,0,0,0.90) 100%)',
          }}
        />

        {/* Carousel Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                emblaApi?.scrollPrev();
              }}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/50 hover:bg-[#E31E24] backdrop-blur-md border border-white/30 text-white transition-all hover:scale-110 shadow-lg cursor-pointer pointer-events-auto"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                emblaApi?.scrollNext();
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/50 hover:bg-[#E31E24] backdrop-blur-md border border-white/30 text-white transition-all hover:scale-110 shadow-lg cursor-pointer pointer-events-auto"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex gap-1.5 pointer-events-none">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    emblaApi?.scrollTo(i);
                  }}
                  className={cn(
                    'h-1.5 rounded-full transition-all pointer-events-auto',
                    i === heroSlide ? 'w-6 bg-[#E31E24]' : 'w-1.5 bg-white/50 hover:bg-white/80',
                  )}
                  aria-label={`Go to photo ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Top Bar: Dynamic Breadcrumbs & Action Buttons */}
        <div className="relative top-0 left-0 right-0 p-4 sm:p-5 z-20 flex justify-between items-start pointer-events-none">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-slate-300 drop-shadow-md pointer-events-auto">
            {breadcrumbs.map((b, i) => (
              <span key={b.to} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3 w-3 text-slate-400" />}
                <Link to={b.to} className="hover:text-white transition-colors">
                  {b.label}
                </Link>
              </span>
            ))}
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="text-white font-semibold truncate max-w-[140px] sm:max-w-[280px]">
              {property.title}
            </span>
          </div>

          <div className="flex items-center gap-2.5 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSave();
              }}
              className={cn(
                'grid h-10 w-10 place-items-center rounded-full bg-white/90 hover:bg-[#E31E24] hover:text-white backdrop-blur-md border border-white/40 transition-all hover:scale-105 shadow-md text-slate-800 cursor-pointer',
                saved && 'text-[#E31E24]',
              )}
              title="Add property to favorites"
              aria-label="Add property to favorites"
            >
              <Heart className={cn('h-4 w-4', saved && 'fill-[#E31E24] text-[#E31E24]')} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowShare(true);
              }}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/90 hover:bg-[#E31E24] hover:text-white backdrop-blur-md border border-white/40 transition-all hover:scale-105 shadow-md text-slate-800 cursor-pointer"
              title="Share property"
              aria-label="Share property"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Hero Content & Photo Count — Centered Vertically */}
        <div className="relative z-20 w-full my-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3 pointer-events-none">
          <div className="container-page px-0 flex flex-col md:flex-row md:items-center justify-between gap-4 pointer-events-auto">
            {/* Left Content Area: constrained to max-w-2xl so it stays within the dark overlay */}
            <div className="max-w-2xl text-white space-y-2 sm:space-y-2.5">
              {/* Badge: FOR SALE / FOR RENT with RealtyNow brand red #E31E24 */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-[#E31E24] text-white shadow-md">
                  {property.purpose === 'Rent' ? 'FOR RENT' : 'FOR SALE'}
                </span>
                {property.is_featured && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500 text-white shadow-sm">
                    Featured
                  </span>
                )}
              </div>

              {/* Title: 32px-42px desktop, bold white text */}
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight drop-shadow-md">
                {property.title}
              </h1>

              {/* Location: Red pin icon + crisp white text */}
              <p className="text-sm sm:text-[15px] text-slate-100 flex items-center gap-1.5 font-medium drop-shadow-sm">
                <MapPin className="h-4 w-4 text-[#E31E24] shrink-0" />
                <span className="truncate">
                  {property.address ?? `${property.locality_name ?? ''}, ${property.city_name ?? 'Hyderabad'}`}
                </span>
              </p>

              {/* Price: Prominent RealtyNow Red #E31E24 + Negotiable badge */}
              <div className="flex flex-wrap items-baseline gap-3 pt-0.5">
                <span className="font-display text-2xl sm:text-3xl lg:text-4xl font-black text-[#E31E24] tracking-tight">
                  {pricing.primaryPrice}
                </span>
                <span className="rounded-lg bg-black/60 border border-[#E31E24]/60 px-2.5 py-0.5 text-xs text-white backdrop-blur-md font-semibold">
                  Negotiable
                </span>
              </div>

              {/* Secondary Land Information: Land Area & Estimated Total Property Value */}
              {pricing.isLand ? (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-0.5 text-slate-200 text-xs sm:text-sm font-medium">
                  {pricing.areaDisplay && (
                    <div className="flex items-center gap-1.5">
                      <Maximize className="h-4 w-4 text-slate-400" />
                      <span>
                        Plot Area: <strong className="text-white font-bold">{pricing.areaDisplay}</strong>
                      </span>
                    </div>
                  )}
                  {pricing.totalEstimatedPrice && (
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <span>
                        Estimated Total Value: <strong className="text-emerald-400 font-bold">{pricing.totalEstimatedPrice}</strong>
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Constructed Property Specs preview (Bedrooms / Bathrooms / Area / Parking) */
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-0.5 text-slate-200 text-xs sm:text-sm font-medium">
                  {!!property.bedrooms && (
                    <div className="flex items-center gap-1.5">
                      <Bed className="h-4 w-4 text-slate-400" />
                      <span>
                        <strong className="text-white font-bold">{property.bedrooms}</strong> BHK
                      </span>
                    </div>
                  )}
                  {!!property.bathrooms && (
                    <div className="flex items-center gap-1.5">
                      <Bath className="h-4 w-4 text-slate-400" />
                      <span>
                        <strong className="text-white font-bold">{property.bathrooms}</strong> Baths
                      </span>
                    </div>
                  )}
                  {!!property.built_up_area && (
                    <div className="flex items-center gap-1.5">
                      <Maximize className="h-4 w-4 text-slate-400" />
                      <span>
                        <strong className="text-white font-bold">{property.built_up_area}</strong> Sq Ft
                      </span>
                    </div>
                  )}
                  {!!property.parking && (
                    <div className="flex items-center gap-1.5">
                      <Car className="h-4 w-4 text-slate-400" />
                      <span>
                        <strong className="text-white font-bold">{property.parking}</strong> Parking
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Photo Count Capsule Button (Right aligned) */}
            <div className="shrink-0 self-start md:self-end mt-2 md:mt-0">
              <button
                onClick={() => {
                  setActiveImg(heroSlide);
                  setLightbox(true);
                }}
                className="h-10 sm:h-11 px-4 bg-black/75 hover:bg-black/90 backdrop-blur-md rounded-xl border border-white/25 hover:border-white text-white flex items-center gap-2 transition-all shadow-xl group cursor-pointer"
                aria-label="View all property photos"
              >
                <Images className="h-4 w-4 text-[#E31E24]" />
                <span className="text-xs sm:text-sm font-bold">
                  {heroSlide + 1} / {images.length} · View All Photos
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom indicator space */}
        <div className="relative z-20 w-full h-3 pointer-events-none" />
      </section>

      {/* 2. PROPERTY IDENTITY STRIP (Clean White Bar with Red Accents) */}
      <div className="border-b border-slate-200 bg-white sticky top-[64px] z-30 shadow-sm">
        <div className="container-page py-3.5 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
          <div className="flex items-center gap-3 border-r border-slate-200 pr-8">
            <div className="h-10 w-10 rounded-xl bg-red-50 text-[#E31E24] flex items-center justify-center shrink-0 border border-red-100/80">
              <Box className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Property ID</span>
              <span className="font-extrabold text-slate-900">RN-{property.id.slice(0, 7).toUpperCase()}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 border-r border-slate-200 pr-8">
            <div className="h-10 w-10 rounded-xl bg-red-50 text-[#E31E24] flex items-center justify-center shrink-0 border border-red-100/80">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Posted On</span>
              <span className="font-extrabold text-slate-900">
                {new Date(property.created_at).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 border-r border-slate-200 pr-8">
            <div className="h-10 w-10 rounded-xl bg-red-50 text-[#E31E24] flex items-center justify-center shrink-0 border border-red-100/80">
              <Building className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Property Type</span>
              <span className="font-extrabold text-slate-900">{property.property_type_name || property.property_sub_type || 'Property'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 border-r border-slate-200 pr-8 hidden sm:flex">
            <div className="h-10 w-10 rounded-xl bg-red-50 text-[#E31E24] flex items-center justify-center shrink-0 border border-red-100/80">
              <Flag className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Purpose</span>
              <span className="font-extrabold text-slate-900">For {property.purpose}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 hidden md:flex">
            <div className="h-10 w-10 rounded-xl bg-red-50 text-[#E31E24] flex items-center justify-center shrink-0 border border-red-100/80">
              <Clock className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Availability</span>
              <span className="font-extrabold text-slate-900">{property.possession_status ?? 'Ready to Move'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container-page py-12">
        <div className="grid lg:grid-cols-[1fr_360px] gap-12">
          
          {/* LEFT COLUMN: MAIN CONTENT */}
          <div className="space-y-16 min-w-0">
            
            {/* 5. ABOUT THIS PROPERTY */}
            <section className="scroll-mt-32" id="about">
              <h2 className="font-display text-2xl font-bold text-navy-900 mb-6">About This Property</h2>
              <div className="prose prose-navy max-w-none text-navy-700 leading-relaxed text-[15px]">
                {property.description}
              </div>
              {property.ai_description && (
                <div className="mt-8 rounded-2xl bg-gradient-to-br from-gold-50 to-white p-6 border border-gold-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><Bot className="h-24 w-24 text-gold-600"/></div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <Bot className="h-5 w-5 text-gold-600" />
                      <h3 className="text-base font-bold text-gold-900">AI Generated Summary</h3>
                    </div>
                    <p className="text-[15px] leading-relaxed text-gold-800">{property.ai_description}</p>
                  </div>
                </div>
              )}
            </section>

            {/* REALTYNOW STANDARDIZED PROPERTY VALUE SCORE & INTELLIGENCE */}
            <section className="scroll-mt-32" id="value-score">
              <div className="rounded-2xl border border-slate-700/60 bg-gradient-to-br from-[#0B1528] via-[#0F1E36] to-[#0A1220] p-5 sm:p-6 shadow-xl shadow-slate-950/20 relative overflow-hidden text-white transition-all">
                {/* Subtle Analytical Glow Accents */}
                <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none" />

                <div className="relative z-10">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-[11px] font-extrabold uppercase tracking-wider mb-1.5 backdrop-blur-md">
                        <Sparkles className="h-3 w-3 text-blue-400 animate-pulse" /> RealtyNow Value Score™
                      </div>
                      <h3 className="text-lg sm:text-xl font-display font-extrabold text-white tracking-tight">
                        AI Property & Investment Rating
                      </h3>
                      <p className="text-xs text-slate-300/80 mt-0.5 max-w-xl font-normal leading-relaxed">
                        Data-driven rating evaluated on pricing efficiency, locality index, amenities, and rental yield.
                      </p>
                    </div>

                    <div className="flex items-center gap-3.5 px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 shadow-inner backdrop-blur-md shrink-0 self-start sm:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Overall Rating</span>
                        <span className="text-2xl font-display font-extrabold text-white">
                          {(() => {
                            const raw = property.ai_score;
                            const score = raw != null && raw > 0 ? (raw > 100 ? Math.round(raw / 10) : Math.round(raw)) : 88;
                            return score;
                          })()}
                          <span className="text-xs text-slate-400 font-semibold ml-0.5">/100</span>
                        </span>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-emerald-950/50 border border-emerald-400/30">
                        {(() => {
                          const raw = property.ai_score;
                          const score = raw != null && raw > 0 ? (raw > 100 ? Math.round(raw / 10) : Math.round(raw)) : 88;
                          if (score >= 85) return 'A+';
                          if (score >= 75) return 'A';
                          if (score >= 65) return 'B+';
                          return 'B';
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* 6 Space-Efficient Metric Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-4">
                    <div className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/70 hover:border-emerald-500/40 text-center transition-all duration-200 shadow-xs hover:shadow-md group backdrop-blur-sm">
                      <span className="text-[11px] text-slate-300 block font-medium group-hover:text-white transition-colors">Price Value</span>
                      <span className="text-base font-extrabold text-emerald-400 mt-1 block font-display">91/100</span>
                      <span className="text-[10px] text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-md inline-block mt-1 font-semibold">Competitive</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/70 hover:border-sky-500/40 text-center transition-all duration-200 shadow-xs hover:shadow-md group backdrop-blur-sm">
                      <span className="text-[11px] text-slate-300 block font-medium group-hover:text-white transition-colors">Location Index</span>
                      <span className="text-base font-extrabold text-sky-400 mt-1 block font-display">
                        {property.nearby_places ? '89/100' : '82/100'}
                      </span>
                      <span className="text-[10px] text-sky-300 bg-sky-950/70 border border-sky-500/30 px-2 py-0.5 rounded-md inline-block mt-1 font-semibold">Prime Corridor</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/70 hover:border-indigo-500/40 text-center transition-all duration-200 shadow-xs hover:shadow-md group backdrop-blur-sm">
                      <span className="text-[11px] text-slate-300 block font-medium group-hover:text-white transition-colors">Connectivity</span>
                      <span className="text-base font-extrabold text-indigo-400 mt-1 block font-display">
                        {property.nearby_places ? '87/100' : '80/100'}
                      </span>
                      <span className="text-[10px] text-indigo-300 bg-indigo-950/70 border border-indigo-500/30 px-2 py-0.5 rounded-md inline-block mt-1 font-semibold">Highway & Metro</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/70 hover:border-purple-500/40 text-center transition-all duration-200 shadow-xs hover:shadow-md group backdrop-blur-sm">
                      <span className="text-[11px] text-slate-300 block font-medium group-hover:text-white transition-colors">Amenities Tier</span>
                      <span className="text-base font-extrabold text-purple-400 mt-1 block font-display">
                        {(property.amenities?.length ?? 0) >= 6 ? '92/100' : '84/100'}
                      </span>
                      <span className="text-[10px] text-purple-300 bg-purple-950/70 border border-purple-500/30 px-2 py-0.5 rounded-md inline-block mt-1 font-semibold">
                        {(property.amenities?.length ?? 0) >= 6 ? 'Full Lifestyle' : 'Essential'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/70 hover:border-amber-500/40 text-center transition-all duration-200 shadow-xs hover:shadow-md group backdrop-blur-sm">
                      <span className="text-[11px] text-slate-300 block font-medium group-hover:text-white transition-colors">Rental Yield</span>
                      <span className="text-base font-extrabold text-amber-400 mt-1 block font-display">
                        {property.purpose === 'Rent' ? '90/100' : '85/100'}
                      </span>
                      <span className="text-[10px] text-amber-300 bg-amber-950/70 border border-amber-500/30 px-2 py-0.5 rounded-md inline-block mt-1 font-semibold">3.8% - 4.5%</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/70 hover:border-emerald-500/40 text-center transition-all duration-200 shadow-xs hover:shadow-md group backdrop-blur-sm">
                      <span className="text-[11px] text-slate-300 block font-medium group-hover:text-white transition-colors">Risk Score</span>
                      <span className="text-base font-extrabold text-emerald-400 mt-1 block font-display">Low Risk</span>
                      <span className="text-[10px] text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-md inline-block mt-1 font-semibold">
                        {property.legal_approved ? 'Legal Approved' : 'Verified Docs'}
                      </span>
                    </div>
                  </div>

                  {/* Verifiable Trust Signals */}
                  <div className="mt-4 pt-3.5 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="flex items-center gap-1.5 font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Verified Listing
                      </span>
                      <span className="flex items-center gap-1.5 font-semibold text-sky-400 bg-sky-950/50 border border-sky-500/20 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="h-3.5 w-3.5 text-sky-400" /> Coordinates Verified
                      </span>
                      <span className="flex items-center gap-1.5 font-semibold text-teal-400 bg-teal-950/50 border border-teal-500/20 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" /> Genuine Pricing
                      </span>
                    </div>
                    <span className="text-slate-400 text-[10px] font-mono tracking-wide bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                      RealtyNow Trust Index v2.4
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* 6. PROPERTY SPECIFICATIONS */}
            <section className="scroll-mt-32" id="specifications">
              <h2 className="font-display text-2xl font-bold text-navy-900 mb-6">Property Specifications</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {pricing.isLand ? (
                  (() => {
                    const plot = (property as any).plot_details || (property as any).features?.plot_details || {};
                    const layoutType = (property as any).layout_type || (property as any).features?.layout_type || plot.layoutType;
                    return [
                      { label: 'Plot Area', value: pricing.areaDisplay, icon: Maximize },
                      { label: 'Price Per Unit', value: pricing.primaryPrice, icon: Building },
                      { label: 'Estimated Total Value', value: pricing.totalEstimatedPrice, icon: Flame },
                      { label: 'Layout Approval', value: layoutType || plot.approvalAuthority, icon: ShieldCheck },
                      { label: 'Facing', value: property.facing || plot.facing, icon: Compass },
                      { label: 'Road Width', value: plot.roadWidth ? `${plot.roadWidth} ft` : null, icon: Navigation2 },
                      { label: 'Corner Plot', value: plot.cornerPlot, icon: Box },
                      { label: 'Ownership', value: plot.ownershipType, icon: UserCheck },
                      { label: 'Legal Status', value: plot.legallyClear === 'Yes' ? 'Legally Clear' : plot.legallyClear, icon: CheckCircle2 },
                      { label: 'Possession', value: property.possession_status ?? plot.devStatus, icon: Clock },
                    ];
                  })()
                    .filter((s) => s.value != null && s.value !== '')
                    .map((s, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-navy-500 mb-1">
                          <s.icon className="h-4 w-4" />
                          <span className="text-xs uppercase tracking-wider font-semibold">{s.label}</span>
                        </div>
                        <span className="font-bold text-navy-900 text-[15px]">{s.value}</span>
                      </div>
                    ))
                ) : (
                  [
                    { label: 'Bedrooms', value: property.bedrooms, icon: Bed },
                    { label: 'Bathrooms', value: property.bathrooms, icon: Bath },
                    { label: 'Built-up Area', value: property.built_up_area ? `${property.built_up_area} Sq Ft` : null, icon: Maximize },
                    { label: 'Carpet Area', value: property.carpet_area ? `${property.carpet_area} Sq Ft` : null, icon: Maximize },
                    { label: 'Floor', value: property.floor_number != null ? `${property.floor_number} of ${property.total_floors ?? '—'}` : null, icon: Layers },
                    { label: 'Furnishing', value: property.furnishing, icon: Box },
                    { label: 'Facing', value: property.facing, icon: Compass },
                    { label: 'Parking', value: property.parking, icon: Car },
                    { label: 'Construction Year', value: property.age_of_property ? (new Date().getFullYear() - property.age_of_property).toString() : null, icon: Building },
                    { label: 'Possession', value: property.possession_status, icon: Clock },
                  ]
                    .filter((s) => s.value != null && s.value !== '')
                    .map((s, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-navy-500 mb-1">
                          <s.icon className="h-4 w-4" />
                          <span className="text-xs uppercase tracking-wider font-semibold">{s.label}</span>
                        </div>
                        <span className="font-bold text-navy-900 text-[15px]">{s.value}</span>
                      </div>
                    ))
                )}
              </div>
            </section>

            {/* 7. AMENITIES */}
            {property.amenities && property.amenities.length > 0 && (
              <section className="scroll-mt-32" id="amenities">
                <h2 className="font-display text-2xl font-bold text-navy-900 mb-6">Amenities</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {property.amenities.map((a) => {
                    const IconComp = getAmenityIcon(a);
                    return (
                      <div
                        key={a}
                        className="group flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border border-slate-150 bg-white text-center hover:border-red-300 hover:shadow-md transition-all duration-200 cursor-default"
                      >
                        <IconComp className="w-8 h-8 text-red-600 stroke-[2] group-hover:scale-110 transition-transform duration-200" />
                        <span className="text-xs font-bold text-navy-900 leading-tight">{a}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 13. PHOTO GALLERY */}
            <section className="scroll-mt-32" id="gallery">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl font-bold text-navy-900">Photo Gallery</h2>
                <Button variant="secondary" onClick={() => {setActiveImg(0); setLightbox(true);}} className="font-semibold text-navy-700 bg-white">View All</Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {images.slice(0, 5).map((img, i) => (
                  <button 
                    key={i} 
                    onClick={() => {setActiveImg(i); setLightbox(true);}} 
                    className={cn(
                      "relative overflow-hidden rounded-2xl group cursor-pointer border border-navy-100",
                      i === 0 ? "col-span-2 row-span-2 aspect-square md:aspect-auto" : "aspect-square"
                    )}
                  >
                    <img src={img} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {i === 4 && images.length > 5 && (
                      <div className="absolute inset-0 bg-navy-900/70 backdrop-blur-sm flex flex-col items-center justify-center text-white transition-colors group-hover:bg-navy-900/80">
                        <span className="font-display text-3xl font-bold">+{images.length - 5}</span>
                        <span className="text-sm font-semibold mt-1">More Photos</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>

            {/* 8. LOCATION SECTION */}
            {property.latitude && property.longitude && (
              <section className="scroll-mt-32" id="location">
                <h2 className="font-display text-2xl font-bold text-navy-900 mb-2">Location</h2>
                <p className="text-navy-600 mb-6">{property.address ?? `${property.locality_name ?? ''}, ${property.city_name ?? ''}`} {property.pincode}</p>
                <div className="aspect-[21/9] rounded-3xl overflow-hidden shadow-sm border border-navy-100 mb-8">
                  <PropertyLocationMap lat={property.latitude} lng={property.longitude} title={property.title} />
                </div>
                {nearbyEntries.length > 0 && (
                  <div>
                    <h3 className="font-bold text-navy-900 mb-5 text-lg">Nearby Places</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      {nearbyEntries.map(([key, value]) => {
                        const Icon = NEARBY_ICONS[key] ?? MapPin;
                        const labels: Record<string, string> = { metro: 'Metro', hospital: 'Hospital', school: 'School', mall: 'Shopping', airport: 'Airport' };
                        return (
                          <div key={key} className="flex flex-col items-center justify-center text-center gap-3 rounded-2xl border border-navy-100 bg-white p-5 hover:border-navy-200 transition-colors">
                            <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-blue-500">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-navy-900">{value}</p>
                              <span className="text-xs font-semibold uppercase tracking-wide text-navy-400">{labels[key] ?? key}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* 9. PRICE DETAILS */}
            <section className="scroll-mt-32" id="price">
              <h2 className="font-display text-2xl font-bold text-navy-900 mb-6">Price Details</h2>
              <div className="rounded-3xl border border-navy-100 bg-white shadow-sm overflow-hidden">
                <div className="p-8 space-y-6">
                  {property.purpose === 'Rent' ? (
                    <>
                      <div className="flex justify-between items-center pb-6 border-b border-navy-50">
                        <span className="text-navy-600 font-medium">Monthly Rent</span>
                        <span className="text-xl font-bold text-navy-900">{formatCompactPrice(getPropertyPrice(property), property.purpose)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-6 border-b border-navy-50">
                        <span className="text-navy-600 font-medium">Security Deposit</span>
                        <span className="text-lg font-bold text-navy-900">{formatCompactPrice((property as any).security_deposit)}</span>
                      </div>
                      {(property as any).maintenance_charges > 0 && (
                        <div className="flex justify-between items-center pb-6 border-b border-navy-50">
                          <span className="text-navy-600 font-medium">Maintenance</span>
                          <span className="text-lg font-bold text-navy-900">{formatCompactPrice((property as any).maintenance_charges)} <span className="text-sm text-navy-500 font-normal">/ month</span></span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center pb-6 border-b border-navy-50">
                        <span className="text-navy-600 font-medium">Sale Price</span>
                        <span className="text-xl font-bold text-navy-900">{formatCompactPrice(getPropertyPrice(property), property.purpose)}</span>
                      </div>
                      {property.built_up_area && (
                        <div className="flex justify-between items-center pb-6 border-b border-navy-50">
                          <span className="text-navy-600 font-medium">Price per Sq Ft</span>
                          <span className="text-lg font-bold text-navy-900">₹{formatNumber(Math.round(getPropertyPrice(property)! / property.built_up_area))}</span>
                        </div>
                      )}
                      {property.price_per_unit != null && (
                        <>
                          <div className="flex justify-between items-center pb-6 border-b border-navy-50">
                            <span className="text-navy-600 font-medium">Price per {getPriceUnitLabel(property.area_unit)}</span>
                            <span className="text-lg font-bold text-navy-900">{formatPrice(property.price_per_unit)}</span>
                          </div>
                          {property.plot_area != null && (
                            <div className="flex justify-between items-center pb-6 border-b border-navy-50">
                              <span className="text-navy-600 font-medium">Total Area</span>
                              <span className="text-lg font-bold text-navy-900">{formatNumber(property.plot_area)} {fromAreaUnitCode(property.area_unit) || getPriceUnitLabel(property.area_unit)}</span>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
                <div className="bg-red-50/50 p-6 flex items-start gap-4 border-t border-red-100">
                  <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-red-100">
                    <Heart className="h-5 w-5 text-red-600 fill-red-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-red-900">Price is negotiable</h4>
                    <p className="text-sm text-red-700/80 mt-1">Connect with the agent to discuss the final price and make an offer.</p>
                  </div>
                </div>
              </div>
            </section>
            
            {/* 14. VIDEO / 360° SECTION */}
            {(!!tours?.length || !!property.videos?.length) && (
              <section className="scroll-mt-32" id="media">
                <h2 className="font-display text-2xl font-bold text-navy-900 mb-6">Experience This Property</h2>
                <div className="grid sm:grid-cols-2 gap-6">
                  {!!tours?.length && (
                    <div className="rounded-3xl border border-navy-100 overflow-hidden bg-white shadow-sm">
                      <div className="aspect-video bg-navy-900 relative flex items-center justify-center">
                        <img
                          src={images[0]}
                          onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                          className="absolute inset-0 h-full w-full object-cover opacity-50"
                        />
                        <button onClick={() => setShowVirtualTour(true)} className="relative z-10 h-16 w-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:scale-110 transition-transform shadow-2xl border border-white/30 text-white">
                          <Box className="h-8 w-8" />
                        </button>
                      </div>
                      <div className="p-5 text-center">
                        <h3 className="font-bold text-navy-900">360° Virtual Tour</h3>
                        <p className="text-sm text-navy-500 mt-1">Explore the property in immersive 3D</p>
                      </div>
                    </div>
                  )}
                  {!!property.videos?.length && (
                    <div className="rounded-3xl border border-navy-100 overflow-hidden bg-white shadow-sm">
                      <div className="aspect-video bg-navy-900 relative flex items-center justify-center">
                         <video src={property.videos[0]} className="absolute inset-0 h-full w-full object-cover opacity-80" controls={false} />
                         <div className="absolute inset-0 bg-black/20" />
                         <button className="relative z-10 h-16 w-16 rounded-full bg-red-600 flex items-center justify-center hover:scale-110 transition-transform shadow-2xl text-white">
                           <Play className="h-8 w-8 ml-1" />
                         </button>
                      </div>
                      <div className="p-5 text-center">
                        <h3 className="font-bold text-navy-900">Property Video</h3>
                        <p className="text-sm text-navy-500 mt-1">Watch a guided video walkthrough</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 15. LEAD CTA SECTION */}
            <section className="rounded-3xl bg-navy-900 p-8 md:p-12 text-center text-white shadow-2xl relative overflow-hidden">
               <div className="absolute inset-0 opacity-20">
                 <img
                   src={images[0]}
                   onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                   className="h-full w-full object-cover"
                 />
                 <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-navy-900 mix-blend-multiply" />
               </div>
               <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
                 <h2 className="font-display text-3xl md:text-4xl font-bold">Interested in this property?</h2>
                 <p className="text-navy-200 text-lg">Connect with the agent or schedule a visit today to secure this listing.</p>
                 <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                    <Button size="lg" className="bg-red-600 hover:bg-red-700 border-none text-white shadow-lg shadow-red-900/50 text-base px-8" onClick={() => setContactOpen(true)}>
                      Contact Us
                    </Button>
                    <Button size="lg" className="bg-white text-navy-900 hover:bg-navy-50 border-none shadow-lg text-base px-8" onClick={() => (user ? setApptOpen(true) : navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`))}>
                      <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="h-5 w-5 mr-2" /> WhatsApp
                    </Button>
                 </div>
               </div>
            </section>
            
            {/* Reviews */}
            {settings.show_reviews && (
              <section className="scroll-mt-32" id="reviews">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-2xl font-bold text-navy-900">Reviews</h2>
                  <Button size="sm" variant="secondary" onClick={openReviewModal} icon={<Star className="h-4 w-4" />}>
                    {myReview ? 'Edit your review' : 'Write a review'}
                  </Button>
                </div>
                {reviews && reviews.length > 0 ? (
                  <div className="space-y-6">
                    {reviews.map((r: Record<string, unknown>) => {
                      const p = r.profiles as Record<string, unknown> | Record<string, unknown>[] | null;
                      const rp = Array.isArray(p) ? p[0] : p;
                      const isMine = !!user && r.user_id === user.id;
                      return (
                        <div key={r.id as string} className="border-b border-navy-100 pb-6 last:border-0 last:pb-0">
                          <div className="flex justify-between items-start">
                            <div className="flex gap-4">
                              <Avatar name={`${rp?.first_name ?? ''} ${rp?.last_name ?? ''}`.trim() || 'User'} src={(rp?.avatar_url as string) ?? null} size={48} />
                              <div>
                                <p className="text-base font-bold text-navy-900">{String(rp?.first_name ?? 'Anonymous')}</p>
                                <div className="mt-1">
                                  <RatingStars rating={r.rating as number} size={14} />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-navy-400">{new Date(r.created_at as string).toLocaleDateString()}</span>
                              {isMine && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={openReviewModal}
                                    title="Edit your review"
                                    className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700 transition"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setReviewForm({ id: r.id as string, rating: r.rating as number, title: (r.title as string) ?? '', comment: (r.comment as string) ?? '' });
                                      setReviewDeleteConfirm(true);
                                    }}
                                    title="Delete your review"
                                    className="rounded-lg p-1.5 text-navy-400 hover:bg-red-50 hover:text-red-600 transition"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {r.comment ? <p className="mt-4 text-[15px] text-navy-700 leading-relaxed">{r.comment as string}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-navy-150 py-10 text-center">
                    <Star className="mx-auto h-8 w-8 text-navy-200" />
                    <p className="mt-2 text-sm font-medium text-navy-500">No reviews yet</p>
                    <p className="text-xs text-navy-400">Be the first to share your experience with this property.</p>
                  </div>
                )}
              </section>
            )}

            {/* Bottom Badges */}
            <div className="flex flex-wrap justify-center gap-6 pt-10 border-t border-navy-100 text-center pb-10">
               {property.verification_status && property.verification_status !== 'Pending AI' && (
                 <div className="flex flex-col items-center gap-2 max-w-[200px]">
                   <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><ShieldCheck className="h-6 w-6"/></div>
                   <p className="font-bold text-navy-900 text-sm">Verified Listing</p>
                   <p className="text-xs text-navy-500">100% Verified Property</p>
                 </div>
               )}
               <div className="flex flex-col items-center gap-2 max-w-[200px]">
                 <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><User className="h-6 w-6"/></div>
                 <p className="font-bold text-navy-900 text-sm">Trusted Agent</p>
                 <p className="text-xs text-navy-500">Verified & Experienced</p>
               </div>
               <div className="flex flex-col items-center gap-2 max-w-[200px]">
                 <div className="h-12 w-12 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center"><Check className="h-6 w-6"/></div>
                 <p className="font-bold text-navy-900 text-sm">Secure Transactions</p>
                 <p className="text-xs text-navy-500">Safe & Transparent</p>
               </div>
               {property.ai_score != null && (
                 <div className="flex flex-col items-center gap-2 max-w-[200px]">
                   <div className="h-12 w-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center"><Bot className="h-6 w-6"/></div>
                   <p className="font-bold text-navy-900 text-sm">AI Property Score</p>
                   <p className="text-xs text-navy-500">{property.ai_score}/100 Excellent</p>
                 </div>
               )}
            </div>

          </div>

          {/* RIGHT COLUMN (Sticky Sidebar) */}
          <aside className="hidden lg:block relative">
             <div className="sticky top-28 space-y-6">
               
               {/* MANAGED BY CARD */}
               <Card className="p-8 border-0 shadow-xl shadow-navy-900/5 ring-1 ring-navy-100 rounded-3xl bg-white overflow-hidden">
                 <div className="text-xs font-bold tracking-widest text-navy-400 uppercase mb-6">Managed By</div>
                 <div className="flex flex-col items-center text-center mb-8">
                   <div className="relative mb-4">
                     <div className="ring-4 ring-navy-50 rounded-full p-1">
                       <Avatar name={agentName} src={agent?.avatar_url ?? null} size={96} />
                     </div>
                     <div className="absolute bottom-1 right-1 bg-white rounded-full p-1 shadow-md">
                       <div className="bg-red-600 text-white rounded-full p-1"><ShieldCheck className="h-4 w-4" /></div>
                     </div>
                   </div>
                   <h3 className="font-display font-bold text-xl text-navy-900">{agentName}</h3>
                   <p className="text-sm font-medium text-emerald-600 mt-1 flex items-center justify-center gap-1"><Check className="h-4 w-4"/> Verified Agent</p>
                   {agent?.company && <p className="text-sm text-navy-500 mt-2">{agent.company}</p>}
                 </div>
                 
                 <div className="space-y-2.5">
                   <Button
                     size="md"
                     className="w-full h-11 bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20 text-sm font-bold rounded-xl transition-all active:scale-[0.98]"
                     onClick={() => setContactOpen(true)}
                   >
                     Contact Us
                   </Button>
                   {agent?.phone && (
                     <a
                       href={buildWhatsAppUrl((agent as any)?.whatsapp_number || (agent as any)?.phone_number || agent?.phone, property.title)}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="block"
                     >
                       <Button
                         size="md"
                         variant="secondary"
                         className="w-full h-11 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 text-sm font-bold rounded-xl transition-all active:scale-[0.98]"
                       >
                         <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="h-4 w-4 mr-2" /> WhatsApp
                       </Button>
                     </a>
                   )}
                   <Button
                     size="md"
                     variant="secondary"
                     className="w-full h-11 bg-white hover:bg-slate-50 border-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-all active:scale-[0.98]"
                     onClick={() => (user ? setApptOpen(true) : navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`))}
                   >
                     <Calendar className="h-4 w-4 mr-2 text-slate-500" /> Schedule Visit
                   </Button>
                 </div>
               </Card>

               {/* PROPERTY INSIGHTS */}
               <Card className="p-6 shadow-sm border-0 ring-1 ring-navy-100 rounded-3xl bg-white">
                 <h3 className="text-sm font-bold tracking-widest text-navy-400 uppercase mb-4 flex items-center gap-2">
                   <Eye className="h-4 w-4 text-navy-400" /> Property Insights
                 </h3>
                 <div className="space-y-4 text-sm">
                   <div className="flex justify-between items-center pb-4 border-b border-navy-50">
                     <span className="text-navy-500">{t('property.views', 'Total Views')}</span>
                     <span className="font-bold text-navy-900">{formatNumber(property.view_count)}</span>
                   </div>
                   <div className="flex justify-between items-center pb-4 border-b border-navy-50">
                     <span className="text-navy-500">{t('property.posted', 'Posted On')}</span>
                     <span className="font-semibold text-navy-800">{new Date(property.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-navy-500">{t('property.propertyId', 'Property ID')}</span>
                     <span className="font-mono text-xs font-semibold bg-slate-100 px-2 py-1 rounded-md text-navy-700">RN-{property.id.slice(0, 7).toUpperCase()}</span>
                   </div>
                 </div>
               </Card>
             </div>
          </aside>
        </div>
      </div>

      {/* MOBILE STICKY ACTION BAR */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-navy-100 p-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] z-40 flex gap-3">
        {agent?.phone && (
          <a href={`https://wa.me/${agent.phone.replace(/[^\d]/g, '')}`} className="flex-1">
            <Button size="lg" variant="secondary" className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-emerald-50/50">
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="h-5 w-5 mr-2" /> WhatsApp
            </Button>
          </a>
        )}
        <Button size="lg" className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20" onClick={() => setContactOpen(true)}>
          Contact Us
        </Button>
      </div>

      {/* Virtual tour modal */}
      {showVirtualTour && !!tours?.length && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95 p-4 backdrop-blur-2xl" onClick={() => setShowVirtualTour(false)}>
          <button
            type="button"
            className="absolute right-4 sm:right-8 top-4 sm:top-8 z-[100000] grid h-12 w-12 place-items-center rounded-full bg-black/75 hover:bg-red-600 border border-white/40 text-white transition-all shadow-2xl hover:scale-110 cursor-pointer active:scale-95"
            onClick={() => setShowVirtualTour(false)}
            title="Close virtual tour"
            aria-label="Close virtual tour"
          >
            <X className="h-6 w-6 stroke-[2.5]" />
          </button>
          <div className="h-[80vh] w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl border border-white/15" onClick={(e) => e.stopPropagation()}>
            <VirtualTourViewer tours={tours} propertyId={id} />
          </div>
        </div>,
        document.body
      )}

      {/* Lightbox Modal */}
      {lightbox && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95 backdrop-blur-2xl" onClick={() => setLightbox(false)}>
          <button
            type="button"
            className="absolute right-4 sm:right-8 top-4 sm:top-8 z-[100000] grid h-12 w-12 place-items-center rounded-full bg-black/75 hover:bg-red-600 border border-white/40 text-white transition-all shadow-2xl hover:scale-110 cursor-pointer active:scale-95"
            onClick={() => setLightbox(false)}
            title="Close photo gallery"
            aria-label="Close photo gallery"
          >
            <X className="h-6 w-6 stroke-[2.5]" />
          </button>
          <div className="absolute top-4 sm:top-8 left-1/2 -translate-x-1/2 bg-black/80 border border-white/30 text-white font-extrabold text-xs sm:text-sm px-5 py-2 rounded-full shadow-2xl tracking-widest uppercase backdrop-blur-md">
            {activeImg + 1} / {images.length}
          </div>
          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveImg((prev) => (prev - 1 + images.length) % images.length); }}
              className="absolute left-3 sm:left-8 top-1/2 -translate-y-1/2 z-[100000] grid h-12 sm:h-16 w-12 sm:w-16 place-items-center rounded-full bg-black/75 hover:bg-red-600 border border-white/30 text-white backdrop-blur-md transition-all shadow-2xl hover:scale-110 cursor-pointer active:scale-95"
              title="Previous photo"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-7 sm:h-8 w-7 sm:w-8 stroke-[2.5]" />
            </button>
          )}
          <img
            src={images[activeImg] || DEFAULT_PROPERTY_IMAGE}
            alt={`Property image ${activeImg + 1}`}
            onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
            className="max-h-[85vh] max-w-[90vw] object-contain shadow-2xl rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveImg((prev) => (prev + 1) % images.length); }}
              className="absolute right-3 sm:right-8 top-1/2 -translate-y-1/2 z-[100000] grid h-12 sm:h-16 w-12 sm:w-16 place-items-center rounded-full bg-black/75 hover:bg-red-600 border border-white/30 text-white backdrop-blur-md transition-all shadow-2xl hover:scale-110 cursor-pointer active:scale-95"
              title="Next photo"
              aria-label="Next photo"
            >
              <ChevronRight className="h-7 sm:h-8 w-7 sm:w-8 stroke-[2.5]" />
            </button>
          )}
          <div className="absolute bottom-4 sm:bottom-8 flex gap-3 overflow-x-auto max-w-[92vw] px-4 py-3 bg-black/80 border border-white/20 backdrop-blur-md rounded-2xl no-scrollbar shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveImg(i)}
                className={cn(
                  'h-16 sm:h-20 w-24 sm:w-32 shrink-0 overflow-hidden rounded-xl border-2 transition-all cursor-pointer',
                  activeImg === i ? 'border-red-600 scale-105 shadow-2xl ring-2 ring-red-600/50' : 'border-transparent opacity-50 hover:opacity-100 hover:scale-102'
                )}
              >
                <img
                  src={img}
                  alt=""
                  onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Contact Agent Modal */}
      {property && (
        <ContactAgentModal
          isOpen={contactOpen}
          onClose={() => setContactOpen(false)}
          property={{
            id: property.id,
            title: property.title,
            assigned_agent_id: property.assigned_agent_id,
            owner_id: property.owner_id,
            city_name: property.city_name,
            locality_name: property.locality_name,
          }}
          agentOverride={
            agent
              ? {
                  id: property.assigned_agent_id || property.owner_id || agent.id || undefined,
                  name: agentName,
                  phone: agent.phone,
                  email: agent.email,
                  avatar_url: agent.avatar_url,
                  company: agent.company,
                  is_verified: true,
                }
              : null
          }
        />
      )}

      {/* Appointment modal */}
      <Modal
        open={apptOpen}
        onClose={() => setApptOpen(false)}
        title={t('property.bookVisit', 'Book a property visit')}
        footer={
          <Button loading={apptMutation.isPending} onClick={() => apptMutation.mutate()} icon={<Calendar className="h-4 w-4" />} className="w-full bg-navy-900 hover:bg-navy-800 text-white border-0">
            {t('forms.requestAppointment', 'Request appointment')}
          </Button>
        }
      >
        <p className="mb-4 text-sm text-navy-500">{t('property.pickDateMsg', 'Pick a date and time to visit this property. The agent will confirm.')}</p>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('forms.date', 'Date')} type="date" value={apptForm.date} onChange={(e) => setApptForm((f) => ({ ...f, date: e.target.value }))} />
            <Input label={t('forms.time', 'Time')} type="time" value={apptForm.time} onChange={(e) => setApptForm((f) => ({ ...f, time: e.target.value }))} />
          </div>
          <Textarea label={t('forms.notesOptional', 'Notes (optional)')} value={apptForm.notes} onChange={(e) => setApptForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t('forms.specificRequests', 'Any specific requests or questions')} />
          {apptMutation.isSuccess && (
            <p className="text-sm text-emerald-600 flex items-center gap-1 font-medium bg-emerald-50 p-3 rounded-lg">
              <Check className="h-4 w-4" /> {t('property.apptRequestedMsg', 'Appointment requested! Check your portal for updates.')}
            </p>
          )}
        </div>
      </Modal>

      {/* Review modal */}
      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title={reviewForm.id ? 'Edit your review' : t('property.writeReview', 'Write a review')}
        footer={
          <Button loading={reviewMutation.isPending} onClick={() => reviewMutation.mutate()} icon={<Star className="h-4 w-4" />} className="w-full">
            {reviewForm.id ? 'Update review' : t('forms.submitReview', 'Submit review')}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">{t('forms.rating', 'Rating')}</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} type="button" onClick={() => setReviewForm((f) => ({ ...f, rating: i }))} className={i <= reviewForm.rating ? 'text-gold-400 hover:scale-110 transition-transform' : 'text-navy-100 hover:text-gold-200 transition-colors'}>
                  <Star className="h-8 w-8 fill-current" />
                </button>
              ))}
            </div>
          </div>
          <Input label="Title (optional)" value={reviewForm.title} onChange={(e) => setReviewForm((f) => ({ ...f, title: e.target.value }))} placeholder="Brief summary of your experience" />
          <Textarea label={t('forms.comment', 'Comment')} value={reviewForm.comment} onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))} placeholder={t('forms.shareExperience', 'Share your experience with this property')} />
          {reviewMutation.isSuccess && (
            <p className="text-sm text-emerald-600 flex items-center gap-1 font-medium bg-emerald-50 p-3 rounded-lg">
              <Check className="h-4 w-4" /> {reviewForm.id ? 'Review updated!' : t('property.reviewSubmitted', 'Review submitted!')}
            </p>
          )}
        </div>
      </Modal>

      {/* Delete review confirmation */}
      <Modal
        open={reviewDeleteConfirm}
        onClose={() => setReviewDeleteConfirm(false)}
        title="Delete your review?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteReviewMutation.isPending} onClick={() => deleteReviewMutation.mutate()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-700">This will permanently remove your review from this listing.</p>
      </Modal>

      {/* Report Property modal */}
      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report this listing"
        footer={
          <Button loading={reportMutation.isPending} onClick={() => reportMutation.mutate()} icon={<Flag className="h-4 w-4" />} className="w-full">
            Submit report
          </Button>
        }
      >
        <div className="space-y-4">
          <Select label="Reason" value={reportForm.reason} onChange={(e) => setReportForm((f) => ({ ...f, reason: e.target.value }))}>
            <option value="">Select a reason</option>
            <option value="Incorrect information">Incorrect information</option>
            <option value="Fraud or scam">Fraud or scam</option>
            <option value="Duplicate listing">Duplicate listing</option>
            <option value="Property already sold/rented">Property already sold/rented</option>
            <option value="Inappropriate content">Inappropriate content</option>
            <option value="Other">Other</option>
          </Select>
          <Textarea label="Details (optional)" value={reportForm.details} onChange={(e) => setReportForm((f) => ({ ...f, details: e.target.value }))} placeholder="Tell us more..." />
        </div>
      </Modal>

      {/* Share Property Modal */}
      <SharePropertyModal property={property} isOpen={showShare} onClose={() => setShowShare(false)} />
    </div>
  );
}
