import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MapPin,
  Search,
  ChevronDown,
  X,
  Crosshair,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  POPULAR_CITIES,
  getPopularAreasForCity,
  searchCities,
  searchAreasForCity,
  detectUserCurrentCityAndArea,
  type StructuredCity,
  type StructuredArea,
  type UnifiedLocationSelection,
} from '../lib/location-service';
import { useLocationContext } from '../contexts/location-context';
import { useToast } from './toast';
import { cn } from '../lib/utils';

export interface LocationCityAreaFilterProps {
  selectedCityId?: string;
  selectedCityName?: string;
  selectedLocalityId?: string;
  selectedLocalityName?: string;
  onChange: (location: UnifiedLocationSelection) => void;
  className?: string;
}

export function LocationCityAreaFilter({
  selectedCityId,
  selectedCityName,
  selectedLocalityId,
  selectedLocalityName,
  onChange,
  className,
}: LocationCityAreaFilterProps) {
  const { addToast } = useToast();
  const { detectLocation, isLocating } = useLocationContext();

  // Inline dropdown expansion state
  const [openDropdown, setOpenDropdown] = useState<'city' | 'area' | null>(null);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [areaSearchQuery, setAreaSearchQuery] = useState('');

  const [cityResults, setCityResults] = useState<StructuredCity[]>(POPULAR_CITIES);
  const [areaResults, setAreaResults] = useState<StructuredArea[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
  const [isSearchingCities, setIsSearchingCities] = useState(false);

  const cityInputRef = useRef<HTMLInputElement>(null);
  const areaInputRef = useRef<HTMLInputElement>(null);

  // Derive active city & area
  const activeCity = useMemo(() => {
    if (selectedCityName && !/^[0-9a-f-]{36}$/i.test(selectedCityName)) return selectedCityName;
    if (selectedCityId) {
      const match = POPULAR_CITIES.find(
        (c) => c.id === selectedCityId || c.name.toLowerCase() === selectedCityId.toLowerCase()
      );
      if (match) return match.name;
      if (selectedCityId === 'fa963656-a6dc-4167-ae42-6dab041befe6' || selectedCityId === '04ec1d24-d2e8-4ee7-91aa-90fb4dfd3b9e') {
        return 'Hyderabad';
      }
    }
    return selectedCityName || 'Hyderabad';
  }, [selectedCityId, selectedCityName]);

  const activeLocality = useMemo(() => {
    const raw = selectedLocalityName || selectedLocalityId || '';
    if (/^[0-9a-f-]{36}$/i.test(raw)) {
      const foundInResults = areaResults.find((a) => a.id === raw);
      if (foundInResults) return foundInResults.name;
      return '';
    }
    return raw;
  }, [selectedLocalityId, selectedLocalityName, areaResults]);

  // Load cities on search query change
  useEffect(() => {
    let isCurrent = true;
    setIsSearchingCities(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchCities(citySearchQuery);
        if (isCurrent) {
          setCityResults(results);
        }
      } catch (err) {
        console.error('Error searching cities:', err);
      } finally {
        if (isCurrent) setIsSearchingCities(false);
      }
    }, 150);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [citySearchQuery]);

  // Load areas when city is selected or area search query changes
  useEffect(() => {
    if (!activeCity) {
      setAreaResults([]);
      return;
    }

    let isCurrent = true;
    setIsLoadingAreas(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchAreasForCity({
          cityName: activeCity,
          query: areaSearchQuery,
        });
        if (isCurrent) {
          setAreaResults(results);
        }
      } catch (err) {
        console.error('Error loading areas:', err);
      } finally {
        if (isCurrent) setIsLoadingAreas(false);
      }
    }, 200);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [activeCity, areaSearchQuery]);

  // Popular quick areas for the current city
  const popularChips = useMemo(() => {
    if (!activeCity) return [];
    return getPopularAreasForCity(activeCity).slice(0, 6);
  }, [activeCity]);

  // Handlers
  const handleSelectCity = (city: StructuredCity) => {
    const isDifferentCity = activeCity.toLowerCase() !== city.name.toLowerCase();

    onChange({
      cityId: city.id,
      cityName: city.name,
      state: city.state,
      country: city.country,
      localityId: isDifferentCity ? undefined : selectedLocalityId,
      localityName: isDifferentCity ? undefined : selectedLocalityName,
    });

    setOpenDropdown(null);
    setCitySearchQuery('');

    if (isDifferentCity) {
      setAreaSearchQuery('');
    }
  };

  const handleSelectArea = (area: StructuredArea) => {
    onChange({
      cityId: selectedCityId || area.cityId,
      cityName: activeCity || area.cityName,
      localityId: area.id,
      localityName: area.name,
      state: area.state,
      country: area.country,
      placeId: area.placeId,
      latitude: area.latitude,
      longitude: area.longitude,
      formattedAddress: area.formattedAddress,
    });

    setOpenDropdown(null);
    setAreaSearchQuery('');
  };

  const handleClearLocation = () => {
    onChange({
      cityId: undefined,
      cityName: undefined,
      localityId: undefined,
      localityName: undefined,
    });
    setOpenDropdown(null);
  };

  const handleClearAreaOnly = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({
      cityId: selectedCityId,
      cityName: activeCity,
      localityId: undefined,
      localityName: undefined,
    });
  };

  const [isDetectingGps, setIsDetectingGps] = useState(false);

  const handleUseCurrentLocation = async () => {
    setIsDetectingGps(true);
    try {
      const loc = await detectUserCurrentCityAndArea();
      if (loc && loc.city) {
        onChange({
          cityId: loc.city,
          cityName: loc.city,
          localityId: loc.area,
          localityName: loc.area,
          state: loc.state,
          country: loc.country,
          latitude: loc.latitude,
          longitude: loc.longitude,
          formattedAddress: loc.formattedAddress,
        });
        addToast(
          'success',
          loc.area
            ? `📍 Location detected: ${loc.area}, ${loc.city}`
            : `📍 Location detected: ${loc.city}`
        );
      } else {
        addToast('error', 'Could not detect your city. Please select from the list.');
      }
    } catch (err: any) {
      if (err?.code === 1 || err?.message?.toLowerCase().includes('denied')) {
        addToast('error', 'Location permission denied in browser. Please select your city or enable GPS in browser settings.');
      } else {
        addToast('error', 'GPS location unavailable. Please select your city manually.');
      }
    } finally {
      setIsDetectingGps(false);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* ── 1. Main City Input Field & Inline Dropdown ── */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
          Main City <span className="text-red-500">*</span>
        </label>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              const next = openDropdown === 'city' ? null : 'city';
              setOpenDropdown(next);
              if (next === 'city') {
                setTimeout(() => cityInputRef.current?.focus(), 50);
              }
            }}
            className={cn(
              'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left text-sm font-medium transition-all shadow-2xs cursor-pointer',
              activeCity
                ? 'bg-red-50/50 border-red-200 text-slate-900 font-semibold ring-1 ring-red-500/20'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-white'
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <MapPin className={cn('h-4 w-4 shrink-0', activeCity ? 'text-red-600' : 'text-slate-400')} />
              <span className="truncate">
                {activeCity ? (
                  <span className="text-slate-900 font-bold">{activeCity}</span>
                ) : (
                  <span className="text-slate-400 text-xs">Search or select city</span>
                )}
              </span>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200',
                openDropdown === 'city' && 'rotate-180 text-red-600'
              )}
            />
          </button>

          {/* Inline Collapsible City Panel */}
          <AnimatePresence>
            {openDropdown === 'city' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md z-10"
              >
                {/* Search Box */}
                <div className="p-2 border-b border-slate-100 bg-slate-50/80">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      ref={cityInputRef}
                      type="text"
                      value={citySearchQuery}
                      onChange={(e) => setCitySearchQuery(e.target.value)}
                      placeholder="Type city (e.g. Hyderabad)..."
                      className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20"
                    />
                    {citySearchQuery && (
                      <button
                        type="button"
                        onClick={() => setCitySearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* City Options List */}
                <div className="max-h-48 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                  {!citySearchQuery && (
                    <div className="px-2 py-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Active Operating City
                      </span>
                    </div>
                  )}

                  {cityResults.length > 0 ? (
                    cityResults.map((c) => {
                      const isSelected = activeCity.toLowerCase() === c.name.toLowerCase();
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCity(c)}
                          className={cn(
                            'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer',
                            isSelected
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'hover:bg-slate-100 text-slate-700'
                          )}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <MapPin className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'text-red-600' : 'text-slate-400')} />
                            <span className="truncate">{c.name}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">({c.state})</span>
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 shrink-0">
                            Active
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400">
                      No cities matching &quot;{citySearchQuery}&quot;
                    </div>
                  )}

                  <div className="mt-2 pt-2 border-t border-slate-100 px-2 py-1">
                    <p className="text-[10px] text-slate-400 leading-tight">
                      🚀 Additional Indian cities launching soon. Currently serving all Hyderabad areas.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── 2. Area / Locality Input Field & Inline Dropdown ── */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block flex items-center justify-between">
          <span>Area / Locality</span>
          {activeCity && (
            <span className="text-[10px] font-normal text-slate-400 lowercase">
              in {activeCity}
            </span>
          )}
        </label>

        <div className="relative">
          <button
            type="button"
            disabled={!activeCity}
            onClick={() => {
              if (!activeCity) return;
              const next = openDropdown === 'area' ? null : 'area';
              setOpenDropdown(next);
              if (next === 'area') {
                setTimeout(() => areaInputRef.current?.focus(), 50);
              }
            }}
            className={cn(
              'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left text-sm font-medium transition-all shadow-2xs',
              !activeCity
                ? 'bg-slate-100/70 border-slate-200/80 text-slate-400 cursor-not-allowed opacity-75'
                : activeLocality
                ? 'bg-red-50/50 border-red-200 text-slate-900 font-semibold ring-1 ring-red-500/20 cursor-pointer'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-white cursor-pointer'
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <Search className={cn('h-4 w-4 shrink-0', activeLocality ? 'text-red-600' : 'text-slate-400')} />
              <span className="truncate">
                {activeLocality ? (
                  <span className="text-slate-900 font-bold">{activeLocality}</span>
                ) : activeCity ? (
                  <span className="text-slate-500 text-xs">Search {activeCity} areas...</span>
                ) : (
                  <span className="text-slate-400 italic text-xs">Select a city first</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {activeLocality && (
                <span
                  onClick={handleClearAreaOnly}
                  className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded-full transition-colors cursor-pointer"
                  title="Clear Area"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200',
                  openDropdown === 'area' && 'rotate-180 text-red-600'
                )}
              />
            </div>
          </button>

          {/* Inline Collapsible Area Panel */}
          <AnimatePresence>
            {openDropdown === 'area' && activeCity && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md z-10"
              >
                {/* Search Box with Google Places */}
                <div className="p-2 border-b border-slate-100 bg-slate-50/80">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      ref={areaInputRef}
                      type="text"
                      value={areaSearchQuery}
                      onChange={(e) => setAreaSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && areaSearchQuery.trim()) {
                          e.preventDefault();
                          const targetArea = areaResults[0] || {
                            id: areaSearchQuery.trim(),
                            name: areaSearchQuery.trim(),
                            cityId: selectedCityId || activeCity,
                            cityName: activeCity,
                            state: 'Telangana',
                            country: 'India',
                          };
                          handleSelectArea(targetArea);
                        }
                      }}
                      placeholder={`Search ${activeCity} areas (e.g. Serilingampally, Madhapur)...`}
                      className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20"
                    />
                    {isLoadingAreas && (
                      <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-red-500 animate-spin" />
                    )}
                    {areaSearchQuery && !isLoadingAreas && (
                      <button
                        type="button"
                        onClick={() => setAreaSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Popular Chips inside the inline panel */}
                {!areaSearchQuery && popularChips.length > 0 && (
                  <div className="p-2 border-b border-slate-100 bg-slate-50/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-amber-500" /> Popular in {activeCity}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {popularChips.map((chipName) => {
                        const isSelected = activeLocality.toLowerCase() === chipName.toLowerCase();
                        return (
                          <button
                            key={chipName}
                            type="button"
                            onClick={() =>
                              handleSelectArea({
                                id: `area-${activeCity.toLowerCase()}-${chipName.toLowerCase().replace(/\s+/g, '-')}`,
                                name: chipName,
                                cityId: selectedCityId || `city-${activeCity.toLowerCase()}`,
                                cityName: activeCity,
                                state: 'Telangana',
                                country: 'India',
                              })
                            }
                            className={cn(
                              'text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all cursor-pointer',
                              isSelected
                                ? 'bg-red-600 text-white border-red-600'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-red-300 hover:text-red-600'
                            )}
                          >
                            {chipName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Area Results List */}
                <div className="max-h-48 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                  {areaResults.length > 0 ? (
                    areaResults.map((a) => {
                      const isSelected = activeLocality.toLowerCase() === a.name.toLowerCase();
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => handleSelectArea(a)}
                          className={cn(
                            'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer',
                            isSelected
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'hover:bg-slate-100 text-slate-700'
                          )}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <MapPin className={cn('h-3 w-3 shrink-0', isSelected ? 'text-red-600' : 'text-slate-400')} />
                            <span className="truncate">{a.name}</span>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 text-red-600 shrink-0" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400">
                      No areas found matching &quot;{areaSearchQuery}&quot;
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── 3. Selected Location Summary Card ── */}
      {(activeCity || activeLocality) && (
        <div className="rounded-xl border border-red-100 bg-red-50/60 p-2.5 flex items-start justify-between gap-2 text-xs">
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-red-600 block">
                Active Location
              </span>
              <p className="font-bold text-slate-900 text-xs leading-tight">
                {activeLocality ? `${activeLocality}, ${activeCity}` : activeCity}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearLocation}
            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-100/80 rounded-lg transition-colors cursor-pointer"
            title="Reset location filter"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── 4. Use Current Location Action ── */}
      <button
        type="button"
        onClick={handleUseCurrentLocation}
        disabled={isDetectingGps || isLocating}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-98 disabled:opacity-60"
      >
        {isDetectingGps || isLocating ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-red-600" />
            <span>Detecting your location...</span>
          </>
        ) : (
          <>
            <Crosshair className="h-3 w-3 text-red-600" />
            <span>Use Current Location</span>
          </>
        )}
      </button>
    </div>
  );
}
