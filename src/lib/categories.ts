import {
  Building,
  Home,
  Store,
  Warehouse,
  LandPlot,
  Users,
  Briefcase,
  Layers,
  LucideIcon,
} from 'lucide-react';

export type CategorySlug =
  | 'apartment'
  | 'villa'
  | 'independent-house'
  | 'commercial-office'
  | 'retail-shop'
  | 'warehouse'
  | 'plots'
  | 'co-working';

export interface CategoryMeta {
  id: CategorySlug;
  slug: CategorySlug;
  name: string;
  pluralName: string;
  icon: LucideIcon;
  color: string;
  description: string;
  matchingKeywords: string[];
  dbCategory?: 'Residential' | 'Commercial' | 'Plot' | 'Luxury';
  allowedFilters: (
    | 'bhk'
    | 'price'
    | 'built_up_area'
    | 'plot_area'
    | 'bathrooms'
    | 'furnishing'
    | 'floor'
    | 'total_floors'
    | 'parking'
    | 'facing'
    | 'possession'
    | 'amenities'
    | 'plot_size'
    | 'road_width'
    | 'corner_plot'
    | 'gated_layout'
    | 'approval'
    | 'washrooms'
    | 'conference_room'
    | 'power_backup'
    | 'lift'
    | 'frontage'
    | 'ceiling_height'
    | 'truck_access'
    | 'seat_type'
    | 'internet'
  )[];
}

