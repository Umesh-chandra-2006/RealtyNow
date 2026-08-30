import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  MapPin,
  Building2,
  Clock,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { useLanguageContext } from '../lib/i18n/language-context';
import {
  fetchLiveSearchSuggestions,
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  type LiveSearchSuggestionsResult,
} from '../lib/search-service';
import { formatCompactPrice, generatePropertyUrl } from '../lib/utils';
import { DEFAULT_PROPERTY_IMAGE } from '../lib/property-images';
import { VoiceSearchButton } from './voice-search-button';

interface HeaderSearchModalProps {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
  cityId?: string;
}

const TRENDING_SEARCHES = [
  '3 BHK in Kokapet',
  'Luxury Villas in Jubilee Hills',
  'Apartments under 2 Crore',
  'Flats for Rent in Gachibowli',
  'Commercial Office in Hitech City',
  'Plots in Hyderabad',
];

const POPULAR_HOTSPOTS = [
  { name: 'Kokapet', type: 'High Growth Area' },
  { name: 'Jubilee Hills', type: 'Ultra Luxury' },
  { name: 'Gachibowli', type: 'IT Corridor' },
  { name: 'Hitech City', type: 'Commercial Hub' },
  { name: 'Madhapur', type: 'Central Hotspot' },
  { name: 'Tellapur', type: 'Gated Communities' },
  { name: 'Banjara Hills', type: 'Prime Residential' },
  { name: 'Financial District', type: 'Work & Living' },
];

