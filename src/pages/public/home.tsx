import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { Link, useNavigate } from 'react-router-dom';
import { PostPropertyBanner } from '../../components/post-property-banner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import homeServicesImg from '../../assets/services/home-services.webp';
import interiorServicesImg from '../../assets/services/interior-services.webp';
import borewellServicesImg from '../../assets/services/borewell-services.webp';
import homeLoansImg from '../../assets/services/home-loans.webp';
import {
  Search,
  Mic,
  Navigation,
  MapPin,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Building2,
  Home,
  Store,
  Warehouse,
  Users,
  Star,
  Phone,
  MessageCircle,
  ShieldCheck,
  BadgeCheck,
  Zap,
  Bot,
  Calculator,
  FileText,
  Wallet,
  KeyRound,
  Briefcase,
  Heart,
  GitCompare,
  BarChart3,
  Layers,
  Award,
  Scale,
  Sun,
  Shield,
  Truck,
  Ruler,
  PaintBucket,
  LandPlot,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplets,
  PieChart,
  Bed,
  Share2,
  Check,
  CheckCircle2,
  Calendar,
  X,
} from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { parsePropertySearchQuery, fetchLocationCategoryDiscovery, type LocationDiscoveryResult } from '../../lib/search-engine';
import type { CategorySlug } from '../../lib/categories';
import { normalizeSearchQuery } from '../../lib/properties';
import { supabase } from '../../lib/supabase';
import { useRealtimeCount } from '../../lib/realtime';
import { formatCompactPrice, formatNumber, cn, generatePropertyUrl, getPropertyPrice, buildWhatsAppUrl } from '../../lib/utils';
import { sharePropertyNativeOrCopy } from '../../lib/share-service';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { useToast } from '../../components/toast';
import { AppShowcase } from '../../components/app-showcase';
import type { HeroCampaign, Property } from '../../lib/types';
import { useLocationContext } from '../../contexts/location-context';

import { useFavorites, toggleFavoriteProperty, getLocalFavoriteIds } from '../../lib/favorites';
import { useAuth } from '../../lib/auth';
import { getPropertyCoverImage, handleImageError, DEFAULT_PROPERTY_IMAGE } from '../../lib/property-images';
import { PropertyImage } from '../../components/property-image';
import { getPropertyPricingDisplay, getPriceUnitLabel } from '../../lib/plot-pricing';
import { PostPropertyLink } from '../../components/post-property-link';
import { ContactAgentModal } from '../../components/contact-agent-modal';
import { BookVisitModal } from '../../components/book-visit-modal';
import { fetchPublicFeaturedProperties } from '../../lib/featured-properties-api';
import { fetchPublicCampaigns } from '../../lib/paid-campaigns-api';

type HomeCardProperty = Property & {
  city_name?: string | null;
  locality_name?: string | null;
  property_type_name?: string | null;
  builder_name?: string | null;
};

/* ============================================================
   Compact premium property card — shared by the homepage carousels
============================================================ */
export function HomePropertyCard({
  property,
  badge,
}: {
  property: HomeCardProperty;
  badge?: { label: string; className: string; icon?: React.ReactNode };
}) {
  const { t } = useLanguageContext();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { data: favoriteIds } = useFavorites(user?.id);
  const favorited = favoriteIds ? favoriteIds.includes(property.id) : false;
  
  const [localFavorited, setLocalFavorited] = useState(() => getLocalFavoriteIds().includes(property.id));
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [visitModalOpen, setVisitModalOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      const handleSyncFavorites = () => setLocalFavorited(getLocalFavoriteIds().includes(property.id));
      window.addEventListener('realtynow-favorites-updated', handleSyncFavorites);
      return () => window.removeEventListener('realtynow-favorites-updated', handleSyncFavorites);
    }
  }, [property.id, user]);

  const isCurrentlyFavorited = user ? favorited : localFavorited;
  const reraNumber = (property as { rera_number?: string | null }).rera_number ?? null;

  const handleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleFavoriteProperty(property.id, user?.id, isCurrentlyFavorited);
  };

  const handleShareClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await sharePropertyNativeOrCopy(property, () => {
      addToast('success', 'Public property link copied to clipboard!');
    });
  };

  const handleWhatsAppClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const agentId = (property as any).assigned_agent_id || (property as any).owner_id;
    if (!agentId) {
      addToast('error', 'WhatsApp is currently unavailable for this property');
      return;
    }

    try {
      const { data: agentProfile } = await supabase
        .from('profiles')
        .select('phone, phone_number, whatsapp_number')
        .eq('id', agentId)
        .maybeSingle();

      const targetPhone = agentProfile?.whatsapp_number || agentProfile?.phone_number || agentProfile?.phone;
      if (!targetPhone) {
        addToast('error', 'WhatsApp is currently unavailable for this agent.');
        return;
      }

      const waUrl = buildWhatsAppUrl(targetPhone, property.title);
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch {
      addToast('error', 'WhatsApp is currently unavailable for this agent.');
    }
  };

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.09)] hover:-translate-y-1">
      <Link
        to={generatePropertyUrl(property)}
        className="block flex-1"
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
          <PropertyImage
            src={getPropertyCoverImage(property)}
            alt={property.title}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
          />
          {/* Subtle gradient scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

          {badge && (
            <span
              className={cn(
                'absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md backdrop-blur-md',
                badge.className,
              )}
            >
              {badge.icon} {badge.label}
            </span>
          )}
          
          <div className="absolute right-3 top-3 flex items-center gap-1.5 z-10">
            <button
              type="button"
              onClick={handleFavorite}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow-md backdrop-blur-md transition-all hover:scale-110 hover:bg-white cursor-pointer',
                isCurrentlyFavorited ? 'text-red-500' : 'text-slate-700 hover:text-red-600',
              )}
              title={isCurrentlyFavorited ? t('common.removeFromFavorites', 'Remove') : t('common.addToFavorites', 'Save')}
            >
              <Heart className={cn('h-4 w-4', isCurrentlyFavorited && 'fill-red-500')} />
            </button>
            <button
              type="button"
              onClick={handleShareClick}
              aria-label="Share this property"
              className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur-md transition-all hover:scale-110 hover:bg-white hover:text-red-600"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {property.possession_status && (
            <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md border border-white/10">
              {property.possession_status}
            </span>
          )}
          {reraNumber && (
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[9px] font-black text-emerald-800 shadow-md backdrop-blur-md">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> RERA
            </span>
          )}
        </div>

        <div className="flex flex-col p-4 sm:p-5">
          {(() => {
            const pricing = getPropertyPricingDisplay(property, { compactConstructed: true });
            return (
              <>
                <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
                  <p className="font-display text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-baseline gap-1.5">
                    {pricing.primaryPrice}
                    {pricing.isLand && pricing.totalEstimatedPrice && (
                      <span className="text-xs font-normal text-slate-500">
                        ({pricing.totalEstimatedPrice})
                      </span>
                    )}
                  </p>
                  {property.bedrooms != null ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      <Bed className="h-3.5 w-3.5 text-slate-500" /> {property.bedrooms} BHK
                    </span>
                  ) : pricing.areaDisplay ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 px-2.5 py-0.5 text-xs font-bold">
                      {pricing.areaDisplay}
                    </span>
                  ) : null}
                </div>

                <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 line-clamp-1 group-hover:text-red-600 transition-colors">
                  {property.title}
                </h3>
                
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-red-500" />
                  <span className="line-clamp-1">
                    {property.locality_name ? `${property.locality_name}, ` : ''}
                    {property.city_name ?? 'Hyderabad'}
                  </span>
                </p>
              </>
            );
          })()}
        </div>
      </Link>

      {/* View Details CTA Button */}
      <div className="mt-auto pt-2 px-4 pb-4 border-t border-slate-100">
        <Link
          to={generatePropertyUrl(property)}
          onClick={(e) => e.stopPropagation()}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-50 hover:bg-red-600 text-slate-700 hover:text-white border border-slate-200 hover:border-red-600 transition-all text-center flex items-center justify-center gap-2 group/btn shadow-2xs hover:shadow-md active:scale-98"
        >
          <span>{t('common.viewDetails', 'View Details')}</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}

/* ============================================================
   Animated Counter
============================================================ */
function Counter({ to, suffix = '', duration = 2000 }: { to: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setVal(Math.floor(eased * to));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref}>
      {formatNumber(val)}
      {suffix}
    </span>
  );
}

/* ============================================================
   Hero Section — Screenshot 2 (99acres) Style Cinematic Layout
============================================================ */
type HeroSlide = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  companyLogo?: string | null;
  developerLogo?: string | null;
  reraNumber?: string | null;
  features: string[];
  overlayPosition: 'left' | 'right' | 'center' | 'both';
  overlayOpacity: number;
  contentAlignment: 'left' | 'center' | 'right';
  priceText?: string | null;
  locationText?: string | null;
  imageDesktop: string;
  imageMobile?: string | null;
  ctaEnabled: boolean;
  ctaText: string;
  ctaLink: string;
  packageTier?: 'Platinum' | 'Gold' | 'Silver' | 'Featured' | 'Free' | null;
  isPinned?: boolean;
};

// Static fallback slides with high-conversion 99acres style formatting
const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'hero-luxury-villas',
    title: 'SIGNATURE VILLAS & PRIVATE MANSIONS',
    subtitle: 'The Crown Enclave — Kokapet & Jubilee Hills Luxury Living',
    reraNumber: 'RERA No.: P02400007205 | Ultra-Luxury Gated Community',
    features: [
      'Private Heated Swimming Pools & Landscaped Terraces',
      '4, 5 & 6 BHK Independent Villas on 500-1200 Sq.Yards',
      '10-Minute Drive to Financial District & HITEC City',
      '100% Vastu Compliant with 4-Car Covered Parking',
    ],
    overlayPosition: 'left',
    overlayOpacity: 0.88,
    contentAlignment: 'left',
    locationText: 'Hyderabad',
    imageDesktop: '/hero-villa-luxury.jpg',
    imageMobile: '/hero-villa-luxury.jpg',
    ctaEnabled: true,
    ctaText: 'Explore Villas',
    ctaLink: '/search?type=Villa',
    packageTier: 'Platinum',
    isPinned: true,
  },
  {
    id: 'hero-lake-apartments',
    title: 'PREMIUM LAKE-FACING RESIDENCES',
    subtitle: 'My Home Sayuk & Marina Heights — Tellapur, Financial District',
    reraNumber: 'RERA No.: P02400003891 | HMDA Approved High-Rise',
    features: [
      'Zero Brokerage & AI-Assisted Site Visits',
      '2, 2.5 & 3 BHK Starting from ₹ 1.25 Cr',
      'Over 50+ World-Class Resort Style Lifestyle Amenities',
      'Panoramic Lake Views with 80% Green Open Spaces',
    ],
    overlayPosition: 'right',
    overlayOpacity: 0.88,
    contentAlignment: 'left',
    locationText: 'Hyderabad',
    imageDesktop: '/hero-lake-apartments.jpg',
    imageMobile: '/hero-lake-apartments.jpg',
    ctaEnabled: true,
    ctaText: 'View Apartments',
    ctaLink: '/search?category=apartment',
    packageTier: 'Platinum',
  },
  {
    id: 'hero-open-plots',
    title: 'PREMIUM HMDA & RERA APPROVED PLOTS',
    subtitle: 'Greenwood County — Mokila & Shankarpalli Growth Corridor',
    reraNumber: 'RERA No.: P02400005512 | 100% Clear Title Plots',
    features: [
      '200 to 1,000 Sq.Yards Villa Plots with Immediate Registration',
      '60ft & 40ft Black-Top Roads with Underground Utilities',
      '15 Minutes to Neopolis & Outer Ring Road (ORR Exit 1)',
      'Gated Community with 24/7 Security & Grand Clubhouse',
    ],
    overlayPosition: 'left',
    overlayOpacity: 0.88,
    contentAlignment: 'left',
    locationText: 'Hyderabad',
    imageDesktop: '/hero-open-plots.jpg',
    imageMobile: '/hero-open-plots.jpg',
    ctaEnabled: true,
    ctaText: 'Explore Plots',
    ctaLink: '/plots',
    packageTier: 'Gold',
  },
  {
    id: 'hero-commercial-it',
    title: 'GRADE-A COMMERCIAL & IT PARKS',
    subtitle: 'Cyber Gateway Towers — HITEC City & Gachibowli',
    reraNumber: 'RERA No.: P02400008890 | Ready-to-Occupy Commercial',
    features: [
      '5,000 to 1,00,000 Sq.Ft Pre-Leased & Bare-Shell Offices',
      'High Rental Yields up to 9.2% with Fortune 500 Tenants',
      'IGBC Platinum Rated Green Building with 100% Power Backup',
      'Direct Metro Connectivity & Multi-Level Car Parking',
    ],
    overlayPosition: 'right',
    overlayOpacity: 0.88,
    contentAlignment: 'left',
    locationText: 'Hyderabad',
    imageDesktop: '/hero-commercial-it.jpg',
    imageMobile: '/hero-commercial-it.jpg',
    ctaEnabled: true,
    ctaText: 'Explore Commercial',
    ctaLink: '/commercial',
    packageTier: 'Platinum',
  },
  {
    id: 'hero-penthouse-sky',
    title: 'EXCLUSIVE SKY PENTHOUSES & DUPLEXES',
    subtitle: 'The Horizon Heights — Banjara Hills Road No. 12',
    reraNumber: 'RERA No.: P02400009123 | Limited Edition Residences',
    features: [
      '360° City Skyline & KBR National Park Panoramic Views',
      'Private High-Speed Elevators Opening Directly into Foyer',
      'Double-Height Living Ceilings with Italian Marble & Jacuzzi',
      '24/7 Concierge Services, Private Helipad & Sky Lounge',
    ],
    overlayPosition: 'left',
    overlayOpacity: 0.88,
    contentAlignment: 'left',
    locationText: 'Hyderabad',
    imageDesktop: '/hero-penthouse-sky.jpg',
    imageMobile: '/hero-penthouse-sky.jpg',
    ctaEnabled: true,
    ctaText: 'View Penthouses',
    ctaLink: '/search?luxury=1',
    packageTier: 'Platinum',
  },
  {
    id: 'hero-gated-community',
    title: 'NEXT-GEN SMART HOMES NEAR IT CORRIDOR',
    subtitle: 'Aparna CyberLife — Gachibowli Financial District',
    reraNumber: 'RERA No.: P01100004147 | Walk-to-Work Living',
    features: [
      'Automated Lighting, Climate Control & Biometric Locks',
      '2, 3 & 4 BHK Designer Apartments Starting ₹ 95 Lakhs',
      'Olympic Size Swimming Pool, Tennis Courts & Co-Working Cafe',
      '5 Minutes to Microsoft, Google & Amazon Headquarters',
    ],
    overlayPosition: 'right',
    overlayOpacity: 0.88,
    contentAlignment: 'left',
    locationText: 'Hyderabad',
    imageDesktop: '/hero-gated-community.jpg',
    imageMobile: '/hero-gated-community.jpg',
    ctaEnabled: true,
    ctaText: 'Explore Smart Homes',
    ctaLink: '/search?purpose=Buy',
    packageTier: 'Gold',
  },
  {
    id: 'hero-luxury-farmhouse',
    title: 'ECO-LUXURY FARMHOUSES & RESORT LIVING',
    subtitle: 'Serene Meadows — Gandipet & Osman Sagar Enclave',
    reraNumber: 'HMDA & DTCP Approved | Pollution-Free Green Sanctuary',
    features: [
      '0.5 to 2 Acre Gated Farmhouse Plots with Organic Orchard',
      'Private Clubhouse, Organic Farming Zone & Nature Trails',
      '25 Minutes from Gachibowli via Outer Ring Road',
      'Solar Powered Sustainable Living with Rainwater Harvesting',
    ],
    overlayPosition: 'left',
    overlayOpacity: 0.88,
    contentAlignment: 'left',
    locationText: 'Hyderabad',
    imageDesktop: '/hero-luxury-farmhouse.jpg',
    imageMobile: '/hero-luxury-farmhouse.jpg',
    ctaEnabled: true,
    ctaText: 'View Farmhouses',
    ctaLink: '/search?q=Farmhouse',
    packageTier: 'Gold',
  },
  {
    id: 'hero-township-neopolis',
    title: 'NEW LAUNCH: NEOPOLIS INTEGRATED TOWNSHIP',
    subtitle: 'Prestige Clairemont — The Future of Urban Hyderabad',
    reraNumber: 'RERA No.: P02400009944 | Phase 1 Early Booking Open',
    features: [
      '60-Storey Iconic Twin Towers with Skybridge & Skywalk',
      'Special Pre-Launch Pricing & Flexible 10:90 Payment Plans',
      '1 Lakh Sq.Ft Mega Clubhouse with 70+ Sporting Facilities',
      'Direct Access to Trumpet Interchange & Regional Ring Road',
    ],
    overlayPosition: 'right',
    overlayOpacity: 0.88,
    contentAlignment: 'left',
    locationText: 'Hyderabad',
    imageDesktop: '/hero-township-neopolis.jpg',
    imageMobile: '/hero-township-neopolis.jpg',
    ctaEnabled: true,
    ctaText: 'Explore New Launches',
    ctaLink: '/projects',
    packageTier: 'Platinum',
  },
];