export const CANONICAL_CATEGORIES: Record<CategorySlug, CategoryMeta> = {
  apartment: {
    id: 'apartment',
    slug: 'apartment',
    name: 'Apartment',
    pluralName: 'Apartments',
    icon: Building,
    color: 'bg-[#fff0f3] text-[#e11d48] border border-red-100/80 group-hover:bg-[#e11d48] group-hover:text-white',
    description: 'Residential flats, multi-storey apartments, penthouses, and builder floors',
    matchingKeywords: ['Apartment', 'Flat', 'Builder Floor', 'Studio', 'Penthouse', 'Residential Apartment'],
    dbCategory: 'Residential',
    allowedFilters: [
      'bhk',
      'price',
      'built_up_area',
      'bathrooms',
      'furnishing',
      'floor',
      'parking',
      'facing',
      'possession',
      'amenities',
    ],
  },
  villa: {
    id: 'villa',
    slug: 'villa',
    name: 'Villa',
    pluralName: 'Villas',
    icon: Home,
    color: 'bg-[#fff0f3] text-[#e11d48] border border-red-100/80 group-hover:bg-[#e11d48] group-hover:text-white',
    description: 'Luxury standalone villas, gated community villas, bungalows, and duplexes',
    matchingKeywords: ['Villa', 'Bungalow', 'Duplex', 'Luxury Villa'],
    dbCategory: 'Residential',
    allowedFilters: [
      'bhk',
      'price',
      'built_up_area',
      'plot_area',
      'bathrooms',
      'parking',
      'furnishing',
      'facing',
      'possession',
      'amenities',
    ],
  },
  'independent-house': {
    id: 'independent-house',
    slug: 'independent-house',
    name: 'Independent House',
    pluralName: 'Independent Houses',
    icon: Layers,
    color: 'bg-[#fff0f3] text-[#e11d48] border border-red-100/80 group-hover:bg-[#e11d48] group-hover:text-white',
    description: 'Individual houses, row houses, and independent residential buildings',
    matchingKeywords: ['Independent House', 'House', 'Row House', 'Individual House'],
    dbCategory: 'Residential',
    allowedFilters: [
      'bhk',
      'price',
      'built_up_area',
      'plot_area',
      'bathrooms',
      'parking',
      'furnishing',
      'facing',
      'possession',
      'amenities',
    ],
  },
  'commercial-office': {
    id: 'commercial-office',
    slug: 'commercial-office',
    name: 'Commercial Office',
    pluralName: 'Commercial Offices',
    icon: Briefcase,
    color: 'bg-[#fff0f3] text-[#e11d48] border border-red-100/80 group-hover:bg-[#e11d48] group-hover:text-white',
    description: 'Office spaces, corporate suites, IT parks, and commercial towers',
    matchingKeywords: ['Office Space', 'Office', 'Commercial Office', 'IT Park', 'Business Center', 'Commercial Space'],
    dbCategory: 'Commercial',
    allowedFilters: [
      'price',
      'built_up_area',
      'floor',
      'parking',
      'furnishing',
      'washrooms',
      'conference_room',
      'power_backup',
      'lift',
      'amenities',
    ],
  },
  'retail-shop': {
    id: 'retail-shop',
    slug: 'retail-shop',
    name: 'Retail Shop',
    pluralName: 'Retail Shops',
    icon: Store,
    color: 'bg-[#fff0f3] text-[#e11d48] border border-red-100/80 group-hover:bg-[#e11d48] group-hover:text-white',
    description: 'Retail stores, commercial shops, showrooms, and shopping complex spaces',
    matchingKeywords: ['Shop', 'Retail', 'Showroom', 'Commercial Shop', 'Retail Shop'],
    dbCategory: 'Commercial',
    allowedFilters: [
      'price',
      'built_up_area',
      'floor',
      'parking',
      'frontage',
      'washrooms',
      'furnishing',
      'amenities',
    ],
  },
  warehouse: {
    id: 'warehouse',
    slug: 'warehouse',
    name: 'Warehouse',
    pluralName: 'Warehouses',
    icon: Warehouse,
    color: 'bg-[#fff0f3] text-[#e11d48] border border-red-100/80 group-hover:bg-[#e11d48] group-hover:text-white',
    description: 'Industrial storage, godowns, logistics facilities, and cold storages',
    matchingKeywords: ['Warehouse', 'Godown', 'Industrial Shed', 'Cold Storage'],
    dbCategory: 'Commercial',
    allowedFilters: [
      'price',
      'built_up_area',
      'plot_area',
      'ceiling_height',
      'truck_access',
      'parking',
      'power_backup',
    ],
  },
  plots: {
    id: 'plots',
    slug: 'plots',
    name: 'Plots',
    pluralName: 'Plots & Land',
    icon: LandPlot,
    color: 'bg-[#fff0f3] text-[#e11d48] border border-red-100/80 group-hover:bg-[#e11d48] group-hover:text-white',
    description: 'Open plots, residential layouts, commercial land, and farm land',
    matchingKeywords: ['Plot', 'Land', 'Open Plot', 'Residential Land', 'Commercial Land', 'Farm Land'],
    dbCategory: 'Plot',
    allowedFilters: [
      'plot_size',
      'price',
      'facing',
      'road_width',
      'corner_plot',
      'gated_layout',
      'approval',
    ],
  },
  'co-working': {
    id: 'co-working',
    slug: 'co-working',
    name: 'Co-working',
    pluralName: 'Co-working Spaces',
    icon: Users,
    color: 'bg-[#fff0f3] text-[#e11d48] border border-red-100/80 group-hover:bg-[#e11d48] group-hover:text-white',
    description: 'Shared offices, hot desks, dedicated desks, private cabins, and PG/coliving',
    matchingKeywords: ['Co-working', 'Coworking', 'PG', 'Co-Living', 'Hostel', 'Shared Office', 'PG / Co-Living'],
    dbCategory: 'Commercial',
    allowedFilters: [
      'price',
      'seat_type',
      'internet',
      'power_backup',
      'conference_room',
      'parking',
      'amenities',
    ],
  },
};

export const CATEGORY_LIST: CategoryMeta[] = Object.values(CANONICAL_CATEGORIES);

/**
 * Normalizes any category or type input into a canonical CategorySlug or null.
 */
