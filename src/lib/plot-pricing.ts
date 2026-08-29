// Single source of truth for the Open Plot / Land unit-based pricing:
// which units exist, their display labels, and the total-price formula.
// Reused by the wizard, property cards, property detail, search, and admin/agent
// views so the unit → label mapping and the area × rate math never drift
// between call sites.

import { formatPrice, formatCompactPrice, getPropertyPrice } from './utils';

export const AREA_UNIT_OPTIONS = ['Sq. Ft', 'Sq. Yd', 'Acres', 'Guntas'] as const;
export type AreaUnitOption = (typeof AREA_UNIT_OPTIONS)[number];

// Standardized mapping: code -> display string ('Sq. Ft', 'Sq. Yd', 'Acre', 'Gunta')
export type AreaUnitCode = 'sqft' | 'sqyd' | 'acre' | 'gunta';

const CODE_TO_LABEL: Record<AreaUnitCode, string> = {
  sqft: 'Sq. Ft',
  sqyd: 'Sq. Yd',
  acre: 'Acre',
  gunta: 'Gunta',
};

const CODE_TO_SINGULAR: Record<AreaUnitCode, string> = {
  sqft: 'Sq. Ft',
  sqyd: 'Sq. Yd',
  acre: 'Acre',
  gunta: 'Gunta',
};

/** Normalizes any incoming unit representation (string, code, legacy display) into a canonical code */
export function normalizeAreaUnit(unit: string | null | undefined): AreaUnitCode | null {
  if (!unit) return null;
  const clean = String(unit).trim().toLowerCase().replace(/[^a-z]/g, '');
  if (['sqft', 'sqfeet', 'squarefeet', 'squarefoot', 'sqfoot', 'sft', 'sqf'].includes(clean)) return 'sqft';
  if (['sqyd', 'sqyard', 'sqyards', 'squareyards', 'squareyard', 'syd', 'yard', 'yards'].includes(clean)) return 'sqyd';
  if (['acre', 'acres', 'ac'].includes(clean)) return 'acre';
  if (['gunta', 'guntas', 'guntha', 'gunthas', 'gts'].includes(clean)) return 'gunta';
  return null;
}

/** Converts any display unit or string to normalized storage code (e.g. 'Sq. Ft' -> 'sqft', 'Sq. Yards' -> 'sqyd') */
export function toAreaUnitCode(displayUnit: string | null | undefined): AreaUnitCode | null {
  return normalizeAreaUnit(displayUnit);
}

/** Converts stored code ('sqft', 'sqyd') to UI display label ('Sq. Ft', 'Sq. Yd') */
export function fromAreaUnitCode(code: string | null | undefined): string {
  const norm = normalizeAreaUnit(code);
  return norm ? CODE_TO_LABEL[norm] : (code || '');
}

/** Returns the display unit label (e.g. 'Sq. Ft', 'Sq. Yd') */
export function getAreaUnitDisplay(unit: string | null | undefined): string {
  const norm = normalizeAreaUnit(unit);
  return norm ? CODE_TO_LABEL[norm] : (unit || 'Sq. Ft');
}

/** 'Sq. Yards' or 'sqyd' -> 'Sq. Yd' (for "Price Per ___" labels and / Sq. Ft suffix) */
export function getPriceUnitLabel(areaUnitOrCode: string | null | undefined): string {
  const norm = normalizeAreaUnit(areaUnitOrCode);
  return norm ? CODE_TO_SINGULAR[norm] : (areaUnitOrCode || 'Unit');
}

// ─── Land Measurement & Unit Conversion Constants ─────────────────────────
export const SQFT_PER_ACRE = 43560;
export const SQYD_PER_ACRE = 4840;
export const GUNTAS_PER_ACRE = 40;
export const SQFT_PER_GUNTA = 1089;
export const SQYD_PER_GUNTA = 121;
export const SQFT_PER_SQYD = 9;

export interface LandAreaEquivalents {
  acres: number;
  sqft: number;
  sqyd: number;
  guntas: number;
  acresFormatted: string;
  sqftFormatted: string;
  sqydFormatted: string;
  guntasFormatted: string;
}

/**
 * Converts any area value from a given unit to base Sq. Ft.
 */
export function toBaseSqFt(value: number, fromUnit: AreaUnitCode | string): number {
  if (!value || isNaN(value) || value <= 0) return 0;
  const norm = normalizeAreaUnit(fromUnit) || 'sqft';
  switch (norm) {
    case 'acre':
      return value * SQFT_PER_ACRE;
    case 'gunta':
      return value * SQFT_PER_GUNTA;
    case 'sqyd':
      return value * SQFT_PER_SQYD;
    case 'sqft':
    default:
      return value;
  }
}

/**
 * Converts a base Sq. Ft area to the target unit (e.g. 'acre', 'gunta', 'sqyd', 'sqft').
 */
