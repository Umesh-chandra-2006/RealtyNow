import React from 'react';
import { MapPin, Sparkles, Check } from 'lucide-react';
import type { CategorySlug } from '../lib/categories';
import type { LocationDiscoveryResult } from '../lib/search-engine';

interface LocationCategoryDiscoveryProps {
  discovery: LocationDiscoveryResult | null;
  activeCategory?: CategorySlug | null;
  onSelectCategory: (category: CategorySlug | null) => void;
  purpose?: string | null;
  isZeroResultFallback?: boolean;
  searchedCategoryName?: string;
  className?: string;
}

export const LocationCategoryDiscovery: React.FC<LocationCategoryDiscoveryProps> = ({
  discovery,
  activeCategory,
  onSelectCategory,
  purpose,
  isZeroResultFallback = false,
  searchedCategoryName,
  className = '',
}) => {
  if (!discovery || !discovery.categories || discovery.categories.length === 0) {
    return null;
  }

  const rawLocation = discovery.location?.trim() || '';
  const city = discovery.city?.trim() || '';
  const locationDisplay = rawLocation && city && rawLocation.toLowerCase() !== city.toLowerCase()
    ? `${rawLocation}, ${city}`
    : rawLocation || city || 'All Locations';

  const purposeLabel = purpose === 'Rent' ? 'for Rent' : purpose === 'Sale' ? 'for Sale' : '';

  // Show categories with count > 0, OR the currently active category, OR all categories if all are 0
  const hasPositiveCategories = discovery.categories.some((c) => c.count > 0);
  const displayedCategories = hasPositiveCategories
    ? discovery.categories.filter((c) => c.count > 0 || c.type === activeCategory)
    : discovery.categories;

  return (
    <div
      className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition-all duration-300 ${
        isZeroResultFallback
          ? 'border-amber-200 bg-gradient-to-r from-amber-50/50 via-white to-amber-50/30'
          : 'border-slate-200/80 hover:border-slate-300'
      } ${className}`}
    >
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-red-500" />
                  {isZeroResultFallback ? 'Alternative Availability' : 'Location Discovery'}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-semibold text-slate-500">
                  {discovery.totalCount} {discovery.totalCount === 1 ? 'property' : 'properties'} {purposeLabel}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 capitalize">
                {isZeroResultFallback ? (
                  <>
                    No {searchedCategoryName || 'listings'} available in{' '}
                    <span className="text-red-600">{locationDisplay}</span>
                  </>
                ) : (
                  <>
                    Explore property types in <span className="text-red-600">{locationDisplay}</span>
                  </>
                )}
              </h3>
            </div>
          </div>

          {activeCategory && (
            <button
              onClick={() => onSelectCategory(null)}
              className="text-xs font-semibold text-slate-600 hover:text-red-600 transition flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-100"
            >
              Show all ({discovery.totalCount})
            </button>
          )}
        </div>

        {isZeroResultFallback && (
          <p className="text-xs text-slate-600 mb-3 leading-relaxed">
            We couldn't find any {searchedCategoryName?.toLowerCase() || 'matching properties'} in {locationDisplay} right now.
            However, the following property categories are active and available:
          </p>
        )}

        {/* Category Pills / Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200">
          {/* All option */}
          <button
            onClick={() => onSelectCategory(null)}
            className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
              !activeCategory
                ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
            }`}
          >
            <span>🏘️</span>
            <span>All Types</span>
            <span
              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                !activeCategory ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
              }`}
            >
              {discovery.totalCount}
            </span>
          </button>

          {/* Dynamic verified categories from real database inventory */}
          {displayedCategories.map((cat) => {
            const isActive = activeCategory === cat.type;
            return (
              <button
                key={cat.type}
                onClick={() => onSelectCategory(isActive ? null : cat.type)}
                className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                  isActive
                    ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-red-300 hover:bg-red-50/50 hover:text-red-700'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/80 text-slate-700 group-hover:bg-red-100 group-hover:text-red-800'
                  }`}
                >
                  {cat.count}
                </span>
                {isActive && <Check className="w-3 h-3 text-white ml-0.5" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