export function normalizeCategorySlug(raw?: string | null): CategorySlug | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '-');

  if (
    s === 'apartment' ||
    s === 'apartments' ||
    s === 'apartmnt' ||
    s === 'apartmnts' ||
    s === 'appartment' ||
    s === 'appartments' ||
    s === 'flat' ||
    s === 'flats' ||
    s === 'builder-floor' ||
    s === 'studio' ||
    s === 'penthouse' ||
    s === 'residential-apartment' ||
    s === 'residential'
  ) {
    return 'apartment';
  }
  if (
    s === 'villa' ||
    s === 'villas' ||
    s === 'vila' ||
    s === 'vilas' ||
    s === 'bungalow' ||
    s === 'bungalows' ||
    s === 'duplex' ||
    s === 'triplex' ||
    s === 'luxury-villa' ||
    s === 'gated-villa'
  ) {
    return 'villa';
  }
  if (
    s === 'independent-house' ||
    s === 'independenthouse' ||
    s === 'house' ||
    s === 'houses' ||
    s === 'row-house' ||
    s === 'row-houses' ||
    s === 'individual-house' ||
    s === 'kothi' ||
    s === 'haveli'
  ) {
    return 'independent-house';
  }
  if (
    s === 'commercial-office' ||
    s === 'commercialoffice' ||
    s === 'office' ||
    s === 'offices' ||
    s === 'office-space' ||
    s === 'commercial-space' ||
    s === 'it-park' ||
    s === 'business-center' ||
    s === 'commercial'
  ) {
    return 'commercial-office';
  }
  if (
    s === 'retail-shop' ||
    s === 'retailshop' ||
    s === 'shop' ||
    s === 'shops' ||
    s === 'retail' ||
    s === 'showroom' ||
    s === 'showrooms' ||
    s === 'commercial-shop'
  ) {
    return 'retail-shop';
  }
  if (
    s === 'warehouse' ||
    s === 'warehouses' ||
    s === 'godown' ||
    s === 'godowns' ||
    s === 'industrial-shed' ||
    s === 'cold-storage'
  ) {
    return 'warehouse';
  }
  if (
    s === 'plots' ||
    s === 'plot' ||
    s === 'land' ||
    s === 'lands' ||
    s === 'open-plot' ||
    s === 'open-plots' ||
    s === 'residential-plot' ||
    s === 'residential-plots' ||
    s === 'commercial-plot' ||
    s === 'farm-land' ||
    s === 'farm-plot'
  ) {
    return 'plots';
  }
  if (
    s === 'co-working' ||
    s === 'coworking' ||
    s === 'pg' ||
    s === 'coliving' ||
    s === 'co-living' ||
    s === 'hostel' ||
    s === 'shared-office' ||
    s === 'pg-/-co-living'
  ) {
    return 'co-working';
  }

  return null;
}

/**
 * Returns CategoryMeta for a given input or null.
 */
export function getCategoryMeta(raw?: string | null): CategoryMeta | null {
  const slug = normalizeCategorySlug(raw);
  return slug ? CANONICAL_CATEGORIES[slug] : null;
}

/**
 * Categorizes a property record into one of the 8 canonical CategorySlugs
 * by inspecting all metadata signals (type name, category, title, description, purpose).
 */