const HERO_SLIDE_INTERVAL_MS = 6000;

const heroTextVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

function mapCampaignToHeroSlide(c: HeroCampaign): HeroSlide {
  // Extract features from joined hero_campaign_features child table, jsonb features, or description lines
  let featureList: string[] = [];
  if (Array.isArray(c.hero_campaign_features) && c.hero_campaign_features.length > 0) {
    featureList = [...c.hero_campaign_features]
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((f) => f.feature_text)
      .filter(Boolean);
  } else if (Array.isArray(c.features) && c.features.length > 0) {
    featureList = c.features.filter(Boolean);
  } else if (c.description) {
    featureList = c.description
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  return {
    id: c.id,
    title: c.title,
    subtitle: (c.subtitle && c.subtitle.trim()) || null,
    description: c.description || null,
    companyLogo: c.logo || null,
    developerLogo: c.developer_logo || null,
    reraNumber: c.rera_number || null,
    features: featureList,
    overlayPosition: c.overlay_position || 'right',
    overlayOpacity: typeof c.overlay_opacity === 'number' ? c.overlay_opacity : 0.88,
    contentAlignment: c.content_alignment || 'left',
    priceText: c.campaign_type === 'Paid' ? (c.package_tier && c.package_tier !== 'Free' ? c.package_tier : 'Sponsored') : null,
    locationText: c.cities?.name ?? null,
    imageDesktop: c.banner_image || '/hero-ramky.jpg',
    imageMobile: c.mobile_banner || c.banner_image || '/hero-ramky.jpg',
    ctaEnabled: c.cta_enabled !== false,
    ctaText: c.cta_text || 'Explore Now',
    ctaLink: c.cta_url || (c.property_id ? `/property/${c.property_id}` : '/search'),
    packageTier: c.package_tier,
    isPinned: c.is_pinned,
  };
}

function HeroSection() {
  const { cityId } = useLocationContext();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const realtimeTick = useRealtimeCount('hero_campaigns');

  const { data: campaigns } = useQuery({
    queryKey: ['hero-campaigns', realtimeTick],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hero_campaigns')
        .select('*, cities(name), hero_campaign_features(*)')
        .eq('status', 'Active')
        .order('order_no', { ascending: true });
      if (error) return [];
      return (data ?? []) as HeroCampaign[];
    },
  });

  const slides = useMemo(() => {
    const now = Date.now();
    const active = (campaigns ?? []).filter((c) => {
      if (c.start_date && new Date(c.start_date).getTime() > now) return false;
      if (c.end_date && new Date(c.end_date).getTime() < now) return false;
      return true;
    });
    const live = cityId ? active.filter((c) => !c.city_id || c.city_id === cityId) : active;

    const sortedLive = [...live].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;

      const tierWeights: Record<string, number> = {
        Platinum: 5,
        Gold: 4,
        Silver: 3,
        Featured: 2,
        Free: 1,
      };

      const weightA = tierWeights[a.package_tier || 'Free'] || 1;
      const weightB = tierWeights[b.package_tier || 'Free'] || 1;

      if (weightA !== weightB) {
        return weightB - weightA;
      }

      const orderA = a.order_no ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order_no ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });

    return sortedLive.length > 0 ? sortedLive.map(mapCampaignToHeroSlide) : HERO_SLIDES;
  }, [campaigns, cityId]);

  const autoplayPlugin = useRef(Autoplay({ delay: HERO_SLIDE_INTERVAL_MS, stopOnInteraction: false }));
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start', duration: 32 }, [autoplayPlugin.current]);

  useEffect(() => {
    if (!emblaApi) return;
    try {
      if (isHovering) autoplayPlugin.current.stop();
      else autoplayPlugin.current.play();
    } catch {
      // Autoplay safe fallback
    }
  }, [isHovering, emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    onSelect();
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    emblaApi?.reInit();
  }, [emblaApi, slides.length]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  const isHoveringRef = useRef(false);
  useEffect(() => {
    isHoveringRef.current = isHovering;
  }, [isHovering]);
  useEffect(() => {
    if (slides.length <= 1) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isHoveringRef.current) return;
      if (e.key === 'ArrowLeft') scrollPrev();
      else if (e.key === 'ArrowRight') scrollNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [scrollPrev, scrollNext, slides.length]);

  const wheelLockRef = useRef(false);
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (slides.length <= 1 || wheelLockRef.current) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 24) return;
      wheelLockRef.current = true;
      if (delta > 0) scrollNext();
      else scrollPrev();
      window.setTimeout(() => {
        wheelLockRef.current = false;
      }, 700);
    },
    [scrollNext, scrollPrev, slides.length],
  );

  const activeSlide = slides[selectedIndex] ?? slides[0];

  return (
    <section
      className="relative overflow-hidden bg-slate-950 focus:outline-none select-none"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onWheel={onWheel}
    >
      <div className="relative h-[400px] min-h-[400px] max-h-[400px] w-full">
        {/* Sliding track — cover background image */}
        <div className="h-full w-full overflow-hidden" ref={emblaRef}>
          <div className="flex h-full">
            {slides.map((slide, index) => {
              const isActive = index === selectedIndex;
              return (
                <div key={slide.id} className="relative h-full min-w-0 flex-[0_0_100%]">
                  <motion.div
                    className="absolute inset-0 will-change-transform"
                    animate={isActive ? 'active' : 'inactive'}
                    initial="inactive"
                    variants={{
                      active: { scale: 1, opacity: 1, filter: 'blur(0px)' },
                      inactive: { scale: 1.06, opacity: 0.4, filter: 'blur(6px)' },
                    }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <picture>
                      {slide.imageMobile && slide.imageMobile !== slide.imageDesktop && (
                        <source media="(max-width: 640px)" srcSet={slide.imageMobile} />
                      )}
                      <img
                        key={isActive ? `${slide.id}-kb-${selectedIndex}` : slide.id}
                        src={slide.imageDesktop}
                        alt={slide.title}
                        className={cn('h-full w-full object-cover object-center', isActive && 'animate-hero-ken-burns')}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        {...{ fetchpriority: index === 0 ? 'high' : 'low' }}
                      />
                    </picture>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Left/right navigation arrows */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={scrollPrev}
              aria-label="Previous slide"
              className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-black/40 text-white border border-white/20 shadow-2xl backdrop-blur-md transition-all hover:bg-white hover:text-slate-900 hover:scale-110 active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={scrollNext}
              aria-label="Next slide"
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-20 grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-black/40 text-white border border-white/20 shadow-2xl backdrop-blur-md transition-all hover:bg-white hover:text-slate-900 hover:scale-110 active:scale-95 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Carousel indicator dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 sm:bottom-5 right-6 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/20 shadow-2xl">
            {slides.map((s, idx) => {
              const isActive = idx === selectedIndex;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => scrollTo(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className="group relative flex items-center justify-center p-0.5 cursor-pointer focus:outline-none"
                >
                  <span
                    className={cn(
                      'block rounded-full transition-all duration-300',
                      isActive
                        ? 'h-2 w-5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]'
                        : 'h-1.5 w-1.5 bg-white/40 group-hover:bg-white/80',
                    )}
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Adaptive Dynamic Gradient Scrim */}
        <div
          key={`overlay-${activeSlide.id}-${activeSlide.overlayPosition}`}
          className="pointer-events-none absolute inset-0 z-[5] transition-all duration-700"
          style={{
            background:
              activeSlide.overlayPosition === 'right'
                ? `linear-gradient(to right, transparent 0%, rgba(10, 18, 30, 0.3) 25%, rgba(10, 18, 30, 0.85) 60%, rgba(10, 18, 30, 0.95) 100%)`
                : activeSlide.overlayPosition === 'left'
                ? `linear-gradient(to left, transparent 0%, rgba(10, 18, 30, 0.3) 25%, rgba(10, 18, 30, 0.85) 60%, rgba(10, 18, 30, 0.95) 100%)`
                : `radial-gradient(ellipse at center, rgba(10, 18, 30, 0.5) 0%, rgba(10, 18, 30, 0.85) 75%, rgba(10, 18, 30, 0.98) 100%), linear-gradient(to top, rgba(10, 18, 30, 0.95), transparent)`,
          }}
        />

        {/* Mobile & Tablet bottom scrim */}
        <div className="pointer-events-none absolute inset-0 z-[6] bg-gradient-to-t from-slate-950/90 via-transparent to-black/30" />

        {/* Slide Foreground Content Box */}
        <div className="absolute inset-0 z-10">
          <div className="container-wide h-full w-full mx-auto px-4 sm:px-8 lg:px-12 flex items-center">
            <div
              className={cn(
                'w-full h-full flex pb-8 sm:pb-10 pt-4 sm:pt-6',
                activeSlide.overlayPosition === 'right'
                  ? 'justify-center sm:justify-end items-center text-left'
                  : activeSlide.overlayPosition === 'left'
                  ? 'justify-center sm:justify-start items-center text-left'
                  : 'justify-center items-center text-center',
              )}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`panel-${activeSlide.id}-${selectedIndex}`}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } }}
                  className={cn(
                    'w-full max-w-xl sm:max-w-2xl flex flex-col gap-2',
                    activeSlide.overlayPosition === 'center' ? 'items-center text-center' : 'items-start text-left',
                  )}
                >
                  {/* Top Bar: Developer & Project Logos + RERA Registration */}
                  <motion.div variants={heroTextVariants} className="flex flex-wrap items-center gap-2">
                    {activeSlide.packageTier && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-red-600 to-rose-600 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-red-600/30">
                        <Sparkles className="h-2.5 w-2.5" /> {activeSlide.packageTier} Showcase
                      </span>
                    )}
                    {activeSlide.developerLogo && (
                      <div className="h-6 sm:h-7 px-2 py-0.5 rounded-lg bg-white/95 shadow-md backdrop-blur-md flex items-center justify-center">
                        <img src={activeSlide.developerLogo} alt="Developer logo" className="max-h-full max-w-[80px] object-contain" />
                      </div>
                    )}
                    {activeSlide.companyLogo && (
                      <div className="h-6 sm:h-7 px-2 py-0.5 rounded-lg bg-white/95 shadow-md backdrop-blur-md flex items-center justify-center">
                        <img src={activeSlide.companyLogo} alt="Project logo" className="max-h-full max-w-[90px] object-contain" />
                      </div>
                    )}
                    {activeSlide.reraNumber && (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-black/60 border border-white/20 px-2.5 py-0.5 text-[10px] text-white/95 font-semibold backdrop-blur-md shadow-xs">
                        <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                        <span className="truncate max-w-[220px] sm:max-w-xs">{activeSlide.reraNumber}</span>
                      </div>
                    )}
                    {activeSlide.locationText && !activeSlide.reraNumber && (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-black/60 border border-white/20 px-2.5 py-0.5 text-[10px] text-white/90 font-bold tracking-wider uppercase backdrop-blur-md">
                        <MapPin className="h-3 w-3 text-red-400 shrink-0" />
                        <span>{activeSlide.locationText}</span>
                      </div>
                    )}
                    {activeSlide.priceText && (
                      <span className="rounded-full bg-amber-400 text-slate-950 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm">
                        {activeSlide.priceText}
                      </span>
                    )}
                  </motion.div>

                  {/* Main Property Headline Title */}
                  <motion.h1
                    variants={heroTextVariants}
                    className="font-display text-xl sm:text-2xl lg:text-3xl font-black uppercase text-white tracking-tight leading-[1.15] [text-shadow:0_2px_12px_rgba(0,0,0,0.8)]"
                  >
                    {activeSlide.title}
                  </motion.h1>

                  {/* Subtitle */}
                  {activeSlide.subtitle && (
                    <motion.p
                      variants={heroTextVariants}
                      className="text-xs sm:text-sm font-medium text-slate-200/95 leading-relaxed line-clamp-1 [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]"
                    >
                      {activeSlide.subtitle}
                    </motion.p>
                  )}

                  {/* Dynamic Property Features Highlights (Max 2 for 400px height) */}
                  {activeSlide.features && activeSlide.features.length > 0 && (
                    <motion.div variants={heroTextVariants} className="space-y-1 my-0.5">
                      {activeSlide.features.slice(0, 2).map((feat, fIdx) => (
                        <div
                          key={fIdx}
                          className="flex items-start gap-1.5 text-xs font-semibold text-white/95 leading-snug [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span className="leading-snug">{feat}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {/* Optional CTA Button */}
                  {activeSlide.ctaEnabled && activeSlide.ctaText && (
                    <motion.div variants={heroTextVariants} className="pt-1 flex flex-wrap items-center gap-2.5">
                      {activeSlide.ctaLink.startsWith('http') ? (
                        <a
                          href={activeSlide.ctaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 px-4 py-2 sm:px-5 sm:py-2 text-xs sm:text-sm font-bold text-white shadow-lg shadow-red-900/30 hover:shadow-red-600/50 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                          {activeSlide.ctaText}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <Link
                          to={activeSlide.ctaLink}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 px-4 py-2 sm:px-5 sm:py-2 text-xs sm:text-sm font-bold text-white shadow-lg shadow-red-900/30 hover:shadow-red-600/50 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                          {activeSlide.ctaText}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}

                      <Link
                        to="/search?featured=true"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3.5 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold backdrop-blur-md transition-all hover:border-white/40"
                      >
                        Explore Collection
                      </Link>
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   AI Smart Search
============================================================ */
const SEARCH_TABS = ['Buy', 'Rent', 'PG', 'Commercial', 'Plots', 'Projects'] as const;

const SEARCH_PLACEHOLDERS: Record<(typeof SEARCH_TABS)[number], string[]> = {
  Buy: [
    'Search Apartments in Hyderabad...',
    'Search Villas in Bangalore...',
    'Search 2 & 3 BHK Luxury Flats...',
  ],
  Rent: [
    'Search Rental Apartments in Gachibowli...',
    'Search Furnished Houses for Rent...',
    'Search Flats near Hitec City...',
  ],
  PG: [
    'Search PG & Hostels in Gachibowli...',
    'Search Boys / Girls PG in Bangalore...',
    'Search Luxury Co-Living Spaces in Hyderabad...',
  ],
  Commercial: [
    'Search Commercial Offices in Financial District...',
    'Search Shops & Showrooms for Lease...',
    'Search Warehouses & Industrial Spaces...',
  ],
  Plots: [
    'Search Residential Plots Near ORR...',
    'Search Villa Plots in Jubilee Hills...',
    'Search Gated Community Plots...',
  ],
  Projects: [
    'Search New Launch Projects in Gachibowli...',
    'Search Upcoming Gated Communities...',
    'Search Luxury Builder Projects...',
  ],
};

function useTypingPlaceholder(phrases: string[], active: boolean) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'deleting'>('typing');

  useEffect(() => {
    if (!active) return;
    const current = phrases[phraseIndex % phrases.length];
    let timeout: number;

    if (phase === 'typing') {
      timeout = window.setTimeout(() => {
        if (charCount < current.length) setCharCount((c) => c + 1);
        else setPhase('pausing');
      }, 45);
    } else if (phase === 'pausing') {
      timeout = window.setTimeout(() => setPhase('deleting'), 700);
    } else {
      timeout = window.setTimeout(() => {
        if (charCount > 0) setCharCount((c) => c - 1);
        else {
          setPhase('typing');
          setPhraseIndex((i) => (i + 1) % phrases.length);
        }
      }, 22);
    }
    return () => window.clearTimeout(timeout);
  }, [active, charCount, phase, phraseIndex, phrases]);

  return phrases[phraseIndex % phrases.length].slice(0, charCount);
}

function AISmartSearch() {
  const navigate = useNavigate();
  const toast = useToast();
  const { detectLocation, openPermissionGuide } = useLocationContext();
  const [tab, setTab] = useState<(typeof SEARCH_TABS)[number]>('Buy');
  const [query, setQuery] = useState('');
  const [listening, setListening] = useState(false);
  const [locating, setLocating] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [locationDiscovery, setLocationDiscovery] = useState<LocationDiscoveryResult | null>(null);
  const [propertySuggestions, setPropertySuggestions] = useState<string[]>([]);
  const [isSearchingDiscovery, setIsSearchingDiscovery] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasSuggestions = !!(
    (locationDiscovery && locationDiscovery.categories.length > 0) ||
    propertySuggestions.length > 0
  );

  useClickOutside(
    searchContainerRef,
    () => {
      setLocationDiscovery(null);
      setPropertySuggestions([]);
    },
    hasSuggestions,
  );

  const activePlaceholders = useMemo(() => SEARCH_PLACEHOLDERS[tab] || SEARCH_PLACEHOLDERS.Buy, [tab]);
  const typedPlaceholder = useTypingPlaceholder(activePlaceholders, !query);

  const handleLiveLocation = () => {
    if (!navigator.geolocation) {
      toast.addToast('error', 'Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
            {
              headers: {
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'RealtyNow/1.0 (contact@realtynow.in)',
              },
            }
          );
          const data = await res.json();
          const address = data?.address || {};
          const locality =
            address.suburb ||
            address.neighbourhood ||
            address.residential ||
            address.subdistrict ||
            address.town ||
            address.city_district ||
            '';
          const city =
            address.city ||
            address.town ||
            address.state_district ||
            address.county ||
            '';

          const detectedName = [locality, city].filter(Boolean).join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setQuery(detectedName);
          handleQueryChange(detectedName);
          toast.addToast('success', `Live location detected: ${detectedName}`);
          
          detectLocation().catch(() => {});
        } catch (err) {
          console.warn('Reverse geocoding failed:', err);
          const fallback = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setQuery(fallback);
          toast.addToast('success', `Location coordinates: ${fallback}`);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLocating(false);
        if (err.code === 1) {
          openPermissionGuide();
          toast.addToast('info', 'Please enable location in browser settings, or select your city.');
        } else {
          toast.addToast('error', 'Failed to fetch live location. Please select your city manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const voiceErrorMessage = (code: string): string => {
    if (code === 'not-allowed' || code === 'permission-denied') {
      return 'Microphone access was denied. Please allow microphone access in your browser settings and try again.';
    }
    if (code === 'no-speech') return "Didn't catch that — no speech detected. Please try again.";
    if (code === 'audio-capture') return 'No microphone was found. Please connect a microphone and try again.';
    if (code === 'network') return 'Network error during voice recognition. Please check your connection and try again.';
    return 'Voice search failed. Please try again or type your search instead.';
  };

  const handleVoice = () => {
    if (listening) return;
    const SR = (
      window as unknown as {
        webkitSpeechRecognition?: new () => {
          start: () => void;
          stop: () => void;
          onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void;
          onerror: (e: { error: string }) => void;
          onend: () => void;
          lang: string;
          continuous: boolean;
          interimResults: boolean;
        };
      }
    ).webkitSpeechRecognition;
    if (!SR) {
      toast.addToast('error', 'Voice search is not supported in this browser. Please try Chrome, Edge, or Safari.');
      return;
    }
    setListening(true);
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const spokenText = e.results[0][0].transcript;
      setQuery(spokenText);
      handleQueryChange(spokenText);
      setListening(false);
    };
    rec.onerror = (e) => {
      setListening(false);
      toast.addToast('error', voiceErrorMessage(e.error));
    };
    rec.onend = () => setListening(false);
    rec.start();
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (searchError) setSearchError('');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setLocationDiscovery(null);
      setPropertySuggestions([]);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsSearchingDiscovery(true);
      try {
        const { normalized } = normalizeSearchQuery(trimmed);
        const parsed = parsePropertySearchQuery(trimmed);
        const targetLoc = parsed.location || normalized;

        const purpose = tab === 'Rent' || tab === 'PG' ? 'Rent' : tab === 'Buy' ? 'Sale' : undefined;

        // 1. Fetch Location Category Discovery from live database inventory
        const disc = await fetchLocationCategoryDiscovery(targetLoc, purpose);
        if (disc.categories.length > 0) {
          setLocationDiscovery(disc);
        } else {
          setLocationDiscovery(null);
        }

        // 2. Fetch Top Property Matches
        const { data: propData } = await supabase
          .from('v_properties_search')
          .select('title')
          .or('status.eq.published,status.eq.live,is_live.eq.true')
          .ilike('search_text', `%${normalized}%`)
          .limit(4);

        setPropertySuggestions((propData ?? []).map((p: { title: string }) => p.title));
      } catch {
        // Fallback gracefully
      } finally {
        setIsSearchingDiscovery(false);
      }
    }, 250);
  };

  const handleSelectDiscovery = (locName: string, catType?: CategorySlug) => {
    const params = new URLSearchParams();
    params.set('locality', locName);
    if (catType) {
      params.set('category', catType);
    }
    if (tab === 'Rent') params.set('purpose', 'Rent');
    else if (tab === 'PG') params.set('purpose', 'PG');
    else if (tab === 'Buy') params.set('purpose', 'Sale');
    else if (tab === 'Commercial') params.set('type', 'Commercial');
    else if (tab === 'Plots') params.set('type', 'Plot');
    else if (tab === 'Projects') params.set('category', 'Project');

    setLocationDiscovery(null);
    setPropertySuggestions([]);
    navigate(`/search?${params.toString()}`);
  };

  const handleAISearch = async () => {
    if (aiThinking) return;
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchError('Please enter a location, property name, or search keyword.');
      return;
    }
    setSearchError('');
    setAiThinking(true);
    try {
      const params = new URLSearchParams();
      params.set('q', trimmedQuery);
      if (tab === 'Rent') {
        params.set('purpose', 'Rent');
      } else if (tab === 'PG') {
        params.set('purpose', 'PG');
      } else if (tab === 'Buy') {
        params.set('purpose', 'Sale');
      } else if (tab === 'Commercial') {
        params.set('type', 'Commercial');
      } else if (tab === 'Plots') {
        params.set('type', 'Plot');
      } else if (tab === 'Projects') {
        params.set('category', 'Project');
      }

      setLocationDiscovery(null);
      setPropertySuggestions([]);
      navigate(`/search?${params.toString()}`);
    } catch {
      navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    } finally {
      setAiThinking(false);
    }
  };

  return (
    <div className="container-wide relative z-30 -mt-16 sm:-mt-20 lg:-mt-24">
      <div className="relative mx-auto w-[98%] sm:w-[92%] lg:w-[86%] max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="w-full rounded-3xl sm:rounded-[2.25rem] border border-slate-200/90 bg-white/95 p-4 sm:p-5 shadow-[0_25px_60px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
        >
          {/* Tabs with animated active state */}
          <div className="flex items-center gap-1.5 sm:gap-2 pb-3 border-b border-slate-100 px-1 overflow-x-auto no-scrollbar snap-x">
            {SEARCH_TABS.map((tItem) => (
              <button
                key={tItem}
                onClick={() => {
                  setTab(tItem);
                  if (query.trim()) {
                    handleQueryChange(query);
                  }
                }}
                className={cn(
                  'flex shrink-0 snap-center items-center gap-2 rounded-xl px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer',
                  tab === tItem
                    ? 'bg-gradient-to-r from-red-600 via-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25 scale-[1.02]'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                )}
              >
                {tItem === 'Buy' && <Home className="h-4 w-4" />}
                {tItem === 'Rent' && <KeyRound className="h-4 w-4" />}
                {tItem === 'PG' && <Bed className="h-4 w-4" />}
                {tItem === 'Commercial' && <Building2 className="h-4 w-4" />}
                {tItem === 'Plots' && <LandPlot className="h-4 w-4" />}
                {tItem === 'Projects' && <Layers className="h-4 w-4" />}
                {tItem}
              </button>
            ))}
          </div>

          {/* Main Search Input & Actions */}
          <div ref={searchContainerRef} className="relative flex flex-col md:flex-row items-center gap-3 pt-3">
            <div className="relative w-full flex-1">
              <Search className="pointer-events-none absolute left-4.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAISearch()}
                aria-label="Search properties"
                aria-invalid={!!searchError}
                className={cn(
                  'w-full rounded-2xl border bg-slate-50/80 py-4 pl-12 pr-36 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all',
                  searchError
                    ? 'border-red-400 focus:ring-red-500/30 focus:border-red-500'
                    : 'border-slate-200/90 focus:ring-red-500/30 focus:border-red-400 shadow-inner-xs',
                )}
              />
              {!query && (
                <div className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 text-sm sm:text-base text-slate-400">
                  {typedPlaceholder}
                  <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-red-500 align-middle" />
                </div>
              )}
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                {query && (
                  <button
                    onClick={() => {
                      setQuery('');
                      setLocationDiscovery(null);
                      setPropertySuggestions([]);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
                    title="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={handleVoice}
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-xl transition-all cursor-pointer',
                    listening ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30' : 'text-slate-500 hover:bg-slate-200/70'
                  )}
                  title="Voice Search"
                >
                  <Mic className="h-4.5 w-4.5" />
                </button>
                <button
                  onClick={handleLiveLocation}
                  disabled={locating}
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-xl transition-all cursor-pointer',
                    locating
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-slate-500 hover:bg-slate-200/70 hover:text-red-600'
                  )}
                  title="Detect Live Location"
                >
                  <Navigation className={cn("h-4.5 w-4.5 transition-transform", locating && "animate-spin")} />
                </button>
              </div>

              {/* Location-Aware Discovery Dropdown */}
              <AnimatePresence>
                {hasSuggestions && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute z-50 mt-2 left-0 w-full rounded-2xl border border-slate-200/80 bg-white shadow-2xl overflow-hidden divide-y divide-slate-100 max-h-[380px] overflow-y-auto"
                  >
                    {/* Location Discovery Section */}
                    {locationDiscovery && locationDiscovery.categories.length > 0 && (
                      <div className="p-4 bg-slate-50/80">
                        <div className="flex items-center justify-between px-1 mb-2.5">
                          <button
                            onClick={() => handleSelectDiscovery(locationDiscovery.location)}
                            className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 hover:text-red-600 transition text-left"
                          >
                            <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                            <span>
                              {locationDiscovery.city && locationDiscovery.city.toLowerCase() !== locationDiscovery.location.toLowerCase()
                                ? `${locationDiscovery.location}, ${locationDiscovery.city}`
                                : locationDiscovery.location}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-400">
                              ({locationDiscovery.totalCount} properties)
                            </span>
                          </button>
                          <span className="text-[10px] uppercase font-black tracking-wider text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100">
                            Location Match
                          </span>
                        </div>

                        <p className="text-[11px] font-semibold text-slate-500 px-1 mb-2">
                          Available property types in {locationDiscovery.location}:
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {locationDiscovery.categories.map((cat) => (
                            <button
                              key={cat.type}
                              onClick={() => handleSelectDiscovery(locationDiscovery.location, cat.type)}
                              className="group flex items-center justify-between gap-1.5 p-2.5 rounded-xl border border-slate-200/80 bg-white hover:border-red-400 hover:bg-red-50/40 transition-all text-left shadow-2xs cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm shrink-0">{cat.emoji}</span>
                                <span className="text-xs font-bold text-slate-800 group-hover:text-red-700 truncate">
                                  {cat.label}
                                </span>
                              </div>
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 group-hover:bg-red-100 group-hover:text-red-800 shrink-0">
                                {cat.count}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Matching Property Titles */}
                    {propertySuggestions.length > 0 && (
                      <div className="py-2">
                        <div className="px-4 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Matching Listings
                        </div>
                        {propertySuggestions.map((title) => (
                          <button
                            key={title}
                            onClick={() => {
                              setQuery(title);
                              setLocationDiscovery(null);
                              setPropertySuggestions([]);
                              navigate(`/search?q=${encodeURIComponent(title)}`);
                            }}
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-700 transition text-left cursor-pointer"
                          >
                            <Search className="h-4 w-4 text-slate-400 shrink-0" />
                            <span className="line-clamp-1">{title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={handleAISearch}
              disabled={aiThinking}
              className="w-full md:w-auto rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-rose-600 px-8 py-4 text-sm font-bold text-white shadow-xl shadow-red-500/30 hover:shadow-red-500/50 hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-2.5 shrink-0 cursor-pointer"
            >
              <Sparkles className={cn("h-4.5 w-4.5", aiThinking && "animate-spin")} />
              <span>{aiThinking ? 'AI Analyzing…' : 'Search Properties'}</span>
            </button>
          </div>
          {searchError && (
            <p role="alert" className="mt-2 px-2 text-xs sm:text-sm font-bold text-red-600">
              {searchError}
            </p>
          )}
        </motion.div>

        {/* AI Assistant mascot */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="hidden lg:flex absolute left-full bottom-0 ml-6 xl:ml-10 items-end justify-center shrink-0"
        >
          <img
            src="/robot.png"
            alt="AI Assistant Robot"
            className="h-44 xl:h-52 w-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform cursor-pointer mix-blend-multiply"
            onClick={() => window.dispatchEvent(new CustomEvent('open-ai-assistant'))}
            title="Chat with AI Assistant"
          />
        </motion.div>
      </div>
    </div>
  );
}

/* ============================================================
   Trust Section — Refined Luxury Trust Badges
============================================================ */
function TrustSection() {
  const { t } = useLanguageContext();
  const badges = [
    { icon: BadgeCheck, label: t('home.verifiedProperties', 'Verified Properties'), color: 'text-red-600 bg-red-50' },
    { icon: ShieldCheck, label: t('home.reraApproved', 'RERA Approved'), color: 'text-emerald-600 bg-emerald-50' },
    { icon: Building2, label: t('home.verifiedBuilders', 'Verified Builders'), color: 'text-blue-600 bg-blue-50' },
    { icon: Users, label: t('home.verifiedAgents', 'Verified Agents'), color: 'text-purple-600 bg-purple-50' },
    { icon: Zap, label: t('home.aiVerifiedListings', 'AI Price Valuation'), color: 'text-amber-600 bg-amber-50' },
    { icon: Shield, label: t('home.hundredPercentSecure', '100% Zero Spam'), color: 'text-emerald-600 bg-emerald-50' },
  ];
  return (
    <section className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md py-6 sm:py-8">
      <div className="container-wide">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {badges.map((b) => (
            <motion.div
              key={b.label}
              whileHover={{ scale: 1.03 }}
              className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-3.5 shadow-2xs hover:shadow-sm hover:border-slate-300 transition-all"
            >
              <div className={cn('grid h-9 w-9 place-items-center rounded-xl shrink-0', b.color)}>
                <b.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-slate-800 leading-tight">{b.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Property Categories — Curated Luxury Category Showcase
============================================================ */
import { CATEGORY_LIST } from '../../lib/categories';

function CategoriesSection() {
  const { t } = useLanguageContext();
  const { city } = useLocationContext();

  return (
    <SectionShell
      title={t('home.browseCategory', 'Browse by Category')}
      subtitle={t('home.categorySubtitle', "Discover residential, commercial, and investment opportunities")}
      id="categories"
    >
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 lg:grid-cols-8">
        {CATEGORY_LIST.map((cat, i) => {
          const targetUrl = `/search?category=${encodeURIComponent(cat.slug)}${city ? `&city=${encodeURIComponent(city)}` : ''}`;
          const Icon = cat.icon;
          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.03 }}
              whileHover={{ y: -4 }}
            >
              <Link
                to={targetUrl}
                className="group flex flex-col items-center gap-2.5 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 transition-all shadow-2xs hover:shadow-lg hover:border-red-400/80 cursor-pointer block h-full text-center"
              >
                <div
                  className={cn(
                    'grid h-12 w-12 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-110 shadow-2xs',
                    cat.color,
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-center text-xs font-bold text-slate-800 leading-tight group-hover:text-red-600 transition-colors">
                  {cat.name}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </SectionShell>
  );
}

/* ============================================================
   Featured Properties — Carousel Slider
============================================================ */
function SponsoredPropertiesCarousel() {
  const { t } = useLanguageContext();
  const queryClient = useQueryClient();
  const { cityId } = useLocationContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);

  const { data = [], isLoading } = useQuery({
    queryKey: ['home-featured-properties', cityId],
    queryFn: async () => {
      const campaigns = await fetchPublicCampaigns('FEATURED_PROPERTIES');
      if (campaigns && campaigns.length > 0) return campaigns;
      return await fetchPublicFeaturedProperties();
    },
    staleTime: 1000 * 30, // 30 seconds
  });

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      setScrollProgress(Math.min(100, Math.max(0, (scrollLeft / maxScroll) * 100)));
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, data]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    setTimeout(checkScroll, 350);
  };

  // Realtime subscription for instant updates when admin updates paid campaigns or featured properties
  useEffect(() => {
    const channel = supabase
      .channel('realtime-featured-public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paid_campaigns' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-featured-properties'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paid_campaign_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-featured-properties'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'featured_properties' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-featured-properties'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  if (!isLoading && data.length === 0) return null;

  return (
    <section className="py-12 sm:py-16 bg-white border-y border-slate-100 relative overflow-hidden" id="featured-properties">
      <div className="container-wide">
        {/* Section Header */}
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-red-600">
                <Zap className="h-3 w-3" /> Featured Spotlight
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {t('home.sponsoredTitle', 'Featured Properties')}
            </h2>
            <p className="mt-1 text-sm text-slate-500 max-w-xl">
              {t('home.sponsoredSubtitle', 'Handpicked verified properties with priority visibility across premier locations')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Carousel Navigation Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleScroll('left')}
                disabled={!canScrollLeft}
                aria-label="Previous Featured Properties"
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleScroll('right')}
                disabled={!canScrollRight}
                aria-label="Next Featured Properties"
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <Link
              to="/search?featured=true"
              className="inline-flex items-center gap-1 text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
            >
              {t('common.viewAll', 'View All')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex gap-5 sm:gap-6 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="skeleton h-[380px] w-[285px] sm:w-[320px] rounded-3xl shrink-0"
              />
            ))}
          </div>
        ) : (
          <div>
            {/* Scrollable Track */}
            <div
              ref={scrollRef}
              onScroll={checkScroll}
              className="flex items-stretch gap-5 sm:gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 pt-1 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0"
            >
              {data.map((p) => (
                <div
                  key={p.id}
                  className="snap-start shrink-0 w-[85vw] sm:w-[320px] md:w-[330px] lg:w-[310px] xl:w-[320px]"
                >
                  <HomePropertyCard
                    property={p}
                    badge={{
                      label: 'Featured',
                      className: 'bg-red-600',
                      icon: <Zap className="h-2.5 w-2.5" />,
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Scroll Progress Bar Indicator */}
            {data.length > 3 && (
              <div className="mt-4 flex items-center justify-between px-1">
                <div className="h-1 flex-1 max-w-[120px] sm:max-w-[160px] bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 rounded-full transition-all duration-150"
                    style={{ width: `${Math.max(15, scrollProgress)}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-slate-400">
                  Swipe or use arrows to explore {data.length} featured properties
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ============================================================
   Top Localities in Hyderabad
============================================================ */
const HYDERABAD_RICH_AREAS = [
  { name: 'Jubilee Hills', image: '/localities/villas.png' },
  { name: 'Banjara Hills', image: '/localities/apartments.png' },
  { name: 'Gachibowli', image: '/localities/skyscrapers.png' },
  { name: 'Hitech City', image: '/localities/hitech_city.png' },
  { name: 'Madhapur', image: '/localities/cable_bridge.png' },
  { name: 'Kondapur', image: '/localities/buddha_statue.png' },
  { name: 'Kokapet', image: '/localities/charminar.png' },
  { name: 'Financial Dist', image: '/localities/golconda.png' },
];

function ExploreHyderabad() {
  const activeCityName = 'Hyderabad';

  return (
    <SectionShell
      title="Explore in Hyderabad"
      subtitle="Discover premium properties across Hyderabad's richest localities"
      id="cities"
      action={
        <Link
          to="/hyderabad-localities"
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
        >
          View All <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <div className="mt-4 grid grid-cols-4 gap-4 sm:gap-6 lg:grid-cols-8">
        {HYDERABAD_RICH_AREAS.map((locality, i) => (
          <motion.div
            key={locality.name}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={`/search?city=${encodeURIComponent(activeCityName)}&locality=${encodeURIComponent(locality.name)}`}
              className="group flex flex-col items-center gap-3 text-center"
            >
              <div className="relative h-16 w-16 overflow-hidden rounded-full border-4 border-white bg-navy-50 shadow-lg transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-105 group-hover:shadow-red-500/20 sm:h-24 sm:w-24">
                <img
                  src={locality.image}
                  alt={locality.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-navy-900/10 transition-colors group-hover:bg-transparent" />
              </div>
              <p className="font-display text-[11px] font-bold leading-tight text-navy-800 transition-colors group-hover:text-red-600 sm:text-xs">
                {locality.name}
              </p>
            </Link>
          </motion.div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ============================================================
   AI Features Showcase (Ultra Professional 4-Category Layout)
============================================================ */
const AI_CATEGORIES = [
  {
    category: 'Property Discovery',
    subtitle: 'Find the right property with AI in seconds',
    headerIcon: Search,
    headerColor: 'bg-rose-50 text-rose-500',
    items: [
      {
        title: 'AI Property Search',
        desc: 'Search properties naturally using everyday language.',
        icon: Search,
        bg: 'bg-rose-50 text-rose-500',
      },
      {
        title: 'AI Recommendations',
        desc: 'Personalized property suggestions just for you.',
        icon: Sparkles,
        bg: 'bg-purple-50 text-purple-600',
      },
      {
        title: 'AI Property Comparison',
        desc: 'Compare multiple properties side by side instantly.',
        icon: GitCompare,
        bg: 'bg-sky-50 text-sky-600',
      },
    ],
  },
  {
    category: 'Investment Intelligence',
    subtitle: 'Make smarter investment decisions',
    headerIcon: TrendingUp,
    headerColor: 'bg-emerald-50 text-emerald-600',
    items: [
      {
        title: 'AI Price Prediction',
        desc: 'Predict future property prices with advanced AI models.',
        icon: TrendingUp,
        bg: 'bg-emerald-50 text-emerald-600',
      },
      {
        title: 'AI Rental Yield',
        desc: 'Calculate rental returns and cash flow instantly.',
        icon: Calculator,
        bg: 'bg-amber-50 text-amber-600',
      },
      {
        title: 'AI Market Insights',
        desc: 'Get real-time market trends and investment insights.',
        icon: BarChart3,
        bg: 'bg-fuchsia-50 text-fuchsia-600',
      },
    ],
  },
  {
    category: 'Legal & Finance',
    subtitle: 'Secure and transparent real estate transactions',
    headerIcon: ShieldCheck,
    headerColor: 'bg-indigo-50 text-indigo-600',
    items: [
      {
        title: 'AI Legal Assistant',
        desc: 'Get legal guidance and document insights.',
        icon: Scale,
        bg: 'bg-purple-50 text-purple-600',
      },
      {
        title: 'AI Loan Assistant',
        desc: 'Find the best home loan options for you.',
        icon: Wallet,
        bg: 'bg-teal-50 text-teal-600',
      },
      {
        title: 'AI Fraud Detection',
        desc: 'Detect risky listings and fraudulent activities.',
        icon: Shield,
        bg: 'bg-rose-50 text-rose-600',
      },
    ],
  },
  {
    category: 'Smart Services',
    subtitle: 'AI tools to make your journey effortless',
    headerIcon: Bot,
    headerColor: 'bg-blue-50 text-blue-600',
    items: [
      {
        title: 'AI Chat Assistant',
        desc: '24/7 AI-powered answers to all your queries.',
        icon: MessageCircle,
        bg: 'bg-sky-50 text-sky-600',
      },
      {
        title: 'AI Builder Score',
        desc: 'Check builder credibility and project trust score.',
        icon: Award,
        bg: 'bg-amber-50 text-amber-600',
      },
      {
        title: 'AI Neighborhood Analysis',
        desc: 'Analyze locality, lifestyle and future growth.',
        icon: MapPin,
        bg: 'bg-emerald-50 text-emerald-600',
      },
    ],
  },
];

function AIFeaturesSection() {
  const { t } = useLanguageContext();

  const aiServices = [
    {
      title: t('home.aiSearchTitle', 'AI Property Search'),
      desc: t('home.aiSearchDesc', 'Natural language property search'),
      tab: 'smart-search',
      gradient: 'from-rose-500 to-pink-600',
      shadow: 'shadow-rose-500/30',
      bg: 'bg-rose-50',
      icon: Search,
    },
    {
      title: t('home.aiRecommendationsTitle', 'AI Recommendations'),
      desc: t('home.aiRecommendationsDesc', 'Personalized property picks'),
      tab: 'recommendations',
      gradient: 'from-violet-500 to-purple-600',
      shadow: 'shadow-violet-500/30',
      bg: 'bg-violet-50',
      icon: Sparkles,
    },
    {
      title: t('home.aiComparisonTitle', 'Property Comparison'),
      desc: t('home.aiComparisonDesc', 'Side-by-side AI comparison'),
      tab: 'assistant',
      gradient: 'from-sky-500 to-blue-600',
      shadow: 'shadow-sky-500/30',
      bg: 'bg-sky-50',
      icon: GitCompare,
    },
    {
      title: t('home.aiChatAssistantTitle', 'AI Chat Assistant'),
      desc: t('home.aiChatAssistantDesc', '24/7 AI-powered answers'),
      tab: 'assistant',
      gradient: 'from-cyan-500 to-teal-600',
      shadow: 'shadow-cyan-500/30',
      bg: 'bg-cyan-50',
      icon: MessageCircle,
    },
    {
      title: t('home.aiBuilderScoreTitle', 'Builder Score'),
      desc: t('home.aiBuilderScoreDesc', 'Builder credibility check'),
      tab: 'market',
      gradient: 'from-amber-500 to-orange-500',
      shadow: 'shadow-amber-500/30',
      bg: 'bg-amber-50',
      icon: Award,
    },
    {
      title: t('home.aiNeighborhoodTitle', 'Neighborhood AI'),
      desc: t('home.aiNeighborhoodDesc', 'Locality & lifestyle analysis'),
      tab: 'market',
      gradient: 'from-emerald-500 to-green-600',
      shadow: 'shadow-emerald-500/30',
      bg: 'bg-emerald-50',
      icon: MapPin,
    },
  ];

  const categories = [
    {
      category: t('home.smartServicesCategory', 'Smart Services'),
      subtitle: t('home.smartServicesSubtitle', 'AI tools to make your journey effortless'),
      headerIcon: Bot,
      headerColor: 'bg-blue-50 text-blue-600',
      items: [
        {
          title: t('home.aiChatAssistantTitle', 'AI Chat Assistant'),
          desc: t('home.aiChatAssistantDesc', '24/7 AI-powered answers to all your queries.'),
          icon: MessageCircle,
          bg: 'bg-sky-50 text-sky-600',
          tab: 'assistant',
        },
        {
          title: t('home.aiBuilderScoreTitle', 'AI Builder Score'),
          desc: t('home.aiBuilderScoreDesc', 'Check builder credibility and project trust score.'),
          icon: Award,
          bg: 'bg-amber-50 text-amber-600',
          tab: 'market',
        },
        {
          title: t('home.aiNeighborhoodTitle', 'AI Neighborhood Analysis'),
          desc: t('home.aiNeighborhoodDesc', 'Analyze locality, lifestyle and future growth.'),
          icon: MapPin,
          bg: 'bg-emerald-50 text-emerald-600',
          tab: 'market',
        },
      ],
    },
  ];

  return (
    <>
      <section className="py-10 bg-white border-t border-slate-100">
        <div className="container-wide">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {t('home.aiServices', 'AI-Powered Services')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('home.aiServicesSubtitle', 'Explore all AI tools to find, compare and invest smarter')}
              </p>
            </div>
            <Link
              to="/ai-hub"
              className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 group transition-colors"
            >
              <span>{t('common.viewAll', 'View All')}</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Single-Row 6 Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {aiServices.map((svc, i) => (
              <motion.div
                key={svc.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ y: -5, scale: 1.02 }}
              >
                <Link
                  to={`/ai-hub?tab=${svc.tab}`}
                  className="flex flex-col items-center text-center gap-3 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-lg hover:border-slate-200 transition-all group cursor-pointer h-full"
                >
                  {/* 3D-style gradient icon badge */}
                  <div
                    className={`relative h-14 w-14 rounded-2xl bg-gradient-to-br ${svc.gradient} flex items-center justify-center shadow-xl ${svc.shadow} group-hover:scale-110 transition-transform duration-300`}
                    style={{ transform: 'perspective(200px) rotateX(8deg) rotateY(-4deg)' }}
                  >
                    {/* Glossy highlight */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 to-transparent" />
                    <svc.icon className="h-6 w-6 text-white relative z-10 drop-shadow-sm" />
                  </div>

                  <div>
                    <p className="font-bold text-sm text-slate-800 leading-snug line-clamp-2 group-hover:text-red-600 transition-colors">
                      {svc.title}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2 hidden sm:block">
                      {svc.desc}
                    </p>
                  </div>

                  <span className="text-[11px] font-bold text-red-600 group-hover:gap-1.5 flex items-center gap-1 transition-all">
                    Explore <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-50/60 border-y border-slate-100">
        <div className="container-wide">
          <div className="space-y-12">
            {categories.map((cat, catIdx) => (
              <div key={cat.category} className="space-y-4">
                {/* Category Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn('h-10 w-10 rounded-full flex items-center justify-center shadow-sm', cat.headerColor)}
                    >
                      <cat.headerIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-xl text-slate-900 tracking-tight">{cat.category}</h3>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">{cat.subtitle}</p>
                    </div>
                  </div>
                  <Link
                    to="/ai-hub"
                    className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 group transition-colors cursor-pointer"
                  >
                    <span>{t('common.viewAll', 'View All')}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>

                {/* 3 Grid Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {cat.items.map((item, itemIdx) => (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: (catIdx * 3 + itemIdx) * 0.04 }}
                      whileHover={{ y: -4 }}
                      className="block"
                    >
                      <Link
                        to={`/ai-hub?tab=${item.tab}`}
                        className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-sm hover:shadow-md transition-all flex items-start gap-4 cursor-pointer group h-full"
                      >
                        <div
                          className={cn(
                            'h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105',
                            item.bg,
                          )}
                        >
                          <item.icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-display font-bold text-slate-900 text-base leading-snug">{item.title}</h4>
                          <p className="text-slate-500 text-xs mt-1 leading-relaxed line-clamp-2">{item.desc}</p>
                          <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-red-600 group-hover:text-red-700">
                            <span>{t('common.explore', 'Explore')}</span>
                            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/* ============================================================
   Signature Collection (Luxury)
============================================================ */
function SignatureCollection() {
  const { t } = useLanguageContext();
  const { cityId } = useLocationContext();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['home-luxury', cityId],
    queryFn: async () => {
      // First check Paid Campaign SIGNATURE_COLLECTION items
      const campaigns = await fetchPublicCampaigns('SIGNATURE_COLLECTION');
      if (campaigns && campaigns.length > 0) {
        return campaigns;
      }

      const fetchLuxury = async (scopeToCity: boolean) => {
        let q = supabase
          .from('v_properties_search')
          .select('*')
          .or('status.eq.published,status.eq.live,is_live.eq.true')
          .eq('is_luxury', true);
        if (scopeToCity && cityId) q = q.eq('city_id', cityId);
        const { data } = await q.order('price', { ascending: false }).limit(20);
        return data ?? [];
      };

      let rows = await fetchLuxury(true);
      if (rows.length === 0 && cityId) {
        rows = await fetchLuxury(false);
      }

      return rows.map((p) => {
        const r = p as unknown as {
          cities?: { name: string };
          localities?: { name: string };
          property_types?: { name: string };
        };
        return {
          ...p,
          city_name: r.cities?.name ?? null,
          locality_name: r.localities?.name ?? null,
          property_type_name: r.property_types?.name ?? null,
        };
      });
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('public:signature-collection-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paid_campaigns' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-luxury'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paid_campaign_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-luxury'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { align: 'start', loop: true, slidesToScroll: 1 },
    [Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true })],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', () => {
      setScrollSnaps(emblaApi.scrollSnapList());
      onSelect();
    });
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  if (!data || data.length === 0) return null;

  return (
    <section className="my-10 sm:my-16 w-full bg-slate-950 text-white py-16 sm:py-24 overflow-hidden relative border-y border-white/10" id="signature-collection">
      {/* Cinematic Luxury Background Accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-[30%] -right-[10%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[130px]" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-red-600/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>
      
      <div className="container-wide relative z-10">
        {/* Header Section */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-400/10 text-amber-300 border border-amber-400/30 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Signature Collection
              </span>
              <span className="text-xs font-bold text-white/50">Curated Haute Living</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Signature Collection
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-300 font-normal max-w-xl">
              Ultra Luxury Homes for the Discerning Buyer — Bespoke penthouses, golf estates, and signature villas.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Link 
              to="/search?is_luxury=true" 
              className="group inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 hover:border-amber-400/50 backdrop-blur-md transition-all shadow-xl"
            >
              <span>Explore Signature Portfolio</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 text-amber-400" />
            </Link>
          </motion.div>
        </div>

        {/* Carousel Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative"
        >
          {/* Embla Viewport */}
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-5">
              {data.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  whileHover={{ y: -6 }}
                  className="relative min-w-0 flex-[0_0_88%] sm:flex-[0_0_calc(50%-10px)] lg:flex-[0_0_calc(33.333%-14px)] xl:flex-[0_0_calc(25%-15px)]"
                >
                  <HomePropertyCard
                    property={p}
                    badge={{
                      label: 'Signature',
                      className: 'bg-black/80 text-amber-300 border border-amber-500/40 backdrop-blur-md',
                      icon: <Sparkles className="h-2.5 w-2.5 text-amber-400" />,
                    }}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Navigation Controls */}
          {data.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  scrollPrev();
                }}
                className="absolute -left-4 top-[40%] -translate-y-1/2 z-30 hidden lg:flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/90 border border-white/20 shadow-2xl text-white transition-all hover:scale-110 hover:bg-white hover:text-slate-900 active:scale-95 cursor-pointer backdrop-blur-md"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  scrollNext();
                }}
                className="absolute -right-4 top-[40%] -translate-y-1/2 z-30 hidden lg:flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/90 border border-white/20 shadow-2xl text-white transition-all hover:scale-110 hover:bg-white hover:text-slate-900 active:scale-95 cursor-pointer backdrop-blur-md"
                aria-label="Next slide"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Pagination Dots */}
          {scrollSnaps.length > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              {scrollSnaps.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => emblaApi && emblaApi.scrollTo(i)}
                  className={`h-2 transition-all duration-300 rounded-full cursor-pointer ${i === selectedIndex ? 'w-8 bg-amber-400' : 'w-2 bg-white/20 hover:bg-white/40'}`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          )}

        </motion.div>
      </div>
    </section>
  );
}

/* ============================================================
   Explore Builders on RealtyNow Section
============================================================ */
const BUILDER_COVER_FALLBACKS = [
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80',
];

function ExploreBuildersSection() {
  const { t } = useLanguageContext();
  const queryClient = useQueryClient();

  const {
    data: builders,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['home-explore-builders-realtynow'],
    queryFn: async () => {
      // First check Paid Campaign EXPLORE_BUILDERS items
      const campaigns = await fetchPublicCampaigns('EXPLORE_BUILDERS');
      if (campaigns && campaigns.length > 0) {
        return campaigns.map((c, i) => ({
          id: c.builder?.id || c.id,
          name: c.title || c.builder?.name || 'Verified Builder',
          description: c.subtitle || c.builder?.description || '',
          logo_url: c.builder?.logo_url || null,
          cover_image: c.image || c.builder?.cover_image || BUILDER_COVER_FALLBACKS[i % BUILDER_COVER_FALLBACKS.length],
          _cover: c.image || c.builder?.cover_image || BUILDER_COVER_FALLBACKS[i % BUILDER_COVER_FALLBACKS.length],
          _location: c.builder?.city_name || 'Hyderabad',
          _projectCount: 1,
          _propertyCount: 1,
          cta_text: c.cta || 'View Builder',
          cta_link: c.link || `/builders/${c.builder?.id || c.id}`,
        }));
      }

      const { data, error } = await supabase
        .from('builders')
        .select('*, cities:city_id(name), localities:locality_id(name)')
        .eq('status', 'approved')
        .eq('public_visible', true)
        .order('is_featured', { ascending: false })
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;

      const builderRows = (data ?? []) as any[];
      const ids = builderRows.map((b) => b.id);
      const userIds = builderRows.map((b) => b.user_id).filter(Boolean);

      const projectCounts = new Map<string, number>();
      const propertyCounts = new Map<string, number>();

      if (ids.length > 0) {
        // Fetch projects count per builder
        const { data: projectRows } = await supabase
          .from('projects')
          .select('builder_id')
          .in('builder_id', ids);

        (projectRows ?? []).forEach((p: { builder_id: string }) => {
          projectCounts.set(p.builder_id, (projectCounts.get(p.builder_id) ?? 0) + 1);
        });

        // Also check builder_projects linked by user_id
        if (userIds.length > 0) {
          const { data: bpRows } = await supabase
            .from('builder_projects')
            .select('builder_id')
            .in('builder_id', userIds);

          (bpRows ?? []).forEach((p: { builder_id: string }) => {
            const b = builderRows.find((x) => x.user_id === p.builder_id);
            if (b) {
              projectCounts.set(b.id, (projectCounts.get(b.id) ?? 0) + 1);
            }
          });
        }

        // Fetch properties count linked by builder_id or owner_id
        const orFilter = [
          ids.length ? `builder_id.in.(${ids.join(',')})` : '',
          userIds.length ? `owner_id.in.(${userIds.join(',')})` : '',
        ]
          .filter(Boolean)
          .join(',');

        if (orFilter) {
          const { data: propRows } = await supabase
            .from('properties')
            .select('builder_id, owner_id')
            .or(orFilter);

          (propRows ?? []).forEach((p: { builder_id: string | null; owner_id: string | null }) => {
            if (p.builder_id) {
              propertyCounts.set(p.builder_id, (propertyCounts.get(p.builder_id) ?? 0) + 1);
            } else if (p.owner_id) {
              const b = builderRows.find((x) => x.user_id === p.owner_id);
              if (b) {
                propertyCounts.set(b.id, (propertyCounts.get(b.id) ?? 0) + 1);
              }
            }
          });
        }
      }

      return builderRows.map((b, i) => {
        const locParts = [b.localities?.name, b.cities?.name].filter(Boolean);
        return {
          ...b,
          _location: locParts.length > 0 ? locParts.join(', ') : '',
          _projectCount: projectCounts.get(b.id) ?? 0,
          _propertyCount: propertyCounts.get(b.id) ?? 0,
          _cover: b.cover_image || BUILDER_COVER_FALLBACKS[i % BUILDER_COVER_FALLBACKS.length],
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    // Realtime synchronization with paid_campaigns and builders table
    const channel = supabase
      .channel('public:explore-builders-realtynow-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paid_campaigns' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-explore-builders-realtynow'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paid_campaign_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-explore-builders-realtynow'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'builders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-explore-builders-realtynow'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { align: 'start', loop: false, containScroll: 'trimSnaps' },
    [Autoplay({ delay: 6000, stopOnInteraction: true, stopOnMouseEnter: true })],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', () => setSelectedIndex(emblaApi.selectedScrollSnap()));
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  return (
    <section className="py-14 sm:py-20 bg-slate-50/70 border-y border-slate-200/80" id="explore-builders">
      <div className="container-wide">
        {/* Section Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
                {t('home:exploreBuildersTitle', 'Explore Builders on RealtyNow')}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200/60 shadow-2xs">
                <BadgeCheck className="h-3.5 w-3.5" /> {t('home:verifiedBuilder', 'Verified Builder')}
              </span>
            </div>
            <p className="text-sm sm:text-base text-slate-500 max-w-2xl">
              {t(
                'home:exploreBuildersSubtitle',
                'Discover trusted builders, explore their projects, and find your next property with confidence.',
              )}
            </p>
          </div>
          <Link
            to="/builders"
            className="group inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-red-600 bg-white hover:bg-red-600 hover:text-white border border-red-200/80 transition-all duration-200 shadow-2xs shrink-0 self-start sm:self-end"
          >
            <span>{t('home:viewAllBuilders', 'View All Builders')}</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="skeleton h-[360px] rounded-3xl border border-slate-200/60 bg-slate-100"
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {isError && !isLoading && (
          <div className="rounded-3xl border border-red-200 bg-red-50/50 p-8 text-center max-w-lg mx-auto">
            <p className="text-sm font-bold text-red-800 mb-3">
              {t('home:unableToLoadBuilders', 'Unable to load builders right now.')}
            </p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold shadow-md hover:bg-red-700 transition cursor-pointer"
            >
              {t('common:retry', 'Retry')}
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && (!builders || builders.length === 0) && (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center max-w-lg mx-auto shadow-xs">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <Building2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {t('home:noBuildersAvailable', 'No builders available at the moment.')}
            </p>
          </div>
        )}

        {/* Success State with Carousel / Responsive Layout */}
        {!isLoading && !isError && builders && builders.length > 0 && (
          <div className="relative">
            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex gap-5">
                {builders.map((b, i) => (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05, duration: 0.4 }}
                    className="min-w-0 flex-[0_0_88%] sm:flex-[0_0_calc(50%-10px)] lg:flex-[0_0_calc(25%-15px)]"
                  >
                    <Link
                      to={`/builders/${b.id}`}
                      className="group flex flex-col justify-between h-full overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                    >
                      {/* Cover image & Floating Logo */}
                      <div className="relative h-44 overflow-hidden bg-slate-100">
                        <img
                          src={b._cover}
                          alt={b.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-emerald-700 shadow-sm border border-emerald-100">
                          <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /> Verified
                        </span>

                        <div className="absolute -bottom-6 left-5 h-14 w-14 rounded-2xl bg-white border-2 border-white shadow-md grid place-items-center overflow-hidden ring-1 ring-slate-200/80">
                          {b.logo_url ? (
                            <img
                              src={b.logo_url}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-navy-900 text-sm">
                              {b.name ? b.name.charAt(0).toUpperCase() : <Building2 className="h-6 w-6 text-navy-400" />}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Content Area */}
                      <div className="pt-8 pb-5 px-5 flex flex-col flex-1 justify-between">
                        <div>
                          <h3 className="font-display font-bold text-navy-900 text-lg group-hover:text-red-600 transition-colors line-clamp-1">
                            {b.name}
                          </h3>

                          {b._location && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 font-medium truncate">
                              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{b._location}</span>
                            </p>
                          )}

                          {b.description && (
                            <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {b.description}
                            </p>
                          )}

                          {/* Stats Pills */}
                          <div className="mt-3.5 flex flex-wrap items-center gap-1.5 text-xs">
                            {b._projectCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-navy-900 font-bold text-[11px]">
                                <Building2 className="h-3 w-3 text-slate-500" />
                                {b._projectCount} {t('home:projects', 'Projects')}
                              </span>
                            )}
                            {b._propertyCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-bold text-[11px] border border-red-100/60">
                                <Home className="h-3 w-3 text-red-500" />
                                {b._propertyCount} {t('home:properties', 'Properties')}
                              </span>
                            )}
                            {b.established_year && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold text-[11px] border border-amber-100/60">
                                <Award className="h-3 w-3 text-amber-500" />
                                {new Date().getFullYear() - b.established_year}+ Yrs
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card CTA */}
                        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-bold text-red-600 group-hover:text-red-700 inline-flex items-center gap-1.5">
                            {t('home:viewBuilder', 'View Builder')}{' '}
                            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Desktop Navigation Arrows */}
            {builders.length > 4 && (
              <>
                <button
                  onClick={scrollPrev}
                  className="absolute left-[-18px] top-[40%] -translate-y-1/2 z-20 hidden lg:flex h-11 w-11 items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-700 transition-all hover:scale-105 hover:text-red-600 cursor-pointer"
                  aria-label="Previous builder"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={scrollNext}
                  className="absolute right-[-18px] top-[40%] -translate-y-1/2 z-20 hidden lg:flex h-11 w-11 items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-700 transition-all hover:scale-105 hover:text-red-600 cursor-pointer"
                  aria-label="Next builder"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}

            {/* Mobile / Tablet Pagination Dots */}
            {builders.length > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2 lg:hidden">
                {builders.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => emblaApi && emblaApi.scrollTo(i)}
                    className={`h-1.5 rounded-full transition-all ${i === selectedIndex ? 'w-6 bg-red-600' : 'w-1.5 bg-slate-300'}`}
                    aria-label={`Go to builder ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ============================================================
   Top Agents
============================================================ */
function TopAgents() {
  const { t } = useLanguageContext();
  const { data: agents } = useQuery({
    queryKey: ['home-agents'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, avatar_url, bio, company, specialization')
        .eq('role', 'agent')
        .eq('status', 'active')
        .limit(8);
      return data ?? [];
    },
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeft(scrollLeft > 0);
      setShowRight(Math.ceil(scrollLeft) < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll);
      return () => {};
    }
  }, [agents]);

  if (!agents || agents.length === 0) return null;

  return (
    <section className="py-10 bg-white overflow-hidden" id="agents">
      <div className="container-wide relative">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
                {t('home.topAgents', 'Top Agents')}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-semibold text-red-600 border border-red-100">
                <ShieldCheck className="h-3 w-3" />
                Verified Real Estate Experts
              </span>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm">
              {t('home.connectExperts', 'Connect with trusted real estate experts')}
            </p>
          </div>
          <Link
            to="/agents"
            className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
          >
            View All Agents <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {agents.map((a, i) => {
            const badges = ['TOP RATED', 'RISING STAR', 'EXPERT', 'TOP PERFORMER'];
            const badge = badges[i % badges.length];
            const badgeColors: Record<string, string> = {
              'TOP RATED': 'text-red-600 bg-red-50 border-red-100',
              'RISING STAR': 'text-blue-600 bg-blue-50 border-blue-100',
              'EXPERT': 'text-emerald-600 bg-emerald-50 border-emerald-100',
              'TOP PERFORMER': 'text-amber-600 bg-amber-50 border-amber-100',
            };
            const avatarGrads = [
              'from-red-500 to-rose-600',
              'from-blue-500 to-indigo-600',
              'from-emerald-500 to-teal-600',
              'from-amber-500 to-orange-500',
            ];

            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -3 }}
                className="flex items-center gap-3 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.09)] transition-all p-3.5"
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  {a.avatar_url ? (
                    <img
                      src={a.avatar_url}
                      alt={(a.first_name ?? '') + ' ' + (a.last_name ?? '')}
                      className="h-12 w-12 rounded-xl object-cover border-2 border-white shadow"
                    />
                  ) : (
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${avatarGrads[i % avatarGrads.length]} text-white flex items-center justify-center text-lg font-bold shadow`}>
                      {a.first_name?.[0] ?? 'A'}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h3 className="font-display font-bold text-[13px] text-slate-900 leading-tight truncate">
                      {a.first_name} {a.last_name}
                    </h3>
                    <span className={`shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold border uppercase ${badgeColors[badge]}`}>
                      {badge === 'TOP RATED' && <Star className="h-2 w-2" />}
                      {badge === 'RISING STAR' && <TrendingUp className="h-2 w-2" />}
                      {badge === 'EXPERT' && <ShieldCheck className="h-2 w-2" />}
                      {badge === 'TOP PERFORMER' && <Award className="h-2 w-2" />}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{a.company || 'Real Estate Agent'}</p>

                  {/* Stars + Stats */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="h-2.5 w-2.5 fill-red-500 text-red-500" />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400">·</span>
                    <span className="text-[10px] font-semibold text-slate-600">{100 + i * 15}+ deals</span>
                    <span className="text-[10px] text-slate-400">·</span>
                    <span className="text-[10px] font-semibold text-slate-600">{5 + i}+ yrs</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <a
                      href={"tel:" + (a.phone ?? '')}
                      className="grid h-6 w-6 place-items-center rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                    >
                      <Phone className="h-3 w-3" />
                    </a>
                    <a
                      href={"https://wa.me/" + (a.phone ?? '')}
                      className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors"
                    >
                      <MessageCircle className="h-3 w-3" />
                    </a>
                    <Link
                      to={"/agents/" + a.id}
                      className="flex-1 h-6 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-800 hover:text-white transition-colors text-[10px] font-bold"
                    >
                      Profile
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   EMI Calculator
============================================================ */
/* ============================================================
   EMI + Testimonials Combined (2-column layout)
============================================================ */
/* ============================================================
   RealtyNow Exclusive Properties (Sponsored Projects & Events)
============================================================ */
function RealtynowExclusiveSection() {
  const { t } = useLanguageContext();
  const { addToast } = useToast();
  const carouselRef = useRef<HTMLDivElement>(null);
  const realtimeTick = useRealtimeCount('cms_exclusive_properties');

  const [enquiryItem, setEnquiryItem] = useState<any | null>(null);
  const [enquiryForm, setEnquiryForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [submittingEnquiry, setSubmittingEnquiry] = useState(false);

  const { data: exclusiveList = [], isLoading } = useQuery({
    queryKey: ['home-exclusive-properties', realtimeTick],
    queryFn: async () => {
      // First check Paid Campaign REALTYNOW_EXCLUSIVE
      const campaigns = await fetchPublicCampaigns('REALTYNOW_EXCLUSIVE');
      if (campaigns && campaigns.length > 0) {
        return campaigns.map((c) => ({
          id: c.id,
          title: c.title,
          subtitle: c.subtitle || '',
          locality: c.subtitle || c.property?.locality_name || 'Hyderabad',
          price_text: c.property?.price ? formatPrice(c.property.price) : 'Price on Request',
          badge_text: c.badge || 'Sponsored Project',
          rera_no: 'RERA Approved',
          image_url: c.image || DEFAULT_PROPERTY_IMAGE,
          cta_text: c.cta || 'Enquire Now',
          cta_link: c.link || '/search',
          sort_order: c.display_order,
        }));
      }

      const { data, error } = await supabase
        .from('cms_exclusive_properties')
        .select('*')
        .eq('is_visible', true)
        .order('sort_order', { ascending: true });

      if (error || !data || data.length === 0) {
        return [
          {
            id: 'ex-1',
            title: 'Crystal Garden',
            subtitle: '3 & 4 BHK Luxury Apartment',
            locality: 'Attapur, Hyderabad',
            price_text: 'Starting at ₹1.29 Cr.',
            badge_text: 'Sponsored Project',
            rera_no: 'Phase 1 P02500004287',
            image_url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
            cta_text: 'Enquire Now',
            cta_link: '/search',
            sort_order: 1,
          },
          {
            id: 'ex-2',
            title: 'Ananda Vihara',
            subtitle: '1 BHK Luxury Service Suite',
            locality: 'Tirupati',
            price_text: 'Price: ₹69 Lakhs Onw.',
            badge_text: 'Vacation Home Ownership',
            rera_no: 'RERA.P10120276492',
            image_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
            cta_text: 'Enquire Now',
            cta_link: '/search',
            sort_order: 2,
          },
          {
            id: 'ex-3',
            title: 'Eternia Benchmark',
            subtitle: '7.5 Acres | 2, 2.5 & 3 BHK Homes',
            locality: 'Bachupally, Hyderabad',
            price_text: '₹1.2 Cr* Onwards',
            badge_text: 'New Benchmark',
            rera_no: 'RERA Approved',
            image_url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
            cta_text: 'Enquire Now',
            cta_link: '/search',
            sort_order: 3,
          },
          {
            id: 'ex-4',
            title: 'DLF Camellias Heights',
            subtitle: '4 & 5 BHK Ultra Luxury Penthouses',
            locality: 'Gachibowli, Hyderabad',
            price_text: '₹3.5 Cr* Onwards',
            badge_text: 'Exclusive Launch',
            rera_no: 'RERA.P02400009821',
            image_url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
            cta_text: 'Enquire Now',
            cta_link: '/search',
            sort_order: 4,
          },
        ];
      }
      return data;
    },
  });

  const scroll = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const amount = 380;
    carouselRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const handleSendEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingEnquiry(true);
    try {
      await supabase.from('crm_leads').insert([
        {
          full_name: enquiryForm.name,
          phone: enquiryForm.phone,
          email: enquiryForm.email,
          notes: `Enquiry for Exclusive Project: ${enquiryItem?.title} (${enquiryItem?.locality}) - ${enquiryForm.message}`,
          source: 'realtynow_exclusive_cms',
          status: 'new',
        },
      ]);
    } catch {
      // Local fallback success
    } finally {
      setSubmittingEnquiry(false);
      addToast('success', `Enquiry sent for ${enquiryItem?.title}! Our relationship manager will contact you shortly.`);
      setEnquiryItem(null);
      setEnquiryForm({ name: '', phone: '', email: '', message: '' });
    }
  };

  return (
    <section className="py-14 bg-slate-50/70 border-t border-b border-slate-200/80" id="exclusive">
      <div className="container-wide">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-red-700">
                <Sparkles className="h-3.5 w-3.5 fill-red-600 text-red-600" /> Featured
              </span>
              <span className="text-xs font-semibold text-slate-500">Curated & Verified Projects</span>
            </div>
            <h2 className="font-display text-2xl font-extrabold text-slate-900 sm:text-3xl tracking-tight">
              RealtyNow Exclusive
            </h2>
            <p className="mt-1 text-sm text-slate-600 font-medium">
              Sponsored projects, premium launches, and exclusive builder events
            </p>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              aria-label="Previous Project"
              className="grid h-10 w-10 place-items-center rounded-xl bg-white border border-slate-200 text-slate-700 shadow-xs transition hover:bg-slate-100 active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              aria-label="Next Project"
              className="grid h-10 w-10 place-items-center rounded-xl bg-white border border-slate-200 text-slate-700 shadow-xs transition hover:bg-slate-100 active:scale-95 cursor-pointer"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Carousel / Cards Row */}
        {isLoading ? (
          <div className="flex gap-5 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-[280px] w-[360px] shrink-0 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div
            ref={carouselRef}
            className="flex gap-5 overflow-x-auto pb-4 pt-1 scrollbar-none snap-x snap-mandatory"
          >
            {exclusiveList.map((item: any, idx: number) => (
              <motion.div
                key={item.id || idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.06 }}
                className="group relative h-[310px] w-[340px] sm:w-[380px] shrink-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-950 shadow-md hover:shadow-xl transition-all duration-300 snap-start flex flex-col justify-between"
              >
                {/* Background Image */}
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80"
                />

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-black/40" />

                {/* Top Header Bar */}
                <div className="relative z-10 flex items-start justify-between p-4">
                  <span className="rounded-lg bg-red-600/90 backdrop-blur-md px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-xs">
                    {item.badge_text || 'Exclusive'}
                  </span>
                  {item.rera_no && (
                    <span className="rounded-lg bg-black/60 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-slate-200 border border-white/10">
                      {item.rera_no}
                    </span>
                  )}
                </div>

                {/* Bottom Content Area */}
                <div className="relative z-10 p-5 space-y-2 text-white">
                  <div>
                    <h3 className="font-display text-xl font-extrabold text-white tracking-tight leading-tight group-hover:text-red-400 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-300 font-medium line-clamp-1 mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                    <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="truncate">{item.locality}</span>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-white/15">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Price</p>
                      <p className="font-display text-base font-extrabold text-amber-400">
                        {item.price_text}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEnquiryItem(item)}
                      className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-orange-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{item.cta_text || 'Enquire Now'}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ENQUIRY MODAL */}
      <AnimatePresence>
        {enquiryItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200"
            >
              <div className="flex items-start justify-between mb-4 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                    Exclusive Project Enquiry
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">{enquiryItem.title}</h3>
                  <p className="text-xs text-slate-500">{enquiryItem.locality} • {enquiryItem.price_text}</p>
                </div>
                <button
                  onClick={() => setEnquiryItem(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSendEnquiry} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Your Full Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="Enter your name"
                    value={enquiryForm.name}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium focus:border-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number *</label>
                  <input
                    required
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={enquiryForm.phone}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium focus:border-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={enquiryForm.email}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium focus:border-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Message / Requirements</label>
                  <textarea
                    rows={2}
                    placeholder="I am interested in floor plans, pricing & site visit..."
                    value={enquiryForm.message}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, message: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEnquiryItem(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingEnquiry}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-md shadow-red-600/20 cursor-pointer"
                  >
                    {submittingEnquiry ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ============================================================
   Latest Blogs & Real Estate Insights — Cute & Compact Cards
============================================================ */
function LatestBlogs() {
  const { t } = useLanguageContext();
  const realtimeTick = useRealtimeCount('blogs');
  const { data = [], isLoading } = useQuery({
    queryKey: ['home-blogs', realtimeTick],
    queryFn: async () => {
      const { data } = await supabase
        .from('blogs')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  return (
    <SectionShell
      title={t('home.latestFromBlog', 'Latest Real Estate Insights')}
      subtitle={t('home.blogSubtitle', 'Smart guides, market intelligence, and expert advice for buyers, sellers, and investors')}
      id="blogs"
      action={
        <Link
          to="/blog"
          className="group inline-flex items-center gap-1.5 text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
        >
          <span>{t('common.allPosts', 'View All Articles')}</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-[320px] rounded-3xl" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 items-stretch">
          {data.map((b: any, i: number) => {
            const dateStr = new Date(b.published_at ?? b.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            const tag = (Array.isArray(b.tags) && b.tags[0]) || 'Market Guide';
            const readTime = b.read_time || '4 min read';

            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="h-full"
              >
                <Link
                  to={`/blog/${b.slug ?? b.id}`}
                  className="group flex flex-col justify-between h-full rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-3 shadow-2xs hover:shadow-xl hover:border-red-200 transition-all duration-300 hover:-translate-y-1"
                >
                  <div>
                    {/* Compact Image with Tag Badge */}
                    <div className="relative h-44 sm:h-48 w-full rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 mb-3">
                      {b.cover_image ? (
                        <img
                          src={b.cover_image}
                          alt={b.title}
                          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-108"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-red-50 to-slate-100 flex items-center justify-center text-slate-300">
                          <Sparkles className="h-8 w-8 text-red-300" />
                        </div>
                      )}

                      {/* Tag Badge */}
                      <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-slate-800 shadow-xs border border-white/40">
                        {tag}
                      </span>
                    </div>

                    {/* Meta Row: Date & Read Time */}
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 mb-1.5 px-0.5">
                      <span>{dateStr}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" /> {readTime}
                      </span>
                    </div>

                    {/* Cute Title */}
                    <h3 className="font-display text-sm sm:text-[15px] font-bold text-slate-900 leading-snug group-hover:text-red-600 transition-colors line-clamp-2 px-0.5">
                      {b.title}
                    </h3>

                    {/* Short Excerpt */}
                    {b.excerpt && (
                      <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed px-0.5">
                        {b.excerpt}
                      </p>
                    )}
                  </div>

                  {/* Cute Footer */}
                  <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-medium text-slate-500 truncate max-w-[140px]">
                      {b.author_name || 'RealtyNow Editorial'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 group-hover:text-red-700 transition">
                      Read <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-sm text-slate-400 py-12">{t('home.noBlogsYet', 'No blog articles published yet.')}</p>
      )}
    </SectionShell>
  );
}

/* ============================================================
   Property Services
============================================================ */
const SERVICES = [
  {
    icon: Wallet,
    name: 'Home Loan Assistance',
    brand: 'Bank Partners',
    link: '/contact?service=Home+Loan+Assistance',
    color: 'bg-primary-50 text-primary-600',
  },
  {
    icon: Ruler,
    name: 'Architecture & Design',
    brand: 'Certified Experts',
    link: '/contact?service=Architecture',
    color: 'bg-success-50 text-success-600',
  },
  {
    icon: Scale,
    name: 'Legal Services',
    brand: 'Legal Desk',
    link: '/contact?service=Legal+Services',
    color: 'bg-primary-50 text-primary-600',
  },
  {
    icon: FileText,
    name: 'Property Registration',
    brand: 'Govt Assistance',
    link: '/contact?service=Property+Registration',
    color: 'bg-secondary-50 text-secondary-600',
  },
  {
    icon: Sun,
    name: 'Solar Installation',
    brand: 'Green Energy',
    link: '/contact?service=Solar+Installation',
    color: 'bg-success-50 text-success-600',
  },
  {
    icon: Shield,
    name: 'Home Insurance',
    brand: 'Protection Plan',
    link: '/contact?service=Home+Insurance',
    color: 'bg-warning-50 text-warning-600',
  },
  {
    icon: Truck,
    name: 'Packers & Movers',
    brand: 'Relocation Services',
    link: '/contact?service=Packers+and+Movers',
    color: 'bg-primary-50 text-primary-600',
  },
  {
    icon: Building2,
    name: 'Property Valuation',
    brand: 'Verified Assessors',
    link: '/contact?service=Property+Valuation',
    color: 'bg-secondary-50 text-secondary-600',
  },
];

/* ============================================================
   Enhanced Services — 4 Premium Cards matching exact UI design
============================================================ */
const ENHANCED_SERVICES = [
  {
    id: 'home-services',
    title: 'Home Services',
    description: 'Professional care for your home, every day.',
    icon: Home,
    image: homeServicesImg,
    link: 'https://kamkaka.com',
    cta: 'Explore Now',
  },
  {
    id: 'interior-services',
    title: 'Interior Services',
    description: 'Designing beautiful spaces that reflect you.',
    icon: PaintBucket,
    image: interiorServicesImg,
    link: 'https://borninteriors.in',
    cta: 'Explore Now',
  },
  {
    id: 'borewell-services',
    title: 'Borewell Services',
    description: 'Deep expertise. Reliable water solutions.',
    icon: Droplets,
    image: borewellServicesImg,
    link: '/borewell-services',
    cta: 'Explore Now',
  },
  {
    id: 'home-loans',
    title: 'Home Loans',
    description: 'Easy financing for your dream home.',
    icon: PieChart,
    image: homeLoansImg,
    link: '/home-loans',
    cta: 'Explore Now',
  },
] as const;

function ServiceCard({ service }: { service: (typeof ENHANCED_SERVICES)[number] }) {
  const Icon = service.icon;
  const isExternal = /^https?:\/\//.test(service.link);

  const content = (
    <div className="group flex flex-row overflow-hidden rounded-[20px] bg-white shadow-sm hover:shadow-xl transition-all duration-300 h-[135px] w-full border border-slate-100">
      {/* Left side: 40% Background Image */}
      <div className="w-[40%] h-full relative overflow-hidden shrink-0">
        <img
          src={service.image}
          alt={service.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </div>

      {/* Right side: 60% White Content */}
      <div className="w-[60%] h-full bg-white p-3 flex flex-col justify-between items-start">
        {/* Top: Icon + Title + Verified */}
        <div className="flex gap-2 sm:gap-2.5 items-center w-full">
          {/* Icon Box */}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#fff0f3] flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#e11d48] stroke-[2]" />
          </div>

          {/* Title and Badge */}
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="font-extrabold text-slate-900 text-[12px] sm:text-[13px] leading-tight tracking-tight truncate">
              {service.title}
            </h3>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-slate-500 text-[8.5px] font-bold uppercase tracking-wider whitespace-nowrap">Verified Service</span>
              <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-[#1d9bf0] text-white shrink-0">
                <Check className="w-2 h-2 stroke-[3]" />
              </span>
            </div>
          </div>
        </div>

        {/* Short Description */}
        <p className="text-[9px] sm:text-[10px] text-slate-500 line-clamp-2 leading-snug w-full mt-1 mb-1">
          {service.description}
        </p>

        {/* Bottom: Button - Small and Cute */}
        <div className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-[#e11d48] px-3 py-1.5 text-white transition-colors hover:bg-red-700 mt-auto">
          <span className="text-[11px] font-bold tracking-wide">{service.cta || 'Explore Now'}</span>
          <div className="rounded-full border-[1.5px] border-white flex items-center justify-center w-3.5 h-3.5 shrink-0">
            <ArrowRight className="h-2 w-2 text-white stroke-[3]" />
          </div>
        </div>
      </div>
    </div>
  );

  return isExternal ? (
    <a href={service.link} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
      {content}
    </a>
  ) : (
    <Link to={service.link} className="block h-full w-full">
      {content}
    </Link>
  );
}


function ServicesSection() {
  const { t } = useLanguageContext();
  return (
    <section className="relative overflow-hidden py-16 sm:py-24 bg-gradient-to-b from-white via-slate-50/70 to-white border-b border-slate-200/80" id="services">
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-red-100/40 blur-3xl" />
        <div className="absolute top-1/2 -right-24 h-96 w-96 rounded-full bg-amber-100/40 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.25]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(15,23,42,0.06) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="container-wide relative z-10">
        {/* Editorial Story Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center mb-12">
          {/* Left Column: Large Architectural Visual & Floating Stat Card */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-5 relative"
          >
            <div className="relative h-[380px] sm:h-[440px] rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80">
              <img
                src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80"
                alt="Luxury living architectural interior"
                className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
              
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <span className="inline-block rounded-full bg-red-600 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md mb-2">
                  The RealtyNow Standard
                </span>
                <h3 className="font-display text-xl sm:text-2xl font-black leading-tight text-white">
                  Crafted for elevated living at every stage.
                </h3>
              </div>
            </div>

            {/* Floating Metric Badge 1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="absolute -bottom-5 -right-3 sm:-right-6 bg-white/95 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-slate-200/80 flex items-center gap-3.5 max-w-[240px]"
            >
              <div className="h-11 w-11 rounded-xl bg-red-50 text-red-600 grid place-items-center shrink-0">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="font-display text-lg font-black text-slate-900 leading-none">10,000+</p>
                <p className="text-[11px] font-semibold text-slate-500 mt-1">Verified Real Estate Properties</p>
              </div>
            </motion.div>

            {/* Floating Metric Badge 2 */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="absolute -top-4 -left-3 sm:-left-6 bg-slate-900/95 backdrop-blur-xl text-white rounded-2xl p-3.5 shadow-xl border border-white/10 flex items-center gap-3 max-w-[220px]"
            >
              <div className="h-9 w-9 rounded-xl bg-amber-400/20 text-amber-300 grid place-items-center shrink-0">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              </div>
              <div>
                <p className="font-display text-base font-black text-white leading-none">4.9 / 5.0</p>
                <p className="text-[10px] font-medium text-slate-300 mt-0.5">Customer Trust Index</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column: Editorial Narrative */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 flex flex-col gap-4"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-red-600 border border-red-200">
                <Sparkles className="h-3.5 w-3.5" /> Holistic Real Estate Ecosystem
              </span>
            </div>

            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
              {t('home.beyondProperty', 'Beyond Property.')}{' '}
              <span className="bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
                {t('home.enhanceLiving', 'We Enhance Your Living.')}
              </span>
            </h2>

            <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
              {t(
                'home.servicesDescription',
                'From verified property title deeds and AI-driven price predictions to bespoke interior styling and competitive home financing, RealtyNow delivers end-to-end luxury living solutions under one unified platform.',
              )}
            </p>

            {/* Quick Pillars */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {[
                { title: 'Zero Brokerage', desc: 'Direct owner & builder listings' },
                { title: 'Verified Titles', desc: '100% legal scrutiny' },
                { title: 'Fast Financing', desc: 'Instant bank approvals' },
              ].map((pill, idx) => (
                <div key={idx} className="rounded-2xl bg-white border border-slate-200/80 p-3.5 shadow-2xs">
                  <p className="text-xs font-bold text-slate-900">{pill.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{pill.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* 4 Enhanced Curated Service Cards in an Editorial Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 pt-4">
          {ENHANCED_SERVICES.map((service, i) => (
            <motion.div
              key={service.id}
              id={service.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="h-full"
            >
              <ServiceCard service={service} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Interior Design & Home Services — Merged into ServicesSection
============================================================ */
// This section has been merged into the unified ServicesSection above
// Keeping component for backwards compatibility
function InteriorAndHomeServicesSection() {
  return null; // Functionality merged into ServicesSection
}

/* ============================================================
   App CTA
============================================================ */
function AppCTA() {
  return <AppShowcase />;
}

/* ============================================================
   Partners
============================================================ */
function PartnersSection() {
  const { t } = useLanguageContext();
  
  const partners = [
    { name: 'HDFC', logo: '/partners/hdfc.svg' },
    { name: 'SBI', logo: '/partners/sbi.svg' },
    { name: 'ICICI', logo: '/partners/icici.svg' },
    { name: 'Axis', logo: '/partners/axis.svg' },
    { name: 'LIC', logo: '/partners/lic.svg' },
    { name: 'Bajaj Finserv', logo: '/partners/bajaj.svg' },
    { name: 'Kotak', logo: '/partners/kotak.svg' },
    { name: 'Yes Bank', logo: '/partners/yesbank.svg' },
  ];

  // Triple the array to ensure smooth infinite scrolling
  const marqueeItems = [...partners, ...partners, ...partners];

  return (
    <section className="border-y border-slate-200/80 bg-white py-14 overflow-hidden">
      <div className="container-wide">
        <div className="text-center mb-8">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            Trusted Financial Institutions
          </span>
          <h3 className="font-display text-lg font-bold text-slate-700 mt-1">
            {t('home.bankingPartners', 'Our Banking & Insurance Partners')}
          </h3>
        </div>
        
        {/* Marquee Container */}
        <div className="relative flex overflow-hidden">
          {/* Gradient Masks for smooth fade at edges */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

          <motion.div
            className="flex items-center gap-20 sm:gap-28"
            animate={{ x: ['0%', '-33.333333%'] }}
            transition={{ 
              duration: 28, 
              ease: 'linear', 
              repeat: Infinity 
            }}
          >
            {marqueeItems.map((p, i) => (
              <div key={`${p.name}-${i}`} className="shrink-0 w-36 sm:w-44 flex justify-center">
                <img 
                  src={p.logo} 
                  alt={p.name} 
                  className="h-10 sm:h-12 w-auto object-contain grayscale opacity-60 hover:grayscale-0 hover:opacity-100 hover:scale-105 transition-all duration-300 cursor-pointer" 
                />
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Final CTA — Cinematic Luxury Closing Statement
============================================================ */
function FinalCTA() {
  const { t } = useLanguageContext();
  return (
    <section className="py-16 sm:py-24 bg-slate-950 text-white relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-red-600/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-amber-500/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      <div className="container-wide relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-900 to-black border border-white/10 px-8 py-16 sm:py-20 text-center shadow-2xl"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 px-4 py-1 text-xs font-black uppercase tracking-wider mb-4">
            <Sparkles className="h-3.5 w-3.5" /> Start Your Journey
          </span>

          <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight max-w-3xl mx-auto leading-[1.1]">
            Your Next Address Starts Here.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
            {t(
              'home.joinThousands',
              "Discover prime residential and commercial properties with AI price predictions, verified RERA legal titles, and direct developer access.",
            )}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/search"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 hover:bg-red-700 px-8 py-4 text-base font-bold text-white shadow-xl shadow-red-600/30 hover:scale-105 active:scale-95 transition-all"
            >
              <span>Explore Marketplace</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            
            <PostPropertyLink 
              to="/portal/list-property"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur-md px-8 py-4 text-base font-bold text-white transition-all active:scale-95"
            >
              <span>{t('forms.postProperty', 'Post a Property')}</span>
            </PostPropertyLink>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================================
   Section Shell (reusable wrapper)
============================================================ */
function SectionShell({
  title,
  subtitle,
  children,
  id,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  id?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="py-8 sm:py-10" id={id}>
      <div className="container-wide">
        <div className="mb-5 sm:mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display text-2xl font-extrabold text-slate-900 sm:text-3xl tracking-tight"
            >
              {title}
            </motion.h2>
            {subtitle && (
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="mt-1 text-xs sm:text-sm text-slate-500"
              >
                {subtitle}
              </motion.p>
            )}
          </div>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

/* ============================================================
   Luxury Paid Ad Banners (2 Column)
============================================================ */
function LuxuryAdBannersSection() {
  const { t } = useLanguageContext();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const fallbackBanners = [
    {
      id: 'luxury-ad-1',
      title: 'Ultra-Luxury Penthouses in South Mumbai',
      subtitle: 'Starting from ₹15 Cr',
      cta: 'View Collection',
      image: 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg',
      link: '/search?city=Mumbai&category=Apartment',
      tag: 'Sponsored',
    },
    {
      id: 'luxury-ad-2',
      title: 'Premium Golf Course Villas in Gurugram',
      subtitle: 'Limited Edition Estates',
      cta: 'Explore Villas',
      image: 'https://images.pexels.com/photos/1732414/pexels-photo-1732414.jpeg',
      link: '/search?city=Gurugram&category=Villa',
      tag: 'Exclusive',
    },
    {
      id: 'luxury-ad-3',
      title: 'Sea-Facing Mansions in Goa',
      subtitle: 'Private Beach Access',
      cta: 'Discover More',
      image: 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg',
      link: '/search?category=Villa',
      tag: 'Premium',
    },
    {
      id: 'luxury-ad-4',
      title: 'Modern High-Rise Apartments in Bengaluru',
      subtitle: 'Smart Homes & Helipad',
      cta: 'View Apartments',
      image: 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg',
      link: '/search?city=Bengaluru&category=Apartment',
      tag: 'Trending',
    },
  ];

  const { data: banners = fallbackBanners } = useQuery({
    queryKey: ['home-two-column-slider'],
    queryFn: async () => {
      const campaigns = await fetchPublicCampaigns('TWO_COLUMN_SLIDER');
      if (campaigns && campaigns.length > 0) {
        return campaigns.map((c) => ({
          id: c.id,
          title: c.title,
          subtitle: c.subtitle || '',
          cta: c.cta || 'Discover More',
          image: c.image || DEFAULT_PROPERTY_IMAGE,
          link: c.link || '/search',
          tag: c.tag || 'Sponsored',
        }));
      }
      return fallbackBanners;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('public:two-column-slider-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paid_campaigns' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-two-column-slider'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paid_campaign_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-two-column-slider'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Auto scroll effect
  useEffect(() => {
    const timer = setInterval(() => {
      if (!scrollRef.current) return;
      const el = scrollRef.current;
      const isMobile = window.innerWidth < 768;
      const itemWidth = isMobile ? el.clientWidth : el.clientWidth / 2;
      const maxScroll = el.scrollWidth - el.clientWidth;

      let targetScroll = el.scrollLeft + itemWidth;

      if (targetScroll > maxScroll + 10) {
        targetScroll = 0;
      }

      el.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleNext = () => {
    if (!scrollRef.current) return;
    const itemWidth = window.innerWidth < 768 ? scrollRef.current.clientWidth : scrollRef.current.clientWidth / 2;
    scrollRef.current.scrollBy({ left: itemWidth, behavior: 'smooth' });
  };

  const handlePrev = () => {
    if (!scrollRef.current) return;
    const itemWidth = window.innerWidth < 768 ? scrollRef.current.clientWidth : scrollRef.current.clientWidth / 2;
    scrollRef.current.scrollBy({ left: -itemWidth, behavior: 'smooth' });
  };

  if (!banners || banners.length === 0) return null;

  return (
    <section className="py-12 sm:py-16 bg-slate-50/50" id="two-column-slider">
      <div className="container-wide relative group/section">
        {/* Section Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Two Column Slider Properties
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Curated luxury residential and villa developments with exclusive benefits
            </p>
          </div>
          <Link
            to="/search"
            className="inline-flex items-center gap-1 text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={handlePrev}
          className="absolute -left-3 sm:-left-6 top-[55%] -translate-y-1/2 z-20 grid h-12 w-12 place-items-center rounded-full bg-white/80 text-slate-800 backdrop-blur-md shadow-lg border border-slate-200 hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover/section:opacity-100 scale-90 group-hover/section:scale-100 cursor-pointer hidden sm:grid"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <button
          onClick={handleNext}
          className="absolute -right-3 sm:-right-6 top-[55%] -translate-y-1/2 z-20 grid h-12 w-12 place-items-center rounded-full bg-white/80 text-slate-800 backdrop-blur-md shadow-lg border border-slate-200 hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover/section:opacity-100 scale-90 group-hover/section:scale-100 cursor-pointer hidden sm:grid"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 pt-2 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {banners.map((ad: any, i: number) => (
            <motion.div
              key={ad.id || i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative overflow-hidden rounded-3xl h-[320px] shadow-xl group border border-slate-200/60 shrink-0 w-[calc(100%-8px)] md:w-[calc(50%-12px)] snap-start cursor-pointer"
            >
              <Link to={ad.link} className="block h-full w-full relative">
                <img
                  src={ad.image}
                  alt={ad.title}
                  onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                <div className="absolute top-4 left-4 z-10">
                  <span className="bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-sm shadow-md">
                    {ad.tag}
                  </span>
                </div>

                <div className="absolute bottom-6 left-6 right-6 flex flex-col items-start gap-2 z-10">
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white leading-tight drop-shadow-md group-hover:text-amber-300 transition-colors">
                    {ad.title}
                  </h3>
                  <p className="text-sm font-semibold text-amber-400 drop-shadow-md">
                    {ad.subtitle}
                  </p>
                  <span
                    className="mt-2 inline-flex items-center gap-2 bg-white/20 group-hover:bg-red-600 text-white backdrop-blur-md border border-white/40 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-xl group-hover:scale-105"
                  >
                    {ad.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Three Column Paid Ad Banners
============================================================ */
function ThreeColumnAdBannersSection() {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const fallbackBanners = [
    {
      id: 'paid-ad-1',
      title: 'Smart Homes by TechBuilders',
      subtitle: 'Move-in ready with Alexa',
      cta: 'View Details',
      image: 'https://images.pexels.com/photos/259950/pexels-photo-259950.jpeg',
      link: '/search?q=Smart+Homes&type=Apartment',
      tag: 'Featured',
    },
    {
      id: 'paid-ad-2',
      title: 'City Center Commercial Spaces',
      subtitle: 'High Footfall Areas',
      cta: 'Explore Spaces',
      image: 'https://images.pexels.com/photos/269077/pexels-photo-269077.jpeg',
      link: '/search?category=Commercial',
      tag: 'Ad',
    },
    {
      id: 'paid-ad-3',
      title: 'Lakeview Residential Plots',
      subtitle: 'Build your dream home',
      cta: 'See Plots',
      image: 'https://images.pexels.com/photos/2104152/pexels-photo-2104152.jpeg',
      link: '/search?category=Plot',
      tag: 'Sponsored',
    },
    {
      id: 'paid-ad-4',
      title: 'Luxury Villas in Prime Locations',
      subtitle: 'Zero Brokerage Fees',
      cta: 'View Villas',
      image: 'https://images.pexels.com/photos/208736/pexels-photo-208736.jpeg',
      link: '/search?category=Villa',
      tag: 'Hot Deal',
    },
  ];

  const { data: banners = fallbackBanners } = useQuery({
    queryKey: ['home-three-column-banners'],
    queryFn: async () => {
      const campaigns = await fetchPublicCampaigns('THREE_COLUMN_PROPERTIES');
      if (campaigns && campaigns.length > 0) {
        return campaigns.map((c) => ({
          id: c.id,
          title: c.title,
          subtitle: c.subtitle || '',
          cta: c.cta || 'View Details',
          image: c.image || DEFAULT_PROPERTY_IMAGE,
          link: c.link || '/search',
          tag: c.tag || 'Featured',
        }));
      }
      return fallbackBanners;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('public:three-column-banners-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paid_campaigns' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-three-column-banners'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paid_campaign_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-three-column-banners'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
  
  // Auto scroll effect
  useEffect(() => {
    const timer = setInterval(() => {
      if (!scrollRef.current) return;
      const el = scrollRef.current;
      const isMobile = window.innerWidth < 768;
      const isTablet = window.innerWidth < 1024;
      const itemWidth = isMobile ? el.clientWidth : isTablet ? el.clientWidth / 2 : el.clientWidth / 3;
      const maxScroll = el.scrollWidth - el.clientWidth;

      let targetScroll = el.scrollLeft + itemWidth;

      if (targetScroll > maxScroll + 10) {
        targetScroll = 0;
      }

      el.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const handleNext = () => {
    if (!scrollRef.current) return;
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth < 1024;
    const itemWidth = isMobile ? scrollRef.current.clientWidth : isTablet ? scrollRef.current.clientWidth / 2 : scrollRef.current.clientWidth / 3;
    scrollRef.current.scrollBy({ left: itemWidth, behavior: 'smooth' });
  };

  const handlePrev = () => {
    if (!scrollRef.current) return;
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth < 1024;
    const itemWidth = isMobile ? scrollRef.current.clientWidth : isTablet ? scrollRef.current.clientWidth / 2 : scrollRef.current.clientWidth / 3;
    scrollRef.current.scrollBy({ left: -itemWidth, behavior: 'smooth' });
  };

  return (
    <section className="py-12 sm:py-16 bg-slate-50 border-t border-slate-100" id="three-column-properties">
      <div className="container-wide relative group/section">
        {/* Section Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Three Column Properties
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Smart homes, commercial spaces, and curated investment opportunities
            </p>
          </div>
          <Link
            to="/search"
            className="inline-flex items-center gap-1 text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        
        {/* Navigation Arrows */}
        <button
          onClick={handlePrev}
          className="absolute -left-3 sm:-left-6 top-[55%] -translate-y-1/2 z-20 grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-full bg-white/80 text-slate-800 backdrop-blur-md shadow-lg border border-slate-200 hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover/section:opacity-100 scale-90 group-hover/section:scale-100 cursor-pointer hidden sm:grid"
        >
          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
        
        <button
          onClick={handleNext}
          className="absolute -right-3 sm:-right-6 top-[55%] -translate-y-1/2 z-20 grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-full bg-white/80 text-slate-800 backdrop-blur-md shadow-lg border border-slate-200 hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover/section:opacity-100 scale-90 group-hover/section:scale-100 cursor-pointer hidden sm:grid"
        >
          <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>

        <div 
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 pt-2 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {banners.map((ad, i) => (
            <motion.div
              key={ad.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative overflow-hidden rounded-3xl h-[260px] shadow-lg hover:shadow-xl group border border-slate-200/60 shrink-0 w-[calc(100%-8px)] md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] snap-start cursor-pointer"
            >
              <Link to={ad.link} className="block h-full w-full relative">
                <img
                  src={ad.image}
                  alt={ad.title}
                  onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                
                <div className="absolute top-3 left-3 z-10">
                  <span className="bg-amber-500 text-white text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-sm shadow-sm">
                    {ad.tag}
                  </span>
                </div>
                
                <div className="absolute bottom-5 left-5 right-5 flex flex-col items-start gap-1 z-10">
                  <h3 className="text-lg sm:text-xl font-bold text-white leading-tight drop-shadow-md group-hover:text-amber-300 transition-colors">
                    {ad.title}
                  </h3>
                  <p className="text-xs sm:text-sm font-semibold text-amber-300 drop-shadow-md">
                    {ad.subtitle}
                  </p>
                  <span
                    className="mt-2 inline-flex items-center gap-1.5 bg-white/20 group-hover:bg-white text-white group-hover:text-red-600 backdrop-blur-md border border-white/40 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md group-hover:scale-105"
                  >
                    {ad.cta} <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ============================================================
   Main HomePage
============================================================ */
export function HomePage() {
  return (
    <div>
      <HeroSection />
      <AISmartSearch />
      <TrustSection />
      <ServicesSection />
      <CategoriesSection />
      <SponsoredPropertiesCarousel />
      <LuxuryAdBannersSection />
      <ExploreHyderabad />
      <ExploreBuildersSection />
      <TopAgents />
      <PostPropertyBanner />
      <SignatureCollection />
      <ThreeColumnAdBannersSection />
      <LatestBlogs />
      <RealtynowExclusiveSection />
      <InteriorAndHomeServicesSection />
      <AppCTA />
      <PartnersSection />
      <FinalCTA />
    </div>
  );
}