export function fromBaseSqFt(sqft: number, targetUnit: AreaUnitCode | string): number {
  if (!sqft || isNaN(sqft) || sqft <= 0) return 0;
  const norm = normalizeAreaUnit(targetUnit) || 'sqft';
  switch (norm) {
    case 'acre':
      return sqft / SQFT_PER_ACRE;
    case 'gunta':
      return sqft / SQFT_PER_GUNTA;
    case 'sqyd':
      return sqft / SQFT_PER_SQYD;
    case 'sqft':
    default:
      return sqft;
  }
}

/**
 * Calculates all 4 standardized unit equivalents (Acres, Sq. Ft, Sq. Yd, Guntas) from a base Sq. Ft value.
 */
export function calculateLandEquivalents(baseSqFt: number): LandAreaEquivalents {
  if (!baseSqFt || isNaN(baseSqFt) || baseSqFt <= 0) {
    return {
      acres: 0,
      sqft: 0,
      sqyd: 0,
      guntas: 0,
      acresFormatted: '0',
      sqftFormatted: '0',
      sqydFormatted: '0',
      guntasFormatted: '0',
    };
  }

  const acres = baseSqFt / SQFT_PER_ACRE;
  const sqft = baseSqFt;
  const sqyd = baseSqFt / SQFT_PER_SQYD;
  const guntas = baseSqFt / SQFT_PER_GUNTA;

  const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });

  return {
    acres: Math.round(acres * 1000) / 1000,
    sqft: Math.round(sqft * 100) / 100,
    sqyd: Math.round(sqyd * 100) / 100,
    guntas: Math.round(guntas * 100) / 100,
    acresFormatted: nf.format(Math.round(acres * 1000) / 1000),
    sqftFormatted: nf.format(Math.round(sqft * 100) / 100),
    sqydFormatted: nf.format(Math.round(sqyd * 100) / 100),
    guntasFormatted: nf.format(Math.round(guntas * 100) / 100),
  };
}

/** Formats a per-unit price exact with Indian numbering (e.g. 2500 -> '₹2,500 / Sq. Ft') */
export function formatLandPrice(
  pricePerUnit: number | null | undefined,
  areaUnit: string | null | undefined,
): string {
  if (pricePerUnit == null || isNaN(Number(pricePerUnit)) || Number(pricePerUnit) <= 0) {
    return '—';
  }
  const unitLabel = getPriceUnitLabel(areaUnit);
  const formattedNum = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(Number(pricePerUnit));

  return `₹${formattedNum} / ${unitLabel}`;
}

const LAND_KEYWORDS = [
  'plot',
  'land',
  'farm land',
  'farmland',
  'agricultural land',
  'open plot',
  'residential plot',
  'commercial plot',
  'villa plot',
  'gated community plot',
  'hmda layout plot',
  'dtcp layout plot',
  'fcda layout plot',
  'fcda layout',
  'residential land',
  'commercial land',
  'industrial land',
  'layout plot',
];

const NON_LAND_EXCLUSIONS = [
  'apartment',
  'flat',
  'independent house',
  'builder floor',
  'penthouse',
  'office space',
  'commercial building',
  'shop',
  'warehouse',
  'commercial space',
  'showroom',
  'pg',
  'coliving',
  'hostel',
];

/**
 * Checks whether a property belongs to a Land/Plot category.
 * Strictly excludes constructed residential & commercial properties.
 */
export function isLandProperty(p: any): boolean {
  if (!p) return false;

  // 1. Direct category checks
  const listingCategory = String(p.listing_category || '').trim().toLowerCase();
  if (listingCategory === 'plot' || listingCategory === 'land') return true;

  const typeCategory = String(p.property_type_category || p.category || '').trim().toLowerCase();
  if (typeCategory === 'plot' || typeCategory === 'land') return true;

  // 2. Check property type / sub-type names
  const typeName = String(p.property_type_name || p.property_sub_type || p.property_type || '').trim().toLowerCase();
  
  // Exclude constructed properties unless they explicitly have 'plot' (e.g., 'Villa Plot')
  const isConstructed = NON_LAND_EXCLUSIONS.some((kw) => typeName.includes(kw));
  if (isConstructed && !typeName.includes('plot') && !typeName.includes('land')) {
    return false;
  }

  if (LAND_KEYWORDS.some((kw) => typeName.includes(kw))) {
    return true;
  }

  // 3. Fallback: check if plot_details is present with land fields
  if (p.plot_details && typeof p.plot_details === 'object') {
    return true;
  }

  // 4. Has price_per_unit > 0 and area_unit configured
  if (p.price_per_unit != null && Number(p.price_per_unit) > 0 && p.area_unit) {
    return true;
  }

  return false;
}

export interface PropertyPricingDisplay {
  isLand: boolean;
  primaryPrice: string;
  primaryPriceNumeric: number | null;
  secondaryPrice?: string;
  unitLabel?: string;
  areaDisplay?: string;
  totalArea?: number | null;
  totalEstimatedPrice?: string;
  totalEstimatedPriceNumeric?: number | null;
  negotiable?: boolean;
}