export function categorizeProperty(property: {
  property_type_name?: string | null;
  property_type_category?: string | null;
  listing_category?: string | null;
  property_sub_type?: string | null;
  title?: string | null;
  description?: string | null;
  purpose?: string | null;
  plot_details?: any;
}): CategorySlug | null {
  const name = (property.property_type_name || '').trim();
  const cat = (property.property_type_category || property.listing_category || '').trim();
  const subType = (property.property_sub_type || '').trim();
  const title = (property.title || '').trim();
  const desc = (property.description || '').trim();
  const purp = (property.purpose || '').trim();

  const lowerName = name.toLowerCase();
  const lowerCat = cat.toLowerCase();
  const lowerSubType = subType.toLowerCase();
  const lowerPurp = purp.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerDesc = desc.toLowerCase();

  const primarySignals = `${lowerName} ${lowerCat} ${lowerSubType}`.trim();
  const allSignals = `${primarySignals} ${lowerTitle} ${lowerDesc}`.trim();

  // 1. Direct Slug Normalization on explicit type fields
  const directSlug = normalizeCategorySlug(name) || normalizeCategorySlug(subType);
  if (directSlug) return directSlug;

  // 2. Co-working / PG
  if (
    lowerPurp === 'pg' ||
    lowerPurp === 'coliving' ||
    lowerPurp === 'co-living' ||
    lowerPurp === 'hostel' ||
    /co-?working|pg\b|coliving|hostel|shared\s*office/.test(primarySignals) ||
    /co-?working|coliving|shared\s*office/.test(lowerTitle)
  ) {
    if (!/villa|plot|land|warehouse/.test(primarySignals)) {
      return 'co-working';
    }
  }

  // 3. Plots & Land
  if (
    lowerCat === 'plot' ||
    property.plot_details != null ||
    /\b(open\s*plots?|residential\s*plots?|commercial\s*plots?|farm\s*lands?|plots?|lands?|guntas?|sq\.?\s*yds?|acres?)\b/i.test(primarySignals) ||
    (/\b(open\s*plots?|residential\s*plots?|commercial\s*plots?|farm\s*lands?|plots?|acres?)\b/i.test(lowerTitle) &&
      !/\b(apartment|flat|flats|villa|villas|house|building|floor)\b/i.test(lowerTitle))
  ) {
    return 'plots';
  }

  // 4. Villa / Duplex / Bungalow
  if (
    /\b(villas?|vilas?|bungalows?|duplex|triplex|luxury\s*villa|gated\s*villa)\b/i.test(primarySignals) ||
    /\b(villas?|vilas?|bungalows?|duplex\s*villa|luxury\s*villa|gated\s*villa)\b/i.test(lowerTitle)
  ) {
    return 'villa';
  }

  // 5. Independent House / Row House / Individual House
  if (
    /\b(independent\s*houses?|row\s*houses?|individual\s*houses?|kothi|haveli|houses?|g\+1|g\+2|g\+3)\b/i.test(primarySignals) ||
    /\b(independent\s*houses?|individual\s*houses?|row\s*houses?)\b/i.test(lowerTitle)
  ) {
    return 'independent-house';
  }

  // 6. Warehouse / Godown / Industrial
  if (
    /\b(warehouses?|godowns?|industrial\s*sheds?|cold\s*storages?)\b/i.test(primarySignals) ||
    /\b(warehouses?|godowns?|industrial\s*shed)\b/i.test(lowerTitle)
  ) {
    return 'warehouse';
  }

  // 7. Retail Shop / Showroom
  if (
    /\b(shops?|retails?|showrooms?|commercial\s*shops?)\b/i.test(primarySignals) ||
    /\b(retail\s*shops?|showrooms?|commercial\s*shop)\b/i.test(lowerTitle)
  ) {
    return 'retail-shop';
  }

  // 8. Commercial Office
  if (
    lowerCat === 'commercial' ||
    /\b(commercial\s*offices?|offices?|commercial\s*spaces?|it\s*parks?|business\s*centers?)\b/i.test(primarySignals) ||
    /\b(commercial\s*offices?|office\s*space|it\s*park|business\s*center)\b/i.test(lowerTitle)
  ) {
    return 'commercial-office';
  }

  // 9. Apartment / Flat / Studio / Penthouse
  if (
    /\b(apartments?|flats?|builder\s*floors?|studios?|penthouses?|\d\s*bhk)\b/i.test(primarySignals) ||
    /\b(apartments?|flats?|penthouses?|studios?|\d\s*bhk)\b/i.test(lowerTitle)
  ) {
    return 'apartment';
  }

  // 10. Secondary Title Fallback
  if (/\b(villas?|vilas?|bungalows?)\b/i.test(lowerTitle)) return 'villa';
  if (/\b(plots?|lands?)\b/i.test(lowerTitle)) return 'plots';
  if (/\b(houses?)\b/i.test(lowerTitle)) return 'independent-house';
  if (/\b(apartments?|flats?)\b/i.test(lowerTitle)) return 'apartment';
  if (/\b(offices?)\b/i.test(lowerTitle)) return 'commercial-office';
  if (/\b(shops?)\b/i.test(lowerTitle)) return 'retail-shop';

  // 11. Category Default
  if (lowerCat === 'residential') return 'apartment';
  if (lowerCat === 'commercial') return 'commercial-office';
  if (lowerCat === 'plot') return 'plots';

  return normalizeCategorySlug(name) || normalizeCategorySlug(subType) || null;
}
