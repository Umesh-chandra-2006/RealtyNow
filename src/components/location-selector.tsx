import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocationContext } from '../contexts/location-context';
import { MapPin, Search, Crosshair, ChevronDown, Check, Loader2, LocateFixed, Lock, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from './toast';
import { supabase } from '../lib/supabase';

export const DEFAULT_POPULAR_CITIES = [
  'Hyderabad',
  'Bengaluru',
  'Mumbai',
  'Delhi NCR',
  'Pune',
  'Chennai',
  'Kolkata',
  'Ahmedabad',
  'Goa',
  'Kochi',
  'Jaipur',
  'Chandigarh',
];

export function LocationPermissionModal({
  isOpen,
  onClose,
  onSelectCity,
  onRetryDetect,
  isLocating,
  currentCity,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectCity: (city: string) => void;
  onRetryDetect: () => void;
  isLocating: boolean;
  currentCity: string | null;
}) {
  const [citySearch, setCitySearch] = useState('');
  const [allCities, setAllCities] = useState<string[]>(DEFAULT_POPULAR_CITIES);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    supabase
      .from('cities')
      .select('name')
      .order('name')
      .then(({ data }) => {
        if (!isMounted || !data || data.length === 0) return;
        const fetchedNames = data.map((c) => c.name).filter(Boolean);
        const merged = Array.from(new Set([...DEFAULT_POPULAR_CITIES, ...fetchedNames]));
        setAllCities(merged);
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const filtered = allCities.filter((c) =>
    c.toLowerCase().includes(citySearch.toLowerCase().trim()),
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 transition-all sm:max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-navy-900 via-navy-800 to-red-950 p-6 text-white sm:p-7">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-500/20 text-red-400 ring-1 ring-red-400/30">
              <MapPin className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white sm:text-xl">
                Location Access & Selection
              </h3>
              <p className="text-xs text-navy-200 sm:text-sm">
                Get accurate verified listings, prices, and amenities in your area.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* How to unblock instructions */}
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-amber-900">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-200 text-amber-800">
                <Lock className="h-3.5 w-3.5" />
              </div>
              <div className="space-y-1.5 text-xs sm:text-sm">
                <p className="font-bold text-amber-950">
                  How to enable browser location:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-amber-900/90 leading-relaxed font-medium">
                  <li>
                    Click the <span className="font-bold text-amber-950">🔒 lock or tune icon</span> next to <strong>realtynow.in</strong> in your address bar.
                  </li>
                  <li>
                    Set <strong>Location</strong> to <span className="font-bold text-emerald-800">Allow</span> (or reset permissions).
                  </li>
                  <li>
                    Click the button below to retry live detection.
                  </li>
                </ol>
              </div>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200/60">
              <button
                type="button"
                onClick={onRetryDetect}
                disabled={isLocating}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-red-900/20 hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {isLocating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Detecting Location...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" /> Try Detecting Live Location Again
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Popular Cities */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Or Select City Directly
              </span>
              {currentCity && (
                <span className="text-xs font-semibold text-slate-500">
                  Current: <strong className="text-navy-900">{currentCity}</strong>
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {DEFAULT_POPULAR_CITIES.map((c) => {
                const isSelected = currentCity?.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      onSelectCity(c);
                      onClose();
                    }}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                        : 'bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-700 active:scale-95'
                    }`}
                  >
                    <MapPin className={`h-3 w-3 ${isSelected ? 'text-white' : 'text-red-500'}`} />
                    {c}
                    {isSelected && <Check className="h-3 w-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* City Search Bar */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="Search all cities across India..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs sm:text-sm font-medium text-slate-800 outline-none transition-all focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/10"
              />
              {citySearch && (
                <button
                  type="button"
                  onClick={() => setCitySearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {citySearch && (
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-1 custom-scrollbar">
                {filtered.length > 0 ? (
                  filtered.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        onSelectCity(c);
                        onClose();
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-white hover:text-red-600 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 text-red-500" /> {c}
                      </span>
                      {currentCity?.toLowerCase() === c.toLowerCase() && (
                        <Check className="h-3.5 w-3.5 text-red-600" />
                      )}
                    </button>
                  ))
                ) : (
                  <p className="py-3 text-center text-xs text-slate-400 font-medium">
                    No cities matching &quot;{citySearch}&quot;
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function LocationSelector({ isTransparent }: { isTransparent: boolean }) {
  const {
    city,
    isLocating,
    error,
    permissionDenied,
    showPermissionGuide,
    detectLocation,
    setCity,
    dismissLocationPrompt,
    openPermissionGuide,
    closePermissionGuide,
  } = useLocationContext();

  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [citiesList, setCitiesList] = useState<string[]>(DEFAULT_POPULAR_CITIES);
  const justRequestedRef = useRef(false);

  // Fetch available cities dynamically from Supabase
  useEffect(() => {
    let isMounted = true;
    supabase
      .from('cities')
      .select('name')
      .order('name')
      .then(({ data }) => {
        if (!isMounted || !data || data.length === 0) return;
        const names = data.map((c) => c.name).filter(Boolean);
        setCitiesList(Array.from(new Set([...DEFAULT_POPULAR_CITIES, ...names])));
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCities = citiesList.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (selectedCity: string) => {
    setCity(selectedCity);
    setIsOpen(false);
    addToast('success', `City changed to ${selectedCity}`);
  };

  const handleUseMyLocation = async () => {
    justRequestedRef.current = true;
    const success = await detectLocation(true);
    if (success) {
      addToast('success', `Location detected: ${city || 'Live Location'}`);
    }
  };

  return (
    <>
      <div className="relative z-50 flex items-center gap-1.5">
        {/* City Dropdown Trigger */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors border ${
            isTransparent
              ? 'border-white/20 hover:bg-white/10 text-white'
              : 'border-navy-700 hover:bg-navy-800 text-navy-200'
          }`}
        >
          <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <span className="font-semibold text-xs truncate max-w-[120px]">
            {isLocating ? 'Detecting...' : city || 'Hyderabad'}
          </span>
          <ChevronDown
            className={`h-3 w-3 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Use My Location / Crosshair Button */}
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={isLocating}
          title="Detect live location"
          aria-label="Detect live location"
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors disabled:opacity-60 ${
            isTransparent
              ? 'border-white/20 hover:bg-white/10 text-white'
              : 'border-navy-700 hover:bg-navy-800 text-navy-200'
          }`}
        >
          {isLocating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />
          ) : (
            <LocateFixed className="h-3.5 w-3.5 text-red-500" />
          )}
        </button>

        {/* Enable Live Location Pill (Shown when permission was previously denied) */}
        {permissionDenied && (
          <div className="hidden items-center gap-0.5 rounded-lg border border-red-300/60 bg-red-50/90 pl-2.5 pr-1 py-1 sm:flex shadow-xs">
            <button
              type="button"
              onClick={openPermissionGuide}
              className="text-[11px] font-bold text-red-600 transition-colors hover:text-red-700 flex items-center gap-1"
              title="Click to view how to enable location permission or choose city"
            >
              <Crosshair className="h-3 w-3" />
              Enable Live Location
            </button>
            <button
              type="button"
              onClick={dismissLocationPrompt}
              aria-label="Dismiss"
              className="px-1 text-red-400 hover:text-red-700 text-xs font-bold transition-colors"
            >
              ×
            </button>
          </div>
        )}

        {/* Dropdown Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-slate-100 bg-white p-3 shadow-2xl ring-1 ring-slate-900/10 text-slate-800"
            >
              {/* Auto detect button */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  handleUseMyLocation();
                }}
                className="flex w-full items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-left text-xs font-bold text-red-600 transition-colors hover:bg-red-100"
              >
                <Crosshair className={`h-4 w-4 ${isLocating ? 'animate-spin' : ''}`} />
                {isLocating ? 'Locating...' : 'Detect my location'}
              </button>

              <hr className="my-2.5 border-slate-100" />

              {/* Search */}
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search city..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 outline-none focus:border-red-500 focus:bg-white"
                />
              </div>

              {/* City list */}
              <div className="max-h-48 overflow-y-auto pr-1 space-y-0.5 custom-scrollbar">
                {filteredCities.length > 0 ? (
                  filteredCities.map((c) => {
                    const isSelected = city?.toLowerCase() === c.toLowerCase();
                    return (
                      <button
                        key={c}
                        onClick={() => handleSelect(c)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                          isSelected
                            ? 'bg-red-50 font-bold text-red-700'
                            : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-navy-900'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <MapPin className={`h-3 w-3 ${isSelected ? 'text-red-600' : 'text-slate-400'}`} />
                          {c}
                        </span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-red-600" />}
                      </button>
                    );
                  })
                ) : (
                  <p className="py-2 text-center text-xs text-slate-400">No cities found</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interactive Permission Help & City Selector Modal */}
      <LocationPermissionModal
        isOpen={showPermissionGuide}
        onClose={closePermissionGuide}
        onSelectCity={handleSelect}
        onRetryDetect={handleUseMyLocation}
        isLocating={isLocating}
        currentCity={city}
      />
    </>
  );
}
