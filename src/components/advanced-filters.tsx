import React, { useState, useMemo } from 'react';
import {
  X,
  ChevronDown,
  Check,
  SlidersHorizontal,
  MapPin,
  CheckCircle2,
  Building,
  Home,
  Store,
  Warehouse,
  LandPlot,
  Users,
  Briefcase,
  Layers,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { PropertyFilters } from '../lib/properties';
import { LocationCityAreaFilter } from './location-city-area-filter';
import {
  CATEGORY_LIST,
  getCategoryMeta,
  normalizeCategorySlug,
  type CategorySlug,
} from '../lib/categories';
import { isSameAmenity, getCategoryAmenities } from '../lib/amenities';

interface AdvancedFiltersProps {
  filters: PropertyFilters;
  onFilterChange: (filters: Partial<PropertyFilters>) => void;
  onCloseMobile?: () => void;
  cities?: { id: string; name: string }[];
  localities?: { id: string; name: string; city_id?: string }[];
  categoryCounts?: Partial<Record<CategorySlug, number>>;
  totalCount?: number;
}

const BHK_OPTIONS = [1, 2, 3, 4, 5];
const POSSESSION_STATUSES = ['Ready to Move', 'Under Construction', 'New Launch'];
const FACING_OPTIONS = ['North', 'South', 'East', 'West', 'North-East', 'North-West'];
const FURNISHING_OPTIONS = ['Unfurnished', 'Semi-Furnished', 'Fully Furnished'];
const SEAT_TYPES = ['Dedicated Desk', 'Hot Desk', 'Private Cabin', 'Meeting Room'];
const PLOT_APPROVALS = ['HMDA Approved', 'DTCP Approved', 'FCDA Approved', 'RERA Approved', 'Open Plot'];

export function AdvancedFilters({
  filters,
  onFilterChange,
  onCloseMobile,
  cities = [],
  localities = [],
  categoryCounts,
  totalCount,
}: AdvancedFiltersProps) {
  const activeSlug = normalizeCategorySlug(filters.category || filters.type);
  const activeCategory = useMemo(() => getCategoryMeta(activeSlug), [activeSlug]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    category: true,
    location: true,
    price: true,
    bhk: true,
    area: true,
    possession: true,
    furnishing: false,
    facing: false,
    amenities: true,
    plots: true,
    coworking: true,
  });

  const toggleSection = (sec: string) => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const handleAmenityChange = (amenity: string) => {
    const current = filters.amenities || [];
    const exists = current.some((a) => isSameAmenity(a, amenity));
    const next = exists
      ? current.filter((a) => !isSameAmenity(a, amenity))
      : [...current, amenity];
    onFilterChange({ amenities: next });
  };

  // Determine allowed filters based on active category
  const allowed = activeCategory?.allowedFilters ?? [
    'bhk',
    'price',
    'built_up_area',
    'bathrooms',
    'furnishing',
    'possession',
    'facing',
    'amenities',
  ];

  const AMENITIES = useMemo(() => {
    return getCategoryAmenities(activeSlug);
  }, [activeSlug]);

  return (
    <div className="bg-white rounded-[24px] border border-slate-200/60 shadow-xl shadow-slate-200/40 p-5 w-full flex flex-col h-full max-h-[calc(100vh-120px)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-navy-50 text-navy-600 rounded-xl">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-lg text-slate-800">
              {activeCategory ? `${activeCategory.name} Filters` : 'Filters'}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              {activeCategory ? activeCategory.description : 'Find your exact match'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              onFilterChange({
                category: undefined,
                type: undefined,
                purpose: undefined,
                city_id: undefined,
                locality_id: undefined,
                property_type_id: undefined,
                min_price: undefined,
                max_price: undefined,
                bedrooms: undefined,
                bathrooms: undefined,
                amenities: [],
                min_area: undefined,
                max_area: undefined,
                possession_status: undefined,
                facing: undefined,
                furnishing: undefined,
                verified_status: undefined,
              })
            }
            className="text-xs font-bold text-red-500 hover:text-red-600 transition"
          >
            Reset All
          </button>
          {onCloseMobile && (
            <button onClick={onCloseMobile} className="lg:hidden p-2 text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar pb-6">
        {/* Category Picker */}
        <div className="space-y-3">
          <h4
            className="text-xs font-bold text-slate-800 uppercase tracking-wider flex justify-between items-center cursor-pointer"
            onClick={() => toggleSection('category')}
          >
            Category{' '}
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', expandedSections.category && 'rotate-180')}
            />
          </h4>
          {expandedSections.category && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onFilterChange({ category: undefined, type: undefined })}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5',
                    !activeSlug
                      ? 'bg-navy-900 text-white border-navy-900 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  )}
                >
                  <span>All Categories</span>
                  {totalCount != null && (
                    <span
                      className={cn(
                        'text-[10px] font-extrabold px-1.5 py-0.5 rounded-full',
                        !activeSlug ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      )}
                    >
                      {totalCount}
                    </span>
                  )}
                </button>
                {CATEGORY_LIST.map((cat) => {
                  const isSelected = activeSlug === cat.slug;
                  const count = categoryCounts ? categoryCounts[cat.slug] : undefined;
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() =>
                        onFilterChange({
                          category: isSelected ? undefined : cat.slug,
                          type: undefined,
                        })
                      }
                      className={cn(
                        'px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5',
                        isSelected
                          ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-red-300 hover:bg-red-50/50'
                      )}
                    >
                      <span>{cat.name}</span>
                      {count !== undefined && (
                        <span
                          className={cn(
                            'text-[10px] font-extrabold px-1.5 py-0.5 rounded-full transition-colors',
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 text-slate-600 group-hover:bg-red-100'
                          )}
                        >
                          {count}
                        </span>
                      )}
                      {isSelected && <X className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Location (City) */}
        <div className="space-y-3">
          <h4
            className="text-xs font-bold text-slate-800 uppercase tracking-wider flex justify-between items-center cursor-pointer"
            onClick={() => toggleSection('location')}
          >
            Location{' '}
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', expandedSections.location && 'rotate-180')}
            />
          </h4>
          {expandedSections.location && (
            <LocationCityAreaFilter
              selectedCityId={filters.city_id}
              selectedCityName={
                cities.find((c: any) => c.id === filters.city_id)?.name ||
                (filters.city_id === 'fa963656-a6dc-4167-ae42-6dab041befe6' ? 'Hyderabad' : filters.city_id)
              }
              selectedLocalityId={filters.locality_id}
              selectedLocalityName={
                localities.find((l: any) => l.id === filters.locality_id)?.name ||
                filters.locality_id
              }
              onChange={(loc) => {
                onFilterChange({
                  city_id: loc.cityName || loc.cityId,
                  locality_id: loc.localityName || loc.localityId,
                });
              }}
            />
          )}
        </div>

        {/* Price Range */}
        {allowed.includes('price') && (
          <div className="space-y-3">
            <h4
              className="text-xs font-bold text-slate-800 uppercase tracking-wider flex justify-between items-center cursor-pointer"
              onClick={() => toggleSection('price')}
            >
              Budget{' '}
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', expandedSections.price && 'rotate-180')}
              />
            </h4>
            {expandedSections.price && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Min Price</label>
                  <input
                    type="number"
                    placeholder="₹0"
                    value={filters.min_price || ''}
                    onChange={(e) =>
                      onFilterChange({ min_price: e.target.value ? Number(e.target.value) : undefined })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Max Price</label>
                  <input
                    type="number"
                    placeholder="Any"
                    value={filters.max_price || ''}
                    onChange={(e) =>
                      onFilterChange({ max_price: e.target.value ? Number(e.target.value) : undefined })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bedrooms / BHK — ONLY for Residential Categories */}
        {allowed.includes('bhk') && (
          <div className="space-y-3">
            <h4
              className="text-xs font-bold text-slate-800 uppercase tracking-wider flex justify-between items-center cursor-pointer"
              onClick={() => toggleSection('bhk')}
            >
              Bedrooms / BHK{' '}
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', expandedSections.bhk && 'rotate-180')}
              />
            </h4>
            {expandedSections.bhk && (
              <div className="flex flex-wrap gap-2">
                {BHK_OPTIONS.map((bhk) => (
                  <button
                    key={bhk}
                    onClick={() => onFilterChange({ bedrooms: filters.bedrooms === bhk ? undefined : bhk })}
                    className={cn(
                      'h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold transition-all border',
                      filters.bedrooms === bhk
                        ? 'bg-navy-900 text-white border-navy-900 shadow-md shadow-navy-900/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-navy-300 hover:bg-slate-50'
                    )}
                  >
                    {bhk}
                    {bhk === 5 ? '+' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Co-working Seat Types */}
        {allowed.includes('seat_type') && (
          <div className="space-y-3">
            <h4
              className="text-xs font-bold text-slate-800 uppercase tracking-wider flex justify-between items-center cursor-pointer"
              onClick={() => toggleSection('coworking')}
            >
              Seat Type{' '}
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', expandedSections.coworking && 'rotate-180')}
              />
            </h4>
            {expandedSections.coworking && (
              <div className="flex flex-wrap gap-2">
                {SEAT_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => onFilterChange({ q: filters.q === type ? undefined : type })}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-bold transition-all border',
                      filters.q === type
                        ? 'bg-navy-900 text-white border-navy-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-navy-300 hover:bg-slate-50'
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Plots / Land Approvals */}
        {allowed.includes('approval') && (
          <div className="space-y-3">
            <h4
              className="text-xs font-bold text-slate-800 uppercase tracking-wider flex justify-between items-center cursor-pointer"
              onClick={() => toggleSection('plots')}
            >
              Approvals & Layout{' '}
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', expandedSections.plots && 'rotate-180')}
              />
            </h4>
            {expandedSections.plots && (
              <div className="flex flex-wrap gap-2">
                {PLOT_APPROVALS.map((approval) => (
                  <button
                    key={approval}
                    onClick={() => onFilterChange({ q: filters.q === approval ? undefined : approval })}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
                      filters.q === approval
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                    )}
                  >
                    {approval}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Area (Sq.ft / Sq.Yards) */}
        {(allowed.includes('built_up_area') || allowed.includes('plot_size')) && (
          <div className="space-y-3">
            <h4
              className="text-xs font-bold text-slate-800 uppercase tracking-wider flex justify-between items-center cursor-pointer"
              onClick={() => toggleSection('area')}
            >
              {allowed.includes('plot_size') ? 'Plot Area (Sq.Yards / Sq.ft)' : 'Area (Sq.ft)'}{' '}
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', expandedSections.area && 'rotate-180')}
              />
            </h4>
            {expandedSections.area && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Min Area"
                  value={filters.min_area || ''}
                  onChange={(e) =>
                    onFilterChange({ min_area: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20"
                />
                <input
                  type="number"
                  placeholder="Max Area"
                  value={filters.max_area || ''}
                  onChange={(e) =>
                    onFilterChange({ max_area: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20"
                />
              </div>
            )}
          </div>
        )}

        {/* Possession Status */}
        {allowed.includes('possession') && (
          <div className="space-y-3">
            <h4
              className="text-xs font-bold text-slate-800 uppercase tracking-wider flex justify-between items-center cursor-pointer"
              onClick={() => toggleSection('possession')}
            >
              Possession{' '}
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', expandedSections.possession && 'rotate-180')}
              />
            </h4>
            {expandedSections.possession && (
              <div className="flex flex-col gap-2">
                {POSSESSION_STATUSES.map((status) => (
                  <label key={status} className="flex items-center gap-3 cursor-pointer group">
                    <div
                      className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center transition-all',
                        filters.possession_status === status
                          ? 'bg-red-600 border-red-600'
                          : 'border-slate-300 group-hover:border-red-400 bg-white'
                      )}
                    >
                      {filters.possession_status === status && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-slate-700">{status}</span>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={filters.possession_status === status}
                      onChange={() =>
                        onFilterChange({
                          possession_status: filters.possession_status === status ? undefined : status,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Furnishing */}
        {allowed.includes('furnishing') && (
          <div className="space-y-3">
            <h4
              className="text-xs font-bold text-slate-800 uppercase tracking-wider flex justify-between items-center cursor-pointer"
              onClick={() => toggleSection('furnishing')}
            >
              Furnishing{' '}
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', expandedSections.furnishing && 'rotate-180')}
              />
            </h4>
            {expandedSections.furnishing && (
              <div className="flex flex-wrap gap-2">
                {FURNISHING_OPTIONS.map((f) => (
                  <button
                    key={f}
                    onClick={() => onFilterChange({ furnishing: filters.furnishing === f ? undefined : f })}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-bold transition-all border',
                      filters.furnishing === f
                        ? 'bg-navy-900 text-white border-navy-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-navy-300 hover:bg-slate-50'
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Facing */}
        {allowed.includes('facing') && (
          <div className="space-y-3">
            <h4
              className="text-xs font-bold text-slate-800 uppercase tracking-wider flex justify-between items-center cursor-pointer"
              onClick={() => toggleSection('facing')}
            >
              Facing{' '}
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', expandedSections.facing && 'rotate-180')}
              />
            </h4>
            {expandedSections.facing && (
              <div className="flex flex-wrap gap-2">
                {FACING_OPTIONS.map((face) => (
                  <button
                    key={face}
                    onClick={() => onFilterChange({ facing: filters.facing === face ? undefined : face })}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-bold transition-all border',
                      filters.facing === face
                        ? 'bg-navy-900 text-white border-navy-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-navy-300 hover:bg-slate-50'
                    )}
                  >
                    {face}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Amenities */}
        {allowed.includes('amenities') && (
          <div className="space-y-3">
            <h4
              className="text-xs font-bold text-slate-800 uppercase tracking-wider flex justify-between items-center cursor-pointer"
              onClick={() => toggleSection('amenities')}
            >
              Amenities{' '}
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', expandedSections.amenities && 'rotate-180')}
              />
            </h4>
            {expandedSections.amenities && (
              <div className="flex flex-wrap gap-2">
                {AMENITIES.map((amenity) => {
                  const isSelected = (filters.amenities || []).some((a) => isSameAmenity(a, amenity));
                  return (
                    <button
                      key={amenity}
                      type="button"
                      onClick={() => handleAmenityChange(amenity)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border flex items-center gap-1.5 cursor-pointer',
                        isSelected
                          ? 'bg-red-50 text-red-700 border-red-300 shadow-sm ring-1 ring-red-500/30 font-extrabold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 text-red-600 stroke-[3]" />}
                      {amenity}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
