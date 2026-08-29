import { describe, it, expect } from 'vitest';
import {
  normalizeAreaUnit,
  getAreaUnitDisplay,
  getPriceUnitLabel,
  toAreaUnitCode,
  isLandProperty,
  formatLandPrice,
  calculatePlotTotalPrice,
  getPropertyPricingDisplay,
  calculateLandEquivalents,
} from './plot-pricing';
import { validateUnitPrice, validatePropertyPrice } from './price-validation';
import type { Property } from './types';

describe('Plot & Land Pricing System', () => {
  describe('Unit Normalization & Display Labels', () => {
    it('normalizes Sq. Ft and sqft accurately', () => {
      expect(normalizeAreaUnit('Sq. Ft')).toBe('sqft');
      expect(normalizeAreaUnit('Sq. Ft.')).toBe('sqft');
      expect(normalizeAreaUnit('sqft')).toBe('sqft');
      expect(normalizeAreaUnit('Square Feet')).toBe('sqft');
      expect(toAreaUnitCode('Sq. Ft')).toBe('sqft');
      expect(getAreaUnitDisplay('sqft')).toBe('Sq. Ft');
      expect(getPriceUnitLabel('sqft')).toBe('Sq. Ft');
    });

    it('normalizes Sq. Yd and sqyd accurately', () => {
      expect(normalizeAreaUnit('Sq. Yd')).toBe('sqyd');
      expect(normalizeAreaUnit('Sq. Yards')).toBe('sqyd');
      expect(normalizeAreaUnit('sqyd')).toBe('sqyd');
      expect(normalizeAreaUnit('Square Yards')).toBe('sqyd');
      expect(toAreaUnitCode('Sq. Yd')).toBe('sqyd');
      expect(getAreaUnitDisplay('sqyd')).toBe('Sq. Yd');
      expect(getPriceUnitLabel('sqyd')).toBe('Sq. Yd');
    });

    it('normalizes Acres and Guntas', () => {
      expect(normalizeAreaUnit('Acres')).toBe('acre');
      expect(normalizeAreaUnit('acre')).toBe('acre');
      expect(normalizeAreaUnit('Guntas')).toBe('gunta');
      expect(normalizeAreaUnit('gunta')).toBe('gunta');
    });
  });

  describe('isLandProperty Detection', () => {
    it('identifies land properties by listing_category', () => {
      expect(isLandProperty({ listing_category: 'Plot' })).toBe(true);
      expect(isLandProperty({ listing_category: 'Land' })).toBe(true);
    });

    it('identifies land properties by property_sub_type', () => {
      expect(isLandProperty({ property_sub_type: 'Open Plot' })).toBe(true);
      expect(isLandProperty({ property_sub_type: 'Residential Plot' })).toBe(true);
      expect(isLandProperty({ property_sub_type: 'Commercial Plot' })).toBe(true);
      expect(isLandProperty({ property_sub_type: 'Agricultural Land' })).toBe(true);
      expect(isLandProperty({ property_sub_type: 'Farm Land' })).toBe(true);
    });

    it('identifies land properties by property_type_name', () => {
      expect(isLandProperty({ property_type_name: 'Plot' })).toBe(true);
      expect(isLandProperty({ property_type_name: 'Land' })).toBe(true);
    });

    it('identifies land properties by plot_details presence', () => {
      expect(isLandProperty({ plot_details: { area_unit: 'sqyd' } })).toBe(true);
    });

    it('identifies land properties by price_per_unit and area_unit', () => {
      expect(isLandProperty({ price_per_unit: 2500, area_unit: 'sqft' })).toBe(true);
    });

    it('strictly excludes constructed categories', () => {
      expect(isLandProperty({ listing_category: 'Residential', property_type_name: 'Apartment' })).toBe(false);
      expect(isLandProperty({ listing_category: 'Residential', property_type_name: 'Flat' })).toBe(false);
      expect(isLandProperty({ listing_category: 'Residential', property_type_name: 'Villa' })).toBe(false);
      expect(isLandProperty({ listing_category: 'Residential', property_type_name: 'Independent House' })).toBe(false);
      expect(isLandProperty({ listing_category: 'Commercial', property_type_name: 'Office Space' })).toBe(false);
      expect(isLandProperty({ listing_category: 'Commercial', property_type_name: 'Shop' })).toBe(false);
      expect(isLandProperty({ listing_category: 'Commercial', property_type_name: 'Warehouse' })).toBe(false);
    });
  });

  describe('formatLandPrice & Total Calculations', () => {
    it('formats price per Sq. Ft properly with full comma formatting', () => {
      expect(formatLandPrice(2500, 'Sq. Ft')).toBe('₹2,500 / Sq. Ft');
      expect(formatLandPrice(2500, 'sqft')).toBe('₹2,500 / Sq. Ft');
    });

    it('formats price per Sq. Yd properly with full comma formatting', () => {
      expect(formatLandPrice(45000, 'Sq. Yd')).toBe('₹45,000 / Sq. Yd');
      expect(formatLandPrice(45000, 'sqyd')).toBe('₹45,000 / Sq. Yd');
    });

    it('calculates total plot price accurately', () => {
      expect(calculatePlotTotalPrice(2400, 2500)).toBe(6000000);
      expect(calculatePlotTotalPrice(300, 45000)).toBe(13500000);
      expect(calculatePlotTotalPrice(0, 45000)).toBe(0);
      expect(calculatePlotTotalPrice(300, 0)).toBe(0);
    });
  });

  describe('getPropertyPricingDisplay', () => {
    it('renders per-unit price as primary for land in Sq. Ft scenario', () => {
      const property: Partial<Property> = {
        id: 'prop-plot-sqft',
        title: 'Open Plot in Hyderabad',
        listing_category: 'Plot',
        property_sub_type: 'Open Plot',
        plot_area: 2400,
        area_unit: 'sqft',
        price_per_unit: 2500,
        price: 6000000,
        purpose: 'Sale',
      };

      const pricing = getPropertyPricingDisplay(property);
      expect(pricing.isLand).toBe(true);
      expect(pricing.primaryPrice).toBe('₹2,500 / Sq. Ft');
      expect(pricing.unitLabel).toBe('Sq. Ft');
      expect(pricing.totalEstimatedPrice).toBe('₹60,00,000');
      expect(pricing.areaDisplay).toBe('2,400 Sq. Ft');
      expect(pricing.totalArea).toBe(2400);
    });

    it('renders per-unit price as primary for land in Sq. Yd scenario', () => {
      const property: Partial<Property> = {
        id: 'prop-plot-sqyd',
        title: 'Residential Plot in Kamkole',
        listing_category: 'Plot',
        property_sub_type: 'Residential Plot',
        plot_area: 300,
        area_unit: 'sqyd',
        price_per_unit: 45000,
        price: 13500000,
        purpose: 'Sale',
      };

      const pricing = getPropertyPricingDisplay(property);
      expect(pricing.isLand).toBe(true);
      expect(pricing.primaryPrice).toBe('₹45,000 / Sq. Yd');
      expect(pricing.unitLabel).toBe('Sq. Yd');
      expect(pricing.totalEstimatedPrice).toBe('₹1,35,00,000');
      expect(pricing.areaDisplay).toBe('300 Sq. Yd');
      expect(pricing.totalArea).toBe(300);
    });

    it('retains standard total price for constructed properties', () => {
      const property: Partial<Property> = {
        id: 'prop-apartment',
        title: '3BHK Apartment in Hitec City',
        listing_category: 'Residential',
        property_type_name: 'Apartment',
        property_sub_type: 'Apartment',
        built_up_area: 1850,
        price: 15000000,
        purpose: 'Sale',
      };

      const pricing = getPropertyPricingDisplay(property);
      expect(pricing.isLand).toBe(false);
      expect(pricing.primaryPrice).toBe('₹1,50,00,000');
      expect(pricing.areaDisplay).toBe('1,850 sq.ft');
    });

    it('retains compact pricing when requested for constructed cards', () => {
      const property: Partial<Property> = {
        id: 'prop-apartment',
        title: '3BHK Apartment in Hitec City',
        listing_category: 'Residential',
        property_type_name: 'Apartment',
        built_up_area: 1850,
        price: 15000000,
        purpose: 'Sale',
      };

      const pricing = getPropertyPricingDisplay(property, { compactConstructed: true });
      expect(pricing.isLand).toBe(false);
      expect(pricing.primaryPrice).toBe('₹1.5 Cr');
    });
  });

  describe('Validation Rules', () => {
    it('validates minimum price per unit for land properties', () => {
      expect(validateUnitPrice('', 'Sq. Ft')).toBe('Please enter the price per Sq. Ft.');
      expect(validateUnitPrice('50', 'Sq. Ft')).toBe('Minimum price per Sq. Ft must be ₹1,000.');
      expect(validateUnitPrice('2500', 'Sq. Ft')).toBeNull();
      expect(validateUnitPrice('45000', 'Sq. Yd')).toBeNull();
    });

    it('validates property total price for constructed properties', () => {
      expect(validatePropertyPrice('')).toBe('Please enter the property price.');
      expect(validatePropertyPrice('50')).toBe('Minimum property price must be ₹1,000.');
      expect(validatePropertyPrice('6000000')).toBeNull();
    });
  });

  describe('Land Conversion & Equivalent Calculations', () => {
    it('accurately converts 1 Acre into standard units', () => {
      const eq = calculateLandEquivalents(43560);
      expect(eq.acres).toBe(1);
      expect(eq.sqft).toBe(43560);
      expect(eq.sqyd).toBe(4840);
      expect(eq.guntas).toBe(40);
    });

    it('accurately calculates 2 Acres equivalents', () => {
      const eq = calculateLandEquivalents(2 * 43560);
      expect(eq.acres).toBe(2);
      expect(eq.sqft).toBe(87120);
      expect(eq.sqyd).toBe(9680);
      expect(eq.guntas).toBe(80);
    });

    it('calculates Example 1: 2 Acres @ ₹4,500 per Gunta -> ₹3,60,000', () => {
      const eq = calculateLandEquivalents(2 * 43560);
      const totalCost = Math.round(eq.guntas * 4500);
      expect(totalCost).toBe(360000);
    });

    it('calculates Example 2: 2 Acres @ ₹100 per Sq. Ft -> ₹87,12,000', () => {
      const eq = calculateLandEquivalents(2 * 43560);
      const totalCost = Math.round(eq.sqft * 100);
      expect(totalCost).toBe(8712000);
    });

    it('calculates Example 3: 2 Acres @ ₹1,000 per Sq. Yd -> ₹96,80,000', () => {
      const eq = calculateLandEquivalents(2 * 43560);
      const totalCost = Math.round(eq.sqyd * 1000);
      expect(totalCost).toBe(9680000);
    });

    it('calculates Example 4: 2 Acres @ ₹10,00,000 per Acre -> ₹20,00,000', () => {
      const eq = calculateLandEquivalents(2 * 43560);
      const totalCost = Math.round(eq.acres * 1000000);
      expect(totalCost).toBe(2000000);
    });

    it('calculates dimensions 200 ft × 435.6 ft -> 87,120 Sq. Ft (2 Acres)', () => {
      const sqft = 200 * 435.6;
      const eq = calculateLandEquivalents(sqft);
      expect(eq.sqft).toBe(87120);
      expect(eq.acres).toBe(2);
      expect(eq.sqyd).toBe(9680);
      expect(eq.guntas).toBe(80);
    });
  });
});