export function HeaderSearchModal({
  open,
  onClose,
  initialQuery = '',
  cityId,
}: HeaderSearchModalProps) {
  const { t } = useLanguageContext();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<LiveSearchSuggestionsResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Load recent searches on open and listen to updates
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    const handleSync = () => setRecentSearches(getRecentSearches());
    window.addEventListener('realtynow-recent-searches-updated', handleSync);
    return () => window.removeEventListener('realtynow-recent-searches-updated', handleSync);
  }, []);

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch live suggestions when debouncedQuery changes
  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.trim().length < 2) {
      setSuggestions(null);
      setIsSearching(false);
      return;
    }

    let isMounted = true;
    setIsSearching(true);

    fetchLiveSearchSuggestions(debouncedQuery, cityId)
      .then((res) => {
        if (isMounted) {
          setSuggestions(res);
          setIsSearching(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsSearching(false);
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, cityId]);

  const executeSearch = (targetQuery: string) => {
    const clean = (targetQuery || '').trim();
    if (!clean) return;

    addRecentSearch(clean);
    onClose();

    // If query matches a specific property in suggestions, navigate directly to its view
    const exactProp = suggestions?.properties.find(
      (p) => p.title && p.title.trim().toLowerCase() === clean.toLowerCase()
    );
    if (exactProp) {
      navigate(generatePropertyUrl(exactProp));
      setQuery('');
      return;
    }

    navigate(`/search?q=${encodeURIComponent(clean)}`);
    setQuery('');
  };

  const handleVoiceTranscript = (text: string) => {
    setQuery(text);
    executeSearch(text);
  };

  if (!open) return null;

  const hasSuggestions =
    suggestions &&
    (suggestions.properties.length > 0 ||
      suggestions.localities.length > 0 ||
      suggestions.smartQueries.length > 0);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-navy-950/70 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />

        {/* Modal Dialog */}
        <div className="flex min-h-full items-start justify-center p-4 pt-16 sm:pt-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-2xl transform overflow-hidden rounded-3xl border border-navy-100 bg-white text-left shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeSearch(query);
              }}
              className="relative flex items-center border-b border-navy-100 px-4 py-3 sm:px-6"
            >
              <Search className="h-5 w-5 shrink-0 text-red-600" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search.placeholder', 'Search city, locality, project or landmark...')}
                className="w-full border-none bg-transparent pl-3 pr-20 text-sm sm:text-base font-medium text-navy-900 outline-none placeholder:text-navy-400"
              />

              <div className="flex items-center gap-1.5 shrink-0">
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      inputRef.current?.focus();
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full text-navy-400 hover:bg-navy-50 hover:text-navy-700 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                <VoiceSearchButton
                  onTranscript={handleVoiceTranscript}
                  className="h-8 w-8 text-navy-400 hover:text-red-600"
                />

                <button
                  type="submit"
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-red-700 transition-all active:scale-95"
                >
                  {t('common.search', 'Search')}
                </button>
              </div>
            </form>

            {/* Content Area */}
            <div className="max-h-[65vh] overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* While Typing: Live Autocomplete Results */}
              {query.trim().length >= 2 ? (
                <div className="space-y-4">
                  {isSearching && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-navy-400 animate-pulse py-1">
                      <Sparkles className="h-3.5 w-3.5 text-red-500" /> Finding live matching properties...
                    </div>
                  )}

                  {/* Smart Query Suggestions */}
                  {suggestions?.smartQueries && suggestions.smartQueries.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-red-600" /> Smart Suggestions
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.smartQueries.map((sq, idx) => (
                          <button
                            key={idx}
                            onClick={() => executeSearch(sq.text)}
                            className="flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50/50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-all text-left"
                          >
                            <span>{sq.text}</span>
                            <ArrowRight className="h-3 w-3 text-red-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Localities */}
                  {suggestions?.localities && suggestions.localities.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-navy-500" /> Localities & Neighborhoods
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {suggestions.localities.map((loc, idx) => (
                          <button
                            key={idx}
                            onClick={() => executeSearch(`${loc.name}, ${loc.city_name}`)}
                            className="flex items-center justify-between rounded-xl border border-navy-100 bg-white p-2.5 hover:border-red-200 hover:bg-red-50/30 transition-all text-left group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-500 group-hover:bg-red-100 group-hover:text-red-600 transition-colors">
                                <MapPin className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-navy-900 truncate group-hover:text-red-600">
                                  {loc.name}
                                </p>
                                <p className="text-[10px] text-navy-400">{loc.city_name}</p>
                              </div>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-navy-300 group-hover:text-red-500" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Direct Property Results */}
                  {suggestions?.properties && suggestions.properties.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400 flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-navy-500" /> Matching Properties ({suggestions.properties.length})
                        </p>
                        <button
                          onClick={() => executeSearch(query)}
                          className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                        >
                          View all results <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {suggestions.properties.map((p) => {
                          const priceVal = p.price || p.rent_amount || 0;
                          const formattedPrice = formatCompactPrice(priceVal);

                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                onClose();
                                navigate(generatePropertyUrl(p));
                              }}
                              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 hover:border-red-300 hover:shadow-xs transition-all cursor-pointer group"
                            >
                              <img
                                src={p.cover_image || DEFAULT_PROPERTY_IMAGE}
                                alt={p.title}
                                className="h-14 w-16 rounded-xl object-cover shrink-0 border border-slate-100"
                                onError={(e) => {
                                  (e.target as HTMLElement).setAttribute('src', DEFAULT_PROPERTY_IMAGE);
                                }}
                              />
                              <div className="min-w-0 flex-1">
                                <h6 className="text-xs font-bold text-navy-900 line-clamp-1 group-hover:text-red-600">
                                  {p.title}
                                </h6>
                                <p className="text-[11px] text-navy-500 truncate flex items-center gap-1">
                                  <MapPin className="h-3 w-3 shrink-0 text-navy-400" />
                                  {p.locality_name ? `${p.locality_name}, ` : ''}{p.city_name || 'Hyderabad'}
                                </p>
                                <div className="mt-0.5 flex items-center gap-2">
                                  <span className="text-xs font-extrabold text-red-600">
                                    {formattedPrice} {p.purpose === 'Rent' ? '/mo' : ''}
                                  </span>
                                  {p.bedrooms && (
                                    <span className="text-[10px] font-semibold text-navy-500 bg-navy-50 px-1.5 py-0.5 rounded">
                                      {p.bedrooms} BHK
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!hasSuggestions && !isSearching && (
                    <div className="py-6 text-center">
                      <p className="text-xs font-semibold text-navy-500">
                        Press <span className="font-bold text-navy-800">Enter</span> to search the full database for "{query}"
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* When Input is Empty: Recent Searches & Hotspots */
                <div className="space-y-6">
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-navy-400" /> Recent Searches
                        </p>
                        <button
                          onClick={clearRecentSearches}
                          className="text-[11px] font-semibold text-navy-400 hover:text-red-600"
                        >
                          Clear All
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {recentSearches.map((item, idx) => (
                          <div
                            key={idx}
                            className="group flex items-center gap-1.5 rounded-xl border border-navy-100 bg-navy-50/50 px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-navy-100 transition-colors"
                          >
                            <span
                              onClick={() => executeSearch(item)}
                              className="cursor-pointer hover:text-red-600 font-semibold"
                            >
                              {item}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRecentSearch(item);
                              }}
                              className="text-navy-300 hover:text-navy-700 rounded-full"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trending Searches */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400 flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-red-500" /> Trending Searches
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {TRENDING_SEARCHES.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => executeSearch(item)}
                          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-700 hover:border-red-200 hover:bg-red-50/50 hover:text-red-700 transition-all shadow-2xs"
                        >
                          <Search className="h-3 w-3 text-navy-400" />
                          <span>{item}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Popular Localities & Hotspots */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-navy-500" /> Popular Hyderabad Hotspots
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {POPULAR_HOTSPOTS.map((spot, idx) => (
                        <button
                          key={idx}
                          onClick={() => executeSearch(spot.name)}
                          className="flex flex-col items-start rounded-2xl border border-navy-100 bg-slate-50/50 p-2.5 text-left hover:border-red-300 hover:bg-white hover:shadow-xs transition-all group"
                        >
                          <span className="text-xs font-bold text-navy-900 group-hover:text-red-600">
                            {spot.name}
                          </span>
                          <span className="text-[10px] text-navy-400 font-medium">{spot.type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-navy-100 bg-slate-50 px-4 py-2.5 text-[11px] text-navy-400">
              <span className="flex items-center gap-1 font-medium">
                <Sparkles className="h-3 w-3 text-red-500" /> Real-time database discovery engine
              </span>
              <span>
                Press <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] border border-slate-200">ESC</kbd> to exit
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
