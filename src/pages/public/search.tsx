import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PropertyMap } from '../../components/property-map';
import { VoiceSearchButton } from '../../components/voice-search-button';
import { generateSpeech } from '../../lib/elevenlabs';
import { ListingPromoBanner } from '../../components/listing-promo-banner';
import {
  SlidersHorizontal,
  X,
  MapPin,
  Home,
  ChevronLeft,
  ChevronRight,
  Search,
  Heart,
  Phone,
  MessageCircle,
  Calendar,
  Eye,
  Camera,
  Bed,
  Bath,
  Car,
  Maximize2,
  Navigation,
  Building2,
  Zap,
  TrendingUp,
  BarChart3,
  Map,
  GitCompare,
  CheckCircle2,
  Clock,
  ChevronDown,
  Filter,
  SortDesc,
  LayoutGrid,
  Share2,
  ShieldCheck,
  Sparkles,
  Rows3,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { type PropertyFilters, fetchPublishedProperties, sanitizeSearchQuery, normalizeSearchQuery } from '../../lib/properties';
import { useClickOutside } from '../../hooks/useClickOutside';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/toast';
import { formatCompactPrice, formatPrice, formatNumber, cn, generatePropertyUrl, getPropertyPrice, buildWhatsAppUrl } from '../../lib/utils';
import { getPropertyPricingDisplay, getPriceUnitLabel } from '../../lib/plot-pricing';
import { sharePropertyNativeOrCopy } from '../../lib/share-service';
import type { Property } from '../../lib/types';
import { getCategoryMeta, normalizeCategorySlug } from '../../lib/categories';
import { formatAmenityLabel } from '../../lib/amenities';
import { ContactAgentModal } from '../../components/contact-agent-modal';
import { BookVisitModal } from '../../components/book-visit-modal';

import { LocationCategoryDiscovery } from '../../components/location-category-discovery';
import { parsePropertySearchQuery, fetchLocationCategoryDiscovery, fetchSearchCategoryCounts, type LocationDiscoveryResult } from '../../lib/search-engine';
import type { CategorySlug } from '../../lib/categories';
import { useFavorites, toggleFavoriteProperty, getLocalFavoriteIds } from '../../lib/favorites';
import { isCompared, toggleCompareProperty, getCompareIds } from '../../lib/compare';
import { getSafePropertyImages, DEFAULT_PROPERTY_IMAGE } from '../../lib/property-images';
import { PropertyImage } from '../../components/property-image';
import { AdvancedFilters } from '../../components/advanced-filters';
import { LocationCityAreaFilter } from '../../components/location-city-area-filter';
import { useSEO } from '../../hooks/use-seo';
import { PostPropertyLink } from '../../components/post-property-link';

import { executeGlobalPropertySearch } from '../../lib/search-service';
import { logSearchQuery } from '../../lib/search-analytics';

const PAGE_SIZE = 10;

// Malformed URL params (e.g. ?min_price=abc) must be ignored rather than passed
// through as NaN — Number(NaN) is not null/undefined, so an unguarded filter would
// still apply `.gte('price', NaN)` to the query, silently zeroing out real results
// instead of just dropping the invalid constraint.
function parseNumberParam(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

type ViewMode = 'list' | 'grid' | 'map';
type SortOption =
  | 'relevance'
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'ai_recommended'
  | 'most_viewed'
  | 'most_contacted'
  | 'featured';


// ──────────────────────────────────────────────────────────────
// Property Horizontal List Card (desktop/tablet)
// ──────────────────────────────────────────────────────────────
interface HorizontalCardProps {
  property: Property & { city_name?: string; locality_name?: string; property_type_name?: string };
  onSave?: (id: string) => void;
  onCompare?: (id: string) => void;
  saved?: boolean;
  compared?: boolean;
  isAiRecommended?: boolean;
}

function HorizontalCard({ property: p, onSave, onCompare, saved = false, compared = false, isAiRecommended = false }: HorizontalCardProps) {
  const { user } = useAuth();
  const { t } = useLanguageContext();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [activeImg, setActiveImg] = useState(0);
  const [imgHovered, setImgHovered] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [visitModalOpen, setVisitModalOpen] = useState(false);

  const [localCompared, setLocalCompared] = useState(() => isCompared(p.id));
  const isCurrentlyCompared = compared || localCompared;

  useEffect(() => {
    const handleSync = () => setLocalCompared(isCompared(p.id));
    window.addEventListener('realtynow-compare-updated', handleSync);
    return () => window.removeEventListener('realtynow-compare-updated', handleSync);
  }, [p.id]);

  const handleCompareClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const isNowCompared = await toggleCompareProperty(p.id, user?.id);
      setLocalCompared(isNowCompared);
      onCompare?.(p.id);
      addToast(
        'success',
        isNowCompared
          ? t('notifications.addedToCompare', 'Added to compare list')
          : t('notifications.removedFromCompare', 'Removed from compare list'),
      );
    } catch (err) {
      addToast(
        'error',
        err instanceof Error ? err.message : t('notifications.errorCompare', 'Could not update compare list'),
      );
    }
  };

  const images = getSafePropertyImages(p);

  const investScore = useMemo(() => Math.floor(60 + Math.random() * 35), [p.id]);
  const pricePerSqft = p.built_up_area && p.price ? Math.round(p.price / p.built_up_area) : null;

  // Cap to 2-3 meaningful badges: purpose is always shown; at most one
  // "highlight" badge on top of it (luxury takes priority over featured).
  const highlightBadge = p.is_luxury
    ? { label: t('common.luxury', 'Luxury'), className: 'bg-purple-600' }
    : p.is_featured
      ? { label: t('common.featured', 'Featured'), className: 'bg-amber-500' }
      : null;

  const topAmenities = (p.amenities ?? []).slice(0, 4);
  const extraAmenityCount = Math.max(0, (p.amenities?.length ?? 0) - 4);
  const amenityIcons: Record<string, string> = {
    'Swimming Pool': '🏊',
    Gym: '💪',
    'Club House': '🏛️',
    Security: '🛡️',
    'Power Backup': '⚡',
    'Children Park': '🛝',
    Lift: '🛗',
    Garden: '🌿',
  };

  const specs = [
    p.bedrooms != null && { icon: Bed, val: `${p.bedrooms} BHK`, key: 'bed' },
    p.bathrooms != null && { icon: Bath, val: `${p.bathrooms} Bath`, key: 'bath' },
    p.parking != null && { icon: Car, val: `${p.parking} Park`, key: 'park' },
    p.built_up_area && { icon: Maximize2, val: `${formatNumber(p.built_up_area)} sq.ft`, key: 'area' },
  ].filter(Boolean) as { icon: typeof Bed; val: string; key: string }[];

  const nearby = [
    { label: 'Metro 800m', icon: '🚇' },
    { label: 'School 500m', icon: '🏫' },
    { label: 'Hospital 1.2km', icon: '🏥' },
  ];

  const handleWhatsAppClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const agentId = p.assigned_agent_id || (p as any).owner_id;
    if (!agentId) {
      const defaultMsg = `Hi, I'm interested in "${p.title}" in ${p.locality_name ?? p.city_name ?? 'Hyderabad'} listed on RealtyNow. Please share more details.`;
      window.open(`https://wa.me/?text=${encodeURIComponent(defaultMsg)}`, '_blank', 'noopener,noreferrer');
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
        const defaultMsg = `Hi, I'm interested in "${p.title}" in ${p.locality_name ?? p.city_name ?? 'Hyderabad'} listed on RealtyNow. Please share more details.`;
        window.open(`https://wa.me/?text=${encodeURIComponent(defaultMsg)}`, '_blank', 'noopener,noreferrer');
        return;
      }

      const waUrl = buildWhatsAppUrl(targetPhone, p.title);
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch {
      const defaultMsg = `Hi, I'm interested in "${p.title}" in ${p.locality_name ?? p.city_name ?? 'Hyderabad'} listed on RealtyNow. Please share more details.`;
      window.open(`https://wa.me/?text=${encodeURIComponent(defaultMsg)}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        whileHover={{ y: -2 }}
        className="group relative flex flex-col sm:flex-row bg-white rounded-[18px] overflow-hidden border border-[#E7EAF0] shadow-[0_4px_20px_rgba(15,23,42,0.07)] hover:shadow-[0_10px_30px_rgba(15,23,42,0.11)] transition-all duration-200 ease-out cursor-pointer mb-6"
        onClick={() => navigate(generatePropertyUrl(p))}
      >
        {/* ── LEFT: IMAGE GALLERY (Unified 4:3 Frame) ── */}
        <div
          className="relative w-full sm:w-[280px] md:w-[300px] lg:w-[320px] shrink-0 overflow-hidden aspect-[4/3] bg-slate-100 self-stretch sm:self-auto"
          onMouseEnter={() => setImgHovered(true)}
          onMouseLeave={() => setImgHovered(false)}
        >
          <PropertyImage
            src={images[activeImg] || images[0] || DEFAULT_PROPERTY_IMAGE}
            alt={p.title}
            className={cn('h-full w-full object-cover object-center transition-transform duration-500', imgHovered ? 'scale-105' : 'scale-100')}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 pointer-events-none" />

          {/* Badges — purpose + at most one highlight */}
          <div className="absolute top-3 left-3 flex gap-1.5 z-10">
            {p.purpose && (
              <span
                className={cn(
                  'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm',
                  p.purpose === 'Rent' ? 'bg-blue-600 text-white' : 'bg-[#d8232a] text-white',
                )}
              >
                {p.purpose === 'Rent' ? t('property.forRent', 'FOR RENT') : t('property.forSale', 'FOR SALE')}
              </span>
            )}
            {highlightBadge && (
              <span className={cn('text-[10px] font-extrabold px-2.5 py-0.5 rounded-full text-white shadow-sm uppercase tracking-wider', highlightBadge.className)}>
                {highlightBadge.label}
              </span>
            )}
          </div>

          {/* Save, Compare + Share */}
          <div className="absolute top-3 right-3 flex gap-1.5 z-10" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                sharePropertyNativeOrCopy(p, () => {
                  addToast('success', 'Public property link copied to clipboard!');
                });
              }}
              title="Share Property"
              className="grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition hover:scale-110 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleCompareClick}
              title={isCurrentlyCompared ? t('property.removeFromCompare', 'Remove from compare') : t('property.addToCompare', 'Compare')}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-full shadow-md backdrop-blur-sm transition hover:scale-110 cursor-pointer',
                isCurrentlyCompared ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white/90 text-slate-600 hover:text-slate-900',
              )}
            >
              <GitCompare className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSave?.(p.id);
              }}
              title={t('property.saveProperty', 'Save')}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition hover:scale-110 cursor-pointer',
                saved ? 'text-[#d8232a]' : 'text-slate-600',
              )}
            >
              <Heart className={cn('h-4 w-4', saved && 'fill-[#d8232a] text-[#d8232a]')} />
            </button>
          </div>

          {/* Gallery dots + count */}
          {images.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1 z-10">
              {images.slice(0, 5).map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImg(i);
                  }}
                  className={cn('h-1.5 rounded-full transition-all', activeImg === i ? 'w-5 bg-white' : 'w-1.5 bg-white/50')}
                />
              ))}
            </div>
          )}
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Camera className="h-3 w-3" /> {images.length}
          </div>
        </div>

        {/* ── RIGHT: PROPERTY DETAILS ── */}
        <div className="flex flex-1 flex-col p-4 sm:p-5.5 min-w-0">
          {isAiRecommended && (
            <div className="mb-2 flex items-center gap-1.5 w-fit rounded-full bg-gradient-to-r from-purple-50 to-fuchsia-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-100 shadow-sm">
              <Sparkles className="h-3 w-3 text-purple-500" /> AI Recommended
            </div>
          )}

          {/* Title + Price */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base sm:text-lg font-bold text-[#172033] truncate leading-tight group-hover:text-[#d8232a] transition-colors">
                {p.title}
              </h2>
              <div className="mt-1 flex items-center gap-1 text-xs text-[#667085]">
                <MapPin className="h-3.5 w-3.5 text-[#d8232a] shrink-0" />
                <span className="truncate">{[p.locality_name, p.city_name].filter(Boolean).join(', ')}</span>
              </div>
              {p.property_type_name && (
                <span className="mt-1.5 inline-block text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  {p.property_type_name}
                </span>
              )}
            </div>
            <div className="text-right shrink-0">
              {(() => {
                const pricing = getPropertyPricingDisplay(p, { compactConstructed: true });
                if (pricing.isLand) {
                  return (
                    <>
                      <p className="font-display text-xl sm:text-2xl font-extrabold text-[#172033]">
                        {pricing.primaryPrice}
                      </p>
                      {pricing.totalEstimatedPrice && (
                        <p className="text-[11px] text-[#667085] mt-0.5 font-medium">Est. Total: {pricing.totalEstimatedPrice}</p>
                      )}
                    </>
                  );
                }
                return (
                  <>
                    <p className="font-display text-xl sm:text-2xl font-extrabold text-[#172033]">
                      {pricing.primaryPrice}
                    </p>
                    {pricePerSqft ? (
                      <p className="text-[11px] text-[#667085] mt-0.5 font-medium">₹{formatNumber(pricePerSqft)}/sq.ft</p>
                    ) : null}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Key specs */}
          {specs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {specs.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                  <s.icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{s.val}</span>
                </div>
              ))}
            </div>
          )}

          {/* Nearby places */}
          <div className="mt-2.5 flex items-center gap-3 text-[11px] text-[#667085]">
            {nearby.map((n, i) => (
              <span key={n.label} className="flex items-center gap-1 whitespace-nowrap">
                {i > 0 && <span className="text-slate-300">·</span>}
                <span>{n.icon}</span> {n.label}
              </span>
            ))}
          </div>

          {/* Amenities & Feature Badges */}
          {topAmenities.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {topAmenities.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50/70 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
                >
                  <span className="text-emerald-600">✓</span> {formatAmenityLabel(a)}
                </span>
              ))}
              {extraAmenityCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMore(true);
                  }}
                  className="text-[11px] font-bold text-[#d8232a] hover:underline px-1"
                >
                  +{extraAmenityCount} More
                </button>
              )}
            </div>
          )}

          {/* More Details Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMore((v) => !v);
            }}
            className="mt-2.5 flex items-center gap-1 self-start text-[11px] font-bold text-slate-500 hover:text-[#d8232a] transition-colors"
          >
            <span>{showMore ? t('common.lessDetails', 'Less Details') : t('common.moreDetails', 'More Details')}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showMore && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {showMore && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-100 pt-2.5">
                  <div className="flex items-center gap-1 text-xs text-slate-600 font-medium">
                    <span className="text-slate-400">ID:</span> RN-{p.id.slice(0, 7).toUpperCase()}
                  </div>
                  {p.floor_number != null && (
                    <div className="flex items-center gap-1 text-xs text-slate-600">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      Floor {p.floor_number}
                      {p.total_floors ? `/${p.total_floors}` : ''}
                    </div>
                  )}
                  {p.facing && (
                    <div className="flex items-center gap-1 text-xs text-slate-600">
                      <Navigation className="h-3.5 w-3.5 text-slate-400" /> {p.facing} facing
                    </div>
                  )}
                  {(p as any).possession_status && (
                    <div className="flex items-center gap-1 text-xs text-slate-600">
                      <Clock className="h-3.5 w-3.5 text-slate-400" /> {(p as any).possession_status}
                    </div>
                  )}
                  {(p as any).is_verified && (
                    <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t('common.verified', 'Verified')}
                    </div>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    <TrendingUp className="h-3 w-3" /> Invest {investScore}%
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                    <BarChart3 className="h-3 w-3" /> Rental Yield {(2.5 + Math.random() * 2).toFixed(1)}%
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                    <Zap className="h-3 w-3" /> High Demand
                  </span>
                  {p.amenities && p.amenities.length > 4 && (
                    <div className="mt-1 flex w-full flex-wrap gap-1.5">
                      {p.amenities.slice(4).map((a) => (
                        <span
                          key={a}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700"
                        >
                          <span className="text-emerald-600">✓</span> {formatAmenityLabel(a)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Updated date */}
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#667085]">
            <Clock className="h-3 w-3 text-slate-400" />
            <span>Updated {new Date(p.updated_at).toLocaleDateString()}</span>
          </div>

          {/* CTA row — 4 full action buttons */}
          <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-slate-100 pt-3" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContactModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-[#d8232a] hover:bg-[#b81d23] px-2.5 py-2.5 text-xs font-bold text-white transition-all shadow-sm cursor-pointer"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{t('property.contactAgent', 'Contact Us')}</span>
            </button>
            <button
              type="button"
              onClick={handleWhatsAppClick}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-2.5 py-2.5 text-xs font-bold text-white transition-all shadow-sm cursor-pointer"
            >
              <MessageCircle className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setVisitModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 hover:border-[#d8232a]/40 bg-white hover:bg-red-50/40 px-2.5 py-2.5 text-xs font-bold text-slate-700 hover:text-[#d8232a] transition-all cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{t('property.bookVisit', 'Book a Visit')}</span>
            </button>
            <Link
              to={generatePropertyUrl(p)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 px-2.5 py-2.5 text-xs font-bold text-[#d8232a] transition-all text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Eye className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{t('common.viewDetails', 'View Details')}</span>
            </Link>
          </div>
        </div>
      </motion.article>

      <ContactAgentModal property={p as any} isOpen={contactModalOpen} onClose={() => setContactModalOpen(false)} />
      <BookVisitModal property={p as any} isOpen={visitModalOpen} onClose={() => setVisitModalOpen(false)} />
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Property Grid Card (compact)
// ──────────────────────────────────────────────────────────────
function GridCard({
  property: p,
  onSave,
  onCompare,
  saved = false,
  compared = false,
}: {
  property: Property & { city_name?: string; locality_name?: string; property_type_name?: string };
  onSave?: (id: string) => void;
  onCompare?: (id: string) => void;
  saved?: boolean;
  compared?: boolean;
}) {
  const { user } = useAuth();
  const { t } = useLanguageContext();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const images = getSafePropertyImages(p);
  const reraNumber = (p as { rera_number?: string | null }).rera_number ?? null;

  const [localCompared, setLocalCompared] = useState(() => isCompared(p.id));
  const isCurrentlyCompared = compared || localCompared;

  useEffect(() => {
    const handleSync = () => setLocalCompared(isCompared(p.id));
    window.addEventListener('realtynow-compare-updated', handleSync);
    return () => window.removeEventListener('realtynow-compare-updated', handleSync);
  }, [p.id]);

  const handleCompareClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const isNowCompared = await toggleCompareProperty(p.id, user?.id);
      setLocalCompared(isNowCompared);
      onCompare?.(p.id);
      addToast(
        'success',
        isNowCompared
          ? t('notifications.addedToCompare', 'Added to compare list')
          : t('notifications.removedFromCompare', 'Removed from compare list'),
      );
    } catch (err) {
      addToast(
        'error',
        err instanceof Error ? err.message : t('notifications.errorCompare', 'Could not update compare list'),
      );
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await sharePropertyNativeOrCopy(p, () => {
      addToast('success', 'Public property link copied to clipboard!');
    });
  };

  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -5 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-shadow duration-300 hover:shadow-xl cursor-pointer"
      onClick={() => navigate(generatePropertyUrl(p))}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 shrink-0">
        <PropertyImage
          src={images[0] || DEFAULT_PROPERTY_IMAGE}
          alt={p.title}
          className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-110"
        />
        {reraNumber && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm backdrop-blur">
            <ShieldCheck className="h-3 w-3 text-emerald-600" /> RERA
          </span>
        )}
        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onSave?.(p.id)}
            aria-label={saved ? 'Remove from favorites' : 'Add to favorites'}
            className={cn(
              'grid h-7 w-7 place-items-center rounded-full backdrop-blur shadow-sm transition hover:scale-110 cursor-pointer',
              saved ? 'bg-white text-red-500' : 'bg-white/90 text-slate-600 hover:bg-white',
            )}
          >
            <Heart className={cn('h-3.5 w-3.5', saved && 'fill-red-500')} />
          </button>
          <button
            onClick={handleCompareClick}
            aria-label={isCurrentlyCompared ? 'Remove from compare' : 'Add to compare'}
            className={cn(
              'grid h-7 w-7 place-items-center rounded-full backdrop-blur shadow-sm transition hover:scale-110 cursor-pointer',
              isCurrentlyCompared ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white/90 text-slate-600 hover:bg-white',
            )}
          >
            <GitCompare className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleShare}
            aria-label="Share this property"
            className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-slate-600 shadow-sm backdrop-blur transition hover:scale-110 hover:bg-white cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {p.possession_status && (
          <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
            {p.possession_status}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        {(() => {
          const pricing = getPropertyPricingDisplay(p, { compactConstructed: true });
          return (
            <>
              <p className="font-display text-base font-extrabold text-slate-900 flex items-baseline gap-1.5 flex-wrap">
                {pricing.primaryPrice}
                {pricing.isLand && pricing.totalEstimatedPrice && (
                  <span className="text-[11px] font-medium text-slate-500">
                    (Est: {pricing.totalEstimatedPrice})
                  </span>
                )}
              </p>
              <h3 className="mt-0.5 font-display text-sm font-bold text-slate-900 truncate">{p.title}</h3>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                <MapPin className="h-3 w-3 shrink-0 text-red-400" />
                <span className="truncate">{[p.locality_name, p.city_name].filter(Boolean).join(', ')}</span>
              </p>
              {p.bedrooms != null ? (
                <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                  <Bed className="h-3 w-3 text-slate-400" /> {p.bedrooms} BHK
                </span>
              ) : pricing.areaDisplay ? (
                <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 text-[11px] font-semibold">
                  {pricing.areaDisplay}
                </span>
              ) : null}
            </>
          );
        })()}
      </div>
    </motion.article>
  );
}

// ──────────────────────────────────────────────────────────────
// Skeleton
// ──────────────────────────────────────────────────────────────
function ListSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row bg-white rounded-[18px] border border-slate-100 shadow-md overflow-hidden animate-pulse mb-6">
      <div className="w-full sm:w-[280px] md:w-[300px] lg:w-[320px] aspect-[4/3] bg-slate-200 shrink-0" />
      <div className="flex-1 p-5 space-y-3 flex flex-col justify-between">
        <div>
          <div className="h-6 bg-slate-200 rounded-lg w-3/4 mb-2" />
          <div className="h-4 bg-slate-100 rounded-lg w-1/2 mb-4" />
          <div className="h-7 bg-slate-100 rounded-xl w-1/3 mb-3" />
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-5 bg-slate-100 rounded-lg w-16" />
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-auto pt-3 border-t border-slate-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 bg-slate-100 rounded-xl flex-1" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Filter Sidebar
// ──────────────────────────────────────────────────────────────
interface FilterSidebarProps {
  params: URLSearchParams;
  setFilter: (k: string, v: string) => void;
  clearAll: () => void;
  activeCount: number;
  types: { id: string; name: string; category: string }[];
  cities: { id: string; name: string }[];
  localities: { id: string; name: string; city_id: string }[];
}

function FilterSidebar({ params, setFilter, clearAll, activeCount, types, cities, localities }: FilterSidebarProps) {
  const { t } = useLanguageContext();
  const [openSections, setOpenSections] = useState<string[]>(['purpose', 'location', 'price', 'details']);
  const toggle = (s: string) =>
    setOpenSections((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  const open = (s: string) => openSections.includes(s);

  const SectionHeader = ({ id, label }: { id: string; label: string }) => (
    <button
      className="flex w-full items-center justify-between py-2 text-sm font-bold text-slate-800"
      onClick={() => toggle(id)}
    >
      {label}
      <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', open(id) && 'rotate-180')} />
    </button>
  );

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-md overflow-hidden">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <h2 className="font-bold text-slate-900 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-red-600" />
          {t('search.filtersHeader', 'Filters')}
          {activeCount > 0 && (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-extrabold text-white">
              {activeCount}
            </span>
          )}
        </h2>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold"
          >
            <X className="h-3.5 w-3.5" /> {t('search.clearAll', 'Clear All')}
          </button>
        )}
      </div>

      <div className="p-4 space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Purpose */}
        <div className="border-b border-slate-50 pb-2">
          <SectionHeader id="purpose" label={t('search.purposeLabel', 'Purpose')} />
          {open('purpose') && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                { v: 'Sale', l: t('common.sale', 'Buy') },
                { v: 'Rent', l: t('common.rent', 'Rent') },
              ].map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => setFilter('purpose', params.get('purpose') === v ? '' : v)}
                  className={cn(
                    'rounded-xl py-2 text-sm font-bold transition border',
                    params.get('purpose') === v
                      ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-red-300 hover:bg-red-50',
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Location */}
        <div className="border-b border-slate-50 pb-2">
          <SectionHeader id="location" label={t('search.cityLabel', 'Location')} />
          {open('location') && (
            <div className="mt-2">
              <LocationCityAreaFilter
                selectedCityId={params.get('city') ?? undefined}
                selectedCityName={cities?.find((c) => c.id === params.get('city'))?.name || params.get('city') || undefined}
                selectedLocalityId={params.get('locality') ?? undefined}
                selectedLocalityName={localities?.find((l) => l.id === params.get('locality'))?.name || params.get('locality') || undefined}
                onChange={(loc) => {
                  setFilter('city', loc.cityId || '');
                  setFilter('locality', loc.localityName || loc.localityId || '');
                }}
              />
            </div>
          )}
        </div>

        {/* Property Type */}
        <div className="border-b border-slate-50 pb-2">
          <SectionHeader id="type" label={t('search.propertyTypeLabel', 'Property Type')} />
          {open('type') && (
            <div className="mt-2">
              <select
                value={params.get('type_id') ?? ''}
                onChange={(e) => setFilter('type_id', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-200"
              >
                <option value="">{t('search.anyType', 'Any Type')}</option>
                {types?.map((t2) => (
                  <option key={t2.id} value={t2.id}>
                    {t2.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Price */}
        <div className="border-b border-slate-50 pb-2">
          <SectionHeader id="price" label={t('search.priceRange', 'Price Range')} />
          {open('price') && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  {t('search.minPrice', 'Min ₹')}
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={params.get('min_price') ?? ''}
                  onChange={(e) => setFilter('min_price', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  {t('search.maxPrice', 'Max ₹')}
                </label>
                <input
                  type="number"
                  placeholder="∞"
                  value={params.get('max_price') ?? ''}
                  onChange={(e) => setFilter('max_price', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="border-b border-slate-50 pb-2">
          <SectionHeader id="details" label={t('search.bedroomsLabel', 'Bedrooms & Bathrooms')} />
          {open('details') && (
            <div className="mt-2 space-y-3">
              <div>
                <p className="text-[11px] font-bold text-slate-500 mb-1.5">{t('search.bedroomsLabel', 'Bedrooms')}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {['', '1', '2', '3', '4', '5+'].map((b) => (
                    <button
                      key={b}
                      onClick={() => setFilter('bedrooms', b === '5+' ? '5' : b)}
                      className={cn(
                        'h-8 px-3 rounded-xl text-xs font-bold border transition',
                        params.get('bedrooms') === (b === '5+' ? '5' : b)
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-red-300',
                      )}
                    >
                      {b || t('search.any', 'Any')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 mb-1.5">{t('search.bathroomsLabel', 'Bathrooms')}</p>
                <div className="flex gap-1.5">
                  {['', '1', '2', '3', '4'].map((b) => (
                    <button
                      key={b}
                      onClick={() => setFilter('bathrooms', b)}
                      className={cn(
                        'h-8 px-3 rounded-xl text-xs font-bold border transition',
                        params.get('bathrooms') === b
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-red-300',
                      )}
                    >
                      {b || t('search.any', 'Any')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Area */}
        <div className="border-b border-slate-50 pb-2">
          <SectionHeader id="area" label={t('search.areaRange', 'Area (sq.ft)')} />
          {open('area') && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder={t('search.minArea', 'Min')}
                value={params.get('min_area') ?? ''}
                onChange={(e) => setFilter('min_area', e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
              />
              <input
                type="number"
                placeholder={t('search.maxArea', 'Max')}
                value={params.get('max_area') ?? ''}
                onChange={(e) => setFilter('max_area', e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Furnishing */}
        <div className="border-b border-slate-50 pb-2">
          <SectionHeader id="furnish" label={t('search.furnishingLabel', 'Furnishing')} />
          {open('furnish') && (
            <div className="mt-2 space-y-1.5">
              {[
                { v: '', l: t('search.any', 'Any') },
                { v: 'Unfurnished', l: t('search.unfurnished', 'Unfurnished') },
                { v: 'Semi-Furnished', l: t('search.semiFurnished', 'Semi-Furnished') },
                { v: 'Fully Furnished', l: t('search.fullyFurnished', 'Fully Furnished') },
              ].map(({ v, l }) => (
                <label key={v} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="furnishing"
                    value={v}
                    checked={params.get('furnishing') === v || (!params.get('furnishing') && !v)}
                    onChange={() => setFilter('furnishing', v)}
                    className="text-red-600 border-slate-300 focus:ring-red-400 accent-red-600 cursor-pointer"
                  />
                  {l}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Extras */}
        <div className="pt-2 space-y-2">
          <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={params.get('luxury') === '1'}
              onChange={(e) => setFilter('luxury', e.target.checked ? '1' : '')}
              className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-400 accent-red-600 cursor-pointer"
            />
            ✨ {t('search.luxuryOnly', 'Luxury Properties Only')}
          </label>
          <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={params.get('virtual_tour') === '1'}
              onChange={(e) => setFilter('virtual_tour', e.target.checked ? '1' : '')}
              className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-400 accent-red-600 cursor-pointer"
            />
            <Camera className="h-3.5 w-3.5 text-emerald-600" /> {t('search.hasVirtualTour', '360° Virtual Tour')}
          </label>
        </div>
      </div>
    </div>
  );
}

const FILTER_CHIP_LABELS: Record<string, string> = {
  category: 'Category',
  purpose: 'Purpose',
  city_id: 'Location',
  city: 'Location',
  locality_id: 'Locality',
  locality: 'Locality',
  type: 'Type',
  type_id: 'Type',
  min_price: 'Min Price',
  max_price: 'Max Price',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  min_area: 'Min Area',
  max_area: 'Max Area',
  possession_status: 'Possession',
  amenities: 'Amenities',
  luxury: 'Luxury',
};

// Never render raw UUIDs in filter chips — resolve city_id/locality_id/type to their readable names.
function describeFilterChip(
  key: string,
  value: string,
  lookups: {
    cities?: { id: string; name: string }[];
    localities?: { id: string; name: string }[];
    types?: { id: string; name: string }[];
  },
): { label: string; value: string } {
  const label = FILTER_CHIP_LABELS[key] || key;
  let resolved = value;
  if (key === 'category') {
    const meta = getCategoryMeta(value);
    resolved = meta?.name ?? value;
  } else if (key === 'city_id') {
    resolved = lookups.cities?.find((c) => c.id === value)?.name ?? value;
  } else if (key === 'locality_id') {
    resolved = lookups.localities?.find((l) => l.id === value)?.name ?? value;
  } else if (key === 'type' || key === 'type_id') {
    resolved = lookups.types?.find((ty) => ty.id === value)?.name ?? value;
  } else if (key === 'amenities') {
    resolved = value.split(',').map(formatAmenityLabel).join(', ');
  }
  return { label, value: resolved };
}

// ──────────────────────────────────────────────────────────────
// Main Search Page
// ──────────────────────────────────────────────────────────────
export function SearchPage() {
  const { t } = useLanguageContext();
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { category: routeCategory } = useParams<{ category?: string }>();
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const view = (params.get('view') as ViewMode) || 'list';
  const setView = (v: ViewMode) => {
    const next = new URLSearchParams(params);
    next.set('view', v);
    setParams(next);
  };
  
  const rawQParam = params.get('q') || '';
  const defaultSort: SortOption = rawQParam.trim() ? 'relevance' : 'newest';
  const sort = (params.get('sort') as SortOption) || defaultSort;
  const setSort = (s: SortOption) => {
    const next = new URLSearchParams(params);
    next.set('sort', s);
    next.delete('page');
    setParams(next);
  };
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const queryClient = useQueryClient();
  const { data: dbFavoriteIds } = useFavorites(user?.id);
  const [guestFavoriteIds, setGuestFavoriteIds] = useState<string[]>(getLocalFavoriteIds());

  useEffect(() => {
    if (!user) {
      const handleSync = () => setGuestFavoriteIds(getLocalFavoriteIds());
      window.addEventListener('realtynow-favorites-updated', handleSync);
      return () => window.removeEventListener('realtynow-favorites-updated', handleSync);
    }
  }, [user]);

  const currentFavoriteIds = useMemo(
    () => new Set(user ? dbFavoriteIds || [] : guestFavoriteIds),
    [user, dbFavoriteIds, guestFavoriteIds],
  );

  const [comparedIds, setComparedIds] = useState<Set<string>>(() => new Set(getCompareIds()));

  useEffect(() => {
    const handleSync = () => setComparedIds(new Set(getCompareIds()));
    window.addEventListener('realtynow-compare-updated', handleSync);
    return () => window.removeEventListener('realtynow-compare-updated', handleSync);
  }, []);
  const [isVoiceSearchInitiated, setIsVoiceSearchInitiated] = useState(false);
  const [selectedMapPropertyId, setSelectedMapPropertyId] = useState<string | null>(null);
  const [hoveredMapPropertyId, setHoveredMapPropertyId] = useState<string | null>(null);
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  // ── Click-outside: close suggestions when user clicks anywhere outside the
  // search container (input + dropdown). Uses the shared useClickOutside hook
  // which also handles ESC and touchstart so mobile works too.
  const searchContainerRef = useRef<HTMLDivElement>(null);
  useClickOutside(searchContainerRef, () => setSuggestions([]), suggestions.length > 0);

  const { data: types } = useQuery({
    queryKey: ['ptypes-all'],
    queryFn: async () => {
      const { data } = await supabase.from('property_types').select('id, name, category').order('name');
      return data ?? [];
    },
  });
  const { data: cities } = useQuery({
    queryKey: ['cities-all'],
    queryFn: async () => {
      const { data } = await supabase.from('cities').select('id, name').order('name');
      return data ?? [];
    },
  });
  const { data: localities } = useQuery({
    queryKey: ['localities-all'],
    queryFn: async () => {
      const { data } = await supabase.from('localities').select('id, name, city_id').order('name').limit(200);
      return data ?? [];
    },
  });

  const rawQ = params.get('q') || '';
  const parsedQueryIntent = useMemo(() => {
    if (!rawQ) return null;
    return parsePropertySearchQuery(rawQ);
  }, [rawQ]);

  const query = rawQ;

  interface RichSuggestion {
    id: string;
    type: 'location' | 'property';
    title: string;
    locationName?: string;
    cityName?: string;
    categories?: { type: CategorySlug; label: string; emoji: string; count: number }[];
  }

  const [richSuggestions, setRichSuggestions] = useState<RichSuggestion[]>([]);

  const searchSuggestions = useCallback(async (q: string) => {
    const { normalized: cleaned } = normalizeSearchQuery(q);
    if (cleaned.length < 2) {
      setSuggestions([]);
      setRichSuggestions([]);
      return;
    }

    try {
      // 1. Fetch matching properties from live search view with full details
      const { data: propData } = await supabase
        .from('v_properties_search')
        .select('id, title, seo_slug, price, rent_amount, purpose, locality_name, city_name, bedrooms, property_type_name, cover_image_url, images')
        .or('status.eq.published,status.eq.live,is_live.eq.true')
        .ilike('search_text', `%${cleaned}%`)
        .limit(6);

      setSuggestions(propData ?? []);

      // 2. Check if the query matches a locality/city to provide instant location discovery
      const locationMatches: RichSuggestion[] = [];
      const matchingLocalities = (localities ?? [])
        .filter((l) => l.name.toLowerCase().includes(cleaned.toLowerCase()))
        .slice(0, 2);

      for (const loc of matchingLocalities) {
        const disc = await fetchLocationCategoryDiscovery(loc.name);
        if (disc.categories.length > 0) {
          const cName = cities?.find((c) => c.id === loc.city_id)?.name;
          locationMatches.push({
            id: `loc-${loc.id}`,
            type: 'location',
            title: cName ? `${loc.name}, ${cName}` : loc.name,
            locationName: loc.name,
            cityName: cName,
            categories: disc.categories.slice(0, 4),
          });
        }
      }

      setRichSuggestions(locationMatches);
    } catch {
      // Fallback to simple title list
    }
  }, [localities, cities]);

  const activeCategorySlug = normalizeCategorySlug(
    routeCategory || params.get('category') || params.get('type') || (parsedQueryIntent?.propertyType ?? undefined)
  );
  const activeCategoryMeta = useMemo(() => getCategoryMeta(activeCategorySlug), [activeCategorySlug]);

  const filters: PropertyFilters = useMemo(() => {
    const typeIdParam = params.get('type_id') || undefined;
    const typeNameParam = params.get('type') || undefined;

    let resolvedTypeId = typeIdParam;
    if (typeNameParam && types) {
      const found = types.find((t2) => t2.name.toLowerCase() === typeNameParam.toLowerCase());
      if (found) resolvedTypeId = found.id;
    }

    // Resolve ?city_id=UUID/Name or ?city=Name (normalize to readable city name)
    const cityIdParam = params.get('city_id') || params.get('city') || undefined;
    let resolvedCityId: string | undefined = cityIdParam;
    if (cityIdParam) {
      const isUuid = /^[0-9a-f-]{36}$/i.test(cityIdParam);
      if (isUuid) {
        if (cityIdParam === 'fa963656-a6dc-4167-ae42-6dab041befe6' || cityIdParam === '04ec1d24-d2e8-4ee7-91aa-90fb4dfd3b9e') {
          resolvedCityId = 'Hyderabad';
        } else if (cities) {
          const found = cities.find((c) => c.id === cityIdParam);
          if (found) resolvedCityId = found.name;
        }
      }
    }

    // Resolve ?locality_id=... or ?locality=... (keep readable locality name for flexible matching)
    const localityParam = params.get('locality_id') || params.get('locality') || undefined;
    let resolvedLocalityId: string | undefined = localityParam;
    if (localityParam) {
      const isUuid = /^[0-9a-f-]{36}$/i.test(localityParam);
      if (isUuid && localities) {
        const found = localities.find((l) => l.id === localityParam);
        if (found) resolvedLocalityId = found.name;
      }
    }

    const rawAmenities = params.get('amenities');
    const amenitiesList = rawAmenities ? rawAmenities.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

    return {
      q: params.get('q') || undefined,
      city_id: resolvedCityId,
      ...(resolvedLocalityId ? { locality_id: resolvedLocalityId } : {}),
      purpose: params.get('purpose') || parsedQueryIntent?.purpose || undefined,
      category: activeCategorySlug || undefined,
      type: typeNameParam,
      property_type_id: resolvedTypeId,
      min_price: parseNumberParam(params, 'min_price') ?? parsedQueryIntent?.minPrice ?? undefined,
      max_price: parseNumberParam(params, 'max_price') ?? parsedQueryIntent?.maxPrice ?? undefined,
      bedrooms: parseNumberParam(params, 'bedrooms') ?? parsedQueryIntent?.bedrooms ?? undefined,
      bathrooms: parseNumberParam(params, 'bathrooms'),
      min_area: parseNumberParam(params, 'min_area'),
      max_area: parseNumberParam(params, 'max_area'),
      amenities: amenitiesList,
      furnishing: params.get('furnishing') || undefined,
      facing: params.get('facing') || undefined,
      possession_status: params.get('possession_status') || undefined,
      verified_status: params.get('verified_status') || undefined,
      is_luxury: params.get('luxury') === '1' || undefined,
      sort_by: sort === 'relevance' ? undefined : (sort as any),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    };
  }, [params, types, cities, localities, sort, page, activeCategorySlug, parsedQueryIntent]);

  // Target Location for Cross-Category Discovery
  const targetLocation = useMemo(() => {
    const loc = params.get('locality_id') || params.get('locality');
    if (loc) {
      if (/^[0-9a-f-]{36}$/i.test(loc) && localities) {
        const found = localities.find((l) => l.id === loc);
        if (found) return found.name;
      }
      return loc;
    }
    const city = params.get('city_id') || params.get('city');
    if (city) {
      if (/^[0-9a-f-]{36}$/i.test(city)) {
        if (city === 'fa963656-a6dc-4167-ae42-6dab041befe6' || city === '04ec1d24-d2e8-4ee7-91aa-90fb4dfd3b9e') {
          return 'Hyderabad';
        }
        const found = cities?.find((c) => c.id === city);
        if (found) return found.name;
      }
      return city;
    }
    const locationParam = params.get('location');
    if (locationParam) return locationParam;
    if (filters.locality_id && localities) {
      const l = localities.find((locItem) => locItem.id === filters.locality_id);
      if (l) return l.name;
    }
    if (filters.city_id && cities) {
      const c = cities.find((ct) => ct.id === filters.city_id);
      if (c) return c.name;
    }
    if (parsedQueryIntent?.location && parsedQueryIntent.location.length >= 2) {
      return parsedQueryIntent.location;
    }
    return undefined;
  }, [params, filters.locality_id, filters.city_id, localities, cities, parsedQueryIntent]);

  // Base non-category filters for live, synchronized category counts
  const baseCategoryFilters: PropertyFilters = useMemo(() => {
    return {
      ...filters,
      category: undefined,
      type: undefined,
      property_type_id: undefined,
      limit: 5000,
      offset: 0,
    };
  }, [filters]);

  // Fetch Live Synced Category Discovery (grouped category counts strictly from real active inventory matching all non-category filters)
  // Fetch Live Synced Category Discovery (grouped category counts strictly from real active inventory matching all non-category filters)
  const { data: locationDiscovery } = useQuery({
    queryKey: ['search-category-discovery-sync', baseCategoryFilters],
    queryFn: () => fetchSearchCategoryCounts(baseCategoryFilters),
  });

  // Query canonical live properties with intelligence and relevance ranking
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['search', filters, sort, page],
    queryFn: async () => {
      const res = await executeGlobalPropertySearch({
        ...filters,
        sortBy: sort as any,
        page,
        pageSize: PAGE_SIZE,
      });

      // Log search telemetry in background
      if (filters.q) {
        logSearchQuery({
          query: filters.q,
          parsed_intent: res.parsedIntent,
          filters,
          results_count: res.totalCount,
          city_id: filters.city_id,
        });
      }

      return {
        data: res.properties,
        count: res.totalCount,
        baseTotalCount: res.baseTotalCount,
        categoryCounts: res.categoryCounts,
      };
    },
    placeholderData: (previousData) => previousData,
  });

  const categoryCountsMap = useMemo(() => {
    if (data?.categoryCounts) return data.categoryCounts;
    if (!locationDiscovery?.categories) return undefined;
    const map: Partial<Record<CategorySlug, number>> = {};
    for (const cat of locationDiscovery.categories) {
      map[cat.type] = cat.count;
    }
    return map;
  }, [data?.categoryCounts, locationDiscovery]);

  const unifiedDiscovery = useMemo(() => {
    if (!locationDiscovery) return null;
    if (!data?.categoryCounts) return locationDiscovery;

    return {
      ...locationDiscovery,
      totalCount: data.baseTotalCount ?? locationDiscovery.totalCount,
      categories: locationDiscovery.categories.map((c) => ({
        ...c,
        count: data.categoryCounts[c.type] ?? c.count,
      })),
    };
  }, [locationDiscovery, data?.categoryCounts, data?.baseTotalCount]);

  const handleCategorySelect = (catSlug: CategorySlug | null) => {
    const next = new URLSearchParams(params);
    if (catSlug) {
      next.set('category', catSlug);
      next.delete('type');
      next.delete('type_id');
    } else {
      next.delete('category');
      next.delete('type');
      next.delete('type_id');
    }
    next.delete('page');
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Supabase Realtime synchronization for instant property discovery
  useEffect(() => {
    const channel = supabase
      .channel('public_search_properties_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['search'] });
          queryClient.invalidateQueries({ queryKey: ['search-category-discovery-sync'] });
          queryClient.invalidateQueries({ queryKey: ['location-category-discovery'] });
          queryClient.invalidateQueries({ queryKey: ['ptypes-all'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (isVoiceSearchInitiated && !isLoading && data) {
      const propertyText = data.count === 1 ? 'property' : 'properties';
      const introText = data.count > 0 
        ? `I found ${data.count} ${propertyText} matching your search.`
        : `I'm sorry, I couldn't find any properties matching your search.`;
      generateSpeech(introText);
      setIsVoiceSearchInitiated(false);
    }
  }, [isVoiceSearchInitiated, isLoading, data]);

  const goToPage = (p: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearAll = () => {
    setParams(new URLSearchParams());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const activeCount = Array.from(params.keys()).filter((k) => !['q', 'page'].includes(k)).length;
  const totalPages = data?.count ? Math.ceil(data.count / PAGE_SIZE) : 1;

  const toggleSave = async (id: string) => {
    const isCurrentlySaved = currentFavoriteIds.has(id);
    try {
      const isNowSaved = await toggleFavoriteProperty(id, user?.id, isCurrentlySaved);
      if (!user) {
        setGuestFavoriteIds(getLocalFavoriteIds());
      } else {
        queryClient.invalidateQueries({ queryKey: ['favorites', user.id] });
      }
      addToast('success', isNowSaved ? 'Saved to favorites' : 'Removed from saved');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not update favorites');
    }
  };
  const toggleCompare = async (id: string) => {
    try {
      const isNowCompared = await toggleCompareProperty(id, user?.id);
      setComparedIds(new Set(getCompareIds()));
      addToast(
        'success',
        isNowCompared
          ? t('notifications.addedToCompare', 'Added to compare list')
          : t('notifications.removedFromCompare', 'Removed from compare list'),
      );
    } catch (err) {
      addToast(
        'error',
        err instanceof Error ? err.message : t('notifications.errorCompare', 'Could not update compare list'),
      );
    }
  };

  const activeLocalityName = useMemo(() => {
    const raw = params.get('locality_id') || params.get('locality') || filters.locality_id;
    if (!raw) return undefined;
    if (/^[0-9a-f-]{36}$/i.test(raw) && localities) {
      const found = localities.find((l) => l.id === raw);
      if (found) return found.name;
    }
    return raw;
  }, [params, filters.locality_id, localities]);

  const activeCityName = useMemo(() => {
    const raw = params.get('city_id') || params.get('city') || filters.city_id;
    if (!raw) return undefined;
    if (/^[0-9a-f-]{36}$/i.test(raw)) {
      if (raw === 'fa963656-a6dc-4167-ae42-6dab041befe6' || raw === '04ec1d24-d2e8-4ee7-91aa-90fb4dfd3b9e') {
        return 'Hyderabad';
      }
      if (cities) {
        const found = cities.find((c) => c.id === raw);
        if (found) return found.name;
      }
    }
    return raw;
  }, [params, filters.city_id, cities]);

  const cityName = useMemo(() => {
    if (filters.city_id && cities) {
      return cities.find((c) => c.id === filters.city_id)?.name;
    }
    return params.get('city') || undefined;
  }, [filters.city_id, cities, params]);

  const displayLocation = useMemo(() => {
    return targetLocation || cityName || locationDiscovery?.city || locationDiscovery?.location || 'this location';
  }, [targetLocation, cityName, locationDiscovery]);

  const pageTitle = useMemo(() => {
    const locName = targetLocation || cityName;
    if (activeCategoryMeta) {
      if (locName) return `${activeCategoryMeta.pluralName} in ${locName}`;
      if (filters.purpose === 'Rent') return `${activeCategoryMeta.pluralName} for Rent`;
      if (filters.purpose === 'Sale') return `${activeCategoryMeta.pluralName} for Sale`;
      return `${activeCategoryMeta.pluralName}`;
    }
    if (locName) return `Properties in ${locName}`;
    if (filters.purpose === 'Rent') return t('search.forRentTitle', 'Properties for Rent');
    if (filters.purpose === 'Sale') return t('search.forSaleTitle', 'Properties for Sale');
    return t('search.title', 'Search Properties');
  }, [activeCategoryMeta, targetLocation, cityName, filters.purpose, t]);

  useSEO({
    title: pageTitle,
    description: `Explore verified ${pageTitle.toLowerCase()} with direct owner contact, 3D tours, and zero brokerage options on RealtyNow.`,
    schema: {
      "@context": "https://schema.org",
      "@type": "SearchResultsPage",
      "name": pageTitle,
    }
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── TOP TOOLBAR ── */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="container-page py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div ref={searchContainerRef} className="relative flex-1 min-w-0 sm:min-w-[200px] max-w-md w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => {
                  setFilter('q', e.target.value);
                  searchSuggestions(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const trimmed = query.trim().toLowerCase();
                    const exactMatch = suggestions.find(
                      (p) => p.title && p.title.trim().toLowerCase() === trimmed
                    );
                    if (exactMatch) {
                      setSuggestions([]);
                      setRichSuggestions([]);
                      navigate(generatePropertyUrl(exactMatch));
                    }
                  }
                }}
                placeholder={t('search.placeholder', 'City, locality, project or builder...')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-20 text-sm text-slate-800 placeholder:text-slate-400 focus:border-red-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {query && (
                  <button
                    onClick={() => {
                      setFilter('q', '');
                      setSuggestions([]);
                      setRichSuggestions([]);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <VoiceSearchButton
                  onResult={(text) => {
                    setFilter('q', text);
                    setIsVoiceSearchInitiated(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="h-7 w-7 !p-0 rounded-lg"
                />
              </div>
              <AnimatePresence>
                {(suggestions.length > 0 || richSuggestions.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute z-50 mt-1 w-full rounded-2xl border border-slate-100 bg-white shadow-2xl overflow-hidden divide-y divide-slate-100 max-h-[380px] overflow-y-auto"
                  >
                    {/* Location Discovery Suggestions */}
                    {richSuggestions.length > 0 && (
                      <div className="p-2 bg-slate-50/70">
                        <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          Locations & Availability
                        </div>
                        {richSuggestions.map((loc) => (
                          <div key={loc.id} className="p-2 rounded-xl bg-white border border-slate-100 shadow-sm mb-1.5 last:mb-0">
                            <button
                              onClick={() => {
                                setFilter('q', loc.locationName || loc.title);
                                setSuggestions([]);
                                setRichSuggestions([]);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-red-600 transition w-full text-left"
                            >
                              <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              <span>{loc.title}</span>
                            </button>
                            {loc.categories && loc.categories.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                {loc.categories.map((cat) => (
                                  <button
                                    key={cat.type}
                                    onClick={() => {
                                      const next = new URLSearchParams(params);
                                      next.set('q', loc.locationName || loc.title);
                                      next.set('category', cat.type);
                                      next.delete('page');
                                      setParams(next);
                                      setSuggestions([]);
                                      setRichSuggestions([]);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-700 transition"
                                  >
                                    <span>{cat.emoji}</span>
                                    <span>{cat.label}</span>
                                    <span className="text-slate-400 font-extrabold">{cat.count}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Direct Matching Property Listings */}
                    {suggestions.length > 0 && (
                      <div className="py-2 divide-y divide-slate-100">
                        <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          Matching Properties ({suggestions.length})
                        </div>
                        {suggestions.map((p) => {
                          const cover = p.cover_image_url || (Array.isArray(p.images) ? p.images[0] : null) || DEFAULT_PROPERTY_IMAGE;
                          const priceDisplay = p.price
                            ? formatCompactPrice(p.price)
                            : p.rent_amount
                              ? `${formatCompactPrice(p.rent_amount)}/mo`
                              : 'Price on Request';

                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                setSuggestions([]);
                                setRichSuggestions([]);
                                navigate(generatePropertyUrl(p));
                              }}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-red-50/70 transition-all text-left cursor-pointer group"
                            >
                              <img
                                src={cover}
                                alt={p.title || 'Property'}
                                className="h-10 w-13 rounded-lg object-cover shrink-0 border border-slate-100 shadow-2xs"
                                onError={(e) => {
                                  (e.target as HTMLElement).setAttribute('src', DEFAULT_PROPERTY_IMAGE);
                                }}
                              />
                              <div className="min-w-0 flex-1">
                                <h6 className="text-xs font-bold text-slate-900 group-hover:text-red-600 line-clamp-1">
                                  {p.title}
                                </h6>
                                <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                  {[p.locality_name, p.city_name].filter(Boolean).join(', ') || 'Hyderabad'}
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

            {/* Results count */}
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-600">
              <span className="font-bold text-slate-900">{formatNumber(data?.count ?? 0)}</span>
              <span>{t('search.results', 'results')}</span>
              {filters.q && (
                <span className="text-slate-400">
                  for "<span className="font-semibold text-slate-700">{filters.q}</span>"
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {/* Sort */}
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <SortDesc className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="text-sm font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="relevance">Relevance (Best Match)</option>
                  <option value="newest">Newest First</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="ai_recommended">AI Recommended</option>
                  <option value="most_viewed">Most Viewed</option>
                  <option value="most_contacted">Most Contacted</option>
                  <option value="featured">Featured First</option>
                </select>
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1">
                {(
                  [
                    { v: 'list', Icon: Rows3, label: 'List' },
                    { v: 'grid', Icon: LayoutGrid, label: 'Grid' },
                    { v: 'map', Icon: Map, label: 'Map' },
                  ] as const
                ).map(({ v, Icon, label }) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition',
                      view === v ? 'bg-red-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100',
                    )}
                    title={label}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              {/* Mobile filter toggle */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold transition lg:hidden',
                  showFilters ? 'border-red-400 bg-red-50 text-red-600' : 'border-slate-200 bg-white text-slate-700',
                )}
              >
                <Filter className="h-4 w-4" />
                {t('search.filtersHeader', 'Filters')}
                {activeCount > 0 && (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white font-extrabold">
                    {activeCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Active filter chips */}
          {activeCount > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">{t('search.activeFilters', 'Active:')}</span>
              {Array.from(params.entries())
                .filter(([k]) => !['q', 'page'].includes(k))
                .map(([k, v]) => {
                  const { label, value } = describeFilterChip(k, v, { cities, localities, types });
                  return (
                    <span
                      key={k}
                      className="flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs font-semibold text-red-700"
                    >
                      {label}: {value}
                      <button onClick={() => setFilter(k, '')} className="ml-0.5 hover:text-red-900">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              <button onClick={clearAll} className="text-xs text-slate-500 hover:text-red-600 font-semibold ml-1">
                {t('search.clearAll', 'Clear all')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── BODY: Sidebar + Results ── */}
      <div className="container-page py-6">
        <ListingPromoBanner />
        
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside className={cn('shrink-0 w-72', showFilters ? 'block' : 'hidden lg:block')}>
            <div className="sticky top-[88px]">
              <AdvancedFilters
                cities={cities ?? []}
                localities={localities ?? []}
                filters={filters}
                categoryCounts={categoryCountsMap}
                totalCount={data?.baseTotalCount ?? unifiedDiscovery?.totalCount ?? locationDiscovery?.totalCount}
                onFilterChange={(newFilters) => {
                  const updated = { ...filters, ...newFilters };
                  const newParams = new URLSearchParams(params);
                  
                  // Reset page on filter change
                  newParams.delete('page');

                  const syncParam = (key: string, value: any) => {
                    if (value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)) {
                      newParams.set(key, Array.isArray(value) ? value.join(',') : value.toString());
                    } else {
                      newParams.delete(key);
                    }
                  };

                  syncParam('category', updated.category);
                  syncParam('purpose', updated.purpose);
                  syncParam('city_id', updated.city_id);
                  syncParam('locality_id', updated.locality_id);
                  syncParam('type', updated.property_type_id);
                  syncParam('min_price', updated.min_price);
                  syncParam('max_price', updated.max_price);
                  syncParam('bedrooms', updated.bedrooms);
                  syncParam('bathrooms', updated.bathrooms);
                  syncParam('min_area', updated.min_area);
                  syncParam('max_area', updated.max_area);
                  syncParam('possession_status', updated.possession_status);
                  syncParam('amenities', updated.amenities);

                  setParams(newParams);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onCloseMobile={() => setShowFilters(false)}
              />
            </div>
          </aside>

          {/* Results Area */}
          <div className="flex-1 min-w-0 min-h-[600px]">
            {/* Location Category Discovery Banner: ONLY shown when exploring ALL categories (no specific category filter selected) */}
            {(unifiedDiscovery || locationDiscovery) && ((unifiedDiscovery || locationDiscovery)?.categories?.length ?? 0) > 0 && !activeCategorySlug && (
              <div className="mb-5">
                <LocationCategoryDiscovery
                  discovery={unifiedDiscovery || locationDiscovery || null}
                  activeCategory={null}
                  onSelectCategory={handleCategorySelect}
                  purpose={filters.purpose}
                />
              </div>
            )}

            {/* Results heading */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-xl font-bold text-slate-900">
                  {pageTitle}
                  {data?.count != null && (
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      ({formatNumber(data.count)} {t('search.results', 'results')})
                    </span>
                  )}
                </h1>
                {isFetching && (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-bold shadow-2xs animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                    <span>Loading properties...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Map view */}
            {view === 'map' && (
              <div className="space-y-6">
                {isLoading ? (
                  <div className="h-[580px] w-full rounded-3xl bg-slate-200 animate-pulse flex items-center justify-center">
                    <span className="text-slate-400 font-semibold text-sm">Loading properties on map...</span>
                  </div>
                ) : (
                  <PropertyMap
                    properties={(data?.data ?? []) as any}
                    selectedPropertyId={selectedMapPropertyId}
                    hoveredPropertyId={hoveredMapPropertyId}
                    onSelectProperty={(p) => setSelectedMapPropertyId(p.id)}
                    height="580px"
                    defaultCity={params.get('city') || 'Hyderabad'}
                  />
                )}

                {/* Synced Cards Section in Map View */}
                {data && data.data.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">
                          {t('search.propertiesInView', 'Properties on Map')} ({data.count})
                        </h3>
                        <p className="text-xs text-slate-500">
                          {t('search.mapHoverHint', 'Click any pin above or card below to highlight location')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {data.data.map((p) => (
                        <div
                          key={p.id}
                          onMouseEnter={() => setHoveredMapPropertyId(p.id)}
                          onMouseLeave={() => setHoveredMapPropertyId(null)}
                          onClick={() => setSelectedMapPropertyId(p.id)}
                          className={cn(
                            'transition-all duration-200 rounded-2xl',
                            selectedMapPropertyId === p.id && 'ring-2 ring-red-600 shadow-lg scale-[1.01]'
                          )}
                        >
                          <GridCard
                            property={p as any}
                            onSave={toggleSave}
                            onCompare={toggleCompare}
                            saved={currentFavoriteIds.has(p.id)}
                            compared={comparedIds.has(p.id)}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Map Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-8 flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          disabled={page <= 1}
                          onClick={() => goToPage(page - 1)}
                          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          <ChevronLeft className="h-4 w-4" /> {t('common.back', 'Prev')}
                        </button>
                        {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                          const pg = i + 1;
                          return (
                            <button
                              key={pg}
                              onClick={() => goToPage(pg)}
                              className={cn(
                                'h-9 w-9 rounded-xl text-sm font-bold transition border',
                                page === pg
                                  ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600',
                              )}
                            >
                              {pg}
                            </button>
                          );
                        })}
                        {totalPages > 7 && <span className="px-2 text-slate-400 font-bold">…</span>}
                        <button
                          disabled={page >= totalPages}
                          onClick={() => goToPage(page + 1)}
                          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          {t('common.next', 'Next')} <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* List / Grid */}
            {view !== 'map' && (
              <>
                {isLoading ? (
                  <div
                    className={cn(
                      'space-y-4',
                      view === 'grid' && 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 space-y-0',
                    )}
                  >
                    {Array.from({ length: view === 'grid' ? 10 : 4 }).map((_, i) =>
                      view === 'list' ? (
                        <ListSkeleton key={i} />
                      ) : (
                        <div key={i} className="aspect-[3/4] rounded-2xl bg-slate-200 animate-pulse" />
                      ),
                    )}
                  </div>
                ) : isError ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-red-200 bg-red-50/40 py-20 gap-4">
                    <AlertTriangle className="h-12 w-12 text-red-400" />
                    <p className="font-bold text-slate-700 text-lg">Something went wrong</p>
                    <p className="text-sm text-slate-500 text-center max-w-sm">
                      We couldn't load properties right now. Please check your connection and try again.
                    </p>
                    <button
                      onClick={() => refetch()}
                      disabled={isFetching}
                      className="rounded-xl bg-red-600 text-white px-5 py-2 text-sm font-bold hover:bg-red-700 disabled:opacity-60 transition"
                    >
                      {isFetching ? 'Retrying…' : 'Try again'}
                    </button>
                  </div>
                ) : data && data.data.length > 0 ? (
                  <>
                    <div
                      className={cn(
                        'transition-opacity duration-200',
                        isFetching && 'opacity-60 pointer-events-none',
                        view === 'grid'
                          ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'
                          : 'flex flex-col',
                      )}
                    >
                      {data.data.map((p) => (
                        <div key={p.id} className="w-full">
                          {view === 'list' ? (
                            <HorizontalCard
                              property={p as any}
                              onSave={toggleSave}
                              onCompare={toggleCompare}
                              saved={currentFavoriteIds.has(p.id)}
                              compared={comparedIds.has(p.id)}
                            />
                          ) : (
                            <GridCard
                              property={p as any}
                              onSave={toggleSave}
                              onCompare={toggleCompare}
                              saved={currentFavoriteIds.has(p.id)}
                              compared={comparedIds.has(p.id)}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-8 flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          disabled={page <= 1}
                          onClick={() => goToPage(page - 1)}
                          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          <ChevronLeft className="h-4 w-4" /> {t('common.back', 'Prev')}
                        </button>
                        {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                          const pg = i + 1;
                          return (
                            <button
                              key={pg}
                              onClick={() => goToPage(pg)}
                              className={cn(
                                'h-9 w-9 rounded-xl text-sm font-bold transition border',
                                page === pg
                                  ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600',
                              )}
                            >
                              {pg}
                            </button>
                          );
                        })}
                        {totalPages > 7 && <span className="px-2 text-slate-400 font-bold">…</span>}
                        <button
                          disabled={page >= totalPages}
                          onClick={() => goToPage(page + 1)}
                          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          {t('common.next', 'Next')} <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm text-center">
                    {/* Icon */}
                    <div className="mx-auto mb-4 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shadow-sm">
                      {activeCategoryMeta ? (
                        <activeCategoryMeta.icon className="h-7 w-7 sm:h-8 sm:w-8" />
                      ) : (
                        <MapPin className="h-7 w-7 sm:h-8 sm:w-8 text-slate-400" />
                      )}
                    </div>

                    {/* Title */}
                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 capitalize">
                      {activeLocalityName
                        ? `No Properties Found in ${activeLocalityName}${activeCityName ? `, ${activeCityName}` : ''}`
                        : activeCategoryMeta
                          ? `No ${activeCategoryMeta.pluralName} Available in ${displayLocation}`
                          : filters.q || filters.city_id
                            ? `No properties found${filters.q ? ` matching "${filters.q}"` : ` in ${displayLocation}`}`
                            : t('search.notFoundTitle', 'No properties found')}
                    </h2>

                    {/* Description */}
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                      {activeLocalityName ? (
                        <span>
                          There are currently no active listings in <strong className="text-slate-900 font-bold">{activeLocalityName}</strong>. Properties in this specific area may be recently sold or undergoing verification. You can browse all available properties in <strong className="text-slate-900 font-bold">{activeCityName || 'the city'}</strong> or explore nearby popular areas below.
                        </span>
                      ) : activeCategoryMeta ? (
                        `We couldn't find any ${activeCategoryMeta.pluralName.toLowerCase()} matching your current location and filters. Try exploring other property categories, clearing filters, or asking our AI Assistant.`
                      ) : (
                        'Try adjusting your filters, searching a different city or locality, or explore other categories.'
                      )}
                    </p>

                    {/* Action buttons */}
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                      {activeLocalityName && (
                        <button
                          onClick={() => {
                            const next = new URLSearchParams(params);
                            next.delete('locality_id');
                            next.delete('locality');
                            next.delete('page');
                            setParams(next);
                          }}
                          className="rounded-xl bg-red-600 text-white px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md shadow-red-600/20 hover:bg-red-700 transition cursor-pointer"
                        >
                          View All in {activeCityName || 'City'}
                        </button>
                      )}
                      {activeCategorySlug && !activeLocalityName && (
                        <button
                          onClick={() => handleCategorySelect(null)}
                          className="rounded-xl bg-red-600 text-white px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md shadow-red-600/20 hover:bg-red-700 transition cursor-pointer"
                        >
                          Explore All Categories
                        </button>
                      )}
                      <button
                        onClick={clearAll}
                        className="rounded-xl border border-slate-200 bg-white text-slate-700 px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer"
                      >
                        {t('search.clearFilters', 'Clear All Filters')}
                      </button>
                      <Link
                        to="/ai-property-advisor"
                        className="rounded-xl bg-navy-900 text-white px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold hover:bg-navy-800 transition"
                      >
                        Ask AI Assistant
                      </Link>
                    </div>

                    {/* Quick Nearby Area Shortcuts when a specific locality has 0 results */}
                    {activeLocalityName && activeCityName && (
                      <div className="mt-8 pt-6 border-t border-slate-100 text-left">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Explore popular areas in <span className="text-red-600 font-bold">{activeCityName}</span>:
                          </span>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200">
                          {['Madhapur', 'Gachibowli', 'Kondapur', 'Hitech City', 'Banjara Hills', 'Tellapur', 'Kollur', 'Kukatpally']
                            .filter((area) => area.toLowerCase() !== activeLocalityName.toLowerCase())
                            .slice(0, 6)
                            .map((areaName) => (
                              <button
                                key={areaName}
                                onClick={() => {
                                  const next = new URLSearchParams(params);
                                  next.set('locality_id', areaName);
                                  next.delete('page');
                                  setParams(next);
                                }}
                                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50/80 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition cursor-pointer shrink-0"
                              >
                                <MapPin className="h-3 w-3 text-red-500" />
                                <span>{areaName}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Alternative Category Suggestions (clearly separated from primary results) */}
                    {locationDiscovery && locationDiscovery.categories.some((c) => c.count > 0 && c.type !== activeCategorySlug) && (
                      <div className="mt-8 pt-6 border-t border-slate-100 text-left">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            You may also explore available property types in <span className="text-red-600">{displayLocation}</span>:
                          </span>
                          <button
                            onClick={() => handleCategorySelect(null)}
                            className="text-xs font-bold text-red-600 hover:text-red-700 transition shrink-0 cursor-pointer"
                          >
                            View All ({locationDiscovery.totalCount})
                          </button>
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200">
                          {locationDiscovery.categories
                            .filter((cat) => cat.count > 0 && cat.type !== activeCategorySlug)
                            .map((cat) => (
                              <button
                                key={cat.type}
                                onClick={() => handleCategorySelect(cat.type)}
                                className="group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border border-slate-200 bg-slate-50/80 hover:bg-red-50 hover:border-red-300 hover:text-red-700 cursor-pointer"
                              >
                                <span>{cat.emoji}</span>
                                <span className="text-slate-800 group-hover:text-red-700">{cat.label}</span>
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 group-hover:bg-red-100 group-hover:text-red-800 transition-colors">
                                  {cat.count}
                                </span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Category Page (Buy / Rent / Commercial / Plots / Luxury / Projects)
// ──────────────────────────────────────────────────────────────
export function CategoryPage({ category }: { category: 'buy' | 'rent' | 'commercial' | 'plots' | 'luxury' | 'projects' }) {
  const { t } = useLanguageContext();
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const purpose = category === 'rent' ? 'Rent' : category === 'buy' ? 'Sale' : undefined;
  const isLuxury = category === 'luxury';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const rawQParam = params.get('q') || '';
  const clearAll = () => setParams(new URLSearchParams());

  const { data: dbFavoriteIds } = useFavorites(user?.id);
  const [guestFavoriteIds, setGuestFavoriteIds] = useState<string[]>(getLocalFavoriteIds());

  useEffect(() => {
    if (!user) {
      const handleSync = () => setGuestFavoriteIds(getLocalFavoriteIds());
      window.addEventListener('realtynow-favorites-updated', handleSync);
      return () => window.removeEventListener('realtynow-favorites-updated', handleSync);
    }
  }, [user]);

  const currentFavoriteIds = useMemo(
    () => new Set(user ? dbFavoriteIds || [] : guestFavoriteIds),
    [user, dbFavoriteIds, guestFavoriteIds],
  );

  const [comparedIds, setComparedIds] = useState<Set<string>>(() => new Set(getCompareIds()));

  useEffect(() => {
    const handleSync = () => setComparedIds(new Set(getCompareIds()));
    window.addEventListener('realtynow-compare-updated', handleSync);
    return () => window.removeEventListener('realtynow-compare-updated', handleSync);
  }, []);

  const toggleCompare = async (id: string) => {
    try {
      const isNowCompared = await toggleCompareProperty(id, user?.id);
      setComparedIds(new Set(getCompareIds()));
      addToast(
        'success',
        isNowCompared
          ? t('notifications.addedToCompare', 'Added to compare list')
          : t('notifications.removedFromCompare', 'Removed from compare list'),
      );
    } catch (err) {
      addToast(
        'error',
        err instanceof Error ? err.message : t('notifications.errorCompare', 'Could not update compare list'),
      );
    }
  };

  const toggleSave = async (id: string) => {
    const isCurrentlySaved = currentFavoriteIds.has(id);
    try {
      const isNowSaved = await toggleFavoriteProperty(id, user?.id, isCurrentlySaved);
      if (!user) {
        setGuestFavoriteIds(getLocalFavoriteIds());
      } else {
        queryClient.invalidateQueries({ queryKey: ['favorites', user.id] });
      }
      addToast('success', isNowSaved ? 'Saved to favorites' : 'Removed from saved');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not update favorites');
    }
  };

  // SEO
  const seoTitle = {
    buy: t('search.forSaleTitle', 'Properties for Sale in Hyderabad'),
    rent: t('search.forRentTitle', 'Properties for Rent in Hyderabad'),
    commercial: t('menu.commercialSpaces', 'Commercial Properties in Hyderabad'),
    plots: t('menu.plotsTitle', 'Plots & Land in Hyderabad'),
    luxury: t('home.signatureCollection', 'Luxury Homes in Hyderabad'),
    projects: t('menu.newProjects', 'New Projects & Developments in Hyderabad'),
  }[category] || 'Properties in Hyderabad';

  useSEO({
    title: seoTitle,
    description: `Browse the best ${seoTitle.toLowerCase()}. Find your dream property today with RealtyNow.`,
    schema: {
      "@context": "https://schema.org",
      "@type": "SearchResultsPage",
      "name": seoTitle,
    }
  });

  const { data: cities } = useQuery({
    queryKey: ['cities-all'],
    queryFn: async () => {
      const { data } = await supabase.from('cities').select('id, name').order('name');
      return data ?? [];
    },
  });

  const { data: localities } = useQuery({
    queryKey: ['localities-all'],
    queryFn: async () => {
      const { data } = await supabase.from('localities').select('id, name, city_id').order('name').limit(200);
      return data ?? [];
    },
  });

  const { data: types } = useQuery({
    queryKey: ['ptypes-all'],
    queryFn: async () => {
      const { data } = await supabase.from('property_types').select('id, name, category').order('name');
      return data ?? [];
    },
  });

  const typeFilter = useMemo(() => {
    if (!types) return undefined;
    if (category === 'commercial') return types.filter((t2) => t2.category === 'Commercial').map((t2) => t2.id);
    if (category === 'plots') return types.filter((t2) => t2.category === 'Plot').map((t2) => t2.id);
    return undefined;
  }, [types, category]);

  const activeCategoryFilter = useMemo(() => {
    if (category === 'plots') return 'plots';
    if (category === 'commercial') return 'commercial-office';
    return params.get('category') || undefined;
  }, [category, params]);

  const filters: PropertyFilters = useMemo(() => {
    const typeIdParam = params.get('type_id') || undefined;
    const typeNameParam = params.get('type') || undefined;
    let resolvedTypeId = typeIdParam;
    if (typeNameParam && types) {
      const found = types.find((t2) => t2.name.toLowerCase() === typeNameParam.toLowerCase());
      if (found) resolvedTypeId = found.id;
    }
    
    // Category defaults
    const defaultPurpose = category === 'rent' ? 'Rent' : category === 'buy' ? 'Sale' : undefined;
    const defaultIsLuxury = category === 'luxury' || undefined;

    // ?city_id=UUID (filter sidebar) takes precedence; ?city=CityName (footer/home links) is resolved via lookup
    const cityIdParam = params.get('city_id') || undefined;
    const cityParam = params.get('city') || undefined;
    let resolvedCityId: string | undefined = cityIdParam;
    if (!resolvedCityId && cityParam) {
      const isUuid = /^[0-9a-f-]{36}$/i.test(cityParam);
      resolvedCityId = isUuid
        ? cityParam
        : (cities?.find((c) => c.name.toLowerCase() === cityParam.toLowerCase())?.id || cityParam);
    }

    const rawAmenities = params.get('amenities');
    const amenitiesList = rawAmenities ? rawAmenities.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

    return {
      q: params.get('q') || undefined,
      category: activeCategoryFilter,
      city_id: resolvedCityId,
      purpose: params.get('purpose') || defaultPurpose,
      property_type_id: resolvedTypeId || (typeFilter && typeFilter.length === 1 ? typeFilter[0] : undefined),
      min_price: parseNumberParam(params, 'min_price'),
      max_price: parseNumberParam(params, 'max_price'),
      bedrooms: parseNumberParam(params, 'bedrooms'),
      bathrooms: parseNumberParam(params, 'bathrooms'),
      min_area: parseNumberParam(params, 'min_area'),
      max_area: parseNumberParam(params, 'max_area'),
      amenities: amenitiesList,
      furnishing: params.get('furnishing') || undefined,
      facing: params.get('facing') || undefined,
      is_luxury: params.get('luxury') === '1' || defaultIsLuxury,
    };
  }, [params, types, category, typeFilter, cities, activeCategoryFilter]);

  // Base non-category filters for live, synchronized category counts in CategoryPage
  const baseCategoryFilters: PropertyFilters = useMemo(() => {
    return {
      ...filters,
      category: undefined,
      type: undefined,
      property_type_id: undefined,
      limit: 5000,
      offset: 0,
    };
  }, [filters]);

  const { data: locationDiscovery } = useQuery({
    queryKey: ['category-page-discovery-sync', category, baseCategoryFilters],
    queryFn: () => fetchSearchCategoryCounts(baseCategoryFilters),
  });

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['category', category, filters, page],
    queryFn: async () => {
      const res = await executeGlobalPropertySearch({
        ...filters,
        category: activeCategoryFilter || category,
        page,
        pageSize: PAGE_SIZE,
      });

      return {
        data: res.properties,
        count: res.totalCount,
        baseTotalCount: res.baseTotalCount,
        categoryCounts: res.categoryCounts,
      };
    },
    placeholderData: (previousData) => previousData,
  });

  const categoryCountsMap = useMemo(() => {
    if (data?.categoryCounts) return data.categoryCounts;
    if (!locationDiscovery?.categories) return undefined;
    const map: Partial<Record<CategorySlug, number>> = {};
    for (const cat of locationDiscovery.categories) {
      map[cat.type] = cat.count;
    }
    return map;
  }, [data?.categoryCounts, locationDiscovery]);

  const totalPages = data?.count ? Math.ceil(data.count / PAGE_SIZE) : 1;

  const title = {
    buy: t('search.forSaleTitle', 'Properties for Sale'),
    rent: t('search.forRentTitle', 'Properties for Rent'),
    commercial: t('menu.commercialSpaces', 'Commercial Properties'),
    plots: t('menu.plotsTitle', 'Plots & Land'),
    luxury: t('home.signatureCollection', 'Luxury Homes'),
    projects: t('menu.newProjects', 'New Projects & Developments'),
  }[category] || 'Properties';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container-page py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-bold text-slate-800">{formatNumber(data?.count ?? 0)}</span>{' '}
              {t('property.propertiesCount', 'properties')}
            </p>
          </div>
          <button
            onClick={() => setShowFilters(true)}
            className="lg:hidden flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 transition"
          >
            <Filter className="h-4 w-4" /> {t('search.filters', 'Filters')}
          </button>
        </div>
        
        <ListingPromoBanner />

        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          {/* Sidebar */}
          <aside className={cn('shrink-0 w-72', showFilters ? 'block' : 'hidden lg:block')}>
            <div className="sticky top-[88px]">
              <AdvancedFilters
                cities={cities ?? []}
                localities={localities ?? []}
                filters={filters}
                categoryCounts={categoryCountsMap}
                totalCount={data?.baseTotalCount ?? locationDiscovery?.totalCount}
                onFilterChange={(newFilters) => {
                  const updated = { ...filters, ...newFilters };
                  const newParams = new URLSearchParams(params);
                  
                  newParams.delete('page');

                  const syncParam = (key: string, value: any) => {
                    if (value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)) {
                      newParams.set(key, Array.isArray(value) ? value.join(',') : value.toString());
                    } else {
                      newParams.delete(key);
                    }
                  };

                  syncParam('purpose', updated.purpose);
                  syncParam('city_id', updated.city_id);
                  syncParam('locality_id', updated.locality_id);
                  syncParam('type', updated.property_type_id);
                  syncParam('min_price', updated.min_price);
                  syncParam('max_price', updated.max_price);
                  syncParam('bedrooms', updated.bedrooms);
                  syncParam('bathrooms', updated.bathrooms);
                  syncParam('min_area', updated.min_area);
                  syncParam('max_area', updated.max_area);
                  syncParam('possession_status', updated.possession_status);
                  syncParam('amenities', updated.amenities);

                  setParams(newParams);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onCloseMobile={() => setShowFilters(false)}
              />
            </div>
          </aside>

          {/* Main Listings Column */}
          <div className="flex-1 min-w-0 min-h-[600px]">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ListSkeleton key={i} />
                ))}
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-red-200 bg-red-50/40 py-20 gap-4">
                <AlertTriangle className="h-12 w-12 text-red-400" />
                <p className="font-bold text-slate-700 text-lg">Something went wrong</p>
                <p className="text-sm text-slate-500 text-center max-w-sm">
                  We couldn't load properties right now. Please check your connection and try again.
                </p>
                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="rounded-xl bg-red-600 text-white px-5 py-2 text-sm font-bold hover:bg-red-700 disabled:opacity-60 transition"
                >
                  {isFetching ? 'Retrying…' : 'Try again'}
                </button>
              </div>
            ) : data && data.data.length > 0 ? (
              <div className="flex flex-col">
                {data.data.map((p) => (
                  <div key={p.id} className="w-full">
                    <HorizontalCard
                      property={p as any}
                      onSave={toggleSave}
                      onCompare={toggleCompare}
                      saved={currentFavoriteIds.has(p.id)}
                      compared={comparedIds.has(p.id)}
                    />
                  </div>
                ))}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-1.5 flex-wrap">
                    <button
                      disabled={page <= 1}
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        next.set('page', String(page - 1));
                        setParams(next);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft className="h-4 w-4" /> {t('common.back', 'Prev')}
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                      const pg = i + 1;
                      return (
                        <button
                          key={pg}
                          onClick={() => {
                            const next = new URLSearchParams(params);
                            next.set('page', String(pg));
                            setParams(next);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={cn(
                            'h-9 w-9 rounded-xl text-sm font-bold border transition',
                            page === pg
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-red-300',
                          )}
                        >
                          {pg}
                        </button>
                      );
                    })}
                    {totalPages > 7 && <span className="px-2 text-slate-400 font-bold">…</span>}
                    <button
                      disabled={page >= totalPages}
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        next.set('page', String(page + 1));
                        setParams(next);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      {t('common.next', 'Next')} <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-16 px-6 text-center shadow-2xs">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 mb-3">
                  <Search className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-navy-900">
                  {rawQParam ? `No properties found for "${rawQParam}"` : 'No properties matched your criteria'}
                </h3>
                <p className="mt-1 text-sm text-navy-500 max-w-md">
                  We couldn't find exact matches for this search. Try removing some filters or explore popular locations below.
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={clearAll}
                    className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-red-700 transition active:scale-95"
                  >
                    Clear All Filters
                  </button>
                  <Link
                    to="/search"
                    className="rounded-xl border border-navy-200 bg-white px-5 py-2.5 text-xs font-bold text-navy-700 hover:bg-slate-50 transition"
                  >
                    Browse All Listings
                  </Link>
                </div>

                {/* Popular Search Suggestions */}
                <div className="mt-8 w-full max-w-lg pt-6 border-t border-slate-100 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-navy-400">
                    Popular Searches You May Like
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {[
                      '3 BHK in Kokapet',
                      'Villas in Jubilee Hills',
                      'Apartments in Gachibowli',
                      'Commercial Office in Hitech City',
                      'Plots in Hyderabad',
                    ].map((popQ) => (
                      <button
                        key={popQ}
                        onClick={() => {
                          const next = new URLSearchParams();
                          next.set('q', popQ);
                          setParams(next);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700 transition"
                      >
                        {popQ}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

