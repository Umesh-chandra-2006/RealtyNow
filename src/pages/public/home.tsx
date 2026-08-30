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
  X,
} from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { parsePropertySearchQuery, fetchLocationCategoryDiscovery, type LocationDiscoveryResult } from '../../lib/search-engine';
import type { CategorySlug } from '../../lib/categories';
import { normalizeSearchQuery } from '../../lib/properties';
import { supabase } from '../../lib/supabase';
import { useRealtimeCount } from '../../lib/realtime';
import { formatPrice, formatCompactPrice, formatNumber, cn, generatePropertyUrl, buildWhatsAppUrl } from '../../lib/utils';
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
import { getPropertyPricingDisplay } from '../../lib/plot-pricing';
import { PostPropertyLink } from '../../components/post-property-link';
import { fetchPublicFeaturedProperties } from '../../lib/featured-properties-api';
import { fetchPublicCampaigns } from '../../lib/paid-campaigns-api';
import { isRakshaBandhanActive } from '../../lib/campaigns/festive-campaigns';
import { RakshaBandhanPropertySection } from '../../components/festive/RakshaBandhanPropertySection';
import { TinyRakhiIcon } from '../../components/festive/RakshaBandhanIcons';

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

const RAKSHA_BANDHAN_SLIDE: HeroSlide = {
  id: 'hero-raksha-bandhan-special',
  title: 'THIS RAKSHA BANDHAN, CELEBRATE EVERY BOND THAT FEELS LIKE HOME',
  subtitle: 'Because every home is more than four walls — it is where relationships, memories and togetherness grow.',
  reraNumber: 'Raksha Bandhan Special • August 28, 2026',
  features: [
    'Spacious 3 & 4 BHK Luxury Residences for Family Togetherness',
    'Special Festive Home Loan Rates & Pre-Approved Offers',
  ],
  overlayPosition: 'center',
  overlayOpacity: 0.78,
  contentAlignment: 'center',
  locationText: 'Celebrate Home & Family',
  imageDesktop: '/hero-raksha-bandhan.jpg',
  imageMobile: '/hero-raksha-bandhan.jpg',
  ctaEnabled: true,
  ctaText: 'Explore Properties',
  ctaLink: '/search',
  packageTier: 'Platinum',
  isPinned: true,
};

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

  const rakhiActive = isRakshaBandhanActive();

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

    const baseSlides = sortedLive.length > 0 ? sortedLive.map(mapCampaignToHeroSlide) : HERO_SLIDES;
    return baseSlides;
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
      <div className="relative h-[440px] sm:h-[465px] lg:h-[485px] w-full">
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
                      active: { scale: 1, opacity: 1 },
                      inactive: { scale: 1.04, opacity: 0.5 },
                    }}
                    transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <picture>
                      {slide.imageMobile && slide.imageMobile !== slide.imageDesktop && (
                        <source media="(max-width: 640px)" srcSet={slide.imageMobile} />
                      )}
                      <img
                        key={isActive ? `${slide.id}-kb-${selectedIndex}` : slide.id}
                        src={slide.imageDesktop}
                        alt={slide.title}
                        className="h-full w-full object-cover object-[center_right] sm:object-right"
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
          <div className="absolute bottom-4 sm:bottom-5 right-6 sm:right-10 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 shadow-2xl">
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

        {/* Cinematic Horizontal Gradient Scrim (Desktop / Tablet) */}
        <div
          className="pointer-events-none absolute inset-0 z-[5] hidden sm:block"
          style={{
            background:
              'linear-gradient(90deg, rgba(5, 12, 24, 0.97) 0%, rgba(5, 12, 24, 0.88) 25%, rgba(5, 12, 24, 0.60) 42%, rgba(5, 12, 24, 0.25) 60%, rgba(5, 12, 24, 0.00) 78%)',
          }}
        />

        {/* Cinematic Gradient Scrim (Mobile) */}
        <div
          className="pointer-events-none absolute inset-0 z-[5] block sm:hidden"
          style={{
            background:
              'linear-gradient(180deg, rgba(5, 12, 24, 0.96) 0%, rgba(5, 12, 24, 0.86) 65%, rgba(5, 12, 24, 0.40) 100%)',
          }}
        />

        {/* Slide Foreground Content Box */}
        <div className="absolute inset-0 z-10">
          <div className="container-wide h-full w-full mx-auto px-4 sm:px-8 md:pl-[5vw] lg:pl-[6vw] xl:pl-[80px] 2xl:pl-[90px] flex items-center justify-start">
            <div className="w-full h-full flex pb-8 pt-6 sm:py-8 justify-start items-center text-left">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`panel-${activeSlide.id}-${selectedIndex}`}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } }}
                  className="w-full max-w-[620px] lg:max-w-[660px] flex flex-col gap-2.5 sm:gap-3 items-start text-left"
                >
                  {/* Top Bar: Developer & Project Logos + Property Badges */}
                  <motion.div variants={heroTextVariants} className="flex flex-wrap items-center justify-start gap-2">
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
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-black/70 border border-white/20 px-3 py-0.5 text-[10px] sm:text-[11px] text-white/95 font-semibold backdrop-blur-md shadow-xs">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate max-w-[240px] sm:max-w-md">{activeSlide.reraNumber}</span>
                      </div>
                    )}
                    {activeSlide.locationText && !activeSlide.reraNumber && (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-black/70 border border-white/20 px-3 py-0.5 text-[10px] sm:text-[11px] text-white/90 font-bold tracking-wider uppercase backdrop-blur-md">
                        <MapPin className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        <span>{activeSlide.locationText}</span>
                      </div>
                    )}
                    {activeSlide.priceText && (
                      <span className="rounded-md bg-amber-400 text-slate-950 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-xs">
                        {activeSlide.priceText}
                      </span>
                    )}
                  </motion.div>

                  {/* Main Property Headline Title */}
                  <motion.h1
                    variants={heroTextVariants}
                    className="font-display text-2xl sm:text-3xl lg:text-[34px] font-black uppercase text-white tracking-tight leading-[1.16] text-left [text-shadow:0_2px_12px_rgba(0,0,0,0.85)]"
                  >
                    {activeSlide.title}
                  </motion.h1>

                  {/* Subtitle */}
                  {activeSlide.subtitle && (
                    <motion.p
                      variants={heroTextVariants}
                      className="text-xs sm:text-sm lg:text-[15px] font-medium text-slate-200/95 leading-relaxed line-clamp-2 text-left [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]"
                    >
                      {activeSlide.subtitle}
                    </motion.p>
                  )}

                  {/* Dynamic Property Features Highlights */}
                  {activeSlide.features && activeSlide.features.length > 0 && (
                    <motion.div variants={heroTextVariants} className="flex flex-col items-start gap-1.5 my-0.5 sm:my-1">
                      {activeSlide.features.slice(0, 2).map((feat, fIdx) => (
                        <div
                          key={fIdx}
                          className="flex items-center gap-2 text-xs sm:text-[13px] font-semibold text-white/95 leading-snug [text-shadow:0_1px_6px_rgba(0,0,0,0.85)]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400 shrink-0" />
                          <span className="leading-snug">{feat}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {/* CTA Buttons */}
                  {activeSlide.ctaEnabled && activeSlide.ctaText && (
                    <motion.div variants={heroTextVariants} className="pt-1.5 sm:pt-2 flex flex-wrap items-center justify-start gap-3">
                      {activeSlide.ctaLink.startsWith('http') ? (
                        <a
                          href={activeSlide.ctaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 px-5 py-2.5 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-red-950/40 hover:shadow-red-600/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                        >
                          <span>{activeSlide.ctaText}</span>
                          <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </a>
                      ) : (
                        <Link
                          to={activeSlide.ctaLink}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 px-5 py-2.5 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-red-950/40 hover:shadow-red-600/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                        >
                          <span>{activeSlide.ctaText}</span>
                          <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Link>
                      )}

                      <Link
                        to="/search?featured=true"
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 text-white border border-white/25 hover:border-white/45 px-4 py-2.5 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold backdrop-blur-md transition-all shadow-md cursor-pointer"
                      >
                        <span>Explore Collection</span>
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
  const [propertySuggestions, setPropertySuggestions] = useState<any[]>([]);
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

        // 2. Fetch Top Property Matches from live database
        const { data: propData } = await supabase
          .from('v_properties_search')
          .select('id, title, seo_slug, price, rent_amount, purpose, locality_name, city_name, bedrooms, property_type_name, cover_image_url, images')
          .or('status.eq.published,status.eq.live,is_live.eq.true')
          .ilike('search_document', `%${normalized}%`)
          .limit(5);

        setPropertySuggestions(propData ?? []);
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
      // 1. Direct redirect if query matches an existing suggestion title or ID
      const exactSuggestion = propertySuggestions.find(
        (p) => p.title && p.title.trim().toLowerCase() === trimmedQuery.toLowerCase()
      );
      if (exactSuggestion) {
        setLocationDiscovery(null);
        setPropertySuggestions([]);
        navigate(generatePropertyUrl(exactSuggestion));
        return;
      }

      // 2. Query database for exact property title match to redirect directly
      const { data: exactMatches } = await supabase
        .from('v_properties_search')
        .select('id, title, seo_slug')
        .or('status.eq.published,status.eq.live,is_live.eq.true')
        .ilike('title', trimmedQuery)
        .limit(1);

      if (exactMatches && exactMatches.length > 0) {
        setLocationDiscovery(null);
        setPropertySuggestions([]);
        navigate(generatePropertyUrl(exactMatches[0]));
        return;
      }

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
    <div className="container-wide relative z-30 -translate-y-1/2">
      <div className="relative mx-auto w-[96%] sm:w-[90%] lg:w-[82%] max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="w-full rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white/95 p-2.5 sm:p-3 shadow-[0_20px_50px_rgba(0,0,0,0.14)] backdrop-blur-2xl"
        >
          {/* Tabs with animated active state */}
          <div className="flex items-center gap-1 sm:gap-1.5 pb-2 border-b border-slate-100/90 px-0.5 overflow-x-auto no-scrollbar snap-x">
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
                  'flex shrink-0 snap-center items-center gap-1.5 rounded-lg sm:rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-[13px] font-bold transition-all duration-200 cursor-pointer',
                  tab === tItem
                    ? 'bg-gradient-to-r from-red-600 via-red-500 to-rose-600 text-white shadow-md shadow-red-500/25 scale-[1.02]'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                )}
              >
                {tItem === 'Buy' && <Home className="h-3.5 w-3.5" />}
                {tItem === 'Rent' && <KeyRound className="h-3.5 w-3.5" />}
                {tItem === 'PG' && <Bed className="h-3.5 w-3.5" />}
                {tItem === 'Commercial' && <Building2 className="h-3.5 w-3.5" />}
                {tItem === 'Plots' && <LandPlot className="h-3.5 w-3.5" />}
                {tItem === 'Projects' && <Layers className="h-3.5 w-3.5" />}
                {tItem}
              </button>
            ))}
          </div>

          {/* Main Search Input & Actions */}
          <div ref={searchContainerRef} className="relative flex flex-col md:flex-row items-center gap-2 pt-2">
            <div className="relative w-full flex-1">
              <Search className="pointer-events-none absolute left-3.5 sm:left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAISearch()}
                aria-label="Search properties"
                aria-invalid={!!searchError}
                className={cn(
                  'w-full rounded-xl sm:rounded-2xl border bg-slate-50/90 py-2.5 sm:py-3 pl-10 sm:pl-11 pr-28 sm:pr-32 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all',
                  searchError
                    ? 'border-red-400 focus:ring-red-500/30 focus:border-red-500'
                    : 'border-slate-200/90 focus:ring-red-500/20 focus:border-red-400 shadow-inner-xs',
                )}
              />
              {!query && (
                <div className="pointer-events-none absolute left-10 sm:left-11 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-slate-400">
                  {typedPlaceholder}
                  <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-red-500 align-middle" />
                </div>
              )}
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {query && (
                  <button
                    onClick={() => {
                      setQuery('');
                      setLocationDiscovery(null);
                      setPropertySuggestions([]);
                    }}
                    className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={handleVoice}
                  className={cn(
                    'grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-lg transition-all cursor-pointer',
                    listening ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30' : 'text-slate-500 hover:bg-slate-200/70'
                  )}
                  title="Voice Search"
                >
                  <Mic className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                <button
                  onClick={handleLiveLocation}
                  disabled={locating}
                  className={cn(
                    'grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-lg transition-all cursor-pointer',
                    locating
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-slate-500 hover:bg-slate-200/70 hover:text-red-600'
                  )}
                  title="Detect Live Location"
                >
                  <Navigation className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform", locating && "animate-spin")} />
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

                    {/* Matching Property Listings */}
                    {propertySuggestions.length > 0 && (
                      <div className="py-2 divide-y divide-slate-100">
                        <div className="px-4 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Matching Properties ({propertySuggestions.length})
                        </div>
                        {propertySuggestions.map((prop) => {
                          const cover = prop.cover_image_url || (Array.isArray(prop.images) ? prop.images[0] : null) || DEFAULT_PROPERTY_IMAGE;
                          const priceDisplay = prop.price
                            ? formatCompactPrice(prop.price)
                            : prop.rent_amount
                              ? `${formatCompactPrice(prop.rent_amount)}/mo`
                              : 'Price on Request';

                          return (
                            <div
                              key={prop.id}
                              onClick={() => {
                                setLocationDiscovery(null);
                                setPropertySuggestions([]);
                                navigate(generatePropertyUrl(prop));
                              }}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-50/70 transition-all text-left cursor-pointer group"
                            >
                              <img
                                src={cover}
                                alt={prop.title || 'Property'}
                                className="h-11 w-14 rounded-xl object-cover shrink-0 border border-slate-100 shadow-2xs"
                                onError={(e) => {
                                  (e.target as HTMLElement).setAttribute('src', DEFAULT_PROPERTY_IMAGE);
                                }}
                              />
                              <div className="min-w-0 flex-1">
                                <h6 className="text-xs font-bold text-slate-900 group-hover:text-red-600 line-clamp-1">
                                  {prop.title}
                                </h6>
                                <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                  {[prop.locality_name, prop.city_name].filter(Boolean).join(', ') || 'Hyderabad'}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs font-extrabold text-red-600 block">
                                  {priceDisplay}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-red-600 inline-flex items-center gap-0.5">
                                  View Property <ChevronRight className="h-3 w-3 inline" />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={handleAISearch}
              disabled={aiThinking}
              className="w-full md:w-auto rounded-xl sm:rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-rose-600 px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-red-500/25 hover:shadow-red-500/40 hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Sparkles className={cn("h-4 w-4", aiThinking && "animate-spin")} />
              <span>{aiThinking ? 'AI Analyzing…' : 'Search Properties'}</span>
            </button>
          </div>
          {searchError && (
            <p role="alert" className="mt-1.5 px-2 text-xs font-bold text-red-600">
              {searchError}
            </p>
          )}
        </motion.div>

        {/* AI Assistant mascot */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="hidden lg:flex absolute left-full bottom-0 ml-5 xl:ml-8 items-end justify-center shrink-0"
        >
          <img
            src="/robot.png"
            alt="AI Assistant Robot"
            className="h-36 xl:h-44 w-auto object-contain drop-shadow-xl hover:scale-105 transition-transform cursor-pointer mix-blend-multiply"
            onClick={() => window.dispatchEvent(new CustomEvent('open-ai-assistant'))}
            title="Chat with AI Assistant"
          />
        </motion.div>
      </div>
    </div>
  );
}

/* ============================================================
   Business Features — Cute & Smart 3D Red Theme Showcase
============================================================ */
function TrustSection() {
  const { t } = useLanguageContext();

  const features = [
    {
      title: t('home.featVerified', '100% Verified'),
      subtitle: 'Physically inspected homes',
      icon: BadgeCheck,
    },
    {
      title: t('home.featRera', 'RERA Approved'),
      subtitle: '100% Legal & clear titles',
      icon: ShieldCheck,
    },
    {
      title: t('home.featBuilders', 'Top Builders'),
      subtitle: 'Direct developer pricing',
      icon: Building2,
    },
    {
      title: t('home.featAgents', 'Verified Agents'),
      subtitle: '4.9★ Local experts',
      icon: Users,
    },
    {
      title: t('home.featAI', 'AI Price Intel'),
      subtitle: 'Instant fair valuation',
      icon: Sparkles,
    },
    {
      title: t('home.featSecure', 'Zero Spam'),
      subtitle: 'Masked contact privacy',
      icon: Shield,
    },
  ];

  return (
    <section className="relative border-b border-slate-200/80 bg-white/90 backdrop-blur-md py-4 sm:py-5">
      <div className="container-wide">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
          {features.map((f, idx) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
                whileHover={{ y: -2, scale: 1.02 }}
                className="group relative flex items-center gap-2.5 sm:gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 p-2.5 sm:p-3 shadow-xs hover:border-red-200 hover:bg-red-50/20 hover:shadow-md hover:shadow-red-500/10 transition-all cursor-default overflow-hidden"
              >
                {/* Cute 3D Red Theme Icon Badge */}
                <div className="relative shrink-0">
                  <div
                    className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 via-red-600 to-rose-700 text-white shadow-sm shadow-red-500/30 transform-gpu group-hover:scale-110 transition-transform duration-200"
                    style={{
                      boxShadow: '0 4px 10px -2px rgba(220, 38, 38, 0.4), inset 0 1px 1px rgba(255,255,255,0.7), inset 0 -1.5px 2px rgba(0,0,0,0.3)',
                    }}
                  >
                    {/* 3D Glass Shine Layer */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent via-white/20 to-white/40 pointer-events-none" />
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5 relative z-10 text-white stroke-[2.3] drop-shadow-xs" />
                  </div>
                </div>

                {/* Smart Compact Labels */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-[13px] font-extrabold text-slate-900 group-hover:text-red-600 transition-colors truncate leading-tight">
                    {f.title}
                  </p>
                  <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate mt-0.5 leading-none">
                    {f.subtitle}
                  </p>
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
   Property Categories — Curated Luxury Category Showcase
============================================================ */
import { CATEGORY_LIST } from '../../lib/categories';

function CategoriesSection() {
  const { t } = useLanguageContext();
  const { city } = useLocationContext();
  const rakhiActive = isRakshaBandhanActive();

  return (
    <SectionShell
      title={
        <div>
          {rakhiActive && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-red-50 via-amber-50 to-rose-50 border border-amber-200/90 text-red-700 text-[11px] font-black uppercase tracking-wider mb-2.5 shadow-2xs">
              <span className="text-xs">🪢</span>
              <span>Raksha Bandhan Special</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            Browse by <span className="text-red-600 ml-1.5">Category</span>
          </div>
        </div>
      }
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
function FeaturedPropertiesSection() {
  const { t } = useLanguageContext();
  const rakhiActive = isRakshaBandhanActive();
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
      const featuredProps = await fetchPublicFeaturedProperties(cityId || undefined);

      const map = new Map<string, any>();
      (campaigns || []).forEach((c) => {
        const id = c.property?.id || c.id;
        if (id) map.set(id, c);
      });
      (featuredProps || []).forEach((p) => {
        if (p.id && !map.has(p.id)) {
          map.set(p.id, p);
        }
      });

      return Array.from(map.values()).filter((p) => {
        const title = (p.title || p.property?.title || '').toLowerCase();
        if (title.includes('dummy') || title.includes('sample')) return false;
        return true;
      });
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
            <div className="flex items-center gap-2">
              {rakhiActive && <TinyRakhiIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />}
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Featured <span className="text-red-600">Properties</span>
              </h2>
            </div>
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
      title={<>Explore in <span className="text-red-600">Hyderabad</span></>}
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
  const rakhiActive = isRakshaBandhanActive();

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
              <div className="flex items-center gap-2">
                {rakhiActive && <TinyRakhiIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />}
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  AI-Powered <span className="text-red-600">Services</span>
                </h2>
              </div>
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
  const rakhiActive = isRakshaBandhanActive();
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
          .or('status.eq.published,status.eq.live,is_live.eq.true');
        if (scopeToCity && cityId) q = q.eq('city_id', cityId);
        const { data } = await q
          .order('is_luxury', { ascending: false })
          .order('price', { ascending: false })
          .limit(20);
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
    <section className="py-12 sm:py-16 bg-white border-y border-slate-100 relative overflow-hidden" id="signature-collection">
      <div className="container-wide">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
                <Sparkles className="h-3 w-3 text-amber-600" /> Signature Collection
              </span>
              <span className="text-xs font-semibold text-slate-500">Curated Haute Living</span>
            </div>
            <div className="flex items-center gap-2">
              {rakhiActive && <TinyRakhiIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />}
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Signature <span className="text-red-600">Collection</span>
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500 max-w-xl">
              Ultra Luxury Homes for the Discerning Buyer — Bespoke penthouses, golf estates, and signature villas.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {data.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={scrollPrev}
                  aria-label="Previous slide"
                  className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer active:scale-95"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={scrollNext}
                  aria-label="Next slide"
                  className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer active:scale-95"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <Link 
              to="/search?is_luxury=true" 
              className="inline-flex items-center gap-1 text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
            >
              <span>Explore Portfolio</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Carousel Section */}
        <div className="relative">
          {/* Embla Viewport */}
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-5">
              {data.map((p) => (
                <div
                  key={p.id}
                  className="relative min-w-0 flex-[0_0_88%] sm:flex-[0_0_calc(50%-10px)] lg:flex-[0_0_calc(33.333%-14px)] xl:flex-[0_0_calc(25%-15px)]"
                >
                  <HomePropertyCard
                    property={p}
                    badge={{
                      label: 'Signature',
                      className: 'bg-amber-600 text-white font-bold',
                      icon: <Sparkles className="h-2.5 w-2.5" />,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Pagination Dots */}
          {scrollSnaps.length > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              {scrollSnaps.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => emblaApi && emblaApi.scrollTo(i)}
                  className={`h-2 transition-all duration-300 rounded-full cursor-pointer ${i === selectedIndex ? 'w-8 bg-red-600' : 'w-2 bg-slate-200 hover:bg-slate-300'}`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
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
  const { data: builders = [], isLoading } = useQuery({
    queryKey: ['home-top-builders-dynamic'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('builders')
        .select('*')
        .eq('status', 'approved')
        .eq('public_visible', true)
        .order('is_featured', { ascending: false })
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('Error loading dynamic builders:', error);
        return [];
      }
      return (data ?? []) as any[];
    },
    staleTime: 60 * 1000,
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('public:top-builders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'builders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-top-builders-dynamic'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <section className="py-6 sm:py-8 bg-slate-50/40 select-none" id="explore-builders">
      <div className="container-wide">
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 md:p-8 shadow-xs">
          {/* Header */}
          <div className="mb-6 sm:mb-8 flex items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Top Builders
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                Partnered with the most trusted names in real estate
              </p>
            </div>
            <Link
              to="/builders"
              className="text-xs sm:text-sm font-bold text-red-600 hover:text-red-700 transition-colors inline-flex items-center gap-1 shrink-0 group"
            >
              <span>View all builders</span>
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Builder Logos Display */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 sm:gap-6 items-center">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : builders.length === 0 ? (
            <div className="py-8 text-center text-sm font-medium text-slate-500">
              No builders available at the moment.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 sm:gap-6 items-center justify-items-center">
              {builders.map((builder) => (
                <Link
                  key={builder.id}
                  to={`/builders/${builder.id}`}
                  title={builder.name}
                  className="group flex h-16 sm:h-20 w-full max-w-[150px] items-center justify-center rounded-2xl p-2.5 transition-all duration-200 hover:scale-105 hover:bg-slate-50/80 hover:shadow-xs focus:outline-none cursor-pointer"
                >
                  {builder.logo_url ? (
                    <img
                      src={builder.logo_url}
                      alt={builder.name}
                      className="max-h-10 sm:max-h-12 w-auto max-w-[120px] object-contain transition-transform duration-200 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100/90 text-slate-800 font-bold text-xs group-hover:bg-red-50 group-hover:text-red-600 transition-colors">
                      <Building2 className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-red-500" />
                      <span className="truncate max-w-[80px]">{builder.name}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Top Agents Section
============================================================ */
function TopAgentsSection() {
  const { t } = useLanguageContext();
  const rakhiActive = isRakshaBandhanActive();
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'agent')
      .limit(8)
      .then(({ data }) => {
        if (data) setAgents(data);
      });
  }, []);

  if (!agents || agents.length === 0) return null;

  return (
    <section className="py-10 bg-white overflow-hidden" id="agents">
      <div className="container-wide relative">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {rakhiActive && <TinyRakhiIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />}
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Top Verified <span className="text-red-600">Agents</span>
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
  const rakhiActive = isRakshaBandhanActive();
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
        // Fetch live real-time published properties instead of static mock data
        const { data: liveProps } = await supabase
          .from('v_properties_search')
          .select('*')
          .or('status.eq.published,status.eq.live,is_live.eq.true')
          .order('created_at', { ascending: false })
          .limit(8);

        if (liveProps && liveProps.length > 0) {
          return liveProps.map((p, idx) => {
            const priceText = p.price
              ? formatPrice(p.price)
              : p.rent_amount
                ? `${formatPrice(p.rent_amount)}/mo`
                : p.price_per_unit
                  ? `₹${p.price_per_unit.toLocaleString('en-IN')}/${p.area_unit || 'unit'}`
                  : 'Price on Request';

            const images = Array.isArray(p.images) ? p.images : [];
            const cover = p.cover_image_url || images[0] || DEFAULT_PROPERTY_IMAGE;

            return {
              id: p.id,
              title: p.title || 'Verified Property',
              subtitle: p.property_type_name
                ? `${p.bedrooms ? `${p.bedrooms} BHK ` : ''}${p.property_type_name}`
                : (p.property_type_category || 'Real Estate'),
              locality: [p.locality_name || p.locality, p.city_name || p.city].filter(Boolean).join(', ') || 'Hyderabad',
              price_text: priceText,
              badge_text: p.is_featured ? 'Featured' : p.is_luxury ? 'Exclusive' : 'Verified Project',
              rera_no: p.legal_approved ? 'RERA Approved' : 'Verified Listing',
              image_url: cover,
              cta_text: 'View Details',
              cta_link: `/property/${p.seo_slug || p.id}`,
              sort_order: idx + 1,
            };
          });
        }
        return [];
      }
      return data;
    },
  });

  // Strict deduplication to ensure unique cards only (prevents duplicate sponsor or project cards)
  const uniqueExclusiveList = useMemo(() => {
    const seen = new Set<string>();
    return exclusiveList.filter((item: any) => {
      const key = (item.title || item.id || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [exclusiveList]);

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
            <div className="flex items-center gap-2">
              {rakhiActive && <TinyRakhiIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />}
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                RealtyNow <span className="text-red-600">Exclusive</span>
              </h2>
            </div>
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

        {/* Loading State */}
        {isLoading ? (
          <div className="flex gap-6 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-[360px] w-[340px] rounded-3xl shrink-0" />
            ))}
          </div>
        ) : uniqueExclusiveList.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-200/80">
            <Sparkles className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm font-medium">Exclusive projects will be announced soon.</p>
          </div>
        ) : (
          <div
            ref={carouselRef}
            className="flex items-stretch gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 pt-1 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            {uniqueExclusiveList.map((item: any, idx: number) => (
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center mb-10">
          {/* Left Column: Video Player — How to List Property on RealtyNow */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-4 relative max-w-sm mx-auto lg:max-w-none w-full"
          >
            <div className="relative h-[240px] sm:h-[270px] lg:h-[260px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg border border-slate-200/80 group bg-slate-950">
              {/* Video Embed — Replace src with your actual RealtyNow demo/tutorial video URL */}
              <video
                className="h-full w-full object-cover"
                controls
                poster="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80"
                preload="metadata"
                playsInline
              >
                {/* Replace with your actual video files */}
                <source src="/videos/realtynow-listing-guide.mp4" type="video/mp4" />
                <source src="/videos/realtynow-listing-guide.webm" type="video/webm" />
                Your browser does not support the video tag.
              </video>

              {/* Branded Bottom Label */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent px-4 pt-8 pb-3 pointer-events-none">
                <span className="inline-block rounded-full bg-red-600/95 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-xs mb-1.5">
                  🎥 How to List Property
                </span>
                <h3 className="font-display text-sm sm:text-base font-black leading-snug text-white">
                  List, manage & sell on RealtyNow
                </h3>
              </div>
            </div>

            {/* Cute Floating Metric Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="absolute -top-3 -right-2 sm:-top-3 sm:-right-3 bg-white/95 backdrop-blur-md text-slate-900 rounded-xl p-2 sm:p-2.5 shadow-md border border-slate-200/80 flex items-center gap-2"
            >
              <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 grid place-items-center shrink-0 border border-amber-200/60">
                <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
              </div>
              <div className="pr-1">
                <p className="font-display text-xs font-black text-slate-900 leading-none">4.9 / 5.0</p>
                <p className="text-[9px] font-semibold text-slate-500 mt-0.5">Trust Index</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column: Editorial Narrative */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-8 flex flex-col gap-3.5"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-red-600 border border-red-200">
                <Sparkles className="h-3.5 w-3.5" /> Holistic Real Estate Ecosystem
              </span>
            </div>

            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                {t('home.beyondProperty', 'Beyond Property.')}{' '}
                <span className="text-red-600">
                  {t('home.enhanceLiving', 'We Enhance Your Living.')}
                </span>
              </h2>
            </div>

            <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
              {t(
                'home.servicesDescription',
                'From verified property title deeds and AI-driven price predictions to bespoke interior styling and competitive home financing, RealtyNow delivers end-to-end luxury living solutions under one unified platform.',
              )}
            </p>

            {/* Quick Pillars */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
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
  const rakhiActive = isRakshaBandhanActive();
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

          <div className="flex items-center justify-center gap-2.5">
            {rakhiActive && <TinyRakhiIcon className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" />}
            <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight max-w-3xl mx-auto leading-[1.1]">
              Your Next Address Starts Here.
            </h2>
          </div>

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
  title: React.ReactNode;
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
              className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight"
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
  const rakhiActive = isRakshaBandhanActive();
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
            <div className="flex items-center gap-2">
              {rakhiActive && <TinyRakhiIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />}
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Curated Luxury <span className="text-red-600">Living</span>
              </h2>
            </div>
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
  const rakhiActive = isRakshaBandhanActive();
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
            <div className="flex items-center gap-2">
              {rakhiActive && <TinyRakhiIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />}
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Prime Investment <span className="text-red-600">Opportunities</span>
              </h2>
            </div>
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


const SponsoredPropertiesCarousel = FeaturedPropertiesSection;
const TopAgents = TopAgentsSection;

/* ============================================================
   Main HomePage
============================================================ */
export function HomePage() {
  const rakhiActive = isRakshaBandhanActive();

  return (
    <div>
      {/* Top Promotional Hero Banners */}
      <HeroSection />

      <AISmartSearch />
      <TrustSection />
      <ServicesSection />
      <CategoriesSection />
      {rakhiActive && <RakshaBandhanPropertySection />}
      <FeaturedPropertiesSection />
      <LuxuryAdBannersSection />
      <ExploreHyderabad />
      <ExploreBuildersSection />
      <TopAgentsSection />
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