/**
 * Single source of truth for rendering property pricing across the application.
 * If the property is Land/Plot:
 * - primaryPrice: '₹2,500 / Sq. Ft' or '₹45,000 / Sq. Yd'
 * - totalEstimatedPrice: '₹60,00,000'
 * - areaDisplay: '2,400 Sq. Ft'
 * If constructed:
 * - primaryPrice: '₹75,00,000' (or compact '₹75 L' / '₹25,000/month')
 */
export function getPropertyPricingDisplay(
  p: any,
  options?: { compactConstructed?: boolean },
): PropertyPricingDisplay {
  if (!p) {
    return {
      isLand: false,
      primaryPrice: '—',
      primaryPriceNumeric: null,
    };
  }

  const isLand = isLandProperty(p);

  if (isLand) {
    // Extract rate, unit, area, and total from either top-level columns or plot_details JSON
    const rawRate = p.price_per_unit ?? p.plot_details?.pricePerUnit ?? null;
    const pricePerUnit = rawRate != null && !isNaN(Number(rawRate)) && Number(rawRate) > 0 ? Number(rawRate) : null;

    const rawUnit = p.area_unit ?? p.plot_details?.areaUnit ?? 'sqft';
    const areaUnit = getAreaUnitDisplay(rawUnit);
    const unitLabel = getPriceUnitLabel(rawUnit);

    const rawArea = p.plot_area ?? p.area_sqft ?? p.plot_details?.totalArea ?? null;
    const totalArea = rawArea != null && !isNaN(Number(rawArea)) && Number(rawArea) > 0 ? Number(rawArea) : null;

    const rawTotalPrice = getPropertyPrice(p) ?? p.plot_details?.expectedPrice ?? null;
    let totalPrice = rawTotalPrice != null && !isNaN(Number(rawTotalPrice)) && Number(rawTotalPrice) > 0 ? Number(rawTotalPrice) : null;

    // Auto calculate total if missing but area & unit rate exist
    if (!totalPrice && totalArea && pricePerUnit) {
      totalPrice = Math.round(totalArea * pricePerUnit);
    }

    const areaDisplay = totalArea ? `${new Intl.NumberFormat('en-IN').format(totalArea)} ${areaUnit}` : undefined;
    const totalEstimatedPrice = totalPrice ? `₹${new Intl.NumberFormat('en-IN').format(totalPrice)}` : undefined;

    if (pricePerUnit) {
      return {
        isLand: true,
        primaryPrice: formatLandPrice(pricePerUnit, unitLabel),
        primaryPriceNumeric: pricePerUnit,
        secondaryPrice: totalEstimatedPrice ? `Est. Total: ${totalEstimatedPrice}` : undefined,
        unitLabel,
        areaDisplay,
        totalArea,
        totalEstimatedPrice,
        totalEstimatedPriceNumeric: totalPrice,
        negotiable: true,
      };
    }

    // Fallback if price_per_unit is not yet set (legacy record):
    // If total price and total area are known, we can calculate per-unit rate
    if (totalPrice && totalArea && totalArea > 0) {
      const derivedRate = Math.round((totalPrice / totalArea) * 100) / 100;
      return {
        isLand: true,
        primaryPrice: formatLandPrice(derivedRate, unitLabel),
        primaryPriceNumeric: derivedRate,
        secondaryPrice: totalEstimatedPrice ? `Est. Total: ${totalEstimatedPrice}` : undefined,
        unitLabel,
        areaDisplay,
        totalArea,
        totalEstimatedPrice,
        totalEstimatedPriceNumeric: totalPrice,
        negotiable: true,
      };
    }

    return {
      isLand: true,
      primaryPrice: totalPrice ? `₹${new Intl.NumberFormat('en-IN').format(totalPrice)}` : 'Price on Request',
      primaryPriceNumeric: totalPrice,
      unitLabel,
      areaDisplay,
      totalArea,
      totalEstimatedPrice,
      totalEstimatedPriceNumeric: totalPrice,
      negotiable: true,
    };
  }

  // Constructed properties (Apartment, House, Villa, Office, Commercial, etc.)
  const numericPrice = getPropertyPrice(p);
  const primaryPrice = options?.compactConstructed
    ? formatCompactPrice(numericPrice, p.purpose)
    : formatPrice(numericPrice, p.purpose);

  const builtArea = p.built_up_area || p.carpet_area || p.area_sqft;
  const areaDisplay = builtArea ? `${new Intl.NumberFormat('en-IN').format(builtArea)} sq.ft` : undefined;

  return {
    isLand: false,
    primaryPrice,
    primaryPriceNumeric: numericPrice,
    areaDisplay,
    totalArea: builtArea ? Number(builtArea) : null,
    negotiable: false,
  };
}

export function calculatePlotTotalPrice(totalArea: number, pricePerUnit: number): number {
  if (!(totalArea > 0) || !(pricePerUnit > 0)) return 0;
  return Math.round(totalArea * pricePerUnit * 100) / 100;
}
